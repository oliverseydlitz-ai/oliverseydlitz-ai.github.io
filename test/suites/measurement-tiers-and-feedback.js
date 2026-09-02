const M=require('../harness.js').load();
let fail=0; const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c)fail++;};
const near=(a,b,t=0.02)=>Math.abs(a-b)<=t;
const H='Club Type,Ball Speed,Club Speed,Smash Factor,Launch Angle,Launch Direction,Carry Distance,Side Carry,Attack Angle,Club Path,Spin Axis,Spin Rate';
const mk=(n,row)=>{const r=[H];for(let i=0;i<n;i++)r.push(row);return M.CSVParser.parse(r.join('\n'));};

console.log('— §2.1 face-contribution ratio R —');
// R now interpolates piecewise THROUGH the measured anchors, so a tour driver
// lands exactly on 0.84 rather than near a straight-line approximation of it.
ok(near(M.faceRatio({clubType:'d',launchAngle:10.9,attackAngle:-1.3}),0.84,0.001),
   'tour driver sits exactly on its measured anchor 0.84 (PING 2020 / TrackMan)');
ok(Math.abs(M.faceRatio('pw')-0.71)<1e-9 && M.faceRatio('pw') < M.faceRatio('7i'),
   `PW 0.71 < 7i ${M.faceRatio('7i').toFixed(3)} (R falls with loft)`);
ok(M.faceRatio('7i') < M.faceRatio('d'), 'path contributes more as loft rises');

console.log('— §1.7 trust tiers gate prescriptions —');
ok(M.Metrics.tier('spinRate')===3 && M.Metrics.tier('spinAxis')===3, 'spin metrics are tier 3');
ok(M.Metrics.tier('sideCarry')===3 && M.Metrics.tier('launchDirection')===3, 'modelled/unreliable are tier 3');
ok(M.Metrics.canPrescribe('smashFactor') && !M.Metrics.canPrescribe('spinRate'), 'only tier 1 may prescribe');

console.log('— §9 banned claims are gone —');
const spinShots=mk(20,'d,150,110,1.30,12,1,225,5,-4.5,-3.0,18,4200');
const sf=M.FaultEngine.detectFaults(spinShots);
ok(!sf.some(f=>/spin/i.test(f.name)&&/excessive/i.test(f.name)), '§9.7 no spin-rate prescription fires even at 4200rpm');
const aoa=sf.find(f=>f.id==='driver-negative-aa');
ok(!aoa || !/15–25 yards|\+3 yards per degree/.test(aoa.description), '§9.12 no yards-per-degree claim');

console.log('— §1 ShotScorer scores only trustworthy metrics —');
const base={clubType:'7i',smashFactor:1.38,launchAngle:17,attackAngle:-3.6,clubPath:0.4};
const s1=M.ShotScorer.score({...base,sideCarry:2,spinAxis:3});
const s2=M.ShotScorer.score({...base,sideCarry:40,spinAxis:35});
ok(s1===s2, `wildly different side carry / spin axis cannot move the score (${s1} = ${s2})`);
ok(M.ShotScorer.score({...base,smashFactor:1.10}) < s1, 'smash factor still moves it');

console.log('— §1.4 sample gates —');
ok(M.Metrics.MIN_SHOTS_REPORT===10, 'no club mean below 10 shots');
const few=M.FaultEngine.detectFaults(mk(8,'7i,105,92,1.14,29,1,140,3,-1.0,0.4,4,9500'));
ok(few.length===0, '8 shots reports nothing (was 4-shot floor)');
const enough=M.FaultEngine.detectFaults(mk(16,'7i,105,92,1.14,29,1,140,3,-1.0,0.4,4,9500'));
ok(enough.length>0, '16 shots does report');
ok(near(M.Metrics.mdc('clubSpeed',10),2.0,0.01) && M.Metrics.mdc('clubSpeed',20)<2.0, 'MDC shrinks with n');
ok(M.Metrics.DEVICE_ERROR===0, 'device error treated as zero — not carried as a separate term');
const sp=M.Metrics.shotSpread(mk(12,'7i,120,92,1.38,17,3,175,3,-3.6,0.4,4,6300')
  .map((s,i)=>({...s,launchDirection:3+((i%5)-2)})),'facePath','7i');
