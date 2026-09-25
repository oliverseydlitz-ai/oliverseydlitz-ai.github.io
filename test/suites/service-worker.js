// ── The service worker, run for real against a fake worker scope ────────
//
// R1: it served every cross-origin GET cache-first until the next version
// bump — Supabase's /auth/v1/user and /rest/v1/sessions included, keyed
// without the Authorization header. Stale identity after an account switch,
// other devices' sessions never appearing, and a paused project "succeeding"
// from cache so the cloud-status banner could never fire.
// R6: it cached 404s and every ?query variant, so the cache grew unbounded.
// R7: network-first with no timeout, so a hanging connection never loaded.
// R26: offline, an unknown URL got the app shell instead of 404.html.
// R37: every one of those cached assets still paid the FULL network round
// trip on a repeat visit (FCP 1.54s on Slow 4G vs 0.11s from cache) because
// network-first only falls back to the cache after the 3s timeout or a
// network error — never because the file is already sitting there. And an
// open tab never asked the browser to look for a new worker again.
//
// A regex over sw.js would pass a handler that says the right words in the
// wrong order, so this evaluates the file in a vm context with fake `caches`,
// `fetch` and `setTimeout`, dispatches requests at it, and reads what it did.
const fs = require('fs'), path = require('path'), vm = require('vm');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
const ORIGIN = 'https://shotlab.oliverseydlitz.com';

