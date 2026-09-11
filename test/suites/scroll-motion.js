// Scroll motion asserts the CONSTRAINT, not the effect.
//
// Whether a bar grows from its axis is not something a unit test can see, and
// a test that mocked IntersectionObserver into firing would only prove the
// mock works. What matters, and what broke last time, is the rule:
//
//   Animate FROM a visible resting state, never TO one.
//
// `.section-block` once carried a staggered viewFadeIn with eight nth-child
// delays. Somebody later found content invisible for real users and killed it
// with an override titled "ensure content is always visible"
// (`animation: none !important`), and the delays then sat dead for months —
// because a thing that does not appear is indistinguishable from a thing that
// was never there. Nothing in this codebase reported it.
const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// Comments stripped, for the sixth time in this repository: the section below
// quotes `animation: none !important` and `opacity: 0` in the paragraph
// explaining why neither may appear.
const cssCode = css.replace(/\/\*[^]*?\*\//g, '');
const code = src
  .replace(/\/\*[^]*?\*\//g, '')
  .split('\n')
  .map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
  .join('\n');

console.log('— nothing this task added rests invisible —');
// The scroll-motion block, isolated: from its header to the next section
// header. A rule outside it is not this task's to police.
const start = cssCode.indexOf('.section-block.sm-rule::before');
const secStart = cssCode.indexOf('@media (max-width: 767px)');
const section = cssCode.slice(Math.max(0, secStart), start + 200);
ok(section.length > 100, 'the scroll-motion CSS section is present and locatable');
const banned = [];
for (const pat of [/opacity:\s*0(?![.\d%])/g, /visibility:\s*hidden/g, /display:\s*none/g]) {
  for (const m of section.matchAll(pat)) banned.push(m[0]);
}
ok(banned.length === 0,
   `no resting state is hidden${banned.length ? ` — found: ${banned.join(', ')}` : ''}`);

// The keyframe is the whole trick and it has to stay one-sided. `from` alone
// animates TO whatever the element already computes to, so the resting state
// IS the finished state. Adding a `to` would make the CSS the authority on
// where the element ends up, and a typo there hides a rule permanently.
const kf = (cssCode.match(/@keyframes\s+smRuleIn\s*\{[^]*?\n\}/) || [''])[0]
        || (cssCode.match(/@keyframes\s+smRuleIn\s*\{[^}]*\}[^}]*\}/) || [''])[0];
ok(/from\s*\{/.test(kf) && !/\bto\s*\{/.test(kf) && !/100%\s*\{/.test(kf),
   'smRuleIn animates from scaleX(0) to the resting state, with no `to` of its own');

// The rule's own resting state: .section-block::before must carry no transform
// at all, so it computes to scaleX(1) before any class is added.
const restBlock = (cssCode.match(/\.section-block::before\s*\{[^}]*\}/) || [''])[0];
ok(restBlock.length > 0 && !/transform\s*:/.test(restBlock),
   'the section rule has no transform in its resting state');

console.log('— the stagger has not come back —');
// The negative control. This is the exact pattern that failed, and if it ever
// reappears every other assertion here is decoration.
ok(!/nth-child\([^)]*\)[^{]*\{[^}]*animation-delay/.test(cssCode),
   'no nth-child animation-delay stagger in style.css');
ok(!/viewFadeIn/.test(cssCode), 'the viewFadeIn keyframe is still gone');
// @media print is excluded by brace-matched range, not by loosening the
// pattern: killing a modal's entry animation for the printed legal documents
// is correct and has nothing to do with scroll motion. Narrowing the check to
// the context it polices is the fix; weakening the regex would not be.
const printRanges = [];
for (const m of cssCode.matchAll(/@media\s+print[^{]*\{/g)) {
  let i = m.index + m[0].length, depth = 1;
  while (i < cssCode.length && depth > 0) {
    if (cssCode[i] === '{') depth++; else if (cssCode[i] === '}') depth--;
    i++;
  }
  printRanges.push([m.index, i]);
}
const screenOverride = [...cssCode.matchAll(/animation:\s*none\s*!important/g)]
  .filter(m => !printRanges.some(([a, b]) => m.index >= a && m.index < b));
ok(screenOverride.length === 0,
   'no "ensure content is always visible" override on screen — if one is needed, the motion is wrong');

console.log('— reduced motion is wired in BOTH halves —');
// The CSS kill switch cannot reach a Chart.js duration, which is JS. A switch
// that silently covers half of what it claims is the same defect class as a
// gate nothing calls.
ok(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(cssCode), 'the CSS half exists');
const mod = (code.match(/const ScrollMotion = \(\(\) => \{[^]*?\n\}\)\(\);/) || [''])[0];
ok(mod.length > 400, 'ScrollMotion is present in app.js');
ok(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(mod),
   'ScrollMotion.reduced() reads the query itself');
// And it is actually consulted on the chart path, not merely defined.
const chartFn = (mod.match(/function chart\(canvas, cfg\)[^]*?\n  \}/) || [''])[0];
ok(/reduced\(\)/.test(chartFn), 'the chart path consults reduced() — wired, not just written');

console.log('— IntersectionObserver is feature-detected before use —');
ok(/typeof IntersectionObserver === 'function'/.test(mod),
   'support is tested, not assumed');
// Every construction goes through observe(), which returns false rather than
// throwing when support is absent.
const news = [...mod.matchAll(/new IntersectionObserver/g)].length;
ok(news >= 1 && /if \(!SUPPORTED \|\| !el\) return false;/.test(mod),
   `observe() refuses without support (${news} IntersectionObserver sites)`);

console.log('— and every chart is built through ScrollMotion —');
// A `new Chart(` outside the module is a chart that animates at construction,
// below the fold, unseen — which is the bug this task exists to fix. It would
// look perfectly fine and simply never draw on.
const strayCharts = [...code.matchAll(/new Chart\(/g)].length;
ok(strayCharts === 1,
   `exactly one \`new Chart(\` in app.js, inside ScrollMotion (found ${strayCharts})`);
ok(/const inst = new Chart\(canvas, cfg\);/.test(mod),
   'and that one site is ScrollMotion.chart()');
ok([...code.matchAll(/ScrollMotion\.chart\(/g)].length >= 3,
   'the render paths construct through ScrollMotion.chart()');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
