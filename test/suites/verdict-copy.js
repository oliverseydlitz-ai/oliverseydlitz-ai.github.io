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

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exitCode = fail ? 1 : 0;
