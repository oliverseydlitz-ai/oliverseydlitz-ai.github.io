const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { Trajectory: T } = M;

// `launch = launch > 0 ? launch : 12` substituted an invented twelve degrees
// when there was no reading — and the SVG then LABELLED it, so a shot the
// device gave no launch angle for was drawn with "12.0° launch" written under
// it. A drawing may be indicative; a label is a claim.
console.log('— a real flight is drawn —');
const real = T.arc(13.5, 31, 235, 40);
ok(/<svg/.test(real), 'an svg comes back');
ok(/13\.5° launch/.test(real), 'labelled with the reading it was given');
ok(/235 yds carry/.test(real), 'and the carry');
ok(/not measured/.test(real),
   'with a note that apex, carry and descent are computed rather than measured — all tier 3');

console.log('— an absent reading is not drawn at all —');
for (const [args, what] of [
  [[null, 31, 235, 40],  'launch'],
  [[0,    31, 235, 40],  'launch as zero'],
  [[13.5, 31, 235, null],'descent'],
  [[13.5, 31, 235, 0],   'descent as zero'],
]) {
  const out = T.arc(...args);
  ok(!/<svg/.test(out), `no ${what} means no drawing`);
  ok(!/12\.0°|40\.0°/.test(out), `and no invented ${what} value appears anywhere`);
  ok(/No ball flight to draw/.test(out), 'it says why instead');
}

console.log('— and the averaged flight refuses on the same terms —');
ok(T.avgFlight([]) === '', 'no shots, nothing');
const noLaunch = T.avgFlight([{ apex: 30, carryDistance: 230, descentAngle: 40 }]);
ok(!/<svg/.test(noLaunch), 'a mean of a field the parser never filled is null, not a number');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
