const M=require('../harness.js').load();
let fail=0; const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c)fail++;};
const H='Club Type,Ball Speed,Club Speed,Smash Factor,Launch Angle,Launch Direction,Carry Distance,Side Carry,Attack Angle,Club Path,Spin Axis,Spin Rate';
const push=n=>{const r=[H];for(let i=0;i<n;i++)r.push('7i,120,92,1.38,17,7,175,9,-3.6,6.0,4,6300');return M.CSVParser.parse(r.join('\n'));};
const mark=(shots,a)=>shots.map(s=>({...s,_aligned:a,_ball:'premium',_surface:'grass'}));

console.log('— alignment changes the start-line sample floor —');
ok(M.Conditions.startLineFloor(mark(push(12),true))===M.Metrics.MIN_SHOTS_REPORT, 'aligned -> 10-shot floor');
ok(M.Conditions.startLineFloor(mark(push(12),false))===M.Metrics.MIN_SHOTS_TAIL, 'not aligned -> 30-shot floor');
ok(M.Conditions.aligned(undefined)===false, 'unknown provenance is never treated as aligned');

console.log('— and therefore what gets prescribed at 12 shots —');
const un=M.FaultEngine.detectFaults(mark(push(12),false));
const al=M.FaultEngine.detectFaults(mark(push(12),true));
ok(!un.some(f=>f.id==='push-right'), '12 shots, unaligned: push fault withheld');
ok(al.some(f=>f.id==='push-right'), '12 shots, ALIGNED: push fault prescribed');
const alf=al.find(f=>f.id==='push-right');
ok(alf && alf.minShots===10, `and records the floor it cleared (${alf&&alf.minShots})`);

console.log('— alignment does NOT unlock what it has nothing to do with —');
const rpt=mark(push(20),true).map(s=>({...s,spinRate:4600,_ball:'premium'}));
ok(!M.FaultEngine.detectFaults(rpt).some(f=>/spin rate|excessive spin/i.test(f.name)),
   'perfect alignment still yields no spin-rate prescription (biology, not aiming)');
ok(M.Metrics.tier('sideCarry')===3, 'side carry stays tier 3 — it is modelled, not aimed');
ok(M.Metrics.MIN_SHOTS_REPORT===10, 'the 10-shot floor stands — it is shot-to-shot variability');

console.log('— the unaligned caveat is a BIAS warning, not a noise one —');
const cav=M.Conditions.caveats({conditions:{ball:'premium',surface:'grass'},shots:[]});
ok(cav.some(c=>/averaging more shots will not remove it/.test(c)),
   'says plainly that more shots cannot fix an aiming error');
ok(!M.Conditions.caveats({conditions:{ball:'premium',surface:'grass',alignment:'confirmed'},shots:[]})
    .some(c=>/Alignment not confirmed/.test(c)), 'and disappears once confirmed');
console.log('— comparing two sessions across different conditions —');
// Conditions.comparable() existed for exactly this and nothing called it: any
// two sessions were put side by side with green and red arrows, so a
// range-ball session against a premium one showed a carry "improvement" that
// was entirely the ball.
const { Features, Conditions, Store } = M;
const sess = (id, ball, surface, carry, smash) => Store.stamp({
  id, date: '2026-04-0' + id, conditions: { ball, surface, alignment: 'confirmed' },
  shots: Array.from({ length: 12 }, (_, i) => ({
    clubType: '7i', carryDistance: carry + (i % 3), ballSpeed: 80, smashFactor: smash,
    launchAngle: 18, apex: 30, spinRate: 6000 })),
});
const premium = sess(1, 'premium', 'grass', 150, 1.33);
const range   = sess(2, 'range',   'grass', 170, 1.33);
const premium2= sess(3, 'premium', 'grass', 160, 1.36);

const across = Features.compare(premium, range);
ok(across.comparable === false, 'two different ball types are not comparable');
const carryRow = across.find(r => r.label === 'Avg carry');
ok(carryRow.a !== carryRow.b, 'the carry numbers are still shown — the golfer hit them');
ok(carryRow.good === null, 'but no verdict is attached to a difference the ball produced');
ok(carryRow.withheld === true, 'and the row is marked as not comparable');
ok(/the difference is the ball as much as you/.test(across.caveats.join(' ')), 'with the reason said plainly');

const smashRow = across.find(r => r.label === 'Smash');
ok(smashRow.good !== null, 'smash still gets its verdict — ball type does not change what it means');

const within = Features.compare(premium, premium2);
ok(within.comparable === true, 'two premium-ball grass sessions are comparable');
ok(within.find(r => r.label === 'Avg carry').good !== null, 'so carry gets its verdict back');
ok(within.caveats.every(c => !/different balls/.test(c)), 'and no ball caveat is raised');

console.log('— spin is dropped unless BOTH sessions measured it —');
ok(!across.some(r => r.label === 'Spin'), 'no spin row without an RPT ball, rather than a figure never read');
ok(/only measured with a Rapsodo RPT ball/.test(across.caveats.join(' ')), 'and it says why');
const rptA = sess(4, 'rpt', 'grass', 150, 1.33), rptB = sess(5, 'rpt', 'grass', 152, 1.34);
ok(Features.compare(rptA, rptB).some(r => r.label === 'Spin'), 'with RPT balls on both sides it appears');

console.log('— surfaces too —');
const mat = sess(6, 'premium', 'mat', 150, 1.33);
ok(Features.compare(premium, mat).comparable === false, 'grass against mat is not comparable');
ok(/sole bounce/.test(Features.compare(premium, mat).caveats.join(' ')), 'and says what a mat hides');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
