// The standalone pages at /terms and /privacy must match their source
// markdown, exactly.
//
// Those pages are a SECOND COPY of two legal documents, which this codebase
// otherwise refuses to allow — the yardage card, the drill library and the
// first-run screen all read their numbers from the module that owns them for
// exactly this reason. The copy is permitted here because a legal page has to
// render without JavaScript, and it is only safe because this suite makes
// drift impossible to commit: it re-renders from the markdown and compares.
//
// If this fails, the fix is `node tools/build-legal-pages.js` — never editing
// the HTML.
const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const { page, PAGES } = require(path.join(root, 'tools', 'build-legal-pages.js'));

console.log('— the built pages match the markdown they came from —');
for (const p of PAGES) {
  const file = path.join(root, p.slug, 'index.html');
  ok(fs.existsSync(file), `/${p.slug}/index.html exists`);
  if (!fs.existsSync(file)) continue;
  const onDisk = fs.readFileSync(file, 'utf8');
  ok(onDisk === page(p),
     `/${p.slug}/ is up to date with ${p.source}${onDisk === page(p) ? '' : ' — run: node tools/build-legal-pages.js'}`);
}

console.log('— and they work with no JavaScript at all —');
for (const p of PAGES) {
  const html = fs.readFileSync(path.join(root, p.slug, 'index.html'), 'utf8');
  const md = fs.readFileSync(path.join(root, p.source), 'utf8');
  // The document body is in the markup, not fetched. Sample real sentences
  // from the source rather than checking a byte count, which would pass on a
  // page containing the right amount of the wrong thing.
  const sentences = md.split('\n').filter(l => l.length > 90 && !l.startsWith('|') && !l.startsWith('#'));
  // Strip tags AND decode the entities the renderer escapes, or a probe
  // containing an apostrophe or an ampersand never matches and the check
  // reports a missing document that is in fact there.
  const text = html.replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const missing = sentences.slice(0, 6).filter(sen => {
    const probe = sen.replace(/\*\*/g, '').slice(20, 70);
    return !text.includes(probe);
  });
  ok(missing.length === 0, `/${p.slug}/ contains its own text in the HTML`);
  ok(!/Loading…|Loading\.\.\./.test(html), `/${p.slug}/ has no loading placeholder`);
  ok(/<h1>/.test(html), `/${p.slug}/ has a real <h1> for a crawler`);
}

console.log('— nothing on them can reach a third party —');
for (const p of PAGES.concat([{ slug: 'contact' }])) {
  const html = fs.readFileSync(path.join(root, p.slug, 'index.html'), 'utf8');
  const ext = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => m[1])
    .filter(u => !/^https:\/\/oliverseydlitz-ai\.github\.io/.test(u));
  const nonLink = ext.filter(u => !html.includes(`href="${u}" rel="noopener noreferrer"`));
  ok(nonLink.length === 0,
     `/${p.slug}/ loads no third-party asset${nonLink.length ? ` — ${nonLink.join(', ')}` : ''}`);
  ok(/script-src 'self'/.test(html), `/${p.slug}/ carries its own CSP`);
}

console.log('— the app and the pages agree on the version —');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const gate = (app.match(/const VERSION = '([0-9-]+)'/) || [])[1];
for (const p of PAGES) {
  const html = fs.readFileSync(path.join(root, p.slug, 'index.html'), 'utf8');
  ok(html.includes(gate), `/${p.slug}/ shows version ${gate}, the one the gate asks for`);
}

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
