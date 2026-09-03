const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const has = f => fs.existsSync(path.join(root, f));
const DOMAIN = 'https://oliverseydlitz-ai.github.io';

// SEO and production metadata rot silently: nothing renders it, no user reports
// it, and it is only ever noticed by a crawler that has already moved on. These
// are cheap assertions on files that otherwise have no reader.

console.log('— the files a crawler looks for exist —');
for (const f of ['robots.txt','sitemap.xml','404.html','llms.txt','og-image.png','favicon.svg','manifest.json','.nojekyll'])
  ok(has(f), `${f} exists`);

console.log('— robots.txt points somewhere real —');
const robots = read('robots.txt');
ok(/^User-agent: \*/m.test(robots), 'it addresses every crawler');
ok(/^Allow: \/$/m.test(robots), 'and allows the site');
ok(robots.includes(`Sitemap: ${DOMAIN}/sitemap.xml`), 'and names the sitemap on the production domain');
ok(/Disallow: \/test\//.test(robots) && /Disallow: \/node_modules\//.test(robots),
   'test and dependency scaffolding is kept out of the index');
ok(!/^Disallow: \/$/m.test(robots), 'and it never blocks the whole site — the failure that costs everything');

console.log('— the sitemap lists exactly the one indexable URL —');
const sm = new JSDOM(read('sitemap.xml'), { contentType: 'text/xml' }).window.document;
const locs = [...sm.querySelectorAll('loc')].map(n => n.textContent);
ok(locs.length === 1, `one URL (${locs.length}) — the app is a single page and its views are hash routes a crawler discards`);
ok(locs[0] === `${DOMAIN}/`, 'and it is the canonical root on the production domain');
ok(locs.every(u => u.startsWith('https://')), 'https only');
ok(!locs.some(u => /#/.test(u)), 'no hash routes, which cannot be indexed separately');

console.log('— index.html carries the metadata that gets it shared and indexed —');
const doc = new JSDOM(read('index.html')).window.document;
const meta = (sel, attr='content') => doc.querySelector(sel)?.getAttribute(attr) || '';
ok(doc.querySelector('title').textContent.length > 20, 'a real title');
ok(meta('meta[name="description"]').length > 80, 'a real description, not a placeholder');
ok(meta('link[rel="canonical"]','href') === `${DOMAIN}/`, 'canonical is the production root');
ok(doc.querySelectorAll('link[rel="canonical"]').length === 1, 'and there is exactly one — two is worse than none');
for (const p of ['og:title','og:description','og:type','og:url','og:image','og:site_name'])
  ok(meta(`meta[property="${p}"]`).length > 0, `${p} is set`);
ok(meta('meta[property="og:image"]').startsWith(DOMAIN), 'the share image is an absolute production URL');
ok(meta('meta[property="og:image:alt"]').length > 20, 'and it has alt text');
ok(meta('meta[name="twitter:card"]') === 'summary_large_image', 'twitter uses the large card');
ok(meta('meta[name="twitter:image"]').startsWith(DOMAIN), 'with an absolute image');

console.log('— the share image is really 1200x630 —');
// Read the PNG IHDR directly: a card meta tag promising dimensions the file
// does not have is a broken preview on every platform that honours it.
const png = fs.readFileSync(path.join(root, 'og-image.png'));
ok(png.slice(1,4).toString() === 'PNG', 'it is a PNG');
const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
ok(w === 1200 && h === 630, `dimensions are ${w}x${h}`);
ok(String(w) === meta('meta[property="og:image:width"]') &&
   String(h) === meta('meta[property="og:image:height"]'),
   'and the meta tags match the actual file rather than being typed from memory');

console.log('— structured data describes what is really there —');
const ldNodes = [...doc.querySelectorAll('script[type="application/ld+json"]')];
ok(ldNodes.length === 1, 'one JSON-LD block');
let ld = null;
try { ld = JSON.parse(ldNodes[0].textContent); } catch (e) { /* reported below */ }
ok(ld !== null, 'it parses — malformed JSON-LD is ignored wholesale by every consumer');
if (ld) {
  ok(ld['@type'] === 'WebApplication', 'typed as a WebApplication, which is what it is');
  ok(ld.url === `${DOMAIN}/`, 'on the production domain');
  ok(ld.isAccessibleForFree === true && ld.offers.price === '0', 'and free, which is true');
  // The rule that matters: no invented social proof.
  ok(!('aggregateRating' in ld), 'NO aggregateRating — there are no ratings, and inventing them for a rich snippet is the fabrication this app refuses everywhere else');
  ok(!('review' in ld), 'and no reviews');
  ok(ld['@type'] !== 'LocalBusiness', 'not a LocalBusiness — there is no premises, address or trading entity');
  ok(Array.isArray(ld.featureList) && ld.featureList.length > 3, 'the feature list is real');
}

console.log('— the 404 page is a 404, not a redirect —');
const d404 = new JSDOM(read('404.html')).window.document;
ok(d404.querySelector('title').textContent.toLowerCase().includes('not found'), 'it says so in the title');
ok(d404.querySelector('h1'), 'it has a heading');
ok(d404.querySelector('a[href="/"]'), 'and a link home');
ok(d404.querySelectorAll('a').length >= 3, 'plus useful navigation');
ok(d404.querySelector('meta[name="robots"]').content.includes('noindex'), 'noindex, so it never enters the index');
ok(!/location\.replace|location\.href\s*=|http-equiv=["']refresh/i.test(read('404.html')),
   'and it does NOT redirect — bouncing every bad URL to the homepage tells a crawler the wrong URL was fine');

console.log('— no development artefacts ship —');
ok(!has('vite.config.js') && !has('webpack.config.js'), 'no bundler config (there is no build step)');
const maps = fs.readdirSync(root).filter(f => f.endsWith('.map'));
ok(maps.length === 0, 'no source maps at the site root');
ok(!/sourceMappingURL/.test(read('app.js')), 'and app.js references none');

console.log('— no PII is written to the console —');
const app = read('app.js');
const logLines = app.split('\n').filter(l => /console\.(log|warn|info)\(/.test(l) && !/^\s*\/\//.test(l));
ok(!logLines.some(l => /\.email/.test(l)),
   'no console line logs an email — PII in devtools history rides along in every screen-share and bug report');
ok(/function authLog/.test(app), 'auth tracing goes through authLog');
ok(/slDebug.*!== '1'.*return|getItem\('slDebug'\) !== '1'/.test(app),
   'which is off unless the debug flag is set');

console.log('— the service worker fails honestly —');
const sw = read('sw.js');
ok(/req\.mode === 'navigate'/.test(sw),
   'only a navigation falls back to the app shell — every failed GET used to receive index.html, so an offline asset came back as a page of HTML');
ok(/'\/404\.html'/.test(sw), 'and 404.html is precached so it works offline');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
