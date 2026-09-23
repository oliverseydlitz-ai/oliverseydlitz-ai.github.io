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
//
// A regex over sw.js would pass a handler that says the right words in the
// wrong order, so this evaluates the file in a vm context with fake `caches`,
// `fetch` and `setTimeout`, dispatches requests at it, and reads what it did.
const fs = require('fs'), path = require('path'), vm = require('vm');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
const ORIGIN = 'https://oliverseydlitz-ai.github.io';

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

  console.log('— a hanging network (R7) —');
  w = worker({ net: never, cached: { '/style.css': res('cached css') } });
  const r2 = await w.get('/style.css');
  ok(r2 && (await r2.text()) === 'cached css', 'a request that hangs is answered from the cache');
  ok(w.timeouts.length === 1 && w.timeouts[0] >= 1500 && w.timeouts[0] <= 5000,
     `after a timeout of a few seconds (${w.timeouts[0]} ms)`);
  let late = null;
  w = worker({ net: () => new Promise(r => setTimeout(() => r(res('late but real')), 20)) });
  late = await w.get('/fresh.json');
  ok(late && (await late.text()) === 'late but real', 'and with nothing cached, the slow network is still awaited, not abandoned');

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
