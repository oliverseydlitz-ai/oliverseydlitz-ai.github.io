#!/usr/bin/env node
// Renders og-image.png at 1200x630 from a template.
//
// CLAUDE.md has always said this image is "RENDERED, not hand-cropped
// (Playwright, from a template), so it cannot drift from the 1200x630 the
// meta tags promise". No template and no generator existed anywhere in the
// repository or its history — the file was a committed PNG and the claim was
// aspirational. It went through the entire redesign still painted in the
// retired red accent, because seo-and-production.js checks the IHDR
// dimensions and nothing checks the pixels.
//
// The template below is the card. It reads the same palette and the same
// self-hosted typeface as the site, so a palette change is one re-run away
// from being reflected in the share card.
//
//   npm i --no-save playwright-core
//   node tools/build-og-image.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const TOKENS = { bg: '#0B0D10', surface: '#14171C', line: '#2A2F37',
                 text: '#F4F6F8', dim: '#6B7480', accent: '#FF6A2B', ink: '#0B0D10' };

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Archivo';font-style:normal;font-weight:400 800;
    font-stretch:100% 125%;src:url('fonts/archivo-latin.woff2') format('woff2')}
  @font-face{font-family:'Archivo Expanded';font-style:normal;font-weight:400 800;
    font-stretch:125%;src:url('fonts/archivo-latin.woff2') format('woff2')}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:${TOKENS.bg};color:${TOKENS.text};
    font-family:'Archivo',system-ui,sans-serif;overflow:hidden;position:relative;
    display:flex;flex-direction:column;justify-content:space-between;padding:72px 80px}
  /* The measurement grid the app itself sits on. */
  body::before{content:'';position:absolute;inset:0;
    background-image:linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);
    background-size:28px 28px}
  .row{position:relative;display:flex;align-items:center;gap:14px}
  .mark{width:34px;height:34px;fill:none;stroke:${TOKENS.accent};stroke-width:1.6;
    stroke-linecap:square;stroke-linejoin:miter}
  .wordmark{font-family:'Archivo Expanded';font-weight:800;font-size:30px;
    letter-spacing:.06em;text-transform:uppercase}
  .tag{font-family:ui-monospace,monospace;font-size:15px;letter-spacing:.22em;
    color:${TOKENS.dim};text-transform:uppercase}
  .beta{background:${TOKENS.accent};color:${TOKENS.ink};font-family:ui-monospace,monospace;
    font-size:13px;font-weight:700;letter-spacing:.16em;padding:4px 8px 3px;text-transform:uppercase}
  h1{position:relative;font-family:'Archivo Expanded';font-weight:800;font-size:74px;
    line-height:1.02;letter-spacing:-.015em;max-width:16ch}
  h1 em{font-style:normal;color:${TOKENS.accent}}
  p{position:relative;font-size:25px;line-height:1.45;color:${TOKENS.dim};max-width:44ch;margin-top:22px}
  .foot{position:relative;display:flex;gap:0;border-top:1px solid ${TOKENS.line};padding-top:26px}
  .cell{flex:1;border-left:1px solid ${TOKENS.line};padding-left:20px}
  .cell:first-child{border-left:none;padding-left:0}
  .k{font-family:ui-monospace,monospace;font-size:13px;letter-spacing:.14em;
    color:${TOKENS.dim};text-transform:uppercase;margin-bottom:7px}
  .v{font-family:'Archivo Expanded';font-weight:700;font-size:23px}
</style></head><body>
  <div class="row">
    <svg class="mark" viewBox="0 0 24 24"><path d="M6 3v18M6 4l12 4-12 4"/></svg>
    <span class="wordmark">ShotLab</span><span class="tag">Tour</span><span class="beta">Beta</span>
  </div>
  <div>
    <h1>Your launch monitor says <em>less</em> than you think.</h1>
    <p>Import a Rapsodo CSV. Get gapping, dispersion and recurring faults — with
       every number gated by what the device can actually measure.</p>
  </div>
  <div class="foot">
    <div class="cell"><div class="k">Trust tiers</div><div class="v">Three, not one</div></div>
    <div class="cell"><div class="k">Sample floor</div><div class="v">10 shots per club</div></div>
    <div class="cell"><div class="k">Tracking</div><div class="v">None</div></div>
  </div>
</body></html>`;

(async () => {
  const { chromium } = require('playwright-core');
  const exe = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 },
                                       deviceScaleFactor: 1 });
  // A file: URL so the @font-face can reach fonts/ on disk — the card must use
  // the real typeface, not whatever the renderer falls back to.
  const tmp = path.join(ROOT, '.og-template.html');
  fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'og-image.png'),
                          clip: { x: 0, y: 0, width: 1200, height: 630 } });
  fs.unlinkSync(tmp);
  await browser.close();
  const d = fs.readFileSync(path.join(ROOT, 'og-image.png'));
  console.log(`og-image.png rendered — ${d.readUInt32BE(16)}x${d.readUInt32BE(20)}, ${d.length} bytes`);
})();
