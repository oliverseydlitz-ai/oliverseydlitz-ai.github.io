// ── The session-quality breakdown counts each shot once, under its label (C3)
//
// It was a label list reversed and indexed with `4-i`: shots scored 75-100
// were counted as "Poor", under-25 was counted twice (as "Missed" and as
// "Elite"), the low end was painted green, and a score of exactly 100 was
// never counted anywhere. Nothing errored; the bars just said the opposite of
// the pips above them.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { ShotScorer } = R.app;
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');

const scores = [100, 99, 75, 74, 50, 49, 25, 24, 0];
const b = Object.fromEntries(ShotScorer.buckets(scores).map(x => [x.label, x]));
ok(b.Elite.n === 3, `75-100 is Elite, and 100 is in it (${b.Elite.n} of 100, 99, 75)`);
ok(b.Good.n === 2 && b.Fair.n === 2 && b.Poor.n === 2, 'each lower band takes its own two');
ok(ShotScorer.buckets(scores).reduce((n, x) => n + x.n, 0) === scores.length, 'every shot is counted exactly once');
ok(ShotScorer.buckets([]).every(x => x.n === 0), 'no shots, no counts');
ok(ShotScorer.buckets(scores).every(x => x.color === ShotScorer.scoreColor(x.lo)),
   'each bar is the colour of the pips in its band');
ok(b.Elite.color !== b.Poor.color, 'and the top and bottom are not painted alike');

console.log('— the old construction is gone —');
const code = src.replace(/\/\*[^]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
ok(!/\.reverse\(\)\.map\(\(l,\s*i\)/.test(code), 'no reversed label list indexed by position');
ok(/ShotScorer\.buckets\(scores\)/.test(code), 'the banner reads ShotScorer.buckets');

console.log('— a hex alpha is not appended to a token —');
// Found beside C3: `stroke="${g.color}1e"` was a translucent track while
// colours were hexes. Once they became var(--green), it rendered as
// `var(--green)1e`, which computes to `none` (measured in Chromium), so both
// grade-ring tracks have been invisible since the redesign.
const suffixed = [...code.matchAll(/\$\{[\w.]*color\}[0-9a-fA-F]{2}\b/g)].map(m => m[0]);
ok(suffixed.length === 0, `no colour interpolation carries a hex alpha suffix${suffixed.length ? ' — ' + suffixed.join(', ') : ''}`);
ok(/\$\{[\w.]*color\}[0-9a-fA-F]{2}\b/.test('stroke="${g.color}1e"'), 'and the pattern finds the shipped defect');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
