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
  // SM_NO_IO=1 deletes IntersectionObserver before any script runs. Task 15's
  // whole constraint is that the page is already correct when the observer
  // never fires, and the only honest way to check that is to take it away and
  // require this scan to pass unchanged. Run it both ways after touching
  // ScrollMotion; a constraint nobody exercises is a comment.
  if (process.env.SM_NO_IO === '1')
    await ctx.addInitScript(() => { try { delete window.IntersectionObserver; } catch (_) {} });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', x => errs.push(x.message));
  await p.goto((process.env.PW_URL || 'http://127.0.0.1:8766') + '/index.html',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(800);
  // Two boxes now: the agreement and the experimental-software
  // acknowledgement. Accept stays disabled until both are ticked, which is
  // the point of them being separate.
  if (await p.locator('#agreementCheckbox').isVisible().catch(()=>0)) {
    await p.check('#agreementCheckbox');
    await p.check('#agreementRiskCheckbox');
    await p.click('#agreementAcceptBtn'); await p.waitForTimeout(400);
    // The storage notice is raised after the gate, as its own question, and
    // covers the bottom of the viewport until it is answered.
    if (await p.locator('#cookieAcceptBtn').isVisible().catch(()=>0)) {
      await p.click('#cookieAcceptBtn'); await p.waitForTimeout(300);
    }
  }
  await p.waitForSelector('#authGuestWrap button',{state:'visible',timeout:8000}).catch(()=>{});
  await p.click('#authGuestWrap button').catch(()=>{}); await p.waitForTimeout(600);
  // FirstRun no longer opens by itself (23 Sep); this dismissal is a no-op kept
  // in case an older build is being scanned. Originally: a brand-new account got
  // the FirstRun orientation over the home view. It is
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
  // Scroll boxes known to clip at 393px, each with the plan item that fixes it
  // (docs/superpowers/plans/2026-09-22-killer-plan.md). Struck off when fixed.
  const KNOWN_CLIPPED = {
    '#gapTable':          'killer plan 2.6 — the gapping tab, ~14px over',
    '#benchTable':        'killer plan 2.6 — benchmarking, three columns a side',
    'in #launchWindows':  'killer plan 2.6 — launch windows, seven columns',
  };
  const seenClipped = new Set();
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
    // Three layout defects the page-width check CANNOT see, all found on a real
    // phone on 22 Sep 2026 while this scan reported clean:
    //  1. a scroll box whose content is wider than it — the yardage book was
    //     723px of table in a 359px box, trend column off-screen. The page does
    //     not widen, because the box clips; the golfer just has to side-scroll.
    //  2. a view title with no gutter — every title sat at x=0 on a phone,
    //     because a later `padding` shorthand killed the sticky header's
    //     padding-inline. Nothing overflowed; it was just wrong.
    //  3. a label wider than its own box — "CONSISTENCY" spilled out of its
    //     stat card on desktop.
    const inner = await p.evaluate(() => {
      const V = document.querySelector('.view.active');
      if (!V) return { boxes: [], title: null, labels: [] };
      const boxes = [...V.querySelectorAll('*')].filter(e => {
        const ox = getComputedStyle(e).overflowX;
        return (ox === 'auto' || ox === 'scroll') && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2
          // a deliberate horizontal strip (tabs, chips) scrolls by design
          // Deliberate horizontal strips and data grids declare it in the markup
          // with data-hscroll (the shot log: fifteen metrics per shot, where a
          // scrolling grid IS the right form), or are tab rows.
          && !e.matches('[role="tablist"], .subnav, .drill-tabs, [data-hscroll]');
      }).map(e => {
        // Named by the table inside, or the nearest ancestor with an id, so the
        // known list below can name it and a new one is reported by name.
        const t = e.querySelector('table[id]');
        let a = e; while (a && !a.id) a = a.parentElement;
        return { name: t ? '#' + t.id : a ? 'in #' + a.id : e.className, box: e.clientWidth, content: e.scrollWidth };
      });
      const t = V.querySelector('.view-title');
      const title = t && t.offsetParent ? Math.round(t.getBoundingClientRect().left) : null;
      const labels = [...V.querySelectorAll('[class$="-label"], [class*="-label "]')]
        .filter(e => e.offsetParent && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
        .map(e => `.${(e.className + '').split(/\s+/)[0]} "${e.textContent.trim().slice(0, 24)}" ${e.scrollWidth}px in ${e.clientWidth}px`);
      return { boxes, title, labels };
    });
    // A ratchet, like cascade-overrides.js: the ones that exist today are named
    // with the plan item that fixes them. A new one fails; a fixed one that is
    // still listed fails too (checked once at the end), so the list only shrinks.
    for (const bx of inner.boxes) {
      if (KNOWN_CLIPPED[bx.name]) { seenClipped.add(bx.name); continue; }
      overflow++; console.log(`  CLIPPED   ${label}: ${bx.name} is ${bx.content}px of content in a ${bx.box}px box`);
    }
    if (inner.title !== null && inner.title < 8) {
      overflow++; console.log(`  GUTTER    ${label}: the view title starts at x=${inner.title}px — no side margin`);
    }
    if (inner.labels.length) { overflow++; console.log(`  SPILL     ${label}: ${inner.labels.slice(0, 3).join('; ')}`); }
    // HIDDEN: an element marked `hidden` that still renders. An author
    // `display` rule beats the browser's [hidden] rule, so this is invisible
    // to every unit suite — it is how a guest was shown "Sign out" and
    // "Delete my account" (QC V25). style.css now forces [hidden] to win; this
    // is the check that it keeps winning.
    const shownHidden = await p.evaluate(() => [...document.querySelectorAll('[hidden]')]
      .filter(e => getComputedStyle(e).display !== 'none')
      .map(e => e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + (e.className + '').split(' ')[0]));
    if (shownHidden.length) { overflow++; console.log(`  HIDDEN    ${label}: marked hidden but rendered: ${shownHidden.slice(0, 5).join(', ')}`); }
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

  // RING: every focusable control, focused from the keyboard, must have a
  // focus ring that is actually drawn (R20/V26). Three ways it was not, all
  // at once, while the stylesheet's own comment said the outline "ignores
  // clip-path, so it is always visible":
  //   OWN CLIP       — the control's clip-path (the chamfer) cuts off an
  //                    outline drawn outside it: every chamfered button.
  //   ANCESTOR CLIP  — a box with overflow hidden/auto cuts the edge that
  //                    crosses it: every Settings row, the drill tabs, chips.
  //   SAME COLOUR    — an inset ring the colour of the control's own fill.
  // A control scrolled partly out of its box is legitimately clipped and is
  // not reported. No exemption list: there is nothing here worth exempting.
  let rings = 0;
  // POINTER: anything styled as clickable (`cursor: pointer`) must be
  // reachable from the keyboard — itself, an ancestor, or a descendant that
  // declares itself the keyboard way in with `data-key-proxy` (R4). The first
  // run of this found every session card, the last-session tile, the ranked
  // card, the fault headers, every shot row and every table header: the
  // app's main navigation was pointer-only.
  const pointerCheck = async label => {
    const res = await p.evaluate(() => {
      const REACH = 'button, a[href], input, select, textarea, label, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
      const inView = el => { const v = el.closest('.view'); return !v || v.classList.contains('active'); };
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!inView(el) || el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        if (getComputedStyle(el).cursor !== 'pointer') continue;
        if (el.closest(REACH)) continue;
        // `cursor` inherits, so judge the OUTERMOST element of the pointer
        // chain — the card, not every line of text inside it.
        let root = el;
        while (root.parentElement && getComputedStyle(root.parentElement).cursor === 'pointer') root = root.parentElement;
        if (root.closest(REACH) || root.querySelector('[data-key-proxy]')) continue;
        out.push(root.tagName.toLowerCase() + '.' + ((root.className + '').trim().split(/\s+/)[0] || '') + (root.id ? '#' + root.id : ''));
      }
      return [...new Set(out)];
    });
    res.slice(0, 12).forEach(x => console.log(`  POINTER   ${label}: ${x} looks clickable and no keyboard reaches it`));
    rings += res.length;
  };
  const ringCheck = async label => {
    await p.keyboard.press('Shift');   // a keyboard interaction, so focus() matches :focus-visible
    const res = await p.evaluate(() => {
      // Buttons transition outline-color, so a style read straight after
      // focus() sees the colour mid-flight and SAME COLOUR can never match.
      // Found by checking the check: an accent ring on the accent button
      // passed until transitions were switched off for the measurement.
      const still = document.createElement('style');
      still.textContent = '*, *::before, *::after { transition: none !important; }';
      document.head.appendChild(still);
      const out = [];
      const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])';
      const inView = el => { const v = el.closest('.view'); return !v || v.classList.contains('active'); };
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || !inView(el) || el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden') continue;
        if (el.closest('.modal-overlay:not(.open), .modal:not(.open)')) continue;
        el.focus({ preventScroll: true });
        if (document.activeElement !== el || !el.matches(':focus-visible')) continue;
        const cs = getComputedStyle(el);
        const w = parseFloat(cs.outlineWidth) || 0, off = parseFloat(cs.outlineOffset) || 0;
        const name = el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + ((el.className + '').trim().split(/\s+/)[0] || '') + (el.textContent ? ' "' + el.textContent.trim().slice(0, 20) + '"' : '');
        if (cs.outlineStyle === 'none' || w === 0) { if (cs.boxShadow === 'none') out.push(`NO RING ${name}`); continue; }
        if (cs.clipPath !== 'none' && off > -w) { out.push(`OWN CLIP ${name} (offset ${off}px)`); continue; }
        if (off <= -w && cs.outlineColor === cs.backgroundColor) { out.push(`SAME COLOUR ${name}`); continue; }
        const e = off + w;
        const ring = { l: r.left - e, t: r.top - e, r: r.right + e, b: r.bottom + e };
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const ac = getComputedStyle(a);
          const clips = ac.overflowX !== 'visible' || ac.overflowY !== 'visible' || ac.clipPath !== 'none';
          if (!clips) continue;
          const ar = a.getBoundingClientRect();
          const inside = r.left >= ar.left - .5 && r.right <= ar.right + .5 && r.top >= ar.top - .5 && r.bottom <= ar.bottom + .5;
          if (!inside) break;        // scrolled partly out of its box: legitimately clipped
          if (ring.l < ar.left - .5 || ring.r > ar.right + .5 || ring.t < ar.top - .5 || ring.b > ar.bottom + .5) {
            out.push(`ANCESTOR CLIP ${name} by ${a.tagName.toLowerCase()}.${(a.className + '').split(' ')[0]}`); break;
          }
        }
      }
      document.activeElement && document.activeElement.blur();
      still.remove();
      return out;
    });
    const uniq = [...new Set(res.map(x => x.replace(/ ".*?"/, '')))];
    uniq.slice(0, 12).forEach(x => console.log(`  RING      ${label}: ${x}`));
    rings += uniq.length;
  };

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
    await ringCheck(v);
    await pointerCheck(v);
  }
  // session detail, every section
  await p.evaluate(async () => { const ss = await Store.getSessions(); Router.showDetail(ss[0].id); });
  await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelectorAll('.fault-card').forEach(c => c.classList.add('open')));
  await p.waitForTimeout(500);
  total += scan('session detail', await p.evaluate(() => document.body.innerText));
  await widthCheck('session detail');
  await ringCheck('session detail');
  await pointerCheck('session detail');
  // every drill-library tab
  await p.click('.bottom-nav-item[data-view="drills"]'); await p.waitForTimeout(1200);
  for (const s of ['A','B','C','D','E','F','G','H','I']) {
    await p.evaluate(sec => { const b=[...document.querySelectorAll('[data-drill-sec]')].find(x=>x.dataset.drillSec===sec); b&&b.click(); }, s);
    await p.waitForTimeout(350);
    total += scan('drills ' + s, await p.evaluate(() => document.getElementById('drillHost')?.innerText));
  }
  // The guide pages (/guides/). They are not app views, so none of the passes
  // above ever load them — and they are the pages written for strangers on a
  // phone. Same three findings: page wider than the viewport, a table wider
  // than its own scroll box, and a template tell in the text. The list is read
  // from the generator, so a new guide is scanned without editing this file.
  {
    const { GUIDES } = require(path.join(__dirname, '..', '..', 'tools', 'build-guide-pages.js'));
    const base = process.env.PW_URL || 'http://127.0.0.1:8766';
    const gp = await ctx.newPage();
    gp.on('pageerror', x => errs.push('guide: ' + x.message));
    // The legal pages share the guides' header and were 483-589px wide at this
    // viewport from the day they shipped, because nothing loaded them. They get
    // the page-width check only: /privacy/'s storage table is a deliberate
    // horizontal scroller.
    const LEGAL = ['/terms/', '/privacy/', '/contact/'];
    for (const url of ['/guides/', ...GUIDES.map(g => `/guides/${g.slug}/`), ...LEGAL]) {
      const res = await gp.goto(base + url, { waitUntil: 'load' });
      if (!res || !res.ok()) { overflow++; console.log(`  MISSING   ${url} did not load (${res && res.status()}) — did you run sync.sh?`); continue; }
      const m = await gp.evaluate(() => ({
        vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth,
        tables: [...document.querySelectorAll('.doc-table-wrap')].filter(w => w.scrollWidth > w.clientWidth + 1)
          .map(w => `${w.scrollWidth}px in ${w.clientWidth}px`),
        text: document.body.innerText,
      }));
      if (m.sw > m.vw + 1) { overflow++; console.log(`  OVERFLOW  ${url}: ${m.sw}px wide in a ${m.vw}px viewport`); }
      if (m.tables.length && !LEGAL.includes(url)) { overflow++; console.log(`  CLIPPED   ${url}: table ${m.tables.join(', ')}`); }
      total += scan(url, m.text);
    }
    await gp.close();
  }
  console.log(total ? `\n${total} suspicious line(s)` : '\nno NaN / undefined / [object Object] anywhere');
  const staleClipped = Object.keys(KNOWN_CLIPPED).filter(k => !seenClipped.has(k));
  if (staleClipped.length) { overflow++; console.log(`  STALE     these no longer clip — strike them off KNOWN_CLIPPED: ${staleClipped.join(', ')}`); }
  console.log(overflow ? `${overflow} layout finding(s)` : 'no horizontal overflow, clipped box, gutterless title or spilled label at phone width');
  console.log(rings ? `${rings} focus-ring or pointer-only finding(s)` : 'every focusable control draws a visible focus ring, and nothing clickable is pointer-only');
  console.log('page errors:', errs.length?errs:'none');
  await b.close();
  // Exit non-zero on a finding. This used to only print, so its exit status was
  // 0 whatever it found — a check that cannot fail is a check that is not
  // running, and it was being reported as a pass on that basis.
  const failed = total + overflow + rings + errs.length;
  if (failed) console.error(`\nrender-scan FAILED: ${total} text, ${overflow} overflow, ${rings} focus ring, ${errs.length} page error(s)`);
  process.exit(failed ? 1 : 0);
})();
