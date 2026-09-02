// Load app.js as a WHOLE FILE against the real index.html, the way a browser
// does. The previous harness regex-extracted individual modules, which meant a
// broken top-level binding — an export attached to the wrong module, say —
// was completely invisible to it while every suite reported green. This
// catches load-time crashes because it actually runs the file.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '..');

function load({ html = 'index.html', app = 'app.js' } = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(REPO, html), 'utf8'), {
    url: 'https://oliverseydlitz-ai.github.io/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;

  // Third-party globals the page loads from CDNs. Minimal but faithful enough
  // that module construction takes the same path it does in a browser.
  w.Papa = { parse(text) {
    const rows = String(text).trim().split('\n').map(r => r.split(','));
    const hdr = rows[0].map(h => h.trim());
    return { data: rows.slice(1).map(r => Object.fromEntries(hdr.map((h, i) => [h, (r[i] ?? '').trim()]))) };
  }};
  // A real in-memory IndexedDB stand-in, not a no-op. LocalDB's whole job is
  // round-tripping sessions through this, and a stub that always returns
  // undefined would let a broken persistence path report green.
  const _idb = new Map();
  w.__idbStore = _idb;
  w.__idbFail = null;                      // set to a message to make every call throw
  const _fail = () => { if (w.__idbFail) throw new Error(w.__idbFail); };
  w.idbKeyval = {
    createStore: () => ({}),
    get:   async k => { _fail(); return _idb.get(k); },
    set:   async (k, v) => { _fail(); _idb.set(k, v); },
    del:   async k => { _fail(); _idb.delete(k); },
    clear: async () => { _fail(); _idb.clear(); },
    keys:  async () => { _fail(); return [..._idb.keys()]; },
  };
  w.supabase = { createClient: () => ({
    auth: { onAuthStateChange(){}, getUser: async () => ({ data: { user: null }, error: null }),
            setSession: async () => ({ error: null }), signOut: async () => ({}),
            signInWithPassword: async () => ({ data: {}, error: null }),
            signInWithOAuth: async () => ({ error: null }), signUp: async () => ({ data: {}, error: null }) },
    from: () => ({ select(){return this;}, eq(){return this;}, order: async () => ({ data: [], error: null }),
                   upsert: async () => ({ error: null }), insert: async () => ({ error: null }),
                   delete(){return this;} }),
    functions: { invoke: async () => ({ error: null }) },
  })};
  w.Chart = function Chart(){ return { destroy(){}, update(){} }; };
  w.crypto = w.crypto || { randomUUID: () => 'test-' + Math.random().toString(36).slice(2) };
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener(){}, addListener(){} });

  const errors = [];
  const src = fs.readFileSync(path.join(REPO, app), 'utf8');

  // Top-level `const` in an eval stays in that eval's scope, so the export
  // shim has to run in the SAME eval to see the modules. It is appended, not
  // woven in — the file above it is byte-for-byte what ships. If the file
  // throws at load the shim never runs and __app stays undefined, which is
  // exactly the signal we want.
  const EXPORTS = ['Sanitize','CookieConsent','Agreement','DB','MemDB','Metrics','Store','CSVParser',
    'FeedbackEngine','Conditions','Spin','Dispersion','Strike','LocalDB','SetupGuide','MeasurementReference','FaultEngine','ShotScorer',
    'SwingDNA','Benchmarks','Insights','PracticePlan','CoachingMode','Analytics','Trajectory','UI','Router',
    'ImportFlow','Goals','SessionSharing','RetentionProbe','consistencyScore','facePath','faceAngle','faceRatio','spinLoft','spinAxisFrom',
    'curveYards','gearEffectSuspected','mean','avg','stdDev','fmt','clubLabel','isWood','isIron','isHybrid',
    'isShort','isMid','CLUB_ORDER'];
  try {
    w.eval(src + '\n;window.__app = {' + EXPORTS.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '};');
  } catch (e) {
    errors.push(`LOAD THREW: ${e.message}`);
  }
  if (!w.__app) errors.push('app.js did not finish executing — later declarations are in the temporal dead zone');
  else {
    const missing = EXPORTS.filter(n => w.__app[n] === undefined);
    if (missing.length) errors.push(`declared but unreachable after load: ${missing.join(', ')}`);
  }

  return { window: w, app: w.__app || {}, errors, ok: errors.length === 0 };
}

module.exports = { load, REPO };
