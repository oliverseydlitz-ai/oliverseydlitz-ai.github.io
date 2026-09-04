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
  const ctx = await b.newContext({ viewport:{width:393,height:852} });
  await ctx.route('**', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', x => errs.push(x.message));
  await p.goto((process.env.PW_URL || 'http://127.0.0.1:8766') + '/index.html',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(800);
  if (await p.locator('#agreementCheckbox').isVisible().catch(()=>0)) {
    await p.check('#agreementCheckbox'); await p.click('#agreementAcceptBtn'); await p.waitForTimeout(400); }
  await p.waitForSelector('#authGuestWrap button',{state:'visible',timeout:8000}).catch(()=>{});
  await p.click('#authGuestWrap button').catch(()=>{}); await p.waitForTimeout(600);
  // A brand-new account gets the FirstRun orientation over the home view. It is
  // a modal, so it intercepts every click after it — dismiss it the way a real
  // new user would before scanning anything.
  await p.click('#firstRunModal [data-fr="close"]').catch(()=>{}); await p.waitForTimeout(300);

  // Horizontal overflow at phone width. A page wider than its viewport is the
  // difference between "looks a bit off" and "looks broken": everything slides
  // sideways and nothing lines up. It happened because three block elements
  // were dropped inside a `display:flex; flex-wrap:nowrap` header and became
  // flex items beside the title, taking the session view to 605px on a 393px
  // phone. Nothing in the unit suites can see that — it only exists once CSS
  // has been applied by a real engine.
  let overflow = 0;
  const widthCheck = async label => {
    const m = await p.evaluate(() => {
      const de = document.documentElement;
      const clipped = el => { let q = el.parentElement;
        while (q && q !== de) { const ox = getComputedStyle(q).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
          q = q.parentElement; } return false; };
      const vw = de.clientWidth;
      return { vw, sw: de.scrollWidth,
        who: [...document.querySelectorAll('*')]
          .map(e => ({ e, r: e.getBoundingClientRect() }))
          .filter(({e,r}) => r.width > 0 && r.right > vw + 1 && !clipped(e))
          .slice(-3)
          .map(({e,r}) => `${e.tagName}.${(e.className||'').toString().trim().split(/\s+/)[0]||'-'}${e.id?'#'+e.id:''} right=${Math.round(r.right)}`) };
    });
    if (m.sw > m.vw + 1) {
      overflow++;
      console.log(`  OVERFLOW  ${label}: page is ${m.sw}px wide in a ${m.vw}px viewport`);
      m.who.forEach(w => console.log(`            ${w}`));
    }
    return m;
  };

  const imp = async (file, ball) => {
    await p.click('.bottom-nav-item[data-view="import"]'); await p.waitForTimeout(250);
    await p.setInputFiles('#fileInput', path.join(__dirname, 'fixtures', file)); await p.waitForTimeout(800);
    await p.click('#previewNext'); await p.waitForTimeout(250);
    await p.selectOption('#metaBall', ball); await p.click('#saveSession'); await p.waitForTimeout(1300);
  };
  await imp('session.csv','premium');
  // Measure the session detail HERE — this is where a real golfer lands after
  // an import, with the caveat, retention and since blocks all populated. The
  // later Router.showDetail() pass does not reproduce the same DOM, so a width
  // check taken only there missed the overflow bug entirely when it was live.
  await widthCheck('detail (after import)');
  await imp('realistic.csv','premium');
  await imp('session.csv','range');
  await widthCheck('detail (range ball)');

  const BAD = /\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b|\bnull\b/;
  const scan = (where, text) => {
    const lines = (text || '').split('\n').map(l => l.replace(/\s+/g,' ').trim()).filter(Boolean);
    const hits = lines.filter(l => BAD.test(l));
    if (hits.length) { console.log(`\n### ${where}`); hits.slice(0,8).forEach(h => console.log('   !', h.slice(0,160))); }
    return hits.length;
  };
  let total = 0;
  for (const v of ['sessions','yardages','progress','practice','drills','settings']) {
    await p.click(`.bottom-nav-item[data-view="${v}"]`).catch(()=>{});
    await p.waitForTimeout(1600);
    total += scan(v, await p.evaluate(() => document.body.innerText));
    await widthCheck(v);
  }
  // session detail, every section
  await p.evaluate(async () => { const ss = await Store.getSessions(); Router.showDetail(ss[0].id); });
  await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelectorAll('.fault-card').forEach(c => c.classList.add('open')));
  await p.waitForTimeout(500);
  total += scan('session detail', await p.evaluate(() => document.body.innerText));
  await widthCheck('session detail');
  // every drill-library tab
  await p.click('.bottom-nav-item[data-view="drills"]'); await p.waitForTimeout(1200);
  for (const s of ['A','B','C','D','E','F','G','H','I']) {
    await p.evaluate(sec => { const b=[...document.querySelectorAll('[data-drill-sec]')].find(x=>x.dataset.drillSec===sec); b&&b.click(); }, s);
    await p.waitForTimeout(350);
    total += scan('drills ' + s, await p.evaluate(() => document.getElementById('drillHost')?.innerText));
  }
  console.log(total ? `\n${total} suspicious line(s)` : '\nno NaN / undefined / [object Object] anywhere');
  console.log(overflow ? `${overflow} view(s) overflow horizontally` : 'no horizontal overflow at phone width');
  console.log('page errors:', errs.length?errs:'none');
  await b.close();
  // Exit non-zero on a finding. This used to only print, so its exit status was
  // 0 whatever it found — a check that cannot fail is a check that is not
  // running, and it was being reported as a pass on that basis.
  const failed = total + overflow + errs.length;
  if (failed) console.error(`\nrender-scan FAILED: ${total} text, ${overflow} overflow, ${errs.length} page error(s)`);
  process.exit(failed ? 1 : 0);
})();
