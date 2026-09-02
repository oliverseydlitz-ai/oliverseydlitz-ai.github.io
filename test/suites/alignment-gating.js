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
console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
