// No emoji in the shipped source. The redesign replaced every emoji glyph with
// an inline-SVG mark from the sprite; this keeps the purge from regressing one
// convenient `📈` at a time.
//
// The test is the Extended_Pictographic Unicode property, not a hand-rolled
// codepoint range. A range written by hand is how the purge itself nearly went
// wrong: `[☀-➿]` swallows `✓`, `✕` and the arrows this source uses on purpose,
// and stripping those silently is a worse outcome than leaving an emoji in.
// Extended_Pictographic matches pictographs and NOT box drawing (─), arrows
// (← → ↑ ↓ ↻), dingbat check marks, or maths.
const fs = require('fs');
const path = require('path');

const EMOJI = /\p{Extended_Pictographic}/u;
// An intentional pictograph goes here WITH ITS REASON, never by loosening the
// regex above. Empty is the correct state.
const ALLOW = [];

let failed = 0;
// The two legal documents are shipped, user-facing text rendered inside
// the app, so they are held to the same rule as the markup that renders
// them. A pictograph in a privacy policy is not a style preference.
for (const f of ['index.html', 'app.js', 'PRIVACY.md', 'TERMS.md']) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
  src.split('\n').forEach((ln, i) => {
    const stripped = [...ln].filter(c => !ALLOW.includes(c)).join('');
    if (EMOJI.test(stripped)) {
      console.log(`  FAIL  ${f}:${i + 1}  ${ln.trim().slice(0, 90)}`);
      failed++;
    }
  });
}

// The other half: an icon() call naming a symbol the sprite does not carry
// renders nothing at all — no error, no console line, just a gap where the
// mark should be. Exactly the failure shape a missing `id` has.
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');
const symbols = new Set([...html.matchAll(/<symbol id="i-([a-z]+)"/g)].map(m => m[1]));
const used = new Set([
  ...[...app.matchAll(/\bicon\(\s*'([a-z]+)'/g)].map(m => m[1]),
  ...[...html.matchAll(/href="#i-([a-z]+)"/g)].map(m => m[1]),
  // sprite names held in data and passed through icon() at the render site
  ...[...app.matchAll(/\bicon:\s*'([a-z]+)'/g)].map(m => m[1]),
]);
const unknown = [...used].filter(n => !symbols.has(n)).sort();
console.log((unknown.length ? '  FAIL  ' : '  PASS  ') +
  `every icon name resolves to a <symbol> in the sprite${unknown.length ? ` — these do not: ${unknown.join(', ')}` : ''}`);
if (unknown.length) failed++;

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