function worker({ net, cached = {} }) {
  const store = new Map(Object.entries(cached).map(([k, v]) => [ORIGIN + k, v]));
  const listeners = {}, timeouts = [];
  const cache = {
    put: async (k, res) => { store.set(typeof k === 'string' ? k : k.url, res); },
    addAll: async () => {},
  };
  const ctx = {
    self: { location: { origin: ORIGIN }, addEventListener: (t, f) => { listeners[t] = f; },
            skipWaiting() {}, clients: { claim() {} } },
    caches: {
      open: async () => cache,
      keys: async () => [],
      match: async k => {
        const u = typeof k === 'string' ? (k.startsWith('/') ? ORIGIN + k : k) : k.url;
        const r = store.get(u); return r ? r.clone() : undefined;
      },
    },
    fetch: async req => net(req),
    setTimeout: (fn, ms, arg) => { timeouts.push(ms); setImmediate(() => fn(arg)); },
    URL, Response, Promise, console,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return {
    store, timeouts,
    async get(url, { mode = 'no-cors', method = 'GET' } = {}) {
      let p = null;
      listeners.fetch({ request: { url: url.startsWith('/') ? ORIGIN + url : url, mode, method },
                        respondWith: x => { p = x; } });
      return p ? await p : 'not intercepted';
    },
  };
}
const res = (body, status = 200) => new Response(body, { status });
const never = () => new Promise(() => {});
const offline = async () => { throw new TypeError('Failed to fetch'); };
const flush = () => new Promise(r => setImmediate(r));
// A handler that hangs leaves nothing on the event loop, so node exits
// quietly — with code 0 unless it is set here first. The previous worker did
// exactly that on the hanging-network case. Fail until the end is reached.
process.exitCode = 1;

(async () => {
  console.log('— cross-origin is not ours (R1) —');
  let w = worker({ net: async () => res('{"user":"B"}') });
  ok(await w.get('https://jdmahrrxtxqrcpcwmwvx.supabase.co/auth/v1/user') === 'not intercepted',
     'a Supabase auth read is left to the network, never answered from a cache');
  ok(await w.get('https://jdmahrrxtxqrcpcwmwvx.supabase.co/rest/v1/sessions?select=*') === 'not intercepted',
     'and so is a sessions read');
  ok(await w.get('/app.js', { method: 'POST' }) === 'not intercepted', 'and a non-GET');

  console.log('— what is kept (R6) —');
  w = worker({ net: async req => (req.url.endsWith('/missing.png') ? res('nope', 404) : res('v2')) });
  const r1 = await w.get('/app.js?v=123'); await flush();
  ok(r1.status === 200 && w.store.has(ORIGIN + '/app.js'), 'a success is cached under its path');
  ok(![...w.store.keys()].some(k => k.includes('?')), 'with the query string dropped — no per-query copies');
  await w.get('/missing.png'); await flush();
  ok(!w.store.has(ORIGIN + '/missing.png'), 'a 404 is not cached');

  console.log('— a hanging network, outside the shell (R7) —');
  // '/dynamic.json' is deliberately not in ASSETS: it exercises the ORIGINAL
  // network-first-with-timeout path, which R37 leaves untouched for anything
  // that isn't part of the precached shell.
  w = worker({ net: never, cached: { '/dynamic.json': res('cached json') } });
  const r2 = await w.get('/dynamic.json');
  ok(r2 && (await r2.text()) === 'cached json', 'a request that hangs is answered from the cache');
  ok(w.timeouts.length === 1 && w.timeouts[0] >= 1500 && w.timeouts[0] <= 5000,
     `after a timeout of a few seconds (${w.timeouts[0]} ms)`);
  let late = null;
  w = worker({ net: () => new Promise(r => setTimeout(() => r(res('late but real')), 20)) });
  late = await w.get('/fresh.json');
  ok(late && (await late.text()) === 'late but real', 'and with nothing cached, the slow network is still awaited, not abandoned');

  console.log('— stale-while-revalidate for the shell (R37) —');
  // '/style.css' IS in ASSETS — part of the precached shell.
  w = worker({ net: never, cached: { '/style.css': res('cached css') } });
  const r3 = await w.get('/style.css');
  ok(r3 && (await r3.text()) === 'cached css', 'a cached shell asset answers from the cache immediately');
  ok(w.timeouts.length === 0, "without waiting on R7's 3s timeout at all — that is the whole point of R37");

  w = worker({ net: async () => res('new css'), cached: { '/style.css': res('old css') } });
  const r4 = await w.get('/style.css');
  ok((await r4.text()) === 'old css', 'the stale cached copy is served first, not the fresh network one');
  await flush();
  const revalidated = w.store.get(ORIGIN + '/style.css');
  ok(revalidated && (await revalidated.clone().text()) === 'new css',
     'and the cache is revalidated in the background, ready for the NEXT visit');

  w = worker({ net: async () => res('nope', 500) });
  const r5 = await w.get('/style.css'); // nothing cached yet — e.g. the very first visit
  ok(r5.status === 500, 'a shell asset with no cached copy yet still goes through plain network-first');

  console.log('— an open tab checks for updates when it is looked at again (R37) —');
  {
    const { load } = require('../load.js');
    let updates = 0, registerCalls = 0, resolveRegistered;
    const registered = new Promise(r => { resolveRegistered = r; });
    const mockReg = { update: async () => { updates++; } };
    const R = load({ before: bw => { bw.navigator.serviceWorker = {
      register: async () => { registerCalls++; resolveRegistered(); return mockReg; },
    }; } });
    if (!R.ok) { ok(false, 'app.js did not load: ' + R.errors.join('; ')); }
    else {
      ok(typeof R.app.registerServiceWorker === 'function',
         'registerServiceWorker is exported so this suite can see it ran');
      // jsdom dispatches DOMContentLoaded itself, asynchronously, once the
      // document it built is ready — app.js's own listener then runs the
      // real `init()` and calls registerServiceWorker() from inside it. Wait
      // for THAT real boot path rather than calling the function a second
      // time ourselves, which would attach the listener twice.
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('init() never registered a service worker')), 2000));
      await Promise.race([registered, timeout]);
      await flush(); // let register().then(reg => ...) attach the listener
      ok(registerCalls === 1, 'the service worker is registered exactly once at boot');
      const doc = R.window.document;
      Object.defineProperty(doc, 'visibilityState', { value: 'hidden', configurable: true });
      doc.dispatchEvent(new R.window.Event('visibilitychange'));
      await flush();
      ok(updates === 0, 'going hidden does not check for an update');
      Object.defineProperty(doc, 'visibilityState', { value: 'visible', configurable: true });
      doc.dispatchEvent(new R.window.Event('visibilitychange'));
      await flush();
      ok(updates === 1, 'coming back into view calls reg.update() — an open tab left running for days now checks again');
    }
  }

  console.log('— offline —');
  w = worker({ net: offline, cached: { '/index.html': res('<shell>'), '/404.html': res('<not found>'), '/app.js': res('js') } });
  ok((await (await w.get('/app.js')).text()) === 'js', 'a cached asset is served');
  const img = await w.get('/nothing.png');
  ok(img.type === 'error', 'an uncached asset fails as an error, not as a page of HTML');
  ok((await (await w.get('/', { mode: 'navigate' })).text()) === '<shell>', 'the app path gets the app');
  const bad = await w.get('/some/bad/path', { mode: 'navigate' });
  ok(bad.status === 404 && (await bad.text()) === '<not found>', 'an unknown path gets 404.html with a 404 (R26)');

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exitCode = fail ? 1 : 0;
})();
