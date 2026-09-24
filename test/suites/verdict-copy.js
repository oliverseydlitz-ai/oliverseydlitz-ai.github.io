// ── Small verdicts that said more than the data (next-plan A1–A3) ────────
//
// "Clean" showed on any card with no HIGH fault, including sessions where no
// club reached the floor (nothing could have reported) and cards carrying
// medium faults. A +0.0 delta was painted as a gain. "1 more shots".
const fs = require('fs'), path = require('path');
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { cleanBadge, plural, Metrics } = R.app;
const F = Metrics.MIN_SHOTS_REPORT;
const shots = (club, n) => Array.from({ length: n }, () => ({ clubType: club }));

ok(/Clean/.test(cleanBadge(shots('7i', F), [])), `a club at the floor (${F}) with no fault reads Clean`);
ok(/Too few shots/.test(cleanBadge([...shots('7i', F - 1), ...shots('PW', F - 1)], [])),
  'no club at the floor is "too few shots", even when the session total clears it');
ok(cleanBadge(shots('7i', F), [{ id: 'x', severity: 'medium' }]) === '', 'a medium fault means no Clean badge');

ok(plural(1, 'more shot') === '1 more shot' && plural(3, 'more shot') === '3 more shots', 'plural() agrees with its count');
const src = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
ok(!/\}\s*more shots/.test(src), 'no computed count is followed by a hard-coded "more shots"');
ok(!/badge"[^>]*>✓ Clean<\/span>'\}/.test(src.replace(/function cleanBadge[\s\S]*?\n\}/, '')),
  'the card no longer inlines its own Clean badge');

// The shot pop-up comparison: rounded before it is coloured.
const cmpSrc = src.slice(src.indexOf('const cmp = (field, dec)'), src.indexOf('const cmp = (field, dec)') + 700);
ok(/Number\(fmt\(v - a, dec\)\)/.test(cmpSrc) && /'flat'/.test(cmpSrc), 'a delta that rounds to zero is neither up nor down');
const css = fs.readFileSync(path.join(__dirname, '../../style.css'), 'utf8');
ok(/\.sm-cmp\.flat\s*\{/.test(css), 'and the neutral state has a style');

// A4 (C49): ranked claims with no source. Neither "#1 cause" nor "single most
// common reason" is in the research base, and the face-share rule was quoted
// as one percentage when it moves with loft. Comments stripped: the reasons
// quote the phrases.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const bad of [/#1 cause/i, /single most common reason/i, /"75% face" rule/i])
  ok(!bad.test(code), `no unsourced claim on screen: ${bad}`);

// A6: the import menu cut "Premium (own ball)" to "Premium (own l…" at 393px
// (142px of text in 115px, measured). The menu reads a short label; every
// sentence that names the ball keeps the full one.
const opt = R.window.document.querySelector('#metaBall option[value="premium"]');
ok(opt && opt.textContent === R.app.Conditions.BALLS.premium.short && opt.textContent.length <= 12,
  `the import menu uses the short ball label (${opt && opt.textContent})`);
ok(R.app.Conditions.BALLS.premium.label === 'Premium (own ball)', 'the full label is unchanged for prose');

// A7 / V42 and the zero delta found with it. Two identical sessions compared:
// every row moved by 0, and each used to come back good:false — painted in the
// regression colour as "· 0yds".
{
  const { Features, Store: St } = R.app;
  const shotsZ = Array.from({ length: 12 }, () => ({ clubType: 'd', ballSpeed: 150, clubSpeed: 104,
    smashFactor: 1.44, launchAngle: 12, attackAngle: 1, carryDistance: 235, totalDistance: 255, apex: 31 }));
  const mk = (id, d) => St.stamp({ id, date: d, conditions: { ball: 'premium', surface: 'grass' }, shots: shotsZ.map(x => ({ ...x })) });
  const rows = Features.compare(mk('z1', '2026-09-20T10:00:00Z'), mk('z2', '2026-09-21T10:00:00Z')) || [];
  const zeros = rows.filter(r => r.delta !== null && Number(r.delta) === 0);
  ok(zeros.length > 0 && zeros.every(r => r.good === null && r.dir === 'flat'),
    `a change that prints as 0 is neither good nor bad (${zeros.length} rows checked)`);
}
for (const sel of ['.caveat-block', '.probe-block']) {
  const m = css.match(new RegExp(sel.replace('.', '\\.') + '\\s*\\{[^}]*margin:\\s*([^;]+);'));
  ok(m && /^0 0 1rem$/.test(m[1].trim()), `${sel} has no side margin of its own (${m && m[1]})`);
}
ok(/\.probe-item\.dotted\s*\{[^}]*padding-left/.test(css) && !/\.probe-item\{[^}]*padding-left/.test(css),
  'only a dotted probe item reserves room for the dot');

// A5: stdDev is the SAMPLE form. The population form understated every spread
// estimated from a few shots (11% at n = 5), and the fatigue test ran at 12%
// false alarms on it.
{
  const sd = R.app.stdDev([1, 2, 3, 4]);
  ok(Math.abs(sd - Math.sqrt(5 / 3)) < 1e-12, `stdDev divides by n − 1 (${sd.toFixed(4)} for 1,2,3,4)`);
  ok(R.app.stdDev([7]) === 0, 'and one value has no spread');
}

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exitCode = fail ? 1 : 0;