ok(sp!==null && sp>0, `uncertainty comes from the golfer's own spread instead (${sp && sp.toFixed(2)}°)`);
ok(M.Metrics.shotSpread([],'facePath','7i')===null, 'and is null when there is no data to measure it from');

console.log('— §1.4 outlier trimming and intervals —');
const t=M.Metrics.trimOutliers([100,101,99,102,100,147,0]);
ok(t.dropped===2 && t.kept.length===5, `the 147 and the 0 misreads are trimmed (dropped ${t.dropped})`);
const iv=M.Metrics.interval([100,101,99,102,100],' mph',1);
ok(/±/.test(iv.text)&&/5 shots/.test(iv.text), `reports an interval not a point: "${iv.text}"`);

console.log('— §1.4 per-user typical error —');
const sess=n=>({shots:Array.from({length:12},()=>({clubType:'d',clubSpeed:100+Math.random()*2}))});
const few2=M.Metrics.typicalError([sess(),sess()],'clubSpeed','d');
ok(few2.source==='population', 'falls back to population defaults under 3 sessions');
const many=M.Metrics.typicalError([sess(),sess(),sess(),sess(),sess()],'clubSpeed','d');
ok(many.source==='personal'&&many.value>0, 'switches to the golfer\'s own error once there is history');

console.log('— §5.9 feedback engine —');
ok(M.FeedbackEngine.getMode()==='onRequest', 'defaults to tap-to-reveal, not every shot');
ok(M.FeedbackEngine.shouldReveal({mode:'onRequest'}).reveal===false, 'onRequest hides by default');
ok(M.FeedbackEngine.shouldReveal({mode:'bandwidth',outsideBand:false}).reveal===false, 'bandwidth stays silent inside tolerance');
ok(M.FeedbackEngine.shouldReveal({mode:'bandwidth',outsideBand:true}).reveal===true, 'bandwidth speaks outside it');
ok(M.FeedbackEngine.fadedFrequency(0,50) > M.FeedbackEngine.fadedFrequency(45,50), 'faded schedule decays across session');
ok(M.FeedbackEngine.shouldAskPrediction(5)&&!M.FeedbackEngine.shouldAskPrediction(1), 'prompts prediction periodically');
ok(/240/.test(M.FeedbackEngine.volumeAdvice(160)||''), 'warns on marathon sessions');

console.log('— §1.5/1.6 ball and surface —');
const range={conditions:{ball:'range',surface:'mat'},shots:[]};
const good={conditions:{ball:'premium',surface:'grass'},shots:[]};
ok(M.Conditions.caveats(range).length>=2, 'range balls + mat both raise caveats');
ok(/2–4×/.test(M.Conditions.caveats(range)[0]), 'names the actual dispersion inflation');
// the spin caveat moved out of Conditions into the renderer, so it is stated
// on EVERY session either way rather than only when the ball type raises it
ok(!M.Conditions.caveats(good).some(c=>/RPT/.test(c)), 'ball caveats no longer carry the spin line');
ok(/RPT ball/.test(M.Spin.NOT_MEASURED), 'Spin module owns it instead, and states it unconditionally');
ok(!M.Conditions.comparable(range,good), 'sessions on different balls are not comparable');
ok(M.Conditions.ball(range).dispersionValid===false, 'dispersion prescriptions blocked on range balls');

console.log('— §2.2 curvature transfer functions —');
const drv={clubType:'d',launchDirection:2,clubPath:0,launchAngle:10.9,attackAngle:-1.3,carryDistance:275};
const irn={clubType:'6i',launchDirection:2,clubPath:0,launchAngle:14.1,attackAngle:-4.1,carryDistance:183};
ok(Math.abs(M.spinAxisFrom(drv))>Math.abs(M.spinAxisFrom(irn)),
   `driver punishes face-to-path harder (axis ${M.spinAxisFrom(drv).toFixed(1)}° vs ${M.spinAxisFrom(irn).toFixed(1)}°)`);
ok(M.curveYards(drv)>M.curveYards(irn), 'and curves more in yards');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
