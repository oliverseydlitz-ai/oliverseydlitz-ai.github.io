// The PWA manifest's shortcuts and the marketing copy point at #import,
// #yardages and #practice, the docs write them as #/yardages, and NOTHING
// ever read location.hash — so every one of those deep links opened the
// default Sessions view. This pins the router that now honours them, and pins
// that it stays clear of the OAuth flow, which captures its own token from the
// hash at load and must own it.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Router } = R.app;
const w = R.window;
const doc = w.document;

console.log('— hashView maps only the known views —');
const at = h => { w.location.hash = h; return Router.hashView(); };
ok(at('#practice') === 'practice', '#practice');
ok(at('#drills') === 'drills', '#drills — the drill library, split out of Practice into its own view');
ok(at('#/yardages') === 'yardages', '#/yardages — a leading slash is accepted, because the docs write them that way');
ok(at('#IMPORT') === 'import', 'case-insensitive');
ok(at('#progress') === 'progress' && at('#settings') === 'settings' && at('#sessions') === 'sessions',
   'the rest of the tab bar');
ok(at('') === null, 'an empty hash routes nothing');
ok(at('#nonsense') === null, 'and so does an unknown one — no default');

console.log('— an OAuth return is never mistaken for a view —');
ok(at('#access_token=abc123&refresh_token=def&type=signup') === null,
   'an implicit-flow token in the fragment is left for Auth to consume');
ok(at('#error=access_denied&error_description=denied') === null, 'so is an error redirect');

console.log('— applyHash actually switches the view —');
(async () => {
  w.location.hash = '#practice';
  ok(Router.applyHash() === true, 'it reports that it routed');
  // go() -> showPractice() -> Store.getSessions() (async, stubbed) -> render
  await new Promise(r => setTimeout(r, 20));
  ok(doc.getElementById('view-practice').classList.contains('active'),
     'the practice view is active');
  ok(!doc.getElementById('view-sessions').classList.contains('active'),
     'and the default view is not');

  w.location.hash = '#yardages';
  Router.applyHash();
  await new Promise(r => setTimeout(r, 20));
  ok(doc.getElementById('view-yardages').classList.contains('active'), 'and it works a second time');

  w.location.hash = '#drills';
  Router.applyHash();
  await new Promise(r => setTimeout(r, 20));
  ok(doc.getElementById('view-drills').classList.contains('active'),
     'the drill library is its own view, reachable by hash like the rest');
  ok(!doc.getElementById('view-practice').classList.contains('active'),
     'and it is no longer part of Practice');

  w.location.hash = '#nonsense';
  const before = [...doc.querySelectorAll('.view.active')].map(v => v.id);
  ok(Router.applyHash() === false, 'an unknown hash is a no-op');
  await new Promise(r => setTimeout(r, 20));
  ok([...doc.querySelectorAll('.view.active')].map(v => v.id).join() === before.join(),
     'and leaves the current view alone rather than blanking it');

  console.log('— go() is the one place the view map lives —');
  // Both click delegators call Router.go now; the switch used to be copy-pasted
  // three times. `drill` is an alias the action delegator needs.
  ok(typeof Router.go === 'function', 'it is exported');
  await Router.go('drill');
  await new Promise(r => setTimeout(r, 20));
  ok(doc.getElementById('view-sessions').classList.contains('active'),
     'go("drill") lands on Sessions, as the old data-route branch did');
  await Router.go('settings');
  ok(doc.getElementById('view-settings').classList.contains('active'),
     'and an unmapped name falls through to show()');

  w.location.hash = '';
  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exit(fail ? 1 : 0);
})();
