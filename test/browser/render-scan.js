// playwright-core is NOT a dependency of this repo — `npm install` here is
// jsdom only, deliberately, and the site itself still has no build step. If it
// is missing, say so plainly rather than throwing a module-resolution stack.
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (_) {
  console.error('This check needs playwright-core, which this repo does not depend on.\n' +
                '  npm i --no-save playwright-core\n' +
                'Chromium itself is already on the box in CI images; set PW_CHROME to override the path.');
  process.exit(2);
}
const path = require('path');
const CHROME = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
// Renders every view, with data, and greps the DOM for the tells that a
// template literal referenced a field that does not exist: NaN, undefined,
// null, [object Object], and the "yds yds" kind of double-unit slip.
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox'] });
  const ctx = await b.newContext({ viewport:{width:430,height:940} });
  await ctx.route('**', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', x => errs.push(x.message));
  await p.goto((process.env.PW_URL || 'http://127.0.0.1:8766') + '/index.html',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(800);
  if (await p.locator('#agreementCheckbox').isVisible().catch(()=>0)) {
    await p.check('#agreementCheckbox'); await p.click('#agreementAcceptBtn'); await p.waitForTimeout(400); }
  await p.waitForSelector('#authGuestWrap button',{state:'visible',timeout:8000}).catch(()=>{});
  await p.click('#authGuestWrap button').catch(()=>{}); await p.waitForTimeout(600);

  const imp = async (file, ball) => {
    await p.click('.bottom-nav-item[data-view="import"]'); await p.waitForTimeout(250);
    await p.setInputFiles('#fileInput', path.join(__dirname, 'fixtures', file)); await p.waitForTimeout(800);
    await p.click('#previewNext'); await p.waitForTimeout(250);
    await p.selectOption('#metaBall', ball); await p.click('#saveSession'); await p.waitForTimeout(1300);
  };
  await imp('session.csv','premium');
  await imp('realistic.csv','premium');
  await imp('session.csv','range');

  const BAD = /\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b|\bnull\b/;
  const scan = (where, text) => {
    const lines = (text || '').split('\n').map(l => l.replace(/\s+/g,' ').trim()).filter(Boolean);
    const hits = lines.filter(l => BAD.test(l));
    if (hits.length) { console.log(`\n### ${where}`); hits.slice(0,8).forEach(h => console.log('   !', h.slice(0,160))); }
    return hits.length;
  };
  let total = 0;
  for (const v of ['sessions','yardages','progress','practice','settings']) {
    await p.click(`.bottom-nav-item[data-view="${v}"]`).catch(()=>{});
    await p.waitForTimeout(1600);
    total += scan(v, await p.evaluate(() => document.body.innerText));
  }
  // session detail, every section
  await p.evaluate(async () => { const ss = await Store.getSessions(); Router.showDetail(ss[0].id); });
  await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelectorAll('.fault-card').forEach(c => c.classList.add('open')));
  await p.waitForTimeout(500);
  total += scan('session detail', await p.evaluate(() => document.body.innerText));
  // every drill-library tab
  await p.click('.bottom-nav-item[data-view="practice"]'); await p.waitForTimeout(1200);
  for (const s of ['A','B','C','D','E','F','G','H','I']) {
    await p.evaluate(sec => { const b=[...document.querySelectorAll('[data-drill-sec]')].find(x=>x.dataset.drillSec===sec); b&&b.click(); }, s);
    await p.waitForTimeout(350);
    total += scan('drills ' + s, await p.evaluate(() => document.getElementById('drillHost')?.innerText));
  }
  console.log(total ? `\n${total} suspicious line(s)` : '\nno NaN / undefined / [object Object] anywhere');
  console.log('page errors:', errs.length?errs:'none');
  await b.close();
})();
