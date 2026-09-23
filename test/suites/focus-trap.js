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

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exitCode = fail ? 1 : 0;
})();
