// ── The logo and every icon file come from one generator (tools/build-icons) ──
//
// The old favicon was pine green on an app that had moved to graphite and
// orange, and the PNGs beside it were hand-exported copies nobody could
// regenerate — so the logo and the app disagreed for the whole redesign and
// nothing could notice. Now the SVGs are rebuilt here from style.css and
// compared byte for byte, and each PNG is checked for the size it claims.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const tool = require(path.join(ROOT, 'tools', 'build-icons.js'));
const built = tool.svgs();

console.log('— the committed SVGs are what the generator makes from style.css —');
for (const f of ['favicon.svg', 'brand/logo.svg']) {
  ok(fs.existsSync(path.join(ROOT, f)) && read(f) === built[f],
     `${f} is current (re-run: node tools/build-icons.js)`);
}
const css = read('style.css');
const darkAccent = (/--accent:\s*(#[0-9a-f]{6})/i.exec(css.slice(css.indexOf('html.dark {'))) || [])[1];
ok(darkAccent && tool.palette().field === darkAccent.toUpperCase(),
   `the field is the dark theme's accent, read from style.css (${darkAccent})`);
ok(!/#0b4d2e/i.test(read('favicon.svg')), 'the retired pine green is gone');

console.log('— every PNG is the size it claims —');
const ihdr = f => { const b = fs.readFileSync(path.join(ROOT, f));
  return b.slice(1, 4).toString() === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
for (const [file, , size] of tool.PNGS) {
  const d = fs.existsSync(path.join(ROOT, file)) ? ihdr(file) : null;
  ok(d && d[0] === size && d[1] === size, `${file} is ${size}x${size}${d ? '' : ' (missing or not a PNG)'}`);
}
// Google's result favicon wants a multiple of 48px, and the SVG alone is not
// guaranteed to be used.
ok(tool.PNGS.some(([f, , s]) => f === 'favicon-48.png' && s % 48 === 0), 'the raster favicon is a multiple of 48px');

console.log('— and each one is linked where it is used —');
const html = read('index.html');
ok(/<link rel="icon" type="image\/svg\+xml" href="\/favicon.svg">/.test(html), 'index.html links the SVG favicon');
ok(/<link rel="icon" type="image\/png" sizes="48x48" href="\/favicon-48.png">/.test(html), 'and the 48px raster');
ok(/<link rel="apple-touch-icon" href="\/apple-touch-icon.png">/.test(html), 'and the Apple touch icon');
const man = JSON.parse(read('manifest.json'));
const icon = (purpose, src) => man.icons.some(i => i.purpose === purpose && i.src === src);
ok(icon('any', '/icon-192.png') && icon('any', '/icon-512.png'), 'the manifest lists the app icons');
ok(icon('maskable', '/icon-maskable-512.png'),
   'and a maskable icon drawn inside the safe zone, not the full-bleed one a launcher would crop');
const sw = read('sw.js');
const missing = tool.PNGS.map(x => '/' + x[0]).concat('/favicon.svg').filter(a => !sw.includes(`'${a}'`));
ok(!missing.length, `the service worker precaches every icon${missing.length ? ': missing ' + missing.join(', ') : ''}`);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
