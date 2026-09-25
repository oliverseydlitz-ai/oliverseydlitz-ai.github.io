// R27 (leftover): the nav is static markup — it paints long before app.js has
// even finished downloading on a slow connection, let alone run. A nav that
// LOOKS tappable and does nothing when tapped reads as broken, not "still
// loading". `<html class="booting">` ships in the markup itself (no script
// needed to disable it) and the stylesheet refuses the nav pointer events
// and dims it while the class is present; app.js removes it the instant its
// own click delegation exists to actually answer a tap — not at the end of
// `init()`, which still has Auth's own network round-trip below that point.
const fs = require('fs'), path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const flush = () => new Promise(r => setImmediate(r));

console.log('— the shell starts disabled, from the static markup alone —');
ok(/<html lang="en" class="booting">/.test(html),
   '<html> ships with the booting class in the HTML itself — no script has to run to disable the nav');
ok(/html\.booting \.bottom-nav,\s*html\.booting \.top-nav\s*\{[^}]*pointer-events:\s*none/.test(css),
   'the stylesheet refuses pointer events on both navs (and dims them) while the class is present');

console.log('— and comes off the instant a tap would actually be answered —');
{
  const { load } = require('../load.js');
  const R = load({});
  if (!R.ok) {
    ok(false, 'app.js did not load: ' + R.errors.join('; '));
    console.log(`\n${fail} FAILED`);
    process.exitCode = 1;
  } else {
    const doc = R.window.document;
    ok(doc.documentElement.classList.contains('booting'),
       'still present immediately after load, before app.js has had a chance to run');

    let authStillBooting = null;
    const realAuthInit = R.app.Auth.init.bind(R.app.Auth);
    R.app.Auth.init = async (...args) => {
      if (authStillBooting === null) authStillBooting = doc.documentElement.classList.contains('booting');
      return realAuthInit(...args);
    };

    (async () => {
      // jsdom dispatches DOMContentLoaded itself, asynchronously, once the
      // document it built is ready — app.js's own listener then runs the
      // real `init()`. Wait for that real boot path (same pattern as
      // service-worker.js's R37 suite) rather than driving anything here.
      const bootingGone = new Promise(resolve => {
        (function poll() {
          if (!doc.documentElement.classList.contains('booting')) resolve();
          else setTimeout(poll, 5);
        })();
      });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('booting was never removed — init() never reached the nav delegation')), 4000));
      try {
        await Promise.race([bootingGone, timeout]);
        ok(true, 'booting comes off once the real boot path runs');
        ok(authStillBooting === false,
           'and by the time Auth.init() — a network call — actually runs, booting was already gone: the nav was not left gated behind it');
      } catch (e) {
        ok(false, e.message);
      }
      await flush();
      console.log(fail ? `\n${fail} FAILED` : '\nall passed');
      process.exitCode = fail ? 1 : 0;
    })();
  }
}
