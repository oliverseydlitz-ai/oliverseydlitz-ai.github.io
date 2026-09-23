// The guide pages at /guides/<slug>/ — generated, cited, and honest.
//
// These are the only pages on the site written to be FOUND: the app is one URL
// of hash routes, so a guide is what a search engine can rank. That makes them
// the easiest place in the repository to ship a fabricated number. Nothing
// downstream consumes the text, so a wrong figure never surfaces anywhere else,
// and a page written to attract strangers is under the most pressure to
// overclaim. Four things are pinned here:
//
//   1. The HTML is exactly what the generator makes from the markdown, and the
//      sitemap lists exactly the guides it knows about.
//   2. Every number has a home: a {{token}} resolved from the real modules, or
//      a figure that appears in the research base. A typed number found in
//      neither fails, by name.
//   3. The research base's "never claim" wording and the no-fabrication rule
//      (no ratings, reviews or testimonials in the markup or the JSON-LD).
//   4. The pages work with no JavaScript and reach no third party.
//
// If the first block fails, the fix is `node tools/build-guide-pages.js` —
// never editing the HTML.
const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const tool = require(path.join(root, 'tools', 'build-guide-pages.js'));
const { GUIDES, TOKEN, PHOTO, DOMAIN } = tool;

console.log('— the built pages match the markdown they came from —');
const want = tool.outputs();
for (const [file, text] of Object.entries(want)) {
  const exists = fs.existsSync(path.join(root, file));
  ok(exists && read(file) === text,
     `${file} is up to date${exists && read(file) === text ? '' : ' — run: node tools/build-guide-pages.js'}`);
}
ok(GUIDES.length >= 1, `${GUIDES.length} guides are listed`);
ok(new Set(GUIDES.map(g => g.slug)).size === GUIDES.length, 'no two guides share a slug');
ok(GUIDES.every(g => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)), 'every slug is lowercase words and hyphens');

console.log('— the sitemap lists every guide, once —');
{
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const guideLocs = locs.filter(u => u.startsWith(`${DOMAIN}/guides/`));
  const expected = [`${DOMAIN}/guides/`, ...GUIDES.map(g => `${DOMAIN}/guides/${g.slug}/`)];
  ok(expected.every(u => locs.filter(l => l === u).length === 1), 'the index and each guide appear exactly once');
  ok(guideLocs.length === expected.length,
     `no stale guide URL survives in the sitemap (${guideLocs.length} listed, ${expected.length} expected)`);
}

console.log('— every number has a source —');
// The research base is the source for anything the app does not own. The
// short-game evidence file is the second half of it. Numbers are compared
// after normalising the minus sign and thousands separators, so "−2,628" in a
// guide matches "−2,628" or "-2628" in the base.
const SOURCES = ['docs/research-base-v2.md', 'docs/short-game-evidence.md'].map(read).join('\n');
const norm = s => s.replace(/[−–]/g, '-');
// Thousands groups only: "only 2, because" is the number 2, not "2,".
const numbersIn = s => [...norm(s).matchAll(/\d+(?:,\d{3}(?!\d))*(?:\.\d+)?/g)]
  .map(m => m[0].replace(/,/g, ''));
const KNOWN = new Set(numbersIn(SOURCES));
// What a guide's prose says, minus the things that are not claims: the tokens
// (resolved from the modules, checked below), link targets (a URL is an
// address, not a figure), and the photo slots (notes to Oliver, not rendered).
const prose = md => md
  .replace(TOKEN, ' ')
  .replace(/\]\([^)]*\)/g, ']')
  .split('\n').filter(l => !PHOTO.test(l.trim())).join('\n');
const unsourced = md => [...new Set(numbersIn(prose(md)))].filter(n => !KNOWN.has(n));
// A check that cannot fail proves nothing. A figure invented for this line
// must be caught, and a real one from the base must not be.
ok(unsourced('Most golfers lose 37.4% of their spin to wind.').includes('37.4'),
   'positive control: an invented figure is caught');
ok(unsourced('The limits run from −2,628 to +5,103 rpm.').length === 0,
   'and a real one from the research base is not');
for (const g of GUIDES) {
  const miss = unsourced(read(g.source));
  ok(miss.length === 0,
     `${g.slug}: every typed number appears in the research base${miss.length ? ' — no source for: ' + miss.join(', ') : ''}`);
}

// A citation link is a source too. Every outbound URL must appear verbatim in
// the research base's bibliography: a URL typed from memory looks exactly as
// authoritative as a real one, and the first draft of the smash guide had one.
console.log('— every citation link is one the research base already cites —');
for (const g of GUIDES) {
  const urls = [...read(g.source).matchAll(/\]\((https:\/\/[^)\s]+)\)/g)].map(m => m[1]);
  const stray = urls.filter(u => !SOURCES.includes(u));
  ok(urls.length > 0 && stray.length === 0,
     `${g.slug}: ${urls.length} citation link(s), all from the bibliography${stray.length ? ' — not in the research base: ' + stray.join(', ') : ''}`);
}

