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

console.log('— the launch-window targets come from ONE table —');
// They used to be hardcoded as strings inline in the render, a second copy of
// numbers Benchmarks.TARGET already held. That is the exact shape of the bug
// the calibration audit fixed once: the +3.0 driver attack angle that is the
// LPGA average sitting in a table labelled PGA. Correcting the authoritative
// copy would not have changed anything a golfer saw.
const B = M.Benchmarks;
ok(typeof B.targetsFor === 'function', 'there is a resolver rather than inline strings');
const dt = B.targetsFor('d');
ok(dt.attack === B.TARGET.driverAttackAngle, 'driver attack angle is the TARGET entry itself, not a copy');
ok(dt.attack.lo === 2 && dt.attack.hi === 5, 'and it is +2 to +5, the target');
ok(B.get('d').pga.aa === -1.3, 'while the tour AVERAGE stays -1.3, descending — separate on purpose');
ok(dt.attack.lo !== B.get('d').pga.aa, 'the two are not the same number, which was the original bug');
ok(B.targetsFor('7i').attack === B.TARGET.ironAttackAngle, 'irons resolve to the iron band');
ok(B.targetsFor('3w').attack === B.TARGET.otherAttackAngle, 'and woods to their own, not to the iron one');
ok(B.targetsFor('pw').launch === B.TARGET.shortIronLaunch, 'short irons get the short-iron launch window');
ok(B.targetsFor('d').spin === B.TARGET.driverSpin, 'and each family gets its own spin reference');
for (const c of ['d','3w','4h','3i','7i','pw','lw']) {
  const t = B.targetsFor(c);
  ok(t.launch && t.attack && t.spin && t.launch.lo < t.launch.hi,
     `${c}: every band resolves and is the right way round`);
}

console.log('— the inference boundary: what the device sees vs what it cannot —');
// The fault cards listed causes under "Root causes", and sixteen of the eighty
// entries named a body position — hip rotation, spine tilt, a cupped lead
// wrist, casting. None of those are recoverable from ball and club-head data:
// dynamic loft alone is the simultaneous outcome of shaft lean, wrist angle,
// forearm rotation, shaft droop, attack angle and ball position, and the
// mapping cannot be inverted. Asserting them as findings is exactly what §3.6
// forbids.
const FE = M.FaultEngine;
ok(FE.causeIsObservable('Club path is well out-to-in through impact'), 'a club-delivery cause is observable');
ok(FE.causeIsObservable('Face open relative to the swing path'), 'so is a face-to-path one');
for (const bad of [
  'Casting the club (early release) from the top',
  'Insufficient hip rotation causing the arms to flip',
  'Cupped lead wrist at impact adding dynamic loft',
  'Early extension / coming out of posture',
  'Spine tilt level or tilted toward target at address',
  'Lateral slide instead of rotational power transfer',
]) ok(!FE.causeIsObservable(bad), `not observable: "${bad.slice(0, 44)}…"`);

const split = FE.splitCauses([
  'Club path is out-to-in', 'Casting the club from the top', 'Face open to the path', 'Insufficient hip rotation',
]);
ok(split.observable.length === 2 && split.body.length === 2, 'a mixed list splits both ways');
ok(split.observable.every(FE.causeIsObservable), 'and nothing lands on the wrong side');
ok(/cannot see any of them/.test(FE.BODY_CAVEAT), 'the caveat says the app cannot see them');
ok(/several different actions produce the same club delivery/.test(FE.BODY_CAVEAT),
   'and why the same delivery has many possible causes');

// The real content, checked in bulk: every body-construct string the engine
// ships must be classified as unobservable, or it renders as a finding.
const fs2 = require('fs');
const src2 = fs2.readFileSync(require('path').join(__dirname, '../../app.js'), 'utf8');
const seg2 = src2.slice(src2.indexOf('const FaultEngine'), src2.indexOf('const ShotScorer'));
const all = [];
for (const m of seg2.matchAll(/causes:\s*\[(.*?)\]/gs))
  for (const item of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) all.push(item[1]);
ok(all.length > 50, `${all.length} cause strings shipped`);
const leaked = all.filter(c => /\b(wrist|casting|cast|hip|spine|posture|early exten|lag)\b/i.test(c) && FE.causeIsObservable(c));
ok(leaked.length === 0,
   `no body-position cause is classified as measured${leaked.length ? ' — leaked: ' + leaked.join(' | ') : ''}`);
const bodyCount = all.filter(c => !FE.causeIsObservable(c)).length;
ok(bodyCount >= 15, `${bodyCount} of them are correctly held behind the caveat`);

console.log('— the fault gates, pinned so the docs cannot drift from them —');
// CLAUDE.md described a `MIN_CLUB_SHOTS = 4` that does not exist and never
// did, and put the per-club floor at 4 when it is 10. A wrong constant in the
// docs is worse than none: it cost a load-gate failure this session when it was
// exported as real. These assertions are the numbers, so the prose has to match.
ok(FE.MIN_AFFECTED === 2, 'MIN_AFFECTED is 2 — never a fault off one shot');
ok(FE.MIN_RATE === 0.30, 'MIN_RATE is 0.30 of that club\'s shots');
ok(FE.FIRM_RATE === 0.50, 'FIRM_RATE is 0.50, below which a fault is tentative');
ok(FE.MIN_CLUB_SHOTS === undefined, 'and there is no MIN_CLUB_SHOTS, whatever the docs once said');
ok(M.Metrics.MIN_SHOTS_REPORT === 10, 'the default per-club floor is Metrics.MIN_SHOTS_REPORT = 10');

// The gate actually bites: the same fault rate passes at 10 shots and not at 6.
const mk = (n, bad) => Array.from({ length: n }, (_, i) => ({
  _row: i + 2, clubType: '7i', ballSpeed: 80, clubSpeed: 62,
  smashFactor: i < bad ? 1.05 : 1.33, launchAngle: 18, attackAngle: -4, clubPath: -1,
  carryDistance: 150, sideCarry: 2,
}));
const few = FE.detectFaults(mk(6, 3));
const many = FE.detectFaults(mk(12, 6));
ok(few.length === 0, 'a 50% fault rate over 6 shots of a club reports nothing');
ok(many.length > 0, 'the same rate over 12 does');
ok(many.every(f => f.total >= 10), 'and every reported fault was judged against 10+ shots of its club');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
