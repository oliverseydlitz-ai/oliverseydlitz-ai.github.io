const M=require('../harness.js').load();
let fail=0; const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c)fail++;};
const near=(a,b,t=0.05)=>Math.abs(a-b)<=t;

console.log('— D-plane face-to-path correction —');
ok(near(M.facePath({clubType:'d', launchDirection:4, clubPath:-2}), 6/0.84), 'driver divides by R=0.84');
ok(near(M.facePath({clubType:'7i',launchDirection:4, clubPath:-2}), 6/0.78), 'iron divides by R=0.78');
ok(M.facePath({clubType:'7i',launchDirection:null,clubPath:-2})===null, 'null when data missing');
// The exact case from the audit: readings that the OLD code reported as 3.75
// (below the >5 slice threshold, so the slice was missed) are a true 5.0.
const wasUnder = M.facePath({clubType:'7i', launchDirection:3.75, clubPath:0});
ok(near(wasUnder,3.75/0.78), `iron reading the old code called 3.75 is really ${wasUnder.toFixed(2)}`);
const nowCaught = M.facePath({clubType:'7i', launchDirection:4.2, clubPath:0});
ok(nowCaught>5, `a slice the old code missed (old 4.20) now trips the rule at ${nowCaught.toFixed(2)}`);

console.log('— spin loft estimator vs TrackMan published —');
ok(near(M.spinLoft({clubType:'d', launchAngle:10.9,attackAngle:-1.3}),14.7,0.1), 'driver 14.7 (published 14.7)');
ok(near(M.spinLoft({clubType:'6i',launchAngle:14.1,attackAngle:-4.1}),24.3,0.1), '6-iron 24.3 (published 24.3)');
ok(M.spinLoft({clubType:'7i',launchAngle:18,attackAngle:null})===null, 'null when AoA missing');

console.log('— benchmarks —');
ok(M.Benchmarks.get('d').pga.aa === -1.3, 'driver PGA attack angle is -1.3, not +3.0');
ok(M.Benchmarks.TARGET.driverAttackAngle.lo===2, 'the +2..+5 figure survives as a TARGET');
const missing=['1i','2i','3i','2h','3h','4w','5w','7w'].filter(c=>!M.Benchmarks.get(c));
ok(missing.length===0, 'all 8 previously-missing clubs now have benchmarks');
ok(M.Benchmarks.spinLoftBand('6i').tour===24.3, 'spin loft band exposed per club');

console.log('— fault gating: noise must not be reported —');
const H='Club Type,Ball Speed,Club Speed,Smash Factor,Launch Angle,Launch Direction,Carry Distance,Side Carry,Attack Angle,Club Path,Spin Axis,Spin Rate';
// 12 good 7-irons, ONE of which trips shallow-AoA the way instrument noise would
const noise=[`${H}`]; for(let i=0;i<11;i++) noise.push(`7i,120,92,1.38,17,1,175,3,-3.6,0.4,4,6300`);
noise.push(`7i,120,92,1.38,17,1,175,3,-0.2,0.4,4,6300`);
const nf=M.FaultEngine.detectFaults(M.CSVParser.parse(noise.join('\n')));
ok(!nf.some(f=>f.id==='iron-shallow-aa'), '1 of 20 shallow shots is NOT reported');

// a genuine pattern: 9 of 12 shallow
const real=[`${H}`]; for(let i=0;i<14;i++) real.push(`7i,120,92,1.38,17,1,175,3,0.4,0.4,4,6300`);
for(let i=0;i<4;i++) real.push(`7i,120,92,1.38,17,1,175,3,-3.6,0.4,4,6300`);
const rf=M.FaultEngine.detectFaults(M.CSVParser.parse(real.join('\n')));
const sh=rf.find(f=>f.id==='iron-shallow-aa');
ok(!!sh, '14 of 18 shallow shots IS reported');
ok(sh && sh.confidence==='confirmed', 'and marked confirmed');
ok(sh && /14 of 18/.test(sh.evidence), `evidence names the sample: "${sh&&sh.evidence}"`);

// borderline 5 of 12 -> reported but downgraded
const bord=[`${H}`]; for(let i=0;i<7;i++) bord.push(`7i,120,92,1.38,17,1,175,3,0.4,0.4,4,6300`);
for(let i=0;i<11;i++) bord.push(`7i,120,92,1.38,17,1,175,3,-3.6,0.4,4,6300`);
const bf=M.FaultEngine.detectFaults(M.CSVParser.parse(bord.join('\n')));
const bsh=bf.find(f=>f.id==='iron-shallow-aa');
ok(bsh && bsh.confidence==='tentative', '7 of 18 reported as tentative');
ok(bsh && bsh.severity==='low', 'and severity downgraded from medium to low');

console.log('— denominator is the CLUB, not the session —');
const mix=[`${H}`];
for(let i=0;i<16;i++) mix.push(`d,150,110,1.45,12,1,250,5,-5.5,1.0,6,2600`);   // 4 steep drivers
for(let i=0;i<30;i++) mix.push(`7i,120,92,1.38,17,1,175,3,-3.6,0.4,4,6300`);  // 30 fine irons
const mf=M.FaultEngine.detectFaults(M.CSVParser.parse(mix.join('\n')));
ok(mf.some(f=>f.id==='driver-negative-aa'), 'driver fault judged against its own 16 drivers, not all 46 shots');

console.log('— new spin-loft faults —');
const cast=[`${H}`]; for(let i=0;i<12;i++) cast.push(`7i,105,92,1.14,29,1,140,3,-1.0,0.4,4,9500`);
const cf=M.FaultEngine.detectFaults(M.CSVParser.parse(cast.join('\n')));
ok(cf.some(f=>f.id==='high-spin-loft'), 'casting / added loft detected');
const hl=cf.find(f=>f.id==='high-spin-loft');
ok(hl && hl.drills.length>=4 && hl.causes.length>=4, 'with drills and causes attached');

console.log('— practice plan —');
const plan=M.PracticePlan.generate(M.CSVParser.parse(cast.join('\n')), 45);
ok(Array.isArray(plan)&&plan.length>0, 'plan generated');
ok(plan.every(p=>p.balls>=10&&p.minutes>=5), 'every block has balls AND minutes');
ok(M.PracticePlan.scoringWeight('7i') > M.PracticePlan.scoringWeight('3w'),
   `scoring clubs outrank fairway woods (7i ${M.PracticePlan.scoringWeight('7i')} > 3w ${M.PracticePlan.scoringWeight('3w')})`);
const tb=M.PracticePlan.transferBlock(45);
ok(tb && tb.balls===12 && /one target/i.test(tb.drill.name), 'transfer block present');

console.log('— coaching cues are external —');
const internal=/\b(your (wrist|head|shoulder|hip|arm|elbow|spine|weight))\b/i;
let bad=[];
for(const [k,v] of Object.entries({Slice:1,Hook:1,Thin:1,Fat:1})){
  M.CoachingMode.getTips(k).forEach(t=>{ if(internal.test(t)) bad.push(k+': '+t); });
}
ok(bad.length===0, 'no body-part-focused cues remain'+(bad.length?': '+bad.join(' | '):''));
ok(M.CoachingMode.PROTOCOL.minSecondsBetweenShots===20, 'protocol exposes shot spacing');
const sess=M.CoachingMode.generateSession('Slice',30);
ok(sess.balls>0 && /70%/.test(sess.successTarget), 'session prescribes balls and a success target');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
