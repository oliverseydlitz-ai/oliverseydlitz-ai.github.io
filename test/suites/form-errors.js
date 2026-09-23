// ── Form errors are heard, not only drawn (R32) ──────────────────────────
//
// The sign-in and import errors were plain paragraphs: a screen reader user
// pressed "Sign in", heard nothing, and had no way to learn why. Each message
// now lands in a role=alert region, and a sign-in error marks the field it is
// about (aria-invalid, aria-describedby) and moves focus to it.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const doc = R.window.document;

(async () => {
  await new Promise(r => setTimeout(r, 50));
  const box = doc.getElementById('authError');
  ok(box && box.getAttribute('role') === 'alert', 'the sign-in error region is role=alert');
  const imp = doc.getElementById('importError');
  ok(imp && imp.getAttribute('role') === 'alert', 'the import error region is role=alert');

  const email = doc.getElementById('authEmail'), pass = doc.getElementById('authPassword');
  email.value = ''; pass.value = 'x';
  doc.getElementById('authLoginForm').dispatchEvent(new R.window.Event('submit', { cancelable: true }));
  await new Promise(r => setTimeout(r, 0));
  ok(/fill in all fields/i.test(box.textContent), `an empty email says so (${JSON.stringify(box.textContent)})`);
  ok(email.getAttribute('aria-invalid') === 'true' && email.getAttribute('aria-describedby') === 'authError',
    'the empty field is marked invalid and points at the message');
  ok(pass.getAttribute('aria-invalid') !== 'true', 'the filled one is not');
  ok(doc.activeElement === email, 'focus moves to the field that needs fixing');

  R.app.Auth.switchToSignup();
  ok(box.textContent === '' && !email.hasAttribute('aria-invalid'), 'switching tabs clears the message and the marks');

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exitCode = fail ? 1 : 0;
})();
