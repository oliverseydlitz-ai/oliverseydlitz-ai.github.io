// ── A dialog closed by removing it releases the focus trap (R2) ─────────
//
// FirstRun's ✕ and several injected modals close with `.remove()`, not by
// setting `hidden`. The trap only listened for `hidden`, so a removed dialog
// stayed on its stack for the life of the page: `top()` returned a detached
// node, Tab was trapped inside something that no longer existed, and
// `modal-open` stayed on <body>, locking the page's scroll.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const A = R.app.AccessibilityEnhancements;
const doc = R.window.document;
const tick = () => new Promise(r => setTimeout(r, 0));
R.window.scrollTo = () => {};   // jsdom does not implement it; the scroll lock calls it

(async () => {
  A.init();
  // Boot opens the agreement and sign-in gates; close them so this starts
  // from an empty stack and the scroll-lock and focus checks can run.
  // FirstRun is injected asynchronously by the boot, so let it land first.
  await new Promise(r => setTimeout(r, 50));
  doc.querySelectorAll('.modal-overlay').forEach(m => { m.hidden = true; });
  await tick();
  const base = A.openCount();
  ok(base === 0, `starts from an empty stack (${base})`);
  const opener = doc.createElement('button'); opener.textContent = 'open'; doc.body.appendChild(opener); opener.focus();

  const dlg = doc.createElement('div');
  dlg.className = 'modal-overlay';
  dlg.innerHTML = '<div class="modal"><h2 class="modal-title">Intro</h2><button>Close</button></div>';
  doc.body.appendChild(dlg);
  await tick();
  ok(A.openCount() === base + 1 && A.top() === dlg, 'an injected dialog is trapped');

  dlg.remove();
  ok(A.top() !== dlg, 'the moment it is removed, it is no longer "on top" — the backstop');
  await tick();
  ok(A.openCount() === base, 'and it leaves the stack');
  if (base === 0) {
    ok(!doc.body.classList.contains('modal-open'), 'the page scroll lock goes with it');
    ok(doc.activeElement === opener, 'and focus goes back to what opened it');
  }

  // The observer path on its own — nothing asks top() in between.
  opener.focus();
  const dlg3 = doc.createElement('div');
  dlg3.className = 'modal-overlay';
  dlg3.innerHTML = '<div class="modal"><button>Close</button></div>';
  doc.body.appendChild(dlg3); await tick();
  dlg3.remove(); await tick();
  ok(A.openCount() === base && doc.activeElement === opener, 'removal alone closes it and returns focus');

  // Hidden, the original path, still works.
  const dlg2 = doc.createElement('div');
  dlg2.className = 'modal-overlay';
  dlg2.innerHTML = '<div class="modal"><button>x</button></div>';
  doc.body.appendChild(dlg2); await tick();
  dlg2.hidden = true; await tick();
  ok(A.openCount() === base, 'a dialog closed by hiding it still leaves the stack');

  console.log('— the shortcuts leave the browser\'s own alone (R5) —');
  const press = (key, mods = { ctrlKey: true }) => {
    const e = new R.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
    doc.body.dispatchEvent(e); return e;
  };
  ok(!press('p').defaultPrevented && !press('p', { metaKey: true }).defaultPrevented,
     'Ctrl/Cmd+P is left to the browser — it prints the yardage card');
  ok(!press('h').defaultPrevented, 'and Ctrl+H is left to it too');
  press('/');
  await tick();
  const sc = doc.getElementById('shortcutsModal');
  ok(sc && A.top() === sc && sc.getAttribute('role') === 'dialog', 'the shortcuts overlay is a trapped dialog');
  ok(!/Ctrl\+P|Ctrl\+H/.test(sc.textContent), 'and lists no binding that no longer exists');
  doc.dispatchEvent(new R.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await tick();
  ok(A.top() !== sc, 'Escape closes it through the trap');

  console.log('— the small accessibility items (R8, R9, R10, R12, R14, R18) —');
  R.app.toast('Saved');
  const t = doc.getElementById('toast');
  ok(t && t.getAttribute('role') === 'status' && t.getAttribute('aria-live') === 'polite', 'the toast is a live region (R10)');
  const cv = doc.createElement('canvas'); doc.body.appendChild(cv);
  R.app.ScrollMotion.chart(cv, { type: 'line', data: { datasets: [{ label: 'Carry' }] }, options: {} });
  ok(cv.getAttribute('role') === 'img' && /Carry/.test(cv.getAttribute('aria-label') || ''),
     `every chart canvas is a named image (R8): "${cv.getAttribute('aria-label')}"`);
  R.app.Router.show('yardages');
  const cur = [...doc.querySelectorAll('[data-view][aria-current="page"]')].map(e => e.dataset.view);
  ok(cur.length && cur.every(v => v === 'yardages'), `the nav says which view is showing (R9): ${cur.join()}`);
  ok(!!doc.getElementById('goalMetric').getAttribute('aria-label'), 'the goal picker has a name (R12)');
  const first = doc.querySelector('body a[href], body button, body input, body select, body textarea');
  ok(first && first.classList.contains('skip-link') && first.getAttribute('href') === '#appMain'
     && doc.getElementById('appMain').getAttribute('tabindex') === '-1', 'the first control on the page skips to content (R14)');
  // R18: sign-in in a browser that blocks storage.
  const realLS = Object.getOwnPropertyDescriptor(R.window, 'localStorage');
  let oauthErr = null;
  try {
    Object.defineProperty(R.window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    await R.app.Auth.oauth('google');
  } catch (e) { oauthErr = e; }
  finally { if (realLS) Object.defineProperty(R.window, 'localStorage', realLS); }
  ok(!oauthErr, `Google sign-in does not throw when storage is blocked (R18)${oauthErr ? ': ' + oauthErr.message : ''}`);
  R.window.localStorage.setItem('slDebug', '1');
  let logErr = null;
  try { R.app.authLog('token installed', { ok: true }); } catch (e) { logErr = e; }
  R.window.localStorage.removeItem('slDebug');
  ok(!logErr, `and the auth trace does not throw with debugging on (R18)${logErr ? ': ' + logErr.message : ''}`);

  // R21: a modal built at runtime is only trapped if it carries .modal-overlay,
  // the class the observer watches. Five Settings dialogs were plain divs, so
  // Tab walked the page behind them and Escape did nothing. Every element in
  // app.js whose id ends in "Modal" and is written as markup must carry it.
  const appSrc = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');
  // V38 moved the six Settings dialogs onto one shell, runtimeModal(), so the
  // check reads the shell's template once and then every call to it; a modal
  // still written out as markup must carry the class itself.
  const shellAt = appSrc.indexOf('function runtimeModal(');
  const shell = appSrc.slice(shellAt, appSrc.indexOf('\n}\n', shellAt));
  ok(shellAt > 0 && /class="modal-overlay" id="\$\{id\}" aria-label=/.test(shell),
     'the runtime shell is a trapped, named dialog');
  const calls = [...appSrc.matchAll(/runtimeModal\(\s*'(\w+Modal)',\s*\{([\s\S]{0,400}?)\}\);/g)];
  ok(calls.length >= 6, `found the runtime modals built through it (${calls.length})`);
  const untitled = calls.filter(m => !/\btitle:\s*'[^']+'/.test(m[2])).map(m => m[1]);
  ok(!untitled.length, `and each passes a title, which names it${untitled.length ? ': ' + untitled.join(', ') : ''}`);
  const roots = [...appSrc.matchAll(/<div\b([^>]*\bid="(\w+Modal)"[^>]*)>/g)];
  const untrapped = roots.filter(m => !/class="[^"]*\bmodal-overlay\b/.test(m[1])).map(m => m[2]);
  ok(!untrapped.length, `no runtime modal is written outside it untrapped${untrapped.length ? ': ' + untrapped.join(', ') : ''}`);

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exitCode = fail ? 1 : 0;
})();
