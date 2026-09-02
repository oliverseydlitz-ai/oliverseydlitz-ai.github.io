const M = require('../harness.js').load();
let fail = 0;
const ok = (c, msg) => { console.log((c?'  PASS  ':'  FAIL  ')+msg); if(!c) fail++; };

console.log('— helpers tolerate null —');
ok(M.fmt(null) === '—', "fmt(null) renders as em-dash, not 'null'");
ok(M.avg([{c:null},{c:10},{c:20}],'c') === 15, 'avg() ignores null (=15)');
ok(M.stdDev([null,10,10,10]) === 0, 'stdDev() ignores null (=0, was skewed by fake 0s)');
ok(M.facePath({launchDirection:5, clubPath:null}) === null,
   'facePath() returns null without a path — it is DERIVED, not measured, so a missing input means no answer');

console.log('— FaultEngine on a CSV with blank optional columns —');
const H='Club Type,Ball Speed,Club Speed,Smash Factor,Launch Angle,Launch Direction,Carry Distance,Side Carry,Attack Angle,Club Path,Spin Axis,Spin Rate';
const blanks = M.CSVParser.parse(`${H}\n7i,80,61,1.30,18,0,150,,,,,6500\n7i,81,62,1.31,17,0,152,,,,,6400`);
let faults=null, threw=null;
try { faults = M.FaultEngine.detectFaults(blanks); } catch(e){ threw = e; }
ok(!threw, 'detectFaults() does not throw on null metrics' + (threw?' — '+threw.message:''));
ok(Array.isArray(faults), 'detectFaults() returns an array');
ok(faults.every(f => Number.isFinite(f.count)), 'every fault has a finite count');

console.log('— scores are finite in all shapes —');
for (const [n,csv] of Object.entries({
  full:   `${H}\n7i,80,61,1.30,18,0,150,3,-3.5,0.5,4,6500`,
  blank:  `${H}\n7i,80,61,1.30,18,0,150,,,,,6500`,
  absent: `Club Type,Ball Speed,Smash Factor,Carry Distance\n7i,80,1.30,150`,
})) {
  const sc = M.ShotScorer.score(M.CSVParser.parse(csv)[0]);
  ok(sc === null || Number.isFinite(sc), `score is finite or null for '${n}' (got ${sc})`);
}
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail?1:0);