console.log('— every token resolves against the real modules —');
for (const g of GUIDES) {
  const tokens = [...read(g.source).matchAll(TOKEN)];
  let bad = [];
  for (const t of tokens) {
    try { tool.resolveToken(t[1], t[2]); } catch (e) { bad.push(t[0]); }
  }
  ok(bad.length === 0, `${g.slug}: ${tokens.length} token(s), all resolve${bad.length ? ' — broken: ' + bad.join(', ') : ''}`);
  ok(!/\{\{|\}\}/.test(read(`guides/${g.slug}/index.html`)), `${g.slug}: no unresolved token reaches the page`);
}
{
  let threw = false;
  try { tool.resolveToken('Metrics.NO_SUCH_FLOOR'); } catch (_) { threw = true; }
  ok(threw, 'a token naming something the app does not export fails the build rather than printing "undefined"');
}
// The floors the guides quote ARE the code's floors, not a copy of them.
{
  const { load } = require(path.join(root, 'test', 'load.js'));
  const { Metrics } = load().app;
  const acc = read('guides/mlm2pro-accuracy/index.html');
  ok(acc.includes(`at least ${Metrics.MIN_SHOTS_REPORT} shots`),
     `the accuracy guide prints the live report floor (${Metrics.MIN_SHOTS_REPORT})`);
}

console.log('— the claims the research base forbids (§9) —');
// Anchored on the CLAIM, not the vocabulary: the spin guide has to be able to
// say "worn wedge grooves", and a guide explaining why "+3 yards per degree" is
// wrong has to be able to name the idea without printing the number.
const NEVER = [
  [/\b(?:to groove|groov(?:e|es|ing|ed) (?:a|the|your|this|that|it|in)\b)/i, 'a rep or week count to "groove" a change'],
  [/\b(?:automaticity|rewir\w*|train\w* your subconscious)\b/i, 'building automaticity or rewiring motor patterns'],
  [/[+]?\d+(?:\.\d+)?\s*(?:yards?|yds?)\s*(?:per|\/|a|for every)\s*(?:degree|°)/i, '"+N yards per degree" of attack angle'],
  [/\bface (?:was|is) \d/i, 'a face angle stated from one shot'],
  [/\bcosting you [\d.]+ strokes?\b/i, 'a delivery metric converted to strokes'],
  [/\b(?:kinematic sequence is|you'?re not using the ground|lead wrist is cupped)\b/i, 'body mechanics inferred from launch data'],
];
for (const g of GUIDES) {
  const md = read(g.source);
  const hits = NEVER.filter(([re]) => re.test(md)).map(([, why]) => why);
  ok(hits.length === 0, `${g.slug}: makes none of the forbidden claims${hits.length ? ' — ' + hits.join('; ') : ''}`);
}
ok(NEVER[2][0].test('you gain +3 yards per degree') && NEVER[0][0].test('it takes 3 weeks to groove a new move'),
   'positive control: the wording checks still fire on the claims they name');

console.log('— nothing fabricated in the markup —');
for (const file of ['guides/index.html', ...GUIDES.map(g => `guides/${g.slug}/index.html`)]) {
  const html = read(file);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([^]*?)<\/script>/g)].map(m => m[1]);
  let parsed = null;
  try { parsed = ld.length === 1 ? JSON.parse(ld[0]) : null; } catch (_) {}
  ok(parsed !== null, `${file}: exactly one JSON-LD block, and it parses`);
  ok(!/aggregateRating|ratingValue|"review"|reviewCount|testimonial/i.test(html),
     `${file}: no rating, review or testimonial — there are none to cite`);
}

console.log('— they work with no JavaScript, and reach no third party —');
for (const g of GUIDES) {
  const file = `guides/${g.slug}/index.html`;
  const html = read(file);
  const md = read(g.source);
  const text = html.replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const sentences = md.split('\n').filter(l => l.length > 90 && !/^[|#>\-\d[]/.test(l) && !TOKEN.test(l));
  TOKEN.lastIndex = 0;
  const missing = sentences.slice(0, 6).filter(s => !text.includes(s.replace(/\*\*/g, '').replace(/\*/g, '').slice(20, 70)));
  ok(sentences.length > 0 && missing.length === 0, `${g.slug}: its own text is in the HTML`);
  ok(!/<script(?![^>]*application\/ld\+json)[^>]*>/.test(html), `${g.slug}: no script at all — nothing on it needs one`);
  ok((html.match(/<h1>/g) || []).length === 1, `${g.slug}: exactly one <h1>`);
  ok(html.includes(`<link rel="canonical" href="${DOMAIN}/guides/${g.slug}/">`), `${g.slug}: canonical is its own production URL`);
  ok(/script-src 'self'/.test(html), `${g.slug}: carries its own CSP`);
  ok(/href="\/"/.test(html), `${g.slug}: links into the app`);
  ok(/<h2>Sources<\/h2>/.test(html), `${g.slug}: has a Sources section`);
  const ext = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => m[1])
    .filter(u => !u.startsWith(DOMAIN));
  const loaded = ext.filter(u => !html.includes(`href="${u}" rel="noopener noreferrer"`));
  ok(loaded.length === 0, `${g.slug}: loads no third-party asset, and every outbound link is a plain citation`);
  ok(!/src="https?:/.test(html), `${g.slug}: no remote src of any kind`);
}

console.log('— photo slots still waiting for Oliver (informational) —');
for (const g of GUIDES) {
  const slots = read(g.source).split('\n').filter(l => PHOTO.test(l.trim()));
  console.log(`        ${g.slug}: ${slots.length} open photo slot(s)`);
  ok(!/\[\[photo/i.test(read(`guides/${g.slug}/index.html`)), `${g.slug}: no raw photo marker reaches the reader`);
}

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
