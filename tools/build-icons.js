#!/usr/bin/env node
// Builds the logo (Oliver chose "1a, the green", 25 Sep 2026) and every icon
// file the site serves from it.
//
// Two drawings, one scene. The DETAILED one (dimpled ball, pin band, the roll
// line into the cup) is for the sizes where detail survives: the installed app
// icon, the Apple touch icon, brand/logo.svg. The SIMPLE cut is for where it
// does not: the browser tab and Google's result favicon, which is shown at
// 16-32px and cropped to a circle. At those sizes dimples and a 1px band are
// noise, so the cut keeps the shapes (green, cup, pin, flag, ball) and makes
// them bigger. Every shape sits inside the circle Google crops to.
//
// Colours are READ from style.css's dark tokens, never typed: the old favicon
// was pine green on an app that had moved to graphite and orange, because
// nothing tied the two together. The green and the dimples are mixes of those
// tokens, so a palette change moves the logo with it.
//
//   node tools/build-icons.js          writes the SVGs, and the PNGs if
//                                      playwright-core is installed
//                                      (npm i --no-save playwright-core)
// test/suites/icons.js re-runs svgs() and fails if a committed file differs.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
function tokenBlock(sel) {
  const at = CSS.indexOf(sel + ' {');
  if (at < 0) throw new Error('build-icons: style.css has no ' + sel + ' block');
  const open = CSS.indexOf('{', at);
  let i = open + 1, depth = 1;
  while (i < CSS.length && depth > 0) { if (CSS[i] === '{') depth++; else if (CSS[i] === '}') depth--; i++; }
  return CSS.slice(open + 1, i - 1);
}
function token(name) {
  const m = new RegExp('--' + name + '\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;').exec(tokenBlock('html.dark'));
  if (!m) throw new Error('build-icons: --' + name + ' is not a 6-digit hex in html.dark');
  return m[1].toUpperCase();
}
// a*(1-t) + b*t, per channel.
function mix(a, b, t) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t)
    .toString(16).padStart(2, '0')).join('').toUpperCase();
}

function palette() {
  const field = token('accent'), ink = token('bg'), ball = token('text');
  return { field, ink, ball, green: mix(field, ink, 0.22), dimple: mix(ball, ink, 0.25) };
}

const r2 = n => +n.toFixed(2);
const FLAG = (x, y, w, h) =>
  `M${x} ${y}c${r2(w * .3)} -1.6 ${r2(w * .52)} 1.6 ${w} -.4v${h}c-${r2(w * .48)} 2 -${r2(w * .7)} -1.2 -${w} .4z`;

function detailed(p, { maskable = false } = {}) {
  const dimples = [[-.35, -.3, .16], [.25, -.4, .16], [.4, .15, .16], [-.1, .35, .16], [-.5, .2, .14]]
    .map(([dx, dy, r]) => `<circle cx="${+(31.5 + dx * 2.9).toFixed(2)}" cy="${+(33.2 + dy * 2.9).toFixed(2)}" r="${+(r * 2.9).toFixed(2)}"/>`).join('');
  // A maskable icon is cropped by the launcher to anything down to a circle of
  // 80% of its width, so the scene is scaled into that safe zone.
  const open = maskable ? '<g transform="translate(24 24) scale(.8) translate(-24 -24)">' : '<g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><title>ShotLab</title>
<rect width="48" height="48" fill="${p.field}"/>${open}
<ellipse cx="24" cy="35.5" rx="16" ry="5.2" fill="${p.green}"/>
<path d="M21.5 35.5l9-2.2" stroke="${p.ink}" stroke-opacity=".25" stroke-width="1.4"/>
<ellipse cx="21.5" cy="35.5" rx="4.4" ry="1.7" fill="${p.ink}"/>
<path d="M21.5 35.3V9.5" stroke="${p.ink}" stroke-width="2.2"/>
<path d="M21.5 33.5v-2.2" stroke="${p.ball}" stroke-width="2.2"/>
<path d="${FLAG(21.5, 9.8, 13.5, 9.2)}" fill="${p.ink}"/>
<circle cx="31.5" cy="33.2" r="2.9" fill="${p.ball}"/><g fill="${p.dimple}">${dimples}</g>
</g></svg>
`;
}

function simple(p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><title>ShotLab</title>
<rect width="48" height="48" fill="${p.field}"/>
<ellipse cx="24" cy="36" rx="17" ry="5.6" fill="${p.green}"/>
<ellipse cx="20.5" cy="36" rx="5.2" ry="2.1" fill="${p.ink}"/>
<path d="M20.5 35.8V8.5" stroke="${p.ink}" stroke-width="3.2"/>
<path d="${FLAG(20.5, 9, 15, 10.5)}" fill="${p.ink}"/>
<circle cx="32" cy="33" r="4" fill="${p.ball}"/>
</svg>
`;
}

// Everything text: the served favicon and the source logo. Pure, so the guard
// suite can regenerate it without a browser.
function svgs() {
  const p = palette();
  return { 'favicon.svg': simple(p), 'brand/logo.svg': detailed(p),
           _maskable: detailed(p, { maskable: true }) };
}

// PNG targets: [file, source, size].
const PNGS = [
  ['icon-192.png', 'brand/logo.svg', 192],
  ['icon-512.png', 'brand/logo.svg', 512],
  ['icon-maskable-512.png', '_maskable', 512],
  ['apple-touch-icon.png', 'brand/logo.svg', 180],
  ['favicon-48.png', 'favicon.svg', 48],
];

async function main() {
  const out = svgs();
  fs.mkdirSync(path.join(ROOT, 'brand'), { recursive: true });
  for (const f of ['favicon.svg', 'brand/logo.svg']) fs.writeFileSync(path.join(ROOT, f), out[f]);
  let chromium;
  try { ({ chromium } = require('playwright-core')); }
  catch (_) { console.log('build-icons: SVGs written; playwright-core not installed, PNGs skipped'); return; }
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const page = await browser.newPage();
  for (const [file, src, size] of PNGS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0">${out[src].replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(ROOT, file), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
  console.log('build-icons: wrote favicon.svg, brand/logo.svg and ' + PNGS.map(x => x[0]).join(', '));
}

module.exports = { svgs, palette, PNGS };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
