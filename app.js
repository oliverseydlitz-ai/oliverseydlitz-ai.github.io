/* ═══════════════════════════════════════════════════════════════
   ShotLab v2 — app.js
   DB · CSV Parser · Fault Engine · Benchmarks · ShotScorer ·
   SwingDNA · ClubGapping · UI · Router · ImportFlow · Main
═══════════════════════════════════════════════════════════════ */
'use strict';

// ────────────────────────────────────────────────────────────────
// Constants & utils
// ────────────────────────────────────────────────────────────────
const CLUB_ORDER = ['d','2w','3w','4w','5w','7w','2h','3h','4h','5h',
  '1i','2i','3i','4i','5i','6i','7i','8i','9i','pw','aw','sw','lw'];

const CLUB_COLORS = {
  d:'#f59e0b','2w':'#f97316','3w':'#ef4444','4w':'#ec4899','5w':'#a855f7',
  '7w':'#8b5cf6','2h':'#06b6d4','3h':'#0ea5e9','4h':'#3b82f6','5h':'#6366f1',
  '1i':'#14b8a6','2i':'#10b981','3i':'#22c55e','4i':'#84cc16','5i':'#eab308',
  '6i':'#f59e0b','7i':'#f97316','8i':'#ef4444','9i':'#ec4899',
  pw:'#a855f7',aw:'#8b5cf6',sw:'#6366f1',lw:'#3b82f6',
};

const CLUB_LABELS = {
  d:'Driver','2w':'2 Wood','3w':'3 Wood','4w':'4 Wood','5w':'5 Wood','7w':'7 Wood',
  '2h':'2 Hybrid','3h':'3 Hybrid','4h':'4 Hybrid','5h':'5 Hybrid',
  '1i':'1i','2i':'2i','3i':'3i','4i':'4i','5i':'5i','6i':'6i','7i':'7i',
  '8i':'8i','9i':'9i',pw:'PW',aw:'AW',sw:'SW',lw:'LW',
};

const isWood = t => ['d','2w','3w','4w','5w','7w'].includes(t);
const isHybrid = t => ['2h','3h','4h','5h','6h'].includes(t);
const isIron = t => ['1i','2i','3i','4i','5i','6i','7i','8i','9i','pw','aw','sw','lw'].includes(t);
const isLong = t => isWood(t) || isHybrid(t) || ['1i','2i','3i','4i'].includes(t);
const isShort = t => ['8i','9i','pw','aw','sw','lw'].includes(t);
const isMid = t => ['5i','6i','7i'].includes(t);
const clubLabel = t => CLUB_LABELS[t] || (t || '').toUpperCase();
const clubColor = t => CLUB_COLORS[t] || '#8891aa';
const clubOrder = t => { const i = CLUB_ORDER.indexOf(t); return i === -1 ? 99 : i; };

function avg(arr, field) {
  const vals = arr.map(s => s[field]).filter(v => typeof v === 'number' && !isNaN(v) && v !== 0);
  if (!vals.length) return null;
  return vals.reduce((a,b) => a+b, 0) / vals.length;
}

function stdDev(values) {
  const v = values.filter(x => typeof x === 'number' && !isNaN(x));
  if (v.length < 2) return 0;
  const mean = v.reduce((a,b) => a+b,0) / v.length;
  return Math.sqrt(v.map(x => (x-mean)**2).reduce((a,b) => a+b,0) / v.length);
}

function fmt(val, decimals=1) {
  if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return '—';
  return Number(val).toFixed(decimals);
}

function formatDate(iso) {
  if (!iso) return 'Unknown date';
  return new Date(iso).toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'});
}

function clubBreakdown(shots) {
  const counts = {};
  shots.forEach(s => { counts[s.clubType] = (counts[s.clubType]||0)+1; });
  return Object.entries(counts)
    .sort((a,b) => clubOrder(a[0]) - clubOrder(b[0]))
    .map(([c,n]) => `${clubLabel(c)} ×${n}`)
    .join(', ');
}

function getClubs(shots) {
  const seen = new Set();
  return shots.map(s=>s.clubType).filter(t => { if(!seen.has(t)){seen.add(t);return true;} });
}

function sortedClubs(shots) {
  return getClubs(shots).sort((a,b) => clubOrder(a) - clubOrder(b));
}

// D-Plane: face angle ≈ launch direction (ball starts ~75% toward face)
// face-to-path = launchDirection - clubPath
// positive = face open to path = fade/slice
// negative = face closed to path = draw/hook
function facePath(shot) {
  return (shot.launchDirection || 0) - (shot.clubPath || 0);
}

// ────────────────────────────────────────────────────────────────
// DB — IndexedDB via idb-keyval
// ────────────────────────────────────────────────────────────────
const DB = (() => {
  const store = idbKeyval.createStore('shotlab-db','sessions');
  const getSessions = async () => {
    const keys = await idbKeyval.keys(store);
    const sessions = await Promise.all(keys.map(k => idbKeyval.get(k,store)));
    return sessions.filter(Boolean).sort((a,b) => new Date(b.date) - new Date(a.date));
  };
  const getSession   = id => idbKeyval.get(id,store);
  const saveSession  = s  => idbKeyval.set(s.id,s,store);
  const deleteSession= id => idbKeyval.del(id,store);
  const clearAll     = () => idbKeyval.clear(store);
  const exportAll    = () => getSessions();
  return {getSessions,getSession,saveSession,deleteSession,clearAll,exportAll};
})();

// ────────────────────────────────────────────────────────────────
// MemDB — ephemeral in-memory store for guest sessions (gone on page close)
// ────────────────────────────────────────────────────────────────
const MemDB = (() => {
  const _sessions = [];
  const getSessions = () => [..._sessions].sort((a,b) => new Date(b.date) - new Date(a.date));
  const getSession = id => _sessions.find(s => s.id === id) || null;
  const saveSession = s => {
    const i = _sessions.findIndex(x => x.id === s.id);
    if (i >= 0) _sessions[i] = {...s}; else _sessions.push({...s});
  };
  const deleteSession = id => {
    const i = _sessions.findIndex(s => s.id === id);
    if (i >= 0) _sessions.splice(i, 1);
  };
  return { getSessions, getSession, saveSession, deleteSession };
})();

// ────────────────────────────────────────────────────────────────
// Supabase Auth & Cloud DB
// ────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://jdmahrrxtxqrcpcwmwvx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FK_S_xmH5hwC2r8Zm8rT2Q_dT8bLfKH';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Implicit flow (#access_token) — reliably logs users in without a stored
    // PKCE verifier (our pre-redirect purge would wipe that and break login).
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    // We parse the redirect hash OURSELVES (see _oauthTokens + Auth.init's
    // setSession) so there's a single deterministic code path and no race
    // between Supabase's auto-detect and our getUser() call.
    detectSessionInUrl: false,
  },
});

// Capture whether we arrived from an email confirmation / magic link redirect.
// Covers both implicit flow (#access_token / type=signup) and PKCE flow (?code=),
// plus error redirects (e.g. an expired link). Read synchronously before the
// Supabase client strips the URL.
const _redirectStr = (location.hash + '&' + location.search).toLowerCase();
const _authError = /error=|error_code=|error_description=/.test(_redirectStr);
const _authRedirect = _authError ||
  /type=(signup|magiclink|recovery|email_change|invite)|access_token=|[?&]code=/.test(_redirectStr);

// Synchronously grab the OAuth tokens out of the URL hash the INSTANT the page
// loads — before the Supabase client, our debug code, or history.replaceState
// can strip them. In implicit flow Google sends us back to
// #access_token=...&refresh_token=...  We install these explicitly in Auth.init
// via setSession(), which deterministically overwrites any stale stored session
// with the account the user just picked (root-cause fix for "wrong email").
const _oauthTokens = (() => {
  try {
    const h = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const p = new URLSearchParams(h);
    const access_token = p.get('access_token');
    const refresh_token = p.get('refresh_token');
    if (access_token && refresh_token) return { access_token, refresh_token };
  } catch (_) {}
  return null;
})();

// Pull the human-readable error reason out of the redirect (hash or query)
let _authErrorMsg = '';
if (_authError) {
  const p = new URLSearchParams(location.hash.replace(/^#/, '') + '&' + location.search.replace(/^\?/, ''));
  _authErrorMsg = (p.get('error_description') || p.get('error') || '').replace(/\+/g, ' ');
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 4000);
}

// ── Dark mode ──────────────────────────────────────────────────
// Applied synchronously at load (before paint) to avoid a flash; the toggle
// lives in Settings and the choice is persisted to localStorage.
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  const sw = document.getElementById('themeSwitch');
  if (sw) sw.classList.toggle('on', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0a140e' : '#0b4d2e');
}
(function initThemeEarly(){
  try {
    const saved = localStorage.getItem('slTheme');
    const dark = saved ? saved === 'dark'
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(_) {}
})();

// On-screen debug banner (tap to dismiss). Lets us see auth state on mobile
// where the dev console isn't available.
// Diagnostics now log quietly to the console instead of an on-screen banner
// (the banner was a temporary debugging aid while fixing OAuth — login works
// now, so we keep the call sites but stop covering the UI). Toggle the on-screen
// version any time from the console with: localStorage.setItem('slDebug','1')
function showDebug(msg) {
  console.log('[ShotLab]', msg);
  if (localStorage.getItem('slDebug') !== '1') return;
  let d = document.getElementById('debugBanner');
  if (!d) {
    d = document.createElement('div');
    d.id = 'debugBanner';
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#111;color:#0f0;' +
      'font:11px/1.4 monospace;padding:8px 12px;white-space:pre-wrap;border-top:2px solid #0f0;' +
      'max-height:35vh;overflow:auto;pointer-events:none';
    const close = document.createElement('button');
    close.textContent = '✕ close';
    close.style.cssText = 'pointer-events:auto;position:absolute;top:4px;right:8px;background:#0f0;' +
      'color:#000;border:none;border-radius:4px;padding:2px 8px;font:bold 11px monospace;cursor:pointer';
    close.onclick = () => d.remove();
    d.appendChild(close);
    document.body.appendChild(d);
  }
  const ts = new Date().toLocaleTimeString();
  let body = d.querySelector('.dbg-body');
  if (!body) { body = document.createElement('div'); body.className = 'dbg-body'; d.appendChild(body); }
  body.textContent = `[DEBUG ${ts}]\n` + msg;
}

const Auth = (() => {
  let _user = null;
  let _guestTimer = null;
  let _guest = false;        // true when user explicitly chose "continue as guest"
  let _signingOut = false;   // blocks ALL auth events during intentional logout

  // Single source of truth: ask the Supabase server who the JWT belongs to.
  // getUser() validates the token against the server, so it can't return a
  // stale/cached identity the way reading localStorage can.
  async function refreshUserFromServer() {
    const { data, error } = await sb.auth.getUser();
    _user = (!error && data?.user) ? data.user : null;
    console.log('[AUTH] getUser →', _user?.email || '(none)', error ? 'err:'+error.message : '');
    updateUI();
    return _user;
  }

  async function init() {
    sb.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH EVENT]', event, '→ session user:', session?.user?.email || '(none)');
      if (_signingOut) return;
      if (event === 'TOKEN_REFRESHED' && _user === null) return;

      if (event === 'SIGNED_OUT') {
        _user = null;
        updateUI();
        if (!_signingOut) showAuth(false);
        return;
      }

      const wasGuest = !_user;
      _user = session?.user || null;
      updateUI();
      if (wasGuest && _user && event === 'SIGNED_IN') {
        await Router.showSessions();
      }
    });

    // ── Deterministic OAuth handling ──────────────────────────────────────
    // If we just came back from Google (implicit flow), the URL hash held a
    // fresh access/refresh token that we captured synchronously into
    // _oauthTokens. Install it EXPLICITLY with setSession() so the account the
    // user just picked overwrites any stale stored session — this is the
    // root-cause fix for the "wrong email" bug (no race with auto-detection).
    if (_oauthTokens) {
      try {
        const { data, error } = await sb.auth.setSession(_oauthTokens);
        if (error) throw error;
        _user = data?.user || data?.session?.user || null;
      } catch (e) {
        console.error('[AUTH] setSession failed:', e);
        showDebug('LOGIN INSTALL FAILED:\n' + (e?.message || JSON.stringify(e)));
      }
    }

    // Read the server-validated user as the single source of truth (covers
    // returning visitors with a stored session, and confirms the OAuth login).
    await refreshUserFromServer();

    // Diagnostic banner so the state is visible on mobile (no dev console).
    showDebug(
      `had #token   : ${!!_oauthTokens}\n` +
      `signed in as : ${_user?.email || '(none)'}\n` +
      `status       : ${_user ? '✓ logged in' : 'not logged in'}`
    );
    return _user;
  }

  async function signup(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    _user = data.user;
    updateUI();
    return _user;
  }

  async function login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _user = data.user;
    updateUI();
    return _user;
  }

  async function oauth(provider) {
    // Purge any stale token BEFORE leaving so nothing old lingers; the fresh
    // token we get back is installed explicitly via setSession() in init().
    // prompt:select_account makes Google always show the account chooser so the
    // user can switch accounts.
    purgeAuthStorage();
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: location.origin,
        queryParams: { prompt: 'select_account' },
        skipBrowserRedirect: false,
      },
    });
    if (error) throw error;
    // On success the browser is redirected to the provider; we return on the
    // OAuth callback URL, which init() handles on next load.
  }

  function purgeAuthStorage() {
    // Remove every Supabase auth token so a stale identity can't be re-read
    [...Object.keys(localStorage)].forEach(k => {
      if (k.startsWith('sb-') || k.includes('supabase') || k.includes('auth-token')) {
        localStorage.removeItem(k);
      }
    });
    sessionStorage.clear();
  }

  async function logout() {
    _signingOut = true;        // block onAuthStateChange from re-setting _user
    _user = null;
    updateUI();

    // local first: revokes the in-memory session and stops the auto-refresh
    // timer immediately, so it can't write the old token back into storage.
    await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    purgeAuthStorage();

    // global revokes the refresh token server-side (best effort; may be offline)
    await sb.auth.signOut({ scope: 'global' }).catch(() => {});
    purgeAuthStorage();        // clear again in case the client re-persisted

    // Hard reload to a clean origin — no #hash/?code leftovers, no JS heap state
    window.location.replace(location.origin + location.pathname);
  }

  function getUser() { return _user; }

  function updateUI() {
    const emailRow = document.getElementById('accountEmailRow');
    const signIn = document.getElementById('accountSignInBtn');
    const signOut = document.getElementById('accountSignOutBtn');
    const syncBtn = document.getElementById('syncCloudBtn');
    const authModal = document.getElementById('authModal');
    if (_user) {
      clearTimeout(_guestTimer);
      emailRow.hidden = false;
      document.getElementById('accountEmail').textContent = _user.email;
      signIn.hidden = true;
      signOut.hidden = false;
      if (syncBtn) syncBtn.hidden = false;   // sync only available when signed in
      authModal.hidden = true;
    } else if (_guest) {
      // Guest mode: show a clear "Guest" label instead of an empty dash
      emailRow.hidden = false;
      document.getElementById('accountEmail').textContent = 'Guest (local only)';
      signIn.hidden = false;
      signOut.hidden = true;
      if (syncBtn) syncBtn.hidden = true;
    } else {
      emailRow.hidden = true;
      signIn.hidden = false;
      signOut.hidden = true;
      if (syncBtn) syncBtn.hidden = true;
    }
  }

  function setGuest() { _guest = true; updateUI(); }

  // mandatory=true: guest option hidden until 5s pass; false: guest shown right away
  function showAuth(mandatory = false) {
    const modal = document.getElementById('authModal');
    const guest = document.getElementById('authGuestWrap');
    modal.hidden = false;
    switchToLogin();
    clearTimeout(_guestTimer);
    if (mandatory) {
      guest.hidden = true;
      _guestTimer = setTimeout(() => { guest.hidden = false; }, 5000);
    } else {
      guest.hidden = false;
    }
  }

  function hideAuth() {
    clearTimeout(_guestTimer);
    document.getElementById('authModal').hidden = true;
  }

  function switchToLogin() {
    document.getElementById('authTabLogin').classList.add('active');
    document.getElementById('authTabSignup').classList.remove('active');
    document.getElementById('authLoginForm').classList.add('active');
    document.getElementById('authSignupForm').classList.remove('active');
    document.getElementById('authError').textContent = '';
  }

  function switchToSignup() {
    document.getElementById('authTabSignup').classList.add('active');
    document.getElementById('authTabLogin').classList.remove('active');
    document.getElementById('authSignupForm').classList.add('active');
    document.getElementById('authLoginForm').classList.remove('active');
    document.getElementById('authError').textContent = '';
  }

  return { init, signup, login, oauth, logout, getUser, setGuest, showAuth, hideAuth, switchToLogin, switchToSignup };
})();

const CloudDB = (() => {
  async function getSessions(userId) {
    const { data, error } = await sb
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function saveSession(session) {
    const user = Auth.getUser();
    if (!user) return;
    const row = {
      id: session.id,
      user_id: user.id,
      date: session.date,
      notes: session.notes,
      conditions: session.conditions,
      shots: session.shots,
      created_at: new Date(session.createdAt).toISOString(),
    };

    // Primary path: upsert (needs a PRIMARY KEY / UNIQUE constraint on id).
    const { error } = await sb.from('sessions').upsert([row], { onConflict: 'id' });
    if (!error) return;

    // FAILSAFE: if the table is missing the id constraint, upsert throws
    // "no unique or exclusion constraint matching the ON CONFLICT
    // specification" (error 42P10). Fall back to delete-then-insert so sync
    // still works even on a table that wasn't created with the right keys.
    const missingConstraint = error.code === '42P10' ||
      /on conflict|unique or exclusion/i.test(error.message || '');
    if (missingConstraint) {
      await sb.from('sessions').delete().eq('id', session.id).eq('user_id', user.id);
      const { error: insErr } = await sb.from('sessions').insert([row]);
      if (!insErr) return;
      console.error('CloudDB.saveSession insert fallback error:', insErr);
      throw new Error(insErr.message || insErr.code || JSON.stringify(insErr));
    }

    console.error('CloudDB.saveSession error:', error);
    throw new Error(error.message || error.code || JSON.stringify(error));
  }

  async function deleteSession(id) {
    const user = Auth.getUser();
    if (!user) return;
    const { error } = await sb.from('sessions').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
  }

  async function migrateLocalSessions() {
    const user = Auth.getUser();
    if (!user) return;
    const localSessions = await DB.exportAll();
    for (const session of localSessions) {
      await saveSession(session);
    }
  }

  return { getSessions, saveSession, deleteSession, migrateLocalSessions };
})();

// Unified data layer — cloud-only for logged-in users, MemDB (ephemeral) for guests
const Store = (() => {
  function fromRow(r) {
    return {
      id: r.id, date: r.date, notes: r.notes, conditions: r.conditions,
      shots: r.shots, createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    };
  }
  const cloud = () => !!Auth.getUser();

  async function getSessions() {
    // Local-first so the app NEVER breaks if the cloud is unreachable. Merge
    // cloud rows on top when signed in; on cloud error fall back to local and
    // surface the reason instead of throwing (a throw here used to bubble up
    // through the tab click handlers and silently kill navigation).
    const local = MemDB.getSessions();
    if (!cloud()) return local;
    try {
      const rows = await CloudDB.getSessions(Auth.getUser().id);
      const cloudIds = new Set(rows.map(r => r.id));
      const pending = local.filter(s => !cloudIds.has(s.id));
      return [...pending, ...rows.map(fromRow)].sort((a,b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.error('Cloud load failed:', e);
      showDebug('CLOUD LOAD FAILED:\n' + (e?.message || JSON.stringify(e)) + '\n(showing local sessions)');
      return local;
    }
  }
  async function getSession(id) {
    const mem = MemDB.getSession(id);   // covers just-imported sessions
    if (mem) return mem;
    if (!cloud()) return null;
    try {
      const rows = await CloudDB.getSessions(Auth.getUser().id);
      const r = rows.find(x => x.id === id);
      return r ? fromRow(r) : null;
    } catch (e) {
      console.error('Cloud load failed:', e);
      return null;
    }
  }
  async function saveSession(s) {
    MemDB.saveSession(s);               // local first — instant, always works
    if (cloud()) await CloudDB.saveSession(s);
  }
  async function deleteSession(id) {
    MemDB.deleteSession(id);
    if (cloud()) { try { await CloudDB.deleteSession(id); } catch (e) { console.error('Cloud delete failed:', e); } }
  }
  return { getSessions, getSession, saveSession, deleteSession };
})();

// ────────────────────────────────────────────────────────────────
// CSV Parser
// ────────────────────────────────────────────────────────────────
const CSVParser = (() => {
  const COLUMN_MAP = {
    'Club Type':'clubType','Club Brand':'clubBrand','Club Model':'clubModel',
    'Carry Distance':'carryDistance','Total Distance':'totalDistance',
    'Ball Speed':'ballSpeed','Launch Angle':'launchAngle','Launch Direction':'launchDirection',
    'Apex':'apex','Side Carry':'sideCarry','Club Speed':'clubSpeed',
    'Smash Factor':'smashFactor','Descent Angle':'descentAngle',
    'Attack Angle':'attackAngle','Club Path':'clubPath',
    'Club Data Est Type':'clubDataEstType','Spin Rate':'spinRate','Spin Axis':'spinAxis',
  };
  const NUM = new Set(['carryDistance','totalDistance','ballSpeed','launchAngle','launchDirection',
    'apex','sideCarry','clubSpeed','smashFactor','descentAngle','attackAngle','clubPath',
    'clubDataEstType','spinRate','spinAxis']);

  function parse(csvText) {
    const result = Papa.parse(csvText, { header:true, skipEmptyLines:true, transformHeader:h=>h.trim() });
    if (!result.data?.length) throw new Error('No data found in CSV');
    return result.data.map((row,i) => {
      const shot = {_row:i+2};
      for (const [col,field] of Object.entries(COLUMN_MAP)) {
        if (!(col in row)) continue;
        shot[field] = NUM.has(field) ? parseFloat(row[col])||0 : row[col];
      }
      return shot;
    });
  }

  return { parse };
})();

// ────────────────────────────────────────────────────────────────
// Fault Engine — v2 with real swing mechanics
// ────────────────────────────────────────────────────────────────
const FaultEngine = (() => {

  function smashMin(t) { return isWood(t) || isHybrid(t) ? 1.40 : 1.33; }
  function smashGood(t){ return isWood(t) || isHybrid(t) ? 1.44 : 1.37; }

  // All per-shot rules — return true if fault present
  const PER_SHOT_RULES = [

    // ── CONTACT ───────────────────────────────────────────────
    {
      id:'poor-contact', name:'Poor Contact / Thin Strike', icon:'💥', category:'Contact', severity:'high',
      test: s => s.smashFactor > 0 && s.smashFactor < smashMin(s.clubType),
      description: shots => {
        const a = avg(shots,'smashFactor');
        return `Average smash factor ${fmt(a,2)} — below the ${fmt(smashMin(shots[0]?.clubType),2)} minimum threshold. ` +
          `Energy transfer from clubhead to ball is suboptimal, indicating off-centre contact. ` +
          `Each 0.01 drop in smash factor typically costs 1–2 mph of ball speed and ~3–5 yards of carry.`;
      },
      causes:['Ball position too far back in stance','Early extension / coming out of posture',
        'Lateral slide instead of rotational power transfer','Tension in forearms and hands',
        'Over-the-top swing path creating a glancing blow'],
      drills:[
        {name:'Impact tape',desc:'Apply impact tape (or dry-erase marker) to the face. Note where marks appear. Work toward the sweet spot over 20 balls, consciously trying to move the contact point one position closer each set.'},
        {name:'Tee gate drill',desc:'Place a tee 1 inch outside the heel and 1 inch outside the toe. Swing through without clipping either. Forces centerline path through impact.'},
        {name:'Feet together drill',desc:'Hit 10 balls with feet touching. Eliminates lateral slide, forces rotation and centred contact. Use a 7-iron at 60% speed to start.'},
        {name:'Towel under arm',desc:'Tuck a small towel under your lead armpit. Keep it there through impact. Prevents the arms disconnecting from the body which causes mishits.'},
      ],
      optimalRange: t => `>${fmt(smashGood(t),2)} smash factor`,
    },

    {
      id:'fat-shot', name:'Fat / Heavy Strike', icon:'⛏️', category:'Contact', severity:'high',
      test: s => s.smashFactor > 0 && s.clubSpeed > 0 &&
        (s.ballSpeed / s.clubSpeed) < 1.22 && s.attackAngle < -6 && isIron(s.clubType),
      description: shots => `Ball speed / club speed ratio of ${fmt(avg(shots,'ballSpeed')/avg(shots,'clubSpeed'),2)} with steep attack angle — classic fat/heavy strike. ` +
        `Ground contact before the ball is absorbing club energy. This is one of the most distance-costing faults for irons.`,
      causes:['Weight hanging back on trail side at impact','Ball too far forward in stance for the club',
        'Over-the-top path causing steep descent','Casting the club (early release) from the top'],
      drills:[
        {name:'Forward ball position check',desc:'Place an alignment stick across your toes. Ball should be 1 ball-width inside the lead heel for short irons, 2 for mid-irons, 3 for long irons.'},
        {name:'Divot board drill',desc:'Practice on a divot board or place a towel 3 inches behind the ball. Avoid hitting the towel. Forces a ball-first strike pattern.'},
        {name:'Step-through drill',desc:'After impact, step through with the trail foot so both feet finish facing the target. Forces weight transfer to lead side before impact.'},
      ],
      optimalRange: () => 'Attack angle -2° to -5° (irons)',
    },

    // ── PATH & FACE (D-PLANE) ──────────────────────────────────
    {
      id:'slice', name:'Slice / Open Face to Path', icon:'↪️', category:'Path & Face', severity:'high',
      test: s => facePath(s) > 5 && s.sideCarry > 12,
      description: shots => {
        const afp = avg(shots.map(s=>facePath(s)).filter(v=>v>5).map((_,i)=>shots[i]), null) || avg(shots.map(facePath));
        const sc = avg(shots,'sideCarry');
        return `Face is open to path by ~${fmt(afp,1)}° (D-Plane). Ball is starting toward the open face ` +
          `then curving further right due to clockwise spin axis. Average side carry: +${fmt(sc,1)} yds right. ` +
          `Under modern D-Plane physics, ~75% of starting direction is determined by face angle at impact.`;
      },
      causes:['Weak/neutral grip causing face to open at impact','Over-the-top swing path (outside-in)',
        'Early forearm rotation causing "chicken wing" through impact',
        'Insufficient hip rotation causing the arms to flip'],
      drills:[
        {name:'Grip check',desc:'Strengthen grip by rotating both hands 1 knuckle clockwise. At address you should see 2.5 knuckles on your lead hand. This closes the face slightly at impact.'},
        {name:'Towel drill – inside approach',desc:'Place a headcover 18 inches behind the ball on your toe line. Practice approaching from the inside without hitting it. Trains in-to-out swing path.'},
        {name:'Draw finish drill',desc:'Exaggerate rolling the forearms over through impact so the toe of the club passes the heel. "Shake hands with the target" feel at P7.'},
        {name:'Split hand drill',desc:'Hit balls with 6 inches of space between hands on the grip. The disconnection makes it obvious if the hands are not releasing — forces proper forearm rotation.'},
      ],
      optimalRange: () => 'Face-to-path within ±5°',
    },

    {
      id:'hook', name:'Hook / Closed Face to Path', icon:'↩️', category:'Path & Face', severity:'medium',
      test: s => facePath(s) < -5 && s.sideCarry < -12,
      description: shots => {
        const sc = avg(shots,'sideCarry');
        return `Face is closed to path. Ball is starting left and curving further left due to counter-clockwise spin. ` +
          `Average side carry: ${fmt(sc,1)} yds left. Strong hooks cost significant distance and are hard to control under pressure.`;
      },
      causes:['Grip too strong (hands rotated too far right)','Excessive forearm rotation (rolling over) through impact',
        'Inside-out path combined with closed face','Trail shoulder dropping too low in downswing'],
      drills:[
        {name:'Neutral grip drill',desc:'Weaken grip 1 knuckle counter-clockwise. At address, see 2–2.5 knuckles on lead hand. Check that the V formed by thumb and forefinger points to your chin.'},
        {name:'High finish drill',desc:'Practice finishing with your lead arm pointing at the sky (not wrapped around your body). High finish = face staying square longer through impact zone.'},
        {name:'Alignment stick in ground',desc:'Stick an alignment stick in the ground 2 feet right of the target. Deliberately try to start the ball at the stick. Trains a more neutral-to-right path, opening the face relative to path.'},
      ],
      optimalRange: () => 'Face-to-path within ±5°',
    },

    {
      id:'push-right', name:'Consistent Right Miss (Push)', icon:'→', category:'Path & Face', severity:'medium',
      test: s => s.launchDirection > 5 && s.sideCarry > 8 && Math.abs(facePath(s)) < 4,
      description: shots => `Launch direction averaging ${fmt(avg(shots,'launchDirection'),1)}° right with neutral face-to-path. ` +
        `Ball is starting right and staying right — a push, not a slice. Face and path are both aimed right of target.`,
      causes:['Alignment problem — shoulders aimed right of target','Ball too far back in stance',
        'Blocked rotation through impact (trail side stopping, arms releasing right)'],
      drills:[
        {name:'Alignment check',desc:'Place 2 alignment sticks parallel on the ground — one at your feet, one on the target line. Confirm feet, hips, and shoulders are all parallel left of the target, not aimed at it.'},
        {name:'Hip bump drill',desc:'Feel your lead hip bump toward the target at the start of the downswing before rotating. This prevents "blocking" the rotation and sets up a neutral path.'},
      ],
      optimalRange: () => 'Launch direction within ±3°',
    },

    {
      id:'pull-left', name:'Consistent Left Miss (Pull)', icon:'←', category:'Path & Face', severity:'medium',
      test: s => s.launchDirection < -5 && s.sideCarry < -8 && Math.abs(facePath(s)) < 4,
      description: shots => `Launch direction averaging ${fmt(avg(shots,'launchDirection'),1)}° left with neutral face-to-path. ` +
        `A pull — ball starting left and maintaining direction. Both face and path are aligned left of target.`,
      causes:['Alignment aimed left (common beginner overcompensation)',
        'Ball too far forward, catching it after the bottom of the arc with an open stance',
        'Over-the-top move creating an outside-in path with face matching it'],
      drills:[
        {name:'Right eye alignment drill',desc:'At address, close your right eye and look down the target line. If the ball appears right of the target when it should be on it, your alignment is off left.'},
        {name:'Tee behind ball',desc:'Tee a ball 1.5 inches behind your actual ball. Practice not clipping the back tee — this promotes a shallower, more inside approach angle.'},
      ],
      optimalRange: () => 'Launch direction within ±3°',
    },

    // ── ATTACK ANGLE ──────────────────────────────────────────
    {
      id:'driver-negative-aa', name:'Negative Attack Angle on Driver', icon:'📉', category:'Attack Angle', severity:'high',
      test: s => s.clubType === 'd' && s.attackAngle < -1,
      description: shots => {
        const aa = avg(shots,'attackAngle');
        const carry = avg(shots,'carryDistance');
        return `Attack angle of ${fmt(aa,1)}° (hitting down on driver). ` +
          `Each degree of downward attack on driver adds ~200–300 rpm of backspin and reduces carry. ` +
          `At your speed, hitting up at +3° instead could add 15–25 yards of carry without changing anything else.`;
      },
      causes:['Ball too far back in stance (centre or right of centre)',
        'Spine tilt level or tilted toward target at address',
        'Downswing too steep — treating the driver like an iron',
        'Not enough hip shift toward target on downswing'],
      drills:[
        {name:'Ball position forward',desc:'Tee the ball off the inside of your lead heel. At setup, your spine should tilt ~5° away from the target (right for a right-hander). This is the single biggest adjustment for positive attack angle.'},
        {name:'Headcover behind ball',desc:'Place a headcover 4 inches directly behind the teed ball. Swing and miss the headcover completely. Forces an upward, sweeping strike.'},
        {name:'Tee height experiment',desc:'Tee the ball so half of it is above the crown of the driver. Low tee = forced downward hit. High tee = naturally promotes an upward strike. Work progressively higher.'},
      ],
      optimalRange: () => '+2° to +5° attack angle for driver',
    },

    {
      id:'driver-very-steep', name:'Very Steep Driver Attack', icon:'📉📉', category:'Attack Angle', severity:'high',
      test: s => s.clubType === 'd' && s.attackAngle < -4,
      description: shots => `Severely negative attack angle of ${fmt(avg(shots,'attackAngle'),1)}° on driver. ` +
        `Likely producing very high spin rates, balloon trajectory, and significant distance loss. ` +
        `This level of steepness suggests a fundamental swing path issue.`,
      causes:['Pronounced over-the-top move','Upper body dominant swing (arms starting downswing)',
        'Collapsing of trail knee/hip in transition'],
      drills:[
        {name:'Right elbow slot drill',desc:'At the top, feel your right elbow drop to your right hip BEFORE the club moves. This shallows the plane and prevents the steep chop.'},
        {name:'Pump drill',desc:'Take the club to the top, then pump the downswing halfway (stopping at hip height) three times before completing. Trains the shallow transition feel.'},
      ],
      optimalRange: () => '+2° to +5° attack angle for driver',
    },

    {
      id:'iron-shallow-aa', name:'Shallow Attack Angle on Irons', icon:'↗️', category:'Attack Angle', severity:'medium',
      test: s => isIron(s.clubType) && !isShort(s.clubType) && s.attackAngle > -0.5,
      description: shots => `Attack angle of ${fmt(avg(shots,'attackAngle'),1)}° — too shallow for irons. ` +
        `Irons are designed to compress the ball with a downward strike. Shallow attack produces thin contact, ` +
        `lower compression, and inconsistent distance. You should be taking a small divot after the ball.`,
      causes:['Scooping motion — flipping the hands at impact to "help the ball up"',
        'Hanging back on the trail foot through impact',
        'Incorrect ball position (too far forward for the club)',
        '"Casting" — releasing the lag too early in the downswing'],
      drills:[
        {name:'Forward shaft lean drill',desc:'At impact, your hands should be ahead of the ball (shaft leaning toward target). Practice "pressing" the shaft forward at impact with slow-motion swings. Check in a mirror.'},
        {name:'Divot after the ball',desc:'Place a £1 coin on the grass 3 inches in front of the ball. Try to hit the coin with your divot after striking the ball. Proves ball-first, then turf contact.'},
        {name:'Lead wrist flat',desc:'At impact, your lead wrist should be flat or slightly bowed — not cupped (bent back). A cupped lead wrist is the #1 cause of scooping. Use an impact bag to practice.'},
      ],
      optimalRange: () => '-2° to -5° attack angle for irons',
    },

    {
      id:'iron-very-steep', name:'Very Steep Iron Attack', icon:'⬇️', category:'Attack Angle', severity:'medium',
      test: s => isIron(s.clubType) && s.attackAngle < -7,
      description: shots => `Attack angle of ${fmt(avg(shots,'attackAngle'),1)}° is too steep for irons. ` +
        `Excessively steep approach increases fat shot risk, reduces sweet spot contact, and loses distance through gear effect. ` +
        `Also puts stress on the left wrist and forearm.`,
      causes:['Arm-dominant downswing with insufficient hip rotation','Upper body sliding toward target (not rotating)',
        'Trail shoulder too high at address'],
      drills:[
        {name:'Hip turn start',desc:'Initiate the downswing by rotating the hips, not pulling with the arms. Feel the trail hip pocket move toward the target. Arms naturally shallow when hips lead.'},
        {name:'Swing to 3 o\'clock',desc:'Practice half-swings stopping the club at hip height on the follow-through. This promotes a more rounded, on-plane swing and removes the steep chop.'},
      ],
      optimalRange: () => '-2° to -5° attack angle for irons',
    },

    // ── LAUNCH CONDITIONS ──────────────────────────────────────
    {
      id:'driver-low-launch', name:'Low Launch on Driver', icon:'🚀', category:'Launch', severity:'medium',
      test: s => s.clubType === 'd' && s.launchAngle < 9,
      description: shots => {
        const la = avg(shots,'launchAngle');
        const cs = avg(shots,'clubSpeed');
        const ideal = cs > 105 ? '10–12°' : cs > 95 ? '11–13°' : '12–15°';
        return `Launch angle of ${fmt(la,1)}° is below optimal for your club speed (${fmt(cs,0)} mph). ` +
          `Optimal window for your speed is approximately ${ideal}. Low launch = reduced carry and poor descent angle for roll.`;
      },
      causes:['Negative attack angle (see above)','Dynamic loft too low — shaft leaning too far forward',
        'Tee too low','Hitting too far out on toe (reduces effective loft)'],
      drills:[
        {name:'Positive attack angle (key fix)',desc:'Fix negative attack angle first (see attack angle fault). Launch angle is largely a downstream result of attack angle on driver.'},
        {name:'Tee it up higher',desc:'Rule of thumb: half the ball should be above the crown at address. Higher tee naturally promotes higher launch and positive attack angle.'},
      ],
      optimalRange: cs => {
        const s = cs || 95;
        return s > 105 ? '10–12° launch' : s > 95 ? '11–13° launch' : '12–15° launch';
      },
    },

    {
      id:'driver-high-launch', name:'Ballooning / Too High Launch', icon:'🎈', category:'Launch', severity:'low',
      test: s => s.clubType === 'd' && s.launchAngle > 18 && s.carryDistance > 0,
      description: shots => `Launch angle of ${fmt(avg(shots,'launchAngle'),1)}° on driver is too high — creating a ballooning trajectory. ` +
        `High launch + high spin = loss of carry and poor performance into the wind. ` +
        `${shots.some(s=>s.spinRate) ? `Spin rate of ${fmt(avg(shots,'spinRate'),0)} rpm confirms this.` : ''}`,
      causes:['Attack angle too steeply upward (> +6°)','Face too open at address producing a scooped hit',
        'Dynamic loft too high'],
      drills:[
        {name:'Lower tee test',desc:'Drop tee height so only 1/4 of the ball is above the crown. Note how trajectory flattens. Find the tee height that gives your peak trajectory without ballooning.'},
        {name:'Shoulder tilt check',desc:'Excessive spine tilt away from target creates high dynamic loft. Maintain natural shoulder tilt (~5° from horizontal) rather than exaggerating.'},
      ],
      optimalRange: () => '10–15° for most swing speeds',
    },

    // ── SPIN (when available) ──────────────────────────────────
    {
      id:'high-spin-driver', name:'Excessive Spin — Driver', icon:'🌀', category:'Spin', severity:'high',
      test: s => s.clubType === 'd' && s.spinRate > 3500 && s.spinRate !== 0,
      description: shots => `Average spin rate of ${fmt(avg(shots,'spinRate'),0)} rpm on driver exceeds the 3500 rpm threshold. ` +
        `PGA Tour averages ~2686 rpm. High spin balloons the trajectory and kills carry distance — ` +
        `every 500 rpm above optimal is roughly 8–12 yards of lost carry at the same ball speed.`,
      causes:['Negative attack angle (most common)','High dynamic loft at impact',
        'Gear effect from toe/high hits adding spin','Shaft too low-kick (more flex adds spin for some players)'],
      drills:[
        {name:'Attack angle is the root cause',desc:'Reduce spin primarily by improving attack angle (see negative attack angle fault). Each +1° of attack angle removes ~250–400 rpm.'},
        {name:'Low punch shots',desc:'Practice hitting intentional low "punch" drivers with a three-quarter swing and a forward ball position. This trains a neutral dynamic loft at impact.'},
      ],
      optimalRange: () => '2000–2800 rpm driver spin',
    },

    {
      id:'high-spin-axis', name:'High Spin Axis (Slice Spin)', icon:'🔄', category:'Spin', severity:'high',
      test: s => s.spinAxis && s.spinAxis > 15,
      description: shots => {
        const sa = avg(shots,'spinAxis');
        return `Spin axis tilted ${fmt(sa,1)}° clockwise (right). ` +
          `A tilted spin axis causes sidespin — the ball curves right proportional to axis tilt and total spin rate. ` +
          `Spin axis > 15° creates visible slice shape even at moderate spin rates.`;
      },
      causes:['Face open to path at impact (main cause)','Outside-in swing path','Weak grip'],
      drills:[
        {name:'Close the face to path',desc:'See Slice fault — the spin axis is a direct measurement of face-to-path relationship. Closing the face relative to path will reduce spin axis.'},
        {name:'D-Plane drill',desc:'Aim your body slightly right, and try to start the ball at your body line while swinging along that line. This creates a draw. Gradually move your aim toward target as spin axis improves.'},
      ],
      optimalRange: () => 'Spin axis within ±10°',
    },

    {
      id:'low-spin-axis', name:'High Draw/Hook Spin', icon:'🔄', category:'Spin', severity:'medium',
      test: s => s.spinAxis && s.spinAxis < -15,
      description: shots => `Spin axis tilted ${fmt(avg(shots,'spinAxis'),1)}° counter-clockwise — significant draw/hook spin. ` +
        `While a slight draw is often desirable (+5–10 yards distance), excessive hook spin costs control.`,
      causes:['Face closed to path','Strong grip','Excessive forearm rotation through impact'],
      drills:[
        {name:'Face-to-path relationship',desc:'See Hook fault for specific drills. Goal is to reduce face-to-path gap from >15° to the 0–8° range for a controllable draw.'},
      ],
      optimalRange: () => 'Spin axis within ±10° (slight negative = draw = OK)',
    },

    // ── EFFICIENCY ────────────────────────────────────────────
    {
      id:'low-ball-speed', name:'Low Ball Speed / Energy Loss', icon:'🐌', category:'Efficiency', severity:'medium',
      test: s => s.clubSpeed > 0 && s.ballSpeed > 0 && (s.ballSpeed/s.clubSpeed) < 1.30 && s.smashFactor > 1.28,
      description: shots => {
        const ratio = avg(shots,'ballSpeed') / avg(shots,'clubSpeed');
        return `Ball speed / club speed ratio of ${fmt(ratio,2)}. ` +
          `Even with decent contact (smash factor OK), overall energy transfer is below optimal. ` +
          `This often indicates a loss of lag or "casting" before impact.`;
      },
      causes:['Early release / casting (losing lag before impact)','Deceleration in the downswing',
        'Tension stopping natural wrist release at impact','Passive lower body — arms doing all the work'],
      drills:[
        {name:'Lag preservation',desc:'Hold your wrist angle (lag) as long as possible in the downswing. Imagine holding a tray of drinks — release only when the hands reach hip height on the downswing.'},
        {name:'Towel swings',desc:'Swing a damp towel or training aid that "whooshes" at the bottom. If it whooshes early, you\'re casting. Find the feeling of maximum whoosh at the ball.'},
      ],
      optimalRange: () => 'Ball/club speed ratio > 1.42 (driver), > 1.36 (irons)',
    },

    // ── SHORT GAME ────────────────────────────────────────────
    {
      id:'wedge-thin', name:'Thin Wedge Strikes', icon:'⚡', category:'Wedge', severity:'medium',
      test: s => isShort(s.clubType) && s.smashFactor < 1.20 && s.launchAngle > 35,
      description: shots => `Smash factor ${fmt(avg(shots,'smashFactor'),2)} on wedges combined with high launch angle — classic thin/bladed wedge. ` +
        `Blade contact sends the ball low and hot rather than high and soft.`,
      causes:['Scooping motion — flipping at impact','Not maintaining posture through impact',
        'Ball too far forward for lofted clubs'],
      drills:[
        {name:'Bounce awareness',desc:'Wedges are designed to use the bounce (bottom trailing edge). Lead with the bounce by keeping your hands slightly ahead of the ball and the shaft slightly forward. Avoid digging.'},
        {name:'Flat lead wrist',desc:'At impact your lead wrist should be flat. Practice hinge-and-hold: hinge the wrists on backswing, maintain that hinge at impact, then release. No flipping.'},
      ],
      optimalRange: () => '1.25–1.30 smash (wedges)',
    },
  ];

  // Session-wide consistency rules (operate on all shots together)
  const SESSION_RULES = [
    {
      id:'inconsistent-contact', name:'Inconsistent Contact Quality', icon:'📊', category:'Consistency', severity:'medium',
      test: shots => {
        const vals = shots.map(s=>s.smashFactor).filter(v=>v>0);
        return stdDev(vals) > 0.08;
      },
      description: shots => {
        const vals = shots.map(s=>s.smashFactor).filter(v=>v>0);
        const sd = stdDev(vals);
        const best = Math.max(...vals);
        const worst = Math.min(...vals);
        return `Smash factor standard deviation of ${fmt(sd,3)} is above the 0.08 threshold (Tour: ~0.02). ` +
          `Range from ${fmt(worst,2)} to ${fmt(best,2)} — ${fmt((best-worst)*100,0)}% swing in contact quality within the session. ` +
          `This is costing you 10–20 yards on your worst shots vs best shots.`;
      },
      causes:['No consistent pre-shot routine','Ball position varying shot-to-shot','Setup changes (grip, stance width)',
        'Fatigue or mental drift during session'],
      drills:[
        {name:'Rigid pre-shot routine',desc:'Develop and stick to a 3-step routine before every shot: (1) approach from behind and visualise the shot, (2) walk in and take your grip + stance, (3) one waggle + go. Consistency starts before the swing.'},
        {name:'Ball position gate',desc:'Use an alignment stick to set ball position before every shot in practice. Vary the club but always double-check position relative to the alignment stick.'},
      ],
    },
    {
      id:'variable-launch', name:'Variable Launch Angle', icon:'📐', category:'Consistency', severity:'low',
      test: shots => {
        const vals = shots.map(s=>s.launchAngle).filter(v=>v>0);
        return vals.length >= 5 && stdDev(vals) > 5;
      },
      description: shots => {
        const vals = shots.map(s=>s.launchAngle).filter(v=>v>0);
        return `Launch angle standard deviation of ${fmt(stdDev(vals),1)}°. ` +
          `Variable launch angle = inconsistent ball striking. Distance will vary significantly even with the same club speed.`;
      },
      causes:['Inconsistent ball position','Varying spine angle / posture at address',
        'Dynamic loft changing due to wrist action variability'],
      drills:[
        {name:'Check address position',desc:'Photograph your address position from face-on and down-the-line. Compare to Tour reference photos for your club type. Small setup changes cause large launch angle variations.'},
      ],
    },
    {
      id:'session-fatigue', name:'Fatigue Pattern Detected', icon:'😤', category:'Consistency', severity:'low',
      test: shots => {
        if (shots.length < 10) return false;
        const firstHalf = shots.slice(0, Math.floor(shots.length/2));
        const secondHalf = shots.slice(Math.floor(shots.length/2));
        const f = avg(firstHalf,'ballSpeed');
        const s = avg(secondHalf,'ballSpeed');
        return f !== null && s !== null && (f - s) > 5;
      },
      description: shots => {
        const firstHalf = shots.slice(0,Math.floor(shots.length/2));
        const secondHalf = shots.slice(Math.floor(shots.length/2));
        const drop = avg(firstHalf,'ballSpeed') - avg(secondHalf,'ballSpeed');
        return `Ball speed dropped by ${fmt(drop,1)} mph from the first half to the second half of this session. ` +
          `Fatigue causes muscles to tighten, reducing clubhead speed and quality of contact. ` +
          `Consider shorter, more focused practice sessions with breaks.`;
      },
      causes:['Muscle fatigue','Loss of concentration','Dehydration','Hitting too many balls without recovery'],
      drills:[
        {name:'Structured practice blocks',desc:'Practice in 15-minute focused blocks with 5-minute rest. Quality > quantity. 50 deliberate balls beats 200 tired balls every time.'},
        {name:'Speed training last',desc:'If doing speed work (fast swings), do it in the first 20 minutes when you are freshest. Technique work later when pace doesn\'t matter as much.'},
      ],
    },
    {
      id:'dispersion-wide', name:'Wide Shot Dispersion', icon:'↔️', category:'Consistency', severity:'medium',
      test: shots => {
        const vals = shots.map(s=>s.sideCarry);
        return stdDev(vals) > 20;
      },
      description: shots => {
        const vals = shots.map(s=>s.sideCarry);
        const sd = stdDev(vals);
        const leftMost = Math.min(...vals);
        const rightMost = Math.max(...vals);
        return `Side carry standard deviation of ${fmt(sd,1)} yards. Left-right spread: ${fmt(leftMost,1)} to +${fmt(rightMost,1)} yards. ` +
          `Total dispersion width of ${fmt(rightMost-leftMost,0)} yards. Tour players average <25 yard dispersion. ` +
          `Wide dispersion = difficult course management and pressure situations.`;
      },
      causes:['Face angle variability','Path inconsistency','Contact quality variation'],
      drills:[
        {name:'Target narrow gate',desc:'Set up two headcovers 20 yards wide 150 yards away (or use flags). Practice until 80% of balls land between them. Narrow target = narrow mind = better shots.'},
        {name:'Intentional shape drill',desc:'Deliberately hit 5 draws then 5 fades. Controlling shot shape intentionally improves overall path and face consistency.'},
      ],
    },
  ];

  function detectFaults(shots) {
    if (!shots.length) return [];
    const faults = [];

    for (const rule of PER_SHOT_RULES) {
      const affected = shots.filter(s => { try { return rule.test(s); } catch { return false; } });
      if (affected.length === 0) continue;
      faults.push({
        ...rule,
        count: affected.length,
        total: shots.length,
        description: typeof rule.description === 'function' ? rule.description(affected) : rule.description,
        affectedShots: affected.map(s=>s._row),
      });
    }

    for (const rule of SESSION_RULES) {
      let passes = false;
      try { passes = rule.test(shots); } catch {}
      if (!passes) continue;
      faults.push({
        ...rule,
        count: shots.length,
        total: shots.length,
        description: typeof rule.description === 'function' ? rule.description(shots) : rule.description,
      });
    }

    // sort: high > medium > low
    const order = {high:0,medium:1,low:2};
    faults.sort((a,b) => order[a.severity] - order[b.severity]);
    return faults;
  }

  return { detectFaults };
})();

// ────────────────────────────────────────────────────────────────
// Shot Scorer — 0–100 per shot
// ────────────────────────────────────────────────────────────────
const ShotScorer = (() => {
  function score(shot) {
    let pts = 0, max = 0;

    // Smash factor (0–35 pts)
    if (shot.smashFactor > 0) {
      const threshold = isWood(shot.clubType)||isHybrid(shot.clubType) ? 1.42 : 1.36;
      const elite     = isWood(shot.clubType)||isHybrid(shot.clubType) ? 1.48 : 1.41;
      const raw = Math.min(1, Math.max(0, (shot.smashFactor - 1.10) / (elite - 1.10)));
      pts += raw * 35; max += 35;
    }

    // Side carry dispersion (0–25 pts)
    if (typeof shot.sideCarry === 'number') {
      const abs = Math.abs(shot.sideCarry);
      pts += Math.max(0, 25 - abs * 1.2); max += 25;
    }

    // Attack angle vs optimal (0–20 pts)
    if (shot.attackAngle !== 0) {
      let ideal = shot.clubType === 'd' ? 3 : isIron(shot.clubType) ? -3.5 : 1;
      const diff = Math.abs(shot.attackAngle - ideal);
      pts += Math.max(0, 20 - diff * 3); max += 20;
    }

    // Club path neutrality (0–10 pts)
    if (typeof shot.clubPath === 'number') {
      pts += Math.max(0, 10 - Math.abs(shot.clubPath) * 1); max += 10;
    }

    // Spin axis bonus/penalty when available (0–10 pts)
    if (shot.spinAxis) {
      pts += Math.max(0, 10 - Math.abs(shot.spinAxis) * 0.4); max += 10;
    }

    return max > 0 ? Math.round((pts / max) * 100) : null;
  }

  function grade(avgScore) {
    if (avgScore >= 85) return {letter:'A',color:'#16a34a'};
    if (avgScore >= 70) return {letter:'B',color:'#4d7c0f'};
    if (avgScore >= 55) return {letter:'C',color:'#b45309'};
    if (avgScore >= 40) return {letter:'D',color:'#c2410c'};
    return {letter:'F',color:'#dc2626'};
  }

  function scoreColor(s) {
    if (s >= 75) return 'var(--green)';
    if (s >= 50) return 'var(--yellow)';
    return 'var(--red)';
  }

  return { score, grade, scoreColor };
})();

// ────────────────────────────────────────────────────────────────
// Swing DNA — tendencies summary
// ────────────────────────────────────────────────────────────────
const SwingDNA = (() => {
  function analyze(shots) {
    const pills = [];

    // Shot shape — based on avg side carry + D-plane
    const avgSC = avg(shots,'sideCarry');
    const avgFP = shots.length ? shots.reduce((s,x)=>s+facePath(x),0)/shots.length : 0;
    if (avgSC !== null) {
      const shape =
        avgSC < -15 ? {label:'Hooker',val:'Hook tendency',icon:'↩️',tone:'bad'} :
        avgSC < -7  ? {label:'Draw',val:'Draw shape',icon:'↩️',tone:'good'} :
        avgSC > 15  ? {label:'Slicer',val:'Slice tendency',icon:'↪️',tone:'bad'} :
        avgSC > 7   ? {label:'Fade',val:'Fade shape',icon:'↪️',tone:'ok'} :
                      {label:'Straight',val:'Straight',icon:'↑',tone:'good'};
      pills.push({category:'Shot Shape',icon:shape.icon,value:shape.val,tone:shape.tone});
    }

    // Contact quality
    const smashVals = shots.map(s=>s.smashFactor).filter(v=>v>0);
    const avgSmash = avg(shots,'smashFactor');
    const sdSmash = stdDev(smashVals);
    if (avgSmash) {
      const q = sdSmash < 0.04 ? {val:'Elite',tone:'good'} :
                sdSmash < 0.07 ? {val:'Consistent',tone:'good'} :
                sdSmash < 0.10 ? {val:'Inconsistent',tone:'ok'} :
                                  {val:'Very Inconsistent',tone:'bad'};
      pills.push({category:'Contact',icon:'🎯',value:q.val + ` (${fmt(sdSmash,3)} σ)`,tone:q.tone});
    }

    // Average smash vs benchmark
    if (avgSmash) {
      const benchSmash = shots.every(s=>isIron(s.clubType)) ? 1.35 : 1.43;
      const relative = avgSmash >= benchSmash * 0.99 ? {val:`${fmt(avgSmash,2)} ✓`,tone:'good'} :
                       avgSmash >= benchSmash * 0.96 ? {val:`${fmt(avgSmash,2)} (near avg)`,tone:'ok'} :
                                                        {val:`${fmt(avgSmash,2)} (below avg)`,tone:'bad'};
      pills.push({category:'Smash Factor',icon:'💥',value:relative.val,tone:relative.tone});
    }

    // Path tendency
    const avgPath = avg(shots,'clubPath');
    if (avgPath !== null) {
      const p = avgPath > 3  ? {val:`In-to-out +${fmt(avgPath,1)}°`,tone:'ok'} :
                avgPath < -3 ? {val:`Out-to-in ${fmt(avgPath,1)}°`,tone:'bad'} :
                               {val:`Neutral ${fmt(avgPath,1)}°`,tone:'good'};
      pills.push({category:'Club Path',icon:'📐',value:p.val,tone:p.tone});
    }

    // Attack angle on driver shots
    const driverShots = shots.filter(s=>s.clubType==='d');
    if (driverShots.length) {
      const aa = avg(driverShots,'attackAngle');
      if (aa !== null) {
        const a = aa >= 1  ? {val:`+${fmt(aa,1)}° (Hitting up ✓)`,tone:'good'} :
                  aa >= -1 ? {val:`${fmt(aa,1)}° (Near neutral)`,tone:'ok'} :
                             {val:`${fmt(aa,1)}° (Hitting down ✗)`,tone:'bad'};
        pills.push({category:'Driver AoA',icon:'📐',value:a.val,tone:a.tone});
      }
    }

    // Spin (when available)
    const spinShots = shots.filter(s=>s.spinRate);
    if (spinShots.length) {
      const avgSpin = avg(spinShots,'spinRate');
      const driverSpin = spinShots.filter(s=>s.clubType==='d');
      if (driverSpin.length) {
        const ds = avg(driverSpin,'spinRate');
        const s = ds < 2500 ? {val:`${fmt(ds,0)} rpm (Low ✓)`,tone:'good'} :
                  ds < 3200 ? {val:`${fmt(ds,0)} rpm (Optimal ✓)`,tone:'good'} :
                  ds < 3800 ? {val:`${fmt(ds,0)} rpm (High)`,tone:'ok'} :
                              {val:`${fmt(ds,0)} rpm (Excessive ✗)`,tone:'bad'};
        pills.push({category:'Driver Spin',icon:'🌀',value:s.val,tone:s.tone});
      }
    }

    // Handedness of face-to-path
    if (shots.length >= 5) {
      const fpVals = shots.map(facePath);
      const avgFPa = fpVals.reduce((s,x)=>s+x,0)/fpVals.length;
      const fp = avgFPa > 8  ? {val:`Open +${fmt(avgFPa,1)}° (fading)`,tone:'bad'} :
                 avgFPa > 3  ? {val:`Slightly open +${fmt(avgFPa,1)}°`,tone:'ok'} :
                 avgFPa < -8 ? {val:`Closed ${fmt(avgFPa,1)}° (drawing)`,tone:'ok'} :
                 avgFPa < -3 ? {val:`Slightly closed ${fmt(avgFPa,1)}°`,tone:'good'} :
                               {val:`Square ${fmt(avgFPa,1)}° ✓`,tone:'good'};
      pills.push({category:'Face to Path',icon:'🎰',value:fp.val,tone:fp.tone});
    }

    return pills;
  }

  return { analyze };
})();

// ────────────────────────────────────────────────────────────────
// Benchmarks — PGA Tour + Amateur averages per club
// ────────────────────────────────────────────────────────────────
const Benchmarks = (() => {
  const DATA = {
    d:   {label:'Driver',  pga:{sf:1.48,carry:275,bs:167,la:10.9,aa:3.0}, am:{sf:1.41,carry:216,bs:133,la:12.6,aa:-0.5}},
    '2w':{label:'2 Wood',  pga:{sf:1.45,carry:255,bs:162,la:9.5, aa:1.0}, am:{sf:1.38,carry:195,bs:120,la:11.0,aa:-1.0}},
    '3w':{label:'3 Wood',  pga:{sf:1.44,carry:243,bs:158,la:9.2, aa:0.5}, am:{sf:1.38,carry:183,bs:116,la:11.2,aa:-1.5}},
    '4h':{label:'4 Hybrid',pga:{sf:1.40,carry:225,bs:147,la:11.0,aa:-1.0},am:{sf:1.34,carry:170,bs:105,la:13.0,aa:-2.0}},
    '5h':{label:'5 Hybrid',pga:{sf:1.39,carry:210,bs:138,la:12.5,aa:-1.5},am:{sf:1.33,carry:158,bs:100,la:14.0,aa:-2.5}},
    '4i':{label:'4i',       pga:{sf:1.38,carry:210,bs:140,la:11.0,aa:-2.0},am:{sf:1.32,carry:154,bs:100,la:13.5,aa:-3.0}},
    '5i':{label:'5i',       pga:{sf:1.37,carry:195,bs:132,la:13.0,aa:-2.5},am:{sf:1.32,carry:143,bs:93, la:15.0,aa:-3.5}},
    '6i':{label:'6i',       pga:{sf:1.36,carry:183,bs:124,la:14.5,aa:-3.0},am:{sf:1.31,carry:133,bs:87, la:16.5,aa:-4.0}},
    '7i':{label:'7i',       pga:{sf:1.35,carry:172,bs:116,la:16.3,aa:-3.5},am:{sf:1.30,carry:122,bs:80, la:18.0,aa:-4.0}},
    '8i':{label:'8i',       pga:{sf:1.34,carry:160,bs:107,la:18.0,aa:-4.0},am:{sf:1.29,carry:110,bs:74, la:19.5,aa:-4.5}},
    '9i':{label:'9i',       pga:{sf:1.33,carry:148,bs:98, la:20.4,aa:-4.5},am:{sf:1.28,carry:98, bs:69, la:21.5,aa:-5.0}},
    pw:  {label:'PW',       pga:{sf:1.30,carry:136,bs:89, la:24.0,aa:-5.0},am:{sf:1.26,carry:87, bs:62, la:25.0,aa:-5.5}},
    aw:  {label:'AW',       pga:{sf:1.28,carry:125,bs:82, la:27.0,aa:-5.5},am:{sf:1.24,carry:78, bs:57, la:28.0,aa:-6.0}},
    sw:  {label:'SW',       pga:{sf:1.24,carry:110,bs:74, la:32.0,aa:-6.0},am:{sf:1.20,carry:68, bs:50, la:33.0,aa:-6.0}},
    lw:  {label:'LW',       pga:{sf:1.20,carry:90, bs:62, la:38.0,aa:-5.0},am:{sf:1.16,carry:55, bs:42, la:40.0,aa:-5.0}},
  };

  function get(t) { return DATA[t] || null; }

  function status(user, am, pga, higherBetter=true) {
    if (user === null) return 'na';
    const ref = am;
    if (higherBetter) {
      if (user >= pga * 0.97) return 'green';
      if (user >= ref * 0.95) return 'yellow';
      return 'red';
    } else {
      if (user <= pga * 1.03) return 'green';
      if (user <= ref * 1.05) return 'yellow';
      return 'red';
    }
  }

  return { get, status };
})();

// ────────────────────────────────────────────────────────────────
// Insights — auto-generated "coach's notes"
// ────────────────────────────────────────────────────────────────
const Insights = (() => {
  function clubQuality(shots) {
    return sortedClubs(shots).map(c => {
      const cs = shots.filter(s=>s.clubType===c);
      const sc = cs.map(ShotScorer.score).filter(x=>x!==null);
      return { club:c, score: sc.length?sc.reduce((a,b)=>a+b,0)/sc.length:0, count: cs.length };
    }).filter(c => c.count >= 2).sort((a,b)=>b.score-a.score);
  }

  function generate(shots) {
    if (!shots.length) return null;
    const scores = shots.map(ShotScorer.score).filter(x=>x!==null);
    const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    const grade = ShotScorer.grade(avgScore);
    const cq = clubQuality(shots);
    const faults = FaultEngine.detectFaults(shots);
    const highFaults = faults.filter(f=>f.severity==='high');

    const strengths = [], improvements = [];

    if (cq.length && cq[0].score >= 68)
      strengths.push(`Your <strong>${clubLabel(cq[0].club)}</strong> was your most reliable club today (${Math.round(cq[0].score)}/100 quality).`);

    const avgSmash = avg(shots,'smashFactor');
    const allIron = shots.every(s=>isIron(s.clubType));
    const benchSmash = allIron ? 1.35 : 1.43;
    if (avgSmash && avgSmash >= benchSmash)
      strengths.push(`Strike quality is excellent — average smash factor of <strong>${fmt(avgSmash,2)}</strong> meets tour-amateur benchmarks.`);

    const sideStd = stdDev(shots.map(s=>s.sideCarry));
    if (sideStd > 0 && sideStd < 12)
      strengths.push(`Tight dispersion — most shots land within a <strong>${fmt(sideStd*2,0)}-yard</strong> window left-to-right.`);

    const driverShots = shots.filter(s=>s.clubType==='d');
    if (driverShots.length >= 2) {
      const aa = avg(driverShots,'attackAngle');
      if (aa !== null && aa >= 1)
        strengths.push(`You're hitting <strong>up</strong> on the driver (+${fmt(aa,1)}°) — maximising carry efficiency.`);
    }

    if (highFaults.length)
      improvements.push(`<strong>${highFaults[0].name}</strong> is your #1 priority — it affected ${highFaults[0].count} of ${highFaults[0].total} shots.`);
    if (cq.length > 1 && cq[cq.length-1].score < 50) {
      const w = cq[cq.length-1];
      improvements.push(`Your <strong>${clubLabel(w.club)}</strong> struggled (${Math.round(w.score)}/100) — worth dedicated practice time.`);
    }
    if (!highFaults.length && faults.length)
      improvements.push(`No major faults, but watch <strong>${faults[0].name.toLowerCase()}</strong> to tighten up further.`);

    if (!strengths.length) strengths.push('Keep building — more reps will reveal your strengths in the data.');
    if (!improvements.length) improvements.push('No significant faults detected. Excellent, consistent session!');

    return { avgScore, grade, strengths, improvements, focus: highFaults[0]||faults[0]||null, faultCount: faults.length, shotCount: shots.length };
  }
  return { generate };
})();

// ────────────────────────────────────────────────────────────────
// Practice Plan — turn faults into a prioritised session
// ────────────────────────────────────────────────────────────────
const PracticePlan = (() => {
  function generate(shots, totalMin = 45) {
    const faults = FaultEngine.detectFaults(shots).filter(f => f.drills && f.drills.length);
    if (!faults.length) return null;
    const top = faults.slice(0,3);
    const weights = top.map(f => f.severity==='high'?3 : f.severity==='medium'?2 : 1);
    const totalW = weights.reduce((a,b)=>a+b,0);
    return top.map((f,i) => ({
      name: f.name, icon: f.icon, severity: f.severity,
      minutes: Math.max(5, Math.round(totalMin * weights[i]/totalW)),
      drill: f.drills[0],
    }));
  }
  return { generate };
})();

// ────────────────────────────────────────────────────────────────
// Analytics — cross-session yardage book + personal bests
// ────────────────────────────────────────────────────────────────
const Analytics = (() => {
  function yardageBook(sessions) {
    const all = sessions.flatMap(s=>s.shots);
    return sortedClubs(all).map(c => {
      const cs = all.filter(s=>s.clubType===c);
      const carries = cs.map(s=>s.carryDistance).filter(v=>v>0).sort((a,b)=>a-b);
      return {
        club:c, count:cs.length,
        avgCarry: avg(cs,'carryDistance'),
        minCarry: carries.length?carries[0]:null,
        maxCarry: carries.length?carries[carries.length-1]:null,
        avgTotal: avg(cs,'totalDistance'),
        stdCarry: stdDev(carries),
        avgSmash: avg(cs,'smashFactor'),
        avgBall: avg(cs,'ballSpeed'),
      };
    });
  }

  function personalBests(sessions) {
    const all = sessions.flatMap(s => s.shots.map(sh => ({...sh, _date:s.date})));
    if (!all.length) return [];
    const top = (field, label, unit, dec=0) => {
      let best = null;
      all.forEach(s => { if (s[field] > 0 && (!best || s[field] > best[field])) best = s; });
      return best ? { label, value: fmt(best[field],dec), unit, club: clubLabel(best.clubType), date: formatDate(best._date) } : null;
    };
    return [
      top('carryDistance','Longest Carry','yds'),
      top('totalDistance','Longest Total','yds'),
      top('ballSpeed','Top Ball Speed','mph'),
      top('clubSpeed','Top Club Speed','mph'),
      top('smashFactor','Best Smash','',2),
      top('apex','Highest Apex','ft'),
    ].filter(Boolean);
  }
  return { yardageBook, personalBests };
})();

// ════════════════════════════════════════════════════════════════
// QuickStats — always-visible KPI dashboard + smart recommendations
// ════════════════════════════════════════════════════════════════
const QuickStats = (() => {
  function renderStats(sessions) {
    const host = document.getElementById('quickStatsHost');
    if (!host) return;
    if (!sessions.length) { host.innerHTML = ''; return; }

    const all = sessions.flatMap(s => s.shots);
    const recent10 = sessions.slice(0, 10);
    const avgScore = (() => {
      const scores = recent10.flatMap(s => s.shots.map(ShotScorer.score)).filter(x=>x!==null);
      return scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    })();
    const bestCarry = Math.max(0, ...all.map(s => s.carryDistance || 0));
    const avgCarry = Math.round(avg(all, 'carryDistance') || 0);
    const consistency = Math.round(100 - stdDev(all.map(s => s.carryDistance || 0)));

    host.innerHTML = `
      <div class="quick-stat">
        <div class="quick-stat-value">${avgScore}</div>
        <div class="quick-stat-label">Form</div>
      </div>
      <div class="quick-stat">
        <div class="quick-stat-value">${bestCarry}</div>
        <div class="quick-stat-label">Best</div>
      </div>
      <div class="quick-stat">
        <div class="quick-stat-value">${avgCarry}</div>
        <div class="quick-stat-label">Avg</div>
      </div>
      <div class="quick-stat">
        <div class="quick-stat-value">${consistency}%</div>
        <div class="quick-stat-label">Consistency</div>
      </div>`;
  }

  return { renderStats };
})();

// ════════════════════════════════════════════════════════════════
// SmartRecommendations — context-aware next-step suggestions
// ════════════════════════════════════════════════════════════════
const SmartRecommendations = (() => {
  function getNextStep(sessions) {
    if (!sessions.length) return {
      type: 'first',
      title: 'Import your first session',
      desc: 'Upload a Rapsodo CSV to start analyzing your swing',
      icon: '📤', action: 'import'
    };

    if (sessions.length < 5) return {
      type: 'buildup',
      title: 'Build your baseline',
      desc: `${5 - sessions.length} more sessions to establish patterns`,
      icon: '📈', action: 'sessions'
    };

    const faults = FaultEngine.detectFaults(sessions[0].shots);
    if (faults.length > 0) return {
      type: 'drill',
      title: `Work on ${faults[0].name}`,
      desc: faults[0].name,
      icon: faults[0].icon, action: 'drill'
    };

    const st = Features.streak(sessions);
    if (st.current === 0) return {
      type: 'streak',
      title: 'Start your streak today',
      desc: 'Practice to build consistency',
      icon: '🔥', action: 'sessions'
    };

    const goals = Goals.getGoals();
    if (Object.keys(goals).length === 0) return {
      type: 'goal',
      title: 'Set a goal',
      desc: 'Give yourself something to chase',
      icon: '🎯', action: 'settings'
    };

    return {
      type: 'review',
      title: 'Check your progress',
      desc: 'See how you\'re improving',
      icon: '📊', action: 'progress'
    };
  }

  return { getNextStep };
})();

// ════════════════════════════════════════════════════════════════
// SessionFeedback — rate and review sessions for personalization
// ════════════════════════════════════════════════════════════════
const SessionFeedback = (() => {
  const STORAGE_KEY = 'slSessionFeedback';

  function rateSession(sessionId, rating) {
    const feedback = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    feedback[sessionId] = { rating, rated: Date.now() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(feedback)); } catch (_) {}
  }

  function getFeedback(sessionId) {
    const feedback = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return feedback[sessionId] || null;
  }

  function getAverageRating(sessions) {
    const feedback = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const rated = sessions.filter(s => feedback[s.id]).map(s => feedback[s.id].rating);
    return rated.length ? (rated.reduce((a,b)=>a+b,0)/rated.length).toFixed(1) : null;
  }

  return { rateSession, getFeedback, getAverageRating };
})();

// ════════════════════════════════════════════════════════════════
// ClubComparison — compare club performance across sessions
// ════════════════════════════════════════════════════════════════
const ClubComparison = (() => {
  function compareClubs(sessions, club1, club2) {
    const shots1 = sessions.flatMap(s=>s.shots).filter(sh=>sh.clubType===club1);
    const shots2 = sessions.flatMap(s=>s.shots).filter(sh=>sh.clubType===club2);

    return {
      club1: {
        name: clubLabel(club1),
        avgCarry: Math.round(avg(shots1,'carryDistance')||0),
        avgBallSpeed: fmt(avg(shots1,'ballSpeed'),1),
        avgSmash: fmt(avg(shots1,'smashFactor'),2),
        shots: shots1.length,
        consistency: Math.round(100 - stdDev(shots1.map(s=>s.carryDistance||0))),
      },
      club2: {
        name: clubLabel(club2),
        avgCarry: Math.round(avg(shots2,'carryDistance')||0),
        avgBallSpeed: fmt(avg(shots2,'ballSpeed'),1),
        avgSmash: fmt(avg(shots2,'smashFactor'),2),
        shots: shots2.length,
        consistency: Math.round(100 - stdDev(shots2.map(s=>s.carryDistance||0))),
      }
    };
  }

  return { compareClubs };
})();

// ════════════════════════════════════════════════════════════════
// PracticePlans — AI-generated practice routines
// ════════════════════════════════════════════════════════════════
const PracticePlans = (() => {
  function generatePlan(sessions) {
    if (!sessions.length) return null;
    const faults = FaultEngine.detectFaults(sessions[0].shots);
    const st = Features.streak(sessions);

    const plans = [];

    // Consistency drill
    plans.push({
      name: '⏱️ Consistency Drill',
      duration: 20,
      desc: 'Hit 10 shots with each club, focusing on repeatable swing',
      focus: 'Rhythm',
      difficulty: 'Easy'
    });

    // Distance control
    if (faults.length > 0) {
      plans.push({
        name: `🎯 ${faults[0].name} Drill`,
        duration: 30,
        desc: `Target your #1 issue: ${faults[0].name}`,
        focus: 'Technique',
        difficulty: 'Hard'
      });
    }

    // Course simulation
    plans.push({
      name: '⛳ Course Simulation',
      duration: 45,
      desc: 'Simulate 9 holes - pick clubs like you would on course',
      focus: 'Pressure',
      difficulty: 'Hard'
    });

    // Short game if irons present
    const hasIrons = sessions.flatMap(s=>s.shots).some(sh=>isIron(sh.clubType) && sh.carryDistance<150);
    if (hasIrons) {
      plans.push({
        name: '🎪 Short Game Focus',
        duration: 25,
        desc: 'Drill approach shots and wedges for accuracy',
        focus: 'Accuracy',
        difficulty: 'Medium'
      });
    }

    return plans;
  }

  return { generatePlan };
})();

// ════════════════════════════════════════════════════════════════
// SessionCategories — tag and organize sessions
// ════════════════════════════════════════════════════════════════
const SessionCategories = (() => {
  const STORAGE_KEY = 'slSessionCategories';
  const DEFAULT_CATS = ['Indoor', 'Outdoor', 'Range', 'Course', 'Tutorial', 'Testing'];

  function getCategories() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (_) { return {}; }
  }

  function tagSession(sessionId, category) {
    const cats = getCategories();
    if (!cats[category]) cats[category] = [];
    if (!cats[category].includes(sessionId)) cats[category].push(sessionId);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cats)); } catch (_) {}
  }

  function filterByCategory(sessions, category) {
    if (category === 'all') return sessions;
    const cats = getCategories();
    const ids = new Set(cats[category] || []);
    return sessions.filter(s => ids.has(s.id));
  }

  return { DEFAULT_CATS, getCategories, tagSession, filterByCategory };
})();
const Goals = (() => {
  const STORAGE_KEY = 'slGoals';

  function getGoals() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (_) { return {}; }
  }

  function setGoal(metric, target, unit) {
    const goals = getGoals();
    goals[metric] = { target, unit, set: Date.now() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(goals)); } catch (_) {}
  }

  function deleteGoal(metric) {
    const goals = getGoals();
    delete goals[metric];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(goals)); } catch (_) {}
  }

  function getProgress(metric, sessions) {
    const all = sessions.flatMap(s => s.shots);
    let current = null;
    switch(metric) {
      case 'carry':      current = Math.max(0, ...all.map(s => s.carryDistance || 0)); break;
      case 'ball_speed': current = Math.max(0, ...all.map(s => s.ballSpeed || 0)); break;
      case 'smash':      current = Math.max(0, ...all.map(s => s.smashFactor || 0)); break;
      case 'sessions':   current = sessions.length; break;
      case 'score':      {
        const scores = sessions.slice(0,3).map(s => {
          const sc = s.shots.map(ShotScorer.score).filter(x=>x!==null);
          return sc.length ? sc.reduce((a,b)=>a+b,0)/sc.length : null;
        }).filter(x=>x!==null);
        current = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
      } break;
    }
    return current;
  }

  return { getGoals, setGoal, deleteGoal, getProgress };
})();

// ════════════════════════════════════════════════════════════════
// ViewPrefs — customizable dashboard and view settings
// ════════════════════════════════════════════════════════════════
const ViewPrefs = (() => {
  const STORAGE_KEY = 'slViewPrefs';

  const defaults = {
    showHeatmap: true,
    showFaults: true,
    showClubBreakdown: true,
    showTrendChart: true,
    showComparison: true,
    densityMode: false,
  };

  function getPrefs() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (_) { return defaults; }
  }

  function setPref(key, value) {
    const prefs = getPrefs();
    prefs[key] = value;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (_) {}
  }

  function togglePref(key) {
    const prefs = getPrefs();
    prefs[key] = !prefs[key];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (_) {}
    return prefs[key];
  }

  return { getPrefs, setPref, togglePref };
})();

// ════════════════════════════════════════════════════════════════
// Features — nine self-contained, defensive enhancements.
// Each method is wrapped so a failure degrades gracefully (returns
// empty/neutral) and can never break the surrounding render.
// ════════════════════════════════════════════════════════════════
const Features = (() => {

  const dayKey = d => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
  const DAY = 86400000;

  // ── 1. Practice streak (habit psychology) ──────────────────────
  // Counts consecutive days (ending today or yesterday) with a session.
  function streak(sessions) {
    try {
      if (!sessions?.length) return { current: 0, best: 0, active: false };
      const days = [...new Set(sessions.map(s => dayKey(s.date)))].sort((a,b)=>b-a);
      const today = dayKey(Date.now());
      // current streak: walk back from today (grace: counts if last practice was today or yesterday)
      let current = 0;
      if (days[0] === today || days[0] === today - DAY) {
        let cursor = days[0];
        for (const d of days) {
          if (d === cursor) { current++; cursor -= DAY; }
          else if (d < cursor) break;
        }
      }
      // best streak across history
      let best = 1, run = 1;
      for (let i = 1; i < days.length; i++) {
        if (days[i] === days[i-1] - DAY) { run++; best = Math.max(best, run); }
        else run = 1;
      }
      return { current, best: Math.max(best, current), active: days[0] === today };
    } catch (e) { console.error('streak()', e); return { current: 0, best: 0, active: false }; }
  }

  // ── 2. Achievements / badges (gamification) ────────────────────
  function achievements(sessions) {
    try {
      const all = sessions.flatMap(s => s.shots);
      const bests = Analytics.personalBests(sessions);
      const carry = Math.max(0, ...all.map(s => s.carryDistance || 0));
      const ball  = Math.max(0, ...all.map(s => s.ballSpeed || 0));
      const smash = Math.max(0, ...all.map(s => s.smashFactor || 0));
      const clubs = sortedClubs(all).length;
      const st = streak(sessions);
      const defs = [
        { id:'first',   icon:'🌱', name:'First Steps',     desc:'Log your first session',      got: sessions.length >= 1 },
        { id:'dozen',   icon:'📚', name:'Getting Serious',  desc:'Log 12 sessions',             got: sessions.length >= 12 },
        { id:'century',  icon:'💯', name:'Century',          desc:'Log 100 shots total',         got: all.length >= 100 },
        { id:'grand',   icon:'🎯', name:'Range Rat',        desc:'Log 1,000 shots total',       got: all.length >= 1000 },
        { id:'bag',     icon:'🎒', name:'Full Bag',         desc:'Track 10+ different clubs',   got: clubs >= 10 },
        { id:'streak3', icon:'🔥', name:'On a Roll',        desc:'3-day practice streak',       got: st.best >= 3 },
        { id:'streak7', icon:'⚡', name:'Week Warrior',     desc:'7-day practice streak',       got: st.best >= 7 },
        { id:'smash',   icon:'🥎', name:'Pure Contact',     desc:'Hit 1.45+ smash factor',      got: smash >= 1.45 },
        { id:'bomb',    icon:'🚀', name:'Bomber',           desc:'250+ yard carry',             got: carry >= 250 },
        { id:'speed',   icon:'💨', name:'Speed Demon',      desc:'170+ mph ball speed',         got: ball >= 170 },
      ];
      const unlocked = defs.filter(d => d.got).length;
      return { defs, unlocked, total: defs.length };
    } catch (e) { console.error('achievements()', e); return { defs: [], unlocked: 0, total: 0 }; }
  }

  // ── 3. Focus — "what to work on" (personalised, confidence-rated) ─
  // Aggregates fault frequency across recent sessions into one clear priority.
  function focus(sessions) {
    try {
      const recent = sessions.slice(0, 5);
      const shots = recent.flatMap(s => s.shots);
      if (shots.length < 5) return null;
      const faults = FaultEngine.detectFaults(shots);
      if (!faults.length) return { clean: true };
      const ranked = [...faults].sort((a,b) =>
        (b.severity==='high'?2:b.severity==='low'?0:1) - (a.severity==='high'?2:a.severity==='low'?0:1)
        || (b.count||0) - (a.count||0));
      const top = ranked[0];
      const pct = Math.round(((top.count||1) / shots.length) * 100);
      const confidence = pct >= 40 ? 'High' : pct >= 20 ? 'Medium' : 'Low';
      return { clean:false, name:top.name, icon:top.icon, severity:top.severity,
               pct, confidence, count:top.count||0, sample:shots.length,
               drill: (top.drills && top.drills[0]) || null };
    } catch (e) { console.error('focus()', e); return null; }
  }

  // ── 4. Session comparison ──────────────────────────────────────
  // Side-by-side metric deltas between two sessions (newer vs older).
  function compare(a, b) {
    try {
      const metric = (s, f, dec=0) => fmt(avg(s.shots, f), dec);
      const num = (s, f) => avg(s.shots, f);
      const rows = [
        ['Avg carry',  'carryDistance', 0, 'yds', true],
        ['Ball speed', 'ballSpeed',     1, 'mph', true],
        ['Smash',      'smashFactor',   2, '',    true],
        ['Launch',     'launchAngle',   1, '°',   null],
        ['Spin',       'spinRate',      0, 'rpm', null],
        ['Apex',       'apex',          0, 'ft',  null],
      ];
      return rows.map(([label, f, dec, unit, higherBetter]) => {
        const av = num(a, f), bv = num(b, f);
        const delta = (av!=null && bv!=null) ? av - bv : null;
        return {
          label, unit,
          a: metric(a, f, dec), b: metric(b, f, dec),
          delta: delta!=null ? fmt(Math.abs(delta), dec) : null,
          dir: delta==null||Math.abs(delta)<1e-9 ? 'flat' : delta>0 ? 'up' : 'down',
          good: (delta==null||higherBetter==null) ? null : (higherBetter ? delta>0 : delta<0),
        };
      });
    } catch (e) { console.error('compare()', e); return []; }
  }

  // ── 5. Session search/filter helper ────────────────────────────
  // Matches a query against date, notes, club labels.
  function searchSessions(sessions, query) {
    try {
      const q = (query||'').trim().toLowerCase();
      if (!q) return sessions;
      return sessions.filter(s => {
        const hay = [
          formatDate(s.date),
          s.notes || '',
          s.conditions?.wind || '', s.conditions?.temp || '',
          ...new Set(s.shots.map(sh => clubLabel(sh.clubType))),
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
    } catch (e) { console.error('searchSessions()', e); return sessions; }
  }

  // ── 6. Goal progress visualization ────────────────────────────
  function goalProgress(sessions) {
    try {
      const goals = Goals.getGoals();
      const results = {};
      Object.entries(goals).forEach(([metric, goal]) => {
        const current = Goals.getProgress(metric, sessions);
        const pct = Math.round((current / goal.target) * 100);
        results[metric] = { current, target: goal.target, unit: goal.unit, pct: Math.min(pct, 100) };
      });
      return results;
    } catch (e) { console.error('goalProgress()', e); return {}; }
  }

  // ── 7. Performance alerts (email notifications) ────────────────
  function performanceAlerts(sessions) {
    try {
      if (sessions.length < 2) return [];
      const recent = sessions[0];
      const prev = sessions[1];
      const recentScore = recent.shots.map(ShotScorer.score).filter(x=>x!==null).reduce((a,b)=>a+b,0)/recent.shots.length||0;
      const prevScore = prev.shots.map(ShotScorer.score).filter(x=>x!==null).reduce((a,b)=>a+b,0)/prev.shots.length||0;
      const alerts = [];

      if (recentScore > prevScore + 10) alerts.push({ type: 'improvement', msg: `+${Math.round(recentScore-prevScore)} pts! Keep it up!` });
      if (recentScore < prevScore - 10) alerts.push({ type: 'decline', msg: `Session was -${Math.round(prevScore-recentScore)} pts. Check your setup.` });

      const faults = FaultEngine.detectFaults(recent.shots);
      if (faults.some(f=>f.severity==='high')) alerts.push({ type: 'fault', msg: `${faults[0].name} detected. Want to drill it?` });

      return alerts;
    } catch (e) { console.error('performanceAlerts()', e); return []; }
  }

  // ── 8. Drill recommendation engine ────────────────────────────
  function recommendDrill(sessions) {
    try {
      if (!sessions.length) return null;
      const all = sessions.slice(0,5).flatMap(s=>s.shots);
      const faults = {};
      all.forEach(shot => {
        const fault = FaultEngine.detectFault(shot);
        if (fault) faults[fault.name] = (faults[fault.name]||0)+1;
      });
      if (!Object.keys(faults).length) return null;
      const topFault = Object.entries(faults).sort((a,b)=>b[1]-a[1])[0];
      const drills = {
        'Slice': { name: 'In-to-Out Path Drill', time: 15, desc: 'Hit 10 balls focusing on swinging left-to-right' },
        'Hook': { name: 'Out-to-In Path Drill', time: 15, desc: 'Hit 10 balls focusing on swinging right-to-left' },
        'Thin': { name: 'Low Point Drill', time: 10, desc: 'Practice ball position to hit center' },
        'Fat': { name: 'Weight Transfer Drill', time: 15, desc: 'Focus on smooth weight shift through impact' },
      };
      return { fault: topFault[0], count: topFault[1], drill: drills[topFault[0]] || { name: 'Technique Drill', time: 20, desc: 'Record 20 shots focusing on form.' } };
    } catch (e) { console.error('recommendDrill()', e); return null; }
  }

  // ── 9. Session quality benchmarks ────────────────────────────
  function benchmarks(sessions) {
    try {
      if (!sessions.length) return {};
      const all = sessions.flatMap(s=>s.shots);
      const clubs = {};
      all.forEach(shot => {
        if (!clubs[shot.clubType]) clubs[shot.clubType] = [];
        clubs[shot.clubType].push(shot.carryDistance || 0);
      });
      return Object.entries(clubs).reduce((acc,[club,dists]) => {
        acc[club] = { avg: Math.round(avg(dists.map(d=>({carryDistance:d})),'carryDistance')||0), count: dists.length };
        return acc;
      }, {});
    } catch (e) { console.error('benchmarks()', e); return {}; }
  }

  return { streak, achievements, focus, compare, searchSessions, goalProgress, performanceAlerts, recommendDrill, benchmarks };
})();

// ────────────────────────────────────────────────────────────────
// Trajectory — SVG side-profile ball flight
// ────────────────────────────────────────────────────────────────
const Trajectory = (() => {
  function arc(launch, apexFt, carryYds, descent, opts={}) {
    const W=opts.w||340, H=opts.h||170, pad=opts.pad||26;
    launch  = launch  > 0 ? launch  : 12;
    descent = descent > 0 ? descent : 40;
    const tl=Math.tan(launch*Math.PI/180), td=Math.tan(descent*Math.PI/180);
    let frac = td/(tl+td);
    if (!isFinite(frac) || frac<=0.05 || frac>=0.95) frac=0.6;
    const gx0=pad, gx1=W-pad, gy=H-pad;
    const uw=gx1-gx0, uh=H-pad*1.5;
    const ax=gx0+uw*frac, ay=gy-uh;
    const c1x=gx0+(ax-gx0)*0.55, c2x=ax+(gx1-ax)*0.45;
    const line=`M ${gx0} ${gy} Q ${c1x} ${ay} ${ax} ${ay} Q ${c2x} ${ay} ${gx1} ${gy}`;
    const area=`${line} L ${gx1} ${gy} L ${gx0} ${gy} Z`;
    const uid='tg'+Math.random().toString(36).slice(2,7);
    return `
      <svg class="traj-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ball flight profile">
        <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--turf)" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="var(--turf)" stop-opacity="0.02"/>
        </linearGradient></defs>
        <line x1="${gx0}" y1="${gy}" x2="${gx1}" y2="${gy}" stroke="var(--border-hi)" stroke-width="1.5"/>
        <path d="${area}" fill="url(#${uid})"/>
        <line x1="${ax}" y1="${ay}" x2="${ax}" y2="${gy}" stroke="var(--border-hi)" stroke-width="1" stroke-dasharray="3 3"/>
        <path d="${line}" fill="none" stroke="var(--pine)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${gx0}" cy="${gy}" r="3.5" fill="var(--pine)"/>
        <circle cx="${ax}" cy="${ay}" r="4" fill="var(--turf)"/>
        <circle cx="${gx1}" cy="${gy}" r="3.5" fill="var(--pine)"/>
        <text x="${ax}" y="${ay-7}" text-anchor="middle" class="traj-lbl">${fmt(apexFt,0)} ft</text>
        <text x="${gx0}" y="${gy+15}" text-anchor="start" class="traj-lbl">${fmt(launch,1)}° launch</text>
        <text x="${gx1}" y="${gy+15}" text-anchor="end" class="traj-lbl">${fmt(carryYds,0)} yds carry</text>
      </svg>`;
  }
  const shot = s => arc(s.launchAngle, s.apex, s.carryDistance, s.descentAngle);
  const avgFlight = shots => shots.length
    ? arc(avg(shots,'launchAngle'), avg(shots,'apex'), avg(shots,'carryDistance'), avg(shots,'descentAngle'))
    : '';
  return { shot, avgFlight, arc };
})();

// ────────────────────────────────────────────────────────────────
// Paywall helper — blur section content for guest users
// ────────────────────────────────────────────────────────────────
function applyPaywall(el, cta) {
  if (Auth.getUser()) return false;
  if (!el || !el.innerHTML.trim()) return false;
  const inner = el.innerHTML;
  el.innerHTML = `
    <div class="paywall-wrap">
      <div class="paywall-blur" aria-hidden="true">${inner}</div>
      <div class="paywall-overlay">
        <span class="paywall-lock">🔒</span>
        <span class="paywall-msg">${cta || 'Sign in to unlock'}</span>
        <button class="btn-primary btn-sm paywall-btn">Sign In</button>
      </div>
    </div>`;
  el.querySelector('.paywall-btn').addEventListener('click', () => Auth.showAuth(false));
  return true;
}

// ────────────────────────────────────────────────────────────────
// UI
// ────────────────────────────────────────────────────────────────
const UI = (() => {
  let _session = null;
  let _clubFilter = 'all';
  const _charts = {};

  function destroyChart(id) {
    if (_charts[id]) { try { _charts[id].destroy(); } catch {} delete _charts[id]; }
  }

  // ── Home: dashboard + recent sessions ─────────────────────────
  function renderHome(sessions) {
    // Always render quick stats at the top
    try { QuickStats.renderStats(sessions); } catch(e){ console.error('quickstats',e); }

    // Render smart next-step recommendation
    try {
      const nextHost = document.getElementById('nextStepHost');
      if (nextHost) {
        const next = SmartRecommendations.getNextStep(sessions);
        nextHost.innerHTML = `
          <div class="drill-card" onclick="Router.show('${next.action}')">
            <div class="drill-icon">${next.icon}</div>
            <div class="drill-title">${next.title}</div>
            <div class="drill-desc">${next.desc}</div>
            <div class="drill-time">→ Tap to go</div>
          </div>`;
      }
    } catch(e){ console.error('nextStep',e); }

    // Render actionable insights
    try {
      const insightHost = document.getElementById('insightsHost');
      if (insightHost) {
        const insights = InsightEngine.generateInsights(sessions);
        if (insights.length) {
          insightHost.innerHTML = insights.map(i =>
            `<div style="padding:.7rem;background:rgba(11,77,46,.06);border-left:4px solid var(--pine);border-radius:var(--radius-sm);margin-bottom:.6rem">
              <span style="font-size:1rem;margin-right:.4rem">${i.icon}</span>${i.text}
            </div>`
          ).join('');
        }
      }
    } catch(e){ console.error('insights',e); }

    const dash=document.getElementById('dashboard');
    const recent=document.getElementById('recentWrap');
    if (!sessions.length) {
      if(dash) dash.hidden=true;
      if(recent) recent.hidden=true;
      renderSessionList(sessions);
      return;
    }
    if(dash) dash.hidden=false;
    if(recent) recent.hidden=false;
    renderDashboard(sessions, dash);
    // Feature cards are isolated so any failure can't break the dashboard
    try { renderStreakAndFocus(sessions); } catch(e){ console.error('streak/focus',e); }
    renderSessionList(sessions);
    try { renderSearchBar(sessions); } catch(e){ console.error('searchbar',e); }
  }

  // ── Feature: streak banner + "what to work on" focus card ──────
  function renderStreakAndFocus(sessions) {
    const dash = document.getElementById('dashboard');
    if (!dash) return;
    const st = Features.streak(sessions);
    const fc = Features.focus(sessions);
    const ach = Features.achievements(sessions);

    const streakHtml = st.current > 0
      ? `<div class="streak-chip ${st.active?'is-active':''}" title="Best: ${st.best} days">
           <span class="streak-flame">🔥</span>
           <span class="streak-n">${st.current}</span>
           <span class="streak-lbl">day${st.current>1?'s':''}<br>streak</span>
         </div>`
      : `<div class="streak-chip streak-dim" title="Practice today to start a streak">
           <span class="streak-flame">🔥</span>
           <span class="streak-lbl">Start a<br>streak today</span>
         </div>`;

    let focusHtml = '';
    if (fc && fc.clean) {
      focusHtml = `<div class="focus-card focus-clean">
          <div class="focus-head"><span class="focus-icon">✅</span><span class="focus-kicker">Focus</span></div>
          <div class="focus-title">No major faults — keep grooving it</div>
          <div class="focus-sub">Your recent sessions are clean. Maintain your routine.</div>
        </div>`;
    } else if (fc) {
      focusHtml = `<div class="focus-card sev-${fc.severity}">
          <div class="focus-head"><span class="focus-icon">${fc.icon||'🎯'}</span><span class="focus-kicker">Work on this</span>
            <span class="focus-conf conf-${fc.confidence.toLowerCase()}">${fc.confidence} confidence</span></div>
          <div class="focus-title">${fc.name}</div>
          <div class="focus-sub">Seen in <strong>${fc.pct}%</strong> of your last ${fc.sample} shots.${fc.drill?` Try: <strong>${fc.drill.name}</strong>.`:''}</div>
        </div>`;
    }

    const achHtml = `<div class="ach-strip" id="achStrip" role="button" tabindex="0">
        <span class="ach-trophy">🏆</span>
        <span class="ach-count">${ach.unlocked}/${ach.total}</span>
        <span class="ach-lbl">achievements</span>
        <span class="ach-go">View →</span>
      </div>`;

    const wrap = document.createElement('div');
    wrap.className = 'feature-row';
    wrap.innerHTML = `<div class="streak-focus">${streakHtml}${focusHtml||'<div></div>'}</div>${achHtml}`;
    dash.appendChild(wrap);

    const achEl = wrap.querySelector('#achStrip');
    if (achEl) {
      const open = () => showAchievements(sessions);
      achEl.addEventListener('click', open);
      achEl.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } });
    }
  }

  // ── Feature: achievements modal ────────────────────────────────
  function showAchievements(sessions) {
    const ach = Features.achievements(sessions);
    const modal = document.getElementById('achModal');
    const body = document.getElementById('achBody');
    if (!modal || !body) return;
    document.getElementById('achHeadCount').textContent = `${ach.unlocked} of ${ach.total} unlocked`;
    body.innerHTML = ach.defs.map(d => `
      <div class="ach-item ${d.got?'got':'locked'}">
        <span class="ach-item-icon">${d.got?d.icon:'🔒'}</span>
        <div class="ach-item-text">
          <div class="ach-item-name">${d.name}</div>
          <div class="ach-item-desc">${d.desc}</div>
        </div>
        ${d.got?'<span class="ach-item-check">✓</span>':''}
      </div>`).join('');
    modal.hidden = false;
  }

  // ── Feature: live session search ───────────────────────────────
  function renderSearchBar(sessions) {
    const recent = document.getElementById('recentWrap');
    if (!recent || sessions.length < 4) return; // only worth showing with a few sessions
    if (document.getElementById('sessionSearch')) return; // already present
    const bar = document.createElement('div');
    bar.className = 'search-bar';
    bar.innerHTML = `<span class="search-ico">🔎</span>
      <input id="sessionSearch" type="search" placeholder="Search sessions — date, club, notes…" autocomplete="off">`;
    const title = recent.querySelector('.recent-title');
    recent.insertBefore(bar, title ? title.nextSibling : recent.firstChild);
    const input = bar.querySelector('#sessionSearch');
    input.addEventListener('input', () => {
      const filtered = Features.searchSessions(sessions, input.value);
      renderSessionList(filtered);
      // keep focus after re-render of the list (list is a sibling, not replaced)
      input.focus();
    });
  }

  function sessionScore(s) {
    const sc=s.shots.map(ShotScorer.score).filter(x=>x!==null);
    return sc.length ? sc.reduce((a,b)=>a+b,0)/sc.length : null;
  }

  function renderDashboard(sessions, dash) {
    if(!dash) return;
    const all=sessions.flatMap(s=>s.shots);
    const clubs=sortedClubs(all);
    const recent3=sessions.slice(0,3).map(sessionScore).filter(x=>x!==null);
    const prev3=sessions.slice(3,6).map(sessionScore).filter(x=>x!==null);
    const form=recent3.length?Math.round(recent3.reduce((a,b)=>a+b,0)/recent3.length):0;
    const prevForm=prev3.length?prev3.reduce((a,b)=>a+b,0)/prev3.length:null;
    const g=ShotScorer.grade(form);
    const trend=prevForm!==null?form-prevForm:null;
    const bests=Analytics.personalBests(sessions);
    const longest=bests.find(b=>b.label==='Longest Carry');
    const topBall=bests.find(b=>b.label==='Top Ball Speed');
    const last=sessions[0];
    const lastFaults=FaultEngine.detectFaults(last.shots);
    const topFault=lastFaults.find(f=>f.severity==='high')||lastFaults[0];

    dash.innerHTML = `
      <div class="dash-grid">
        <div class="dash-hero">
          <div class="dash-hero-ring">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" class="dh-track"/>
              <circle cx="60" cy="60" r="50" class="dh-arc" style="stroke:${g.color};stroke-dasharray:314;stroke-dashoffset:314"
                data-offset="${(314*(1-form/100)).toFixed(0)}"/>
            </svg>
            <div class="dash-hero-num"><span class="dh-grade" style="color:${g.color}">${g.letter}</span><span class="dh-score">${form}<small>/100</small></span></div>
          </div>
          <div class="dash-hero-meta">
            <div class="dash-hero-title">Current Form</div>
            <div class="dash-hero-sub">across ${recent3.length} recent session${recent3.length>1?'s':''}</div>
            ${trend!==null?`<div class="dash-trend ${trend>=0?'up':'down'}">${trend>=0?'▲':'▼'} ${Math.abs(Math.round(trend))} pts vs prior</div>`:''}
          </div>
        </div>
        <div class="dash-tile"><div class="dt-val">${sessions.length}</div><div class="dt-label">Sessions</div></div>
        <div class="dash-tile"><div class="dt-val">${all.length}</div><div class="dt-label">Shots logged</div></div>
        <div class="dash-tile"><div class="dt-val">${clubs.length}</div><div class="dt-label">Clubs tracked</div></div>
        ${longest?`<div class="dash-tile accent"><div class="dt-val">${longest.value}<small>yds</small></div><div class="dt-label">Longest carry · ${longest.club}</div></div>`:''}
        ${topBall?`<div class="dash-tile"><div class="dt-val">${topBall.value}<small>mph</small></div><div class="dt-label">Top ball speed</div></div>`:''}
        <div class="dash-tile wide clickable" data-goto-last="${last.id}">
          <div class="dt-label">Last session · ${formatDate(last.date)}</div>
          <div class="dt-lastline">${topFault?`<span class="dt-fault">${topFault.icon} ${topFault.name}</span>`:'<span class="dt-clean">✅ No major faults — clean session</span>'}</div>
          <div class="dt-cta">View report →</div>
        </div>
      </div>
      <div class="dash-heatmap-wrap">
        <div class="dash-sub-title">Practice Activity <span class="hm-legend">less <i class="hm-cell hm-l0"></i><i class="hm-cell hm-l1"></i><i class="hm-cell hm-l2"></i><i class="hm-cell hm-l3"></i><i class="hm-cell hm-l4"></i> more</span></div>
        <div class="heatmap" id="heatmap"></div>
      </div>`;

    renderHeatmap(sessions);
    requestAnimationFrame(()=>{
      const arc=dash.querySelector('.dh-arc');
      if(arc) arc.style.strokeDashoffset=arc.dataset.offset||'0';
    });
    const lastTile=dash.querySelector('[data-goto-last]');
    if(lastTile) lastTile.addEventListener('click',()=>Router.showDetail(lastTile.dataset.gotoLast));
  }

  function renderHeatmap(sessions) {
    const el=document.getElementById('heatmap'); if(!el) return;
    const WEEKS=18, days=WEEKS*7;
    const today=new Date(); today.setHours(0,0,0,0);
    const perDay={};
    sessions.forEach(s=>{ const d=new Date(s.date); if(isNaN(d))return; d.setHours(0,0,0,0); const k=d.toISOString().slice(0,10); perDay[k]=(perDay[k]||0)+s.shots.length; });
    const start=new Date(today); start.setDate(start.getDate()-(days-1));
    const dow=(start.getDay()+6)%7; start.setDate(start.getDate()-dow); // align to Monday
    const cells=[];
    for(let i=0;i<WEEKS*7;i++){
      const d=new Date(start); d.setDate(start.getDate()+i);
      if(d>today){ cells.push(`<div class="hm-cell hm-empty"></div>`); continue; }
      const k=d.toISOString().slice(0,10);
      const n=perDay[k]||0;
      const lvl=n===0?0:n<15?1:n<35?2:n<60?3:4;
      cells.push(`<div class="hm-cell hm-l${lvl}" title="${k}: ${n} shot${n!==1?'s':''}"></div>`);
    }
    el.innerHTML=cells.join('');
  }

  // ── Sessions list ─────────────────────────────────────────────
  function renderSessionList(sessions) {
    const el = document.getElementById('sessionList');
    const empty = document.getElementById('sessions-empty');
    if (!sessions.length) { el.hidden=true; empty.style.display=''; return; }
    empty.style.display='none'; el.hidden=false;

    el.innerHTML = sessions.map(s => {
      const faults = FaultEngine.detectFaults(s.shots);
      const scores = s.shots.map(ShotScorer.score).filter(x=>x!==null);
      const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
      const grade = avgScore ? ShotScorer.grade(avgScore) : null;
      const highFaults = faults.filter(f=>f.severity==='high');
      const driverShots = s.shots.filter(x=>x.clubType==='d');
      const driverCarry = avg(driverShots,'carryDistance');
      const prevScore = sessions[sessions.indexOf(s)+1]?.shots.map(ShotScorer.score).filter(x=>x!==null);
      const prevAvgScore = prevScore?.length ? Math.round(prevScore.reduce((a,b)=>a+b,0)/prevScore.length) : null;
      const improved = avgScore && prevAvgScore && avgScore > prevAvgScore;
      return `
        <li>
          <div class="session-card" data-id="${s.id}">
            <div>
              <div class="session-card-date">${formatDate(s.date)}</div>
              <div class="session-card-meta">${s.shots.length} shots · ${clubBreakdown(s.shots)}</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-top:.6rem">
                <div class="stat-card">
                  <div class="stat-value">${fmt(avg(s.shots,'ballSpeed'),0)}</div>
                  <div class="stat-label">Ball Speed</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${fmt(avg(s.shots,'carryDistance'),0)}</div>
                  <div class="stat-label">Avg Carry</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${fmt(avg(s.shots,'launchAngle'),1)}</div>
                  <div class="stat-label">Launch</div>
                </div>
              </div>
              <div class="session-card-badges">
                ${improved ? '<span class="session-badge improvement">↑ Improving</span>' : ''}
                ${highFaults.length ? highFaults.map(f => `<span class="session-badge fault">${f.icon} ${f.name}</span>`).join('') : '<span class="session-badge" style="background:var(--green)">✓ Clean</span>'}
              </div>
            </div>
            <div style="text-align:right">
              ${grade ? `
              <div class="session-score-ring">
                <svg viewBox="0 0 52 52" width="52" height="52" data-offset="${(125.66*(1-avgScore/100)).toFixed(1)}">
                  <circle cx="26" cy="26" r="20" fill="none" stroke="${grade.color}26" stroke-width="3.5"/>
                  <circle cx="26" cy="26" r="20" fill="none" stroke="${grade.color}" stroke-width="3.5"
                    stroke-linecap="round" stroke-dasharray="125.66" stroke-dashoffset="125.66"
                    transform="rotate(-90 26 26)" class="scard-ring-arc"/>
                  <text x="26" y="26" text-anchor="middle" dominant-baseline="central"
                    font-family="Outfit,sans-serif" font-size="17" font-weight="800"
                    fill="${grade.color}">${grade.letter}</text>
                </svg>
                <div class="session-score-num">${avgScore}</div>
                <div class="session-score-label">Score</div>
              </div>` : ''}
            </div>
          </div>
        </li>`;
    }).join('');

    el.querySelectorAll('.session-card').forEach(c => {
      c.addEventListener('click', () => Router.showDetail(c.dataset.id));
    });
    requestAnimationFrame(() => {
      el.querySelectorAll('.scard-ring-arc').forEach(arc => {
        const svg = arc.closest('svg');
        if (svg) arc.style.strokeDashoffset = svg.dataset.offset || '0';
      });
    });
  }

  // ── Session detail ────────────────────────────────────────────
  function renderDetail(session) {
    _session = session;
    _clubFilter = 'all';
    document.getElementById('detailTitle').textContent = formatDate(session.date);
    document.getElementById('detailNotes').textContent = session.notes
      ? session.notes + (session.conditions ? ` · ${[session.conditions.wind,session.conditions.temp].filter(Boolean).join(', ')}` : '')
      : '';
    document.getElementById('deleteSessionBtn').dataset.id = session.id;
    renderForFilter();
  }

  function renderForFilter() {
    const shots = _clubFilter === 'all'
      ? _session.shots
      : _session.shots.filter(s => s.clubType === _clubFilter);

    renderClubFilter(_session.shots);
    renderInsights(shots);
    renderScoreBanner(shots);
    renderMetricsStrip(shots, _session.shots);
    renderSwingDNA(shots);
    renderDispersion(shots);
    renderDispersionStats(shots);
    renderBallFlight(shots);
    renderGapping(_session.shots);
    renderLaunchWindows(shots);
    renderFaultCards(shots);
    renderPracticePlan(shots);
    renderBenchTable(shots);
    renderShotTable(shots);
  }

  // ── Ball flight trajectory ────────────────────────────────────
  function renderBallFlight(shots) {
    const el=document.getElementById('ballFlight'); if(!el) return;
    if(!shots.length){ el.innerHTML=''; return; }
    el.innerHTML = `<div class="chart-card traj-card">${Trajectory.avgFlight(shots)}</div>`;
  }

  // ── Insights (coach's notes) ──────────────────────────────────
  function renderInsights(shots) {
    const el = document.getElementById('insightsCard');
    if (!el) return;
    const ins = Insights.generate(shots);
    if (!ins) { el.innerHTML=''; return; }
    el.innerHTML = `
      <div class="insights-head">
        <span class="insights-icon">🧠</span>
        <span class="insights-title">Coach's Notes</span>
      </div>
      <div class="insights-cols">
        <div class="insights-block">
          <div class="insights-label good">✓ What's working</div>
          <ul class="insights-list">${ins.strengths.map(s=>`<li>${s}</li>`).join('')}</ul>
        </div>
        <div class="insights-block">
          <div class="insights-label bad">→ Focus on</div>
          <ul class="insights-list">${ins.improvements.map(s=>`<li>${s}</li>`).join('')}</ul>
        </div>
      </div>`;
    applyPaywall(el, "Sign in to unlock your coaching notes");
  }

  // ── Dispersion statistics ─────────────────────────────────────
  function renderDispersionStats(shots) {
    const el = document.getElementById('dispersionStats');
    if (!el) return;
    const sides = shots.map(s=>s.sideCarry).filter(v=>typeof v==='number');
    if (!sides.length) { el.innerHTML=''; return; }
    const left  = sides.filter(v=>v < -7).length;
    const online = sides.filter(v=>v >= -7 && v <= 7).length;
    const right = sides.filter(v=>v > 7).length;
    const avgMiss = sides.reduce((a,b)=>a+Math.abs(b),0)/sides.length;
    const spread = Math.max(...sides) - Math.min(...sides);
    const bias = avg(shots,'sideCarry');
    const stats = [
      {label:'Left', value:`${left} (${Math.round(left/sides.length*100)}%)`},
      {label:'On line', value:`${online} (${Math.round(online/sides.length*100)}%)`},
      {label:'Right', value:`${right} (${Math.round(right/sides.length*100)}%)`},
      {label:'Avg miss', value:`${fmt(avgMiss,1)} yds`},
      {label:'Spread', value:`${fmt(spread,0)} yds`},
      {label:'Bias', value:`${bias>0?'+':''}${fmt(bias,1)} yds ${bias>2?'R':bias<-2?'L':''}`},
    ];
    el.innerHTML = stats.map(s=>`
      <div class="disp-stat"><div class="disp-stat-val">${s.value}</div><div class="disp-stat-label">${s.label}</div></div>`).join('');
  }

  // ── Practice plan ─────────────────────────────────────────────
  function renderPracticePlan(shots) {
    const el = document.getElementById('practicePlan');
    if (!el) return;
    const plan = PracticePlan.generate(shots);
    if (!plan) { el.innerHTML = `<div class="no-faults">✅ No faults to drill — keep grooving your swing!</div>`; return; }
    const total = plan.reduce((a,b)=>a+b.minutes,0);
    el.innerHTML = `
      <div class="plan-intro">A ${total}-minute session targeting your top ${plan.length} fault${plan.length>1?'s':''}, time-weighted by severity:</div>
      ${plan.map((p,i)=>`
        <div class="plan-item severity-${p.severity}">
          <div class="plan-num">${i+1}</div>
          <div class="plan-body">
            <div class="plan-head"><span>${p.icon} ${p.name}</span><span class="plan-min">${p.minutes} min</span></div>
            <div class="plan-drill"><strong>${p.drill.name}:</strong> ${p.drill.desc}</div>
          </div>
        </div>`).join('')}`;
    applyPaywall(el, "Sign in to unlock your personalised practice plan");
  }

  // ── Club filter ───────────────────────────────────────────────
  function renderClubFilter(shots) {
    const clubs = sortedClubs(shots);
    const el = document.getElementById('clubFilter');
    el.innerHTML = ['all',...clubs].map(c => `
      <button class="chip ${c===_clubFilter?'active':''}" data-club="${c}"
        style="${c!=='all'?`--chip-dot:${clubColor(c)}`:''}">
        ${c==='all'?'All':clubLabel(c)}
      </button>`).join('');
    el.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => { _clubFilter=btn.dataset.club; renderForFilter(); });
    });
  }

  // ── Score banner ──────────────────────────────────────────────
  function renderScoreBanner(shots) {
    const scores = shots.map(ShotScorer.score).filter(x=>x!==null);
    if (!scores.length) { document.getElementById('scoreBanner').innerHTML=''; return; }
    const avgScore = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
    const g = ShotScorer.grade(avgScore);
    const dist = [0,25,50,75,100].map(t => scores.filter(s=>s>=t && s<t+25).length);
    document.getElementById('scoreBanner').innerHTML = `
      <div class="score-banner-content">
        <div class="score-ring">
          <svg viewBox="0 0 90 90" width="90" height="90" data-offset="${(226.19*(1-avgScore/100)).toFixed(1)}">
            <circle cx="45" cy="45" r="36" fill="none" stroke="${g.color}1e" stroke-width="5"/>
            <circle cx="45" cy="45" r="36" fill="none" stroke="${g.color}" stroke-width="5"
              stroke-linecap="round" stroke-dasharray="226.19" stroke-dashoffset="226.19"
              transform="rotate(-90 45 45)" class="score-ring-arc"/>
            <text x="45" y="45" text-anchor="middle" dominant-baseline="central"
              font-family="Outfit,sans-serif" font-size="30" font-weight="800"
              fill="${g.color}">${g.letter}</text>
          </svg>
        </div>
        <div class="score-details">
          <div class="score-number">${avgScore}<span class="score-max">/100</span></div>
          <div class="score-label">Session quality score</div>
          <div class="score-bar-row">
            ${scores.map(s=>`<span class="score-pip" style="background:${ShotScorer.scoreColor(s)};width:${100/scores.length}%"></span>`).join('')}
          </div>
        </div>
        <div class="score-breakdown">
          ${['Elite','Good','OK','Poor','Missed'].reverse().map((l,i) => {
            const idx = 4-i;
            const n = idx===4 ? scores.filter(s=>s<25).length : scores.filter(s=>s>=idx*25&&s<(idx+1)*25).length;
            return `<div class="score-bd-row"><span class="score-bd-label">${l}</span><span class="score-bd-bar" style="width:${n>0?Math.max(8,n/scores.length*100):0}%;background:${['#fca5a5','#fdba74','#fde68a','#bbf7d0','#86efac'][idx]}"></span><span class="score-bd-n">${n}</span></div>`;
          }).join('')}
        </div>
      </div>`;
    const bannerEl = document.getElementById('scoreBanner');
    if (!applyPaywall(bannerEl, "Sign in to see your session quality score")) {
      requestAnimationFrame(() => {
        const arc = bannerEl.querySelector('.score-ring-arc');
        const svg = arc && arc.closest('svg');
        if (svg) arc.style.strokeDashoffset = svg.dataset.offset || '0';
      });
    }
  }

  // ── Metrics strip ─────────────────────────────────────────────
  function renderMetricsStrip(shots, allShots) {
    const M = [
      {label:'Avg Smash',   field:'smashFactor',     dec:2, unit:'',    col:'#16a34a'},
      {label:'Ball Speed',  field:'ballSpeed',        dec:0, unit:'mph', col:'#2563eb'},
      {label:'Carry',       field:'carryDistance',    dec:0, unit:'yds', col:'#0b4d2e'},
      {label:'Launch Angle',field:'launchAngle',      dec:1, unit:'°',   col:'#b45309'},
      {label:'Club Speed',  field:'clubSpeed',        dec:0, unit:'mph', col:'#7c3aed'},
      {label:'Carry Total', field:'totalDistance',    dec:0, unit:'yds', col:'#0891b2'},
    ];
    const el = document.getElementById('metricsStrip');
    el.innerHTML = M.map(m => {
      const val = avg(shots,m.field);
      const allVal = avg(allShots,m.field);
      let delta='';
      if (val!==null && allVal!==null && shots!==allShots) {
        const d = val-allVal; const cls=d>=0?'up':'down'; const sign=d>=0?'+':'';
        delta = `<div class="metric-delta ${cls}">${sign}${fmt(d,m.dec)} vs all</div>`;
      }
      return `<div class="metric-card" style="--mc:${m.col}">
        <div class="metric-label">${m.label}</div>
        <div class="metric-value"><span class="mval" data-v="${val!==null?val:''}" data-d="${m.dec}">${fmt(val,m.dec)}</span><small class="metric-unit">${m.unit}</small></div>
        ${delta}
      </div>`;
    }).join('');
    el.querySelectorAll('.mval[data-v]').forEach((span, i) => {
      const target = parseFloat(span.dataset.v), dec = parseInt(span.dataset.d);
      if (isNaN(target) || target === 0) return;
      span.textContent = (0).toFixed(dec);
      const t0 = performance.now() + i * 55;
      const run = ts => {
        const p = Math.min(1, (ts - t0) / 700);
        if (p <= 0) { requestAnimationFrame(run); return; }
        span.textContent = (target * (1 - Math.pow(1-p, 3))).toFixed(dec);
        if (p < 1) requestAnimationFrame(run);
        else span.textContent = fmt(target, dec);
      };
      requestAnimationFrame(run);
    });
  }

  // ── Swing DNA ─────────────────────────────────────────────────
  function renderSwingDNA(shots) {
    const pills = SwingDNA.analyze(shots);
    const el = document.getElementById('swingDna');
    el.innerHTML = pills.map(p => `
      <div class="dna-pill tone-${p.tone}">
        <span class="dna-icon">${p.icon}</span>
        <div class="dna-text">
          <div class="dna-cat">${p.category}</div>
          <div class="dna-val">${p.value}</div>
        </div>
      </div>`).join('');
  }

  // ── Dispersion chart ──────────────────────────────────────────
  function renderDispersion(shots) {
    destroyChart('dispersion');
    const canvas = document.getElementById('chartDispersion');
    if (!canvas || !shots.length) return;

    const clubs = sortedClubs(shots);
    const datasets = clubs.map(c => ({
      label: clubLabel(c),
      data: shots.filter(s=>s.clubType===c).map(s=>({x:s.sideCarry, y:s.carryDistance, _row:s._row})),
      backgroundColor: clubColor(c)+'cc',
      borderColor: clubColor(c),
      borderWidth: 1.5,
      pointRadius: 7,
      pointHoverRadius: 10,
    }));

    // center line dataset
    const carryVals = shots.map(s=>s.carryDistance).filter(v=>v>0);
    const minCarry = Math.min(...carryVals) - 20;
    const maxCarry = Math.max(...carryVals) + 20;
    datasets.unshift({
      label:'Centre line',
      data:[{x:0,y:minCarry},{x:0,y:maxCarry}],
      type:'line',
      borderColor:'#00000018',
      borderWidth:1,
      borderDash:[4,4],
      pointRadius:0,
      showLine:true,
    });

    _charts.dispersion = new Chart(canvas, {
      type:'scatter',
      data:{datasets},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{labels:{color:'#496657',font:{size:11}}},
          tooltip:{
            callbacks:{
              label: ctx => {
                const d = ctx.raw;
                return `Shot #${d._row||''}: ${fmt(d.y,0)} yds carry, ${d.x>0?'+':''}${fmt(d.x,1)} yds side`;
              }
            }
          }
        },
        scales:{
          x:{title:{display:true,text:'Side Carry (yds) — left / right',color:'#496657',font:{size:11}},
            ticks:{color:'#496657'},
            grid:{color: ctx => ctx.tick.value===0?'#00000025':'#d4e2d8'},
          },
          y:{title:{display:true,text:'Carry Distance (yds)',color:'#496657',font:{size:11}},
            ticks:{color:'#496657'},grid:{color:'#d4e2d8'},
          },
        },
      },
    });
  }

  // ── Club gapping chart ────────────────────────────────────────
  function renderGapping(shots) {
    destroyChart('gapping');
    const section = document.getElementById('gappingSection');
    const clubs = sortedClubs(shots);
    if (clubs.length < 2) { if(section) section.hidden=true; return; }
    if(section) section.hidden=false;
    const canvas = document.getElementById('chartGapping');
    if (!canvas) return;

    const labels = clubs.map(clubLabel);
    const carries = clubs.map(c => avg(shots.filter(s=>s.clubType===c),'carryDistance'));
    const colors = clubs.map(clubColor);
    const gaps = carries.map((c,i) => i===0?null : (carries[i-1]-c));

    _charts.gapping = new Chart(canvas,{
      type:'bar',
      data:{
        labels,
        datasets:[{
          label:'Avg Carry (yds)',
          data:carries,
          backgroundColor: colors.map(c=>c+'cc'),
          borderColor:colors,
          borderWidth:1.5,
          borderRadius:4,
        }],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{
            callbacks:{
              afterLabel: (ctx) => {
                const g = gaps[ctx.dataIndex];
                return g !== null ? `Gap from prev club: ${fmt(g,0)} yds` : '';
              }
            }
          }
        },
        scales:{
          x:{ticks:{color:'#496657'},grid:{color:'#d4e2d8'}},
          y:{ticks:{color:'#496657'},grid:{color:'#d4e2d8'},
            title:{display:true,text:'Carry (yds)',color:'#496657',font:{size:11}}},
        },
      },
    });

    // render gap table
    const gapTable = document.getElementById('gapTable');
    if (!gapTable) return;
    gapTable.innerHTML = `
      <thead><tr><th>Club</th><th>Avg Carry</th><th>Gap</th><th>Status</th></tr></thead>
      <tbody>${clubs.map((c,i) => {
        const carry = carries[i];
        const g = gaps[i];
        const gapStatus = g === null ? '' :
          g < 8  ? `<span style="color:var(--red)">⚠ Only ${fmt(g,0)} yds</span>` :
          g > 25 ? `<span style="color:var(--yellow)">⚠ Big gap ${fmt(g,0)} yds</span>` :
                   `<span style="color:var(--green-light)">✓ ${fmt(g,0)} yds</span>`;
        return `<tr>
          <td><span class="club-dot" style="background:${clubColor(c)}"></span><strong>${clubLabel(c)}</strong></td>
          <td>${fmt(carry,0)} yds</td>
          <td>${g!==null?fmt(g,0)+' yds':'—'}</td>
          <td>${gapStatus}</td>
        </tr>`;
      }).join('')}</tbody>`;
  }

  // ── Launch windows ────────────────────────────────────────────
  function renderLaunchWindows(shots) {
    const el = document.getElementById('launchWindows');
    if (!el) return;
    const clubs = sortedClubs(shots);
    const rows = clubs.map(c => {
      const cs = shots.filter(s=>s.clubType===c);
      const bench = Benchmarks.get(c);
      if (!bench) return null;
      const userLA = avg(cs,'launchAngle');
      const userAA = avg(cs,'attackAngle');
      const userSpin = avg(cs,'spinRate');
      const optLA  = c==='d'?'10–15°': isWood(c)||isHybrid(c)?'9–14°': isShort(c)?'24–40°':'13–22°';
      const optAA  = c==='d'?'+2 to +5°':isIron(c)?'-2 to -5°':'0 to -2°';
      const optSpin= c==='d'?'2000–2800': isWood(c)||isHybrid(c)?'2500–3500':'3500–6000';
      const laStatus = userLA===null?'na':
        (c==='d'&&userLA>=10&&userLA<=15)||(isIron(c)&&userLA>=bench.pga.la*0.85&&userLA<=bench.pga.la*1.15)?'green':
        Math.abs(userLA-bench.pga.la)<=4?'yellow':'red';
      const aaStatus = userAA===null?'na':
        (c==='d'&&userAA>=1)?'green':
        (isIron(c)&&userAA<=-2&&userAA>=-6)?'green':
        Math.abs(userAA)<2?'yellow':'red';
      return `<tr>
        <td><strong>${bench.label}</strong></td>
        <td><span class="status-dot ${laStatus}"></span>${fmt(userLA,1)}°</td><td>${optLA}</td>
        <td><span class="status-dot ${aaStatus}"></span>${fmt(userAA,1)}°</td><td>${optAA}</td>
        ${userSpin?`<td>${fmt(userSpin,0)} rpm</td><td>${optSpin}</td>`:
                   `<td colspan="2" style="color:var(--text-muted);font-size:.78rem">No spin data</td>`}
      </tr>`;
    }).filter(Boolean);

    if (!rows.length) { el.innerHTML=''; return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr>
        <th>Club</th><th>Launch∠</th><th>Optimal</th>
        <th>Attack∠</th><th>Optimal</th>
        <th>Spin Rate</th><th>Optimal</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
  }

  // ── Fault cards ───────────────────────────────────────────────
  function renderFaultCards(shots) {
    const faults = FaultEngine.detectFaults(shots);
    const el = document.getElementById('faultList');
    if (!faults.length) {
      el.innerHTML=`<div class="no-faults">✅ No faults detected in this selection. Keep it up!</div>`; return;
    }

    const cats = [...new Set(faults.map(f=>f.category))];
    el.innerHTML = cats.map(cat => {
      const catFaults = faults.filter(f=>f.category===cat);
      return `
        <div class="fault-category">
          <div class="fault-cat-label">${cat}</div>
          ${catFaults.map(f => `
            <div class="fault-card severity-${f.severity}" data-fault="${f.id}">
              <div class="fault-header">
                <div class="fault-header-left">
                  <span class="fault-icon">${f.icon}</span>
                  <div>
                    <div class="fault-name">${f.name}</div>
                    <div class="fault-count">${f.count} of ${f.total} shots affected</div>
                  </div>
                </div>
                <span class="fault-toggle">▼</span>
              </div>
              <div class="fault-body">
                <p class="fault-desc">${f.description}</p>
                ${f.causes?.length ? `
                  <div class="fault-section-title">Root causes</div>
                  <ul class="fault-causes">${f.causes.map(c=>`<li>${c}</li>`).join('')}</ul>` : ''}
                ${f.drills?.length ? `
                  <div class="fault-section-title">Drills</div>
                  <div class="fault-drills">${f.drills.map(d=>`
                    <div class="drill-card">
                      <div class="drill-name">💡 ${d.name}</div>
                      <div class="drill-desc">${d.desc}</div>
                    </div>`).join('')}</div>` : ''}
                ${f.optimalRange ? `<div class="fault-optimal">Target: ${typeof f.optimalRange==='function'?f.optimalRange(shots[0]?.clubType):f.optimalRange}</div>` : ''}
                ${f.affectedShots?.length ? `<div class="fault-shots">Affected shots: rows ${f.affectedShots.slice(0,8).join(', ')}${f.affectedShots.length>8?'…':''}</div>` : ''}
              </div>
            </div>`).join('')}
        </div>`;
    }).join('');

    el.querySelectorAll('.fault-card').forEach(card => {
      card.querySelector('.fault-header').addEventListener('click', () => card.classList.toggle('open'));
    });
    applyPaywall(el, "Sign in to unlock fault detection & drills");
  }

  // ── Benchmarking ──────────────────────────────────────────────
  function renderBenchTable(shots) {
    const clubs = sortedClubs(shots);
    const el = document.getElementById('benchTable');
    const rows = clubs.map(c => {
      const cs = shots.filter(s=>s.clubType===c);
      const b = Benchmarks.get(c);
      if (!b) return `<tr><td>${clubLabel(c)}</td><td colspan="6" style="color:var(--text-muted)">No benchmark data</td></tr>`;
      const uSF=avg(cs,'smashFactor'), uCarry=avg(cs,'carryDistance'), uBS=avg(cs,'ballSpeed'), uLA=avg(cs,'launchAngle'), uAA=avg(cs,'attackAngle');
      const sfS=Benchmarks.status(uSF,b.am.sf,b.pga.sf), cS=Benchmarks.status(uCarry,b.am.carry,b.pga.carry);
      const bsS=Benchmarks.status(uBS,b.am.bs,b.pga.bs), laS=Benchmarks.status(uLA,b.am.la,b.pga.la,false);
      const aaOk = c==='d'?(uAA>=1):isIron(c)?(uAA<=-2&&uAA>=-6):(uAA<=-0.5);
      return `<tr>
        <td><span class="club-dot" style="background:${clubColor(c)}"></span><strong>${b.label}</strong><br><small style="color:var(--text-muted);font-size:.72rem">${cs.length} shots</small></td>
        <td><span class="status-dot ${sfS}"></span>${fmt(uSF,2)}<br><small class="bench-ref">${fmt(b.am.sf,2)} / ${fmt(b.pga.sf,2)}</small></td>
        <td><span class="status-dot ${cS}"></span>${fmt(uCarry,0)}<br><small class="bench-ref">${fmt(b.am.carry,0)} / ${fmt(b.pga.carry,0)}</small></td>
        <td><span class="status-dot ${bsS}"></span>${fmt(uBS,0)}<br><small class="bench-ref">${fmt(b.am.bs,0)} / ${fmt(b.pga.bs,0)}</small></td>
        <td><span class="status-dot ${laS}"></span>${fmt(uLA,1)}°<br><small class="bench-ref">${fmt(b.am.la,1)}° / ${fmt(b.pga.la,1)}°</small></td>
        <td><span class="status-dot ${aaOk?'green':'yellow'}"></span>${fmt(uAA,1)}°<br><small class="bench-ref">${c==='d'?'+3°':'-3°'} ideal</small></td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <thead><tr>
        <th>Club</th>
        <th>Smash<br><small>you/am/pga</small></th>
        <th>Carry (yds)<br><small>you/am/pga</small></th>
        <th>Ball Spd<br><small>you/am/pga</small></th>
        <th>Launch∠<br><small>you/am/pga</small></th>
        <th>Attack∠<br><small>you/ideal</small></th>
      </tr></thead>
      <tbody>${rows}</tbody>`;
  }

  // ── Shot log (sortable, colour-coded) ─────────────────────────
  let _sortField=null, _sortDir=1;

  function renderShotTable(shots, sortField, sortDir) {
    if (sortField!==undefined) { _sortField=sortField; _sortDir=sortDir; }
    const sorted = [...shots];
    if (_sortField) sorted.sort((a,b)=>(a[_sortField]-b[_sortField])*_sortDir);

    const COLS = [
      {label:'#',       render:(s,i)=>i+1,               field:null},
      {label:'Club',    render:s=>`<span class="club-dot" style="background:${clubColor(s.clubType)}"></span>${clubLabel(s.clubType)}`, field:'clubType'},
      {label:'Score',   render:s=>{ const sc=ShotScorer.score(s); return sc!==null?`<span class="shot-score" style="color:${ShotScorer.scoreColor(sc)}">${sc}</span>`:'—'; }, field:null},
      {label:'Ball<br><small>mph</small>',  render:s=>fmt(s.ballSpeed,0),   field:'ballSpeed'},
      {label:'Club<br><small>mph</small>',  render:s=>fmt(s.clubSpeed,0),   field:'clubSpeed'},
      {label:'Smash',   render:s=>fmt(s.smashFactor,2),  field:'smashFactor'},
      {label:'Launch<br><small>°</small>',  render:s=>fmt(s.launchAngle,1), field:'launchAngle'},
      {label:'Dir<br><small>°</small>',     render:s=>{const v=s.launchDirection;return `<span style="color:${Math.abs(v||0)>5?'var(--yellow)':'var(--text)'}">${fmt(v,1)}</span>`;}, field:'launchDirection'},
      {label:'Carry<br><small>yds</small>', render:s=>fmt(s.carryDistance,0),field:'carryDistance'},
      {label:'Side<br><small>yds</small>',  render:s=>{const v=s.sideCarry;return `<span style="color:${Math.abs(v||0)>15?'var(--red)':Math.abs(v||0)>8?'var(--yellow)':'var(--text)'}">${fmt(v,1)}</span>`;}, field:'sideCarry'},
      {label:'Path<br><small>°</small>',    render:s=>fmt(s.clubPath,1),    field:'clubPath'},
      {label:'AoA<br><small>°</small>',     render:s=>{const v=s.attackAngle; const ok=s.clubType==='d'?v>=1:(isIron(s.clubType)&&v<=-2&&v>=-6); return `<span style="color:${ok?'var(--green-light)':'var(--yellow)'}">${fmt(v,1)}</span>`;}, field:'attackAngle'},
      {label:'Spin<br><small>rpm</small>',  render:s=>s.spinRate?fmt(s.spinRate,0):'—', field:'spinRate'},
      {label:'Axis<br><small>°</small>',    render:s=>s.spinAxis?fmt(s.spinAxis,1):'—', field:'spinAxis'},
      {label:'Apex<br><small>ft</small>',   render:s=>fmt(s.apex,0),        field:'apex'},
    ];

    const el = document.getElementById('shotTable');
    const heads = COLS.map(c=>{
      const a=_sortField===c.field; const arrow=a?(_sortDir===1?' ↑':' ↓'):'';
      return `<th ${c.field?`data-field="${c.field}"`:''}>${c.label}${arrow}</th>`;
    }).join('');

    const body = sorted.map((s,i) => {
      const sc = ShotScorer.score(s);
      const rowCls = sc===null?'': sc>=75?'row-good': sc>=50?'row-ok':'row-bad';
      return `<tr class="${rowCls} shot-row" data-idx="${i}">${COLS.map(c=>`<td>${c.render(s,i)}</td>`).join('')}</tr>`;
    }).join('');

    el.innerHTML=`<thead><tr>${heads}</tr></thead><tbody>${body}</tbody>`;
    el.querySelectorAll('th[data-field]').forEach(th=>{
      th.addEventListener('click',()=>{
        const f=th.dataset.field;
        renderShotTable(shots,f,_sortField===f?_sortDir*-1:1);
      });
    });
    el.querySelectorAll('.shot-row').forEach(row=>{
      row.addEventListener('click',()=>openShotModal(sorted[+row.dataset.idx], shots));
    });
  }

  // ── Shot detail modal ─────────────────────────────────────────
  function openShotModal(shot, sessionShots) {
    const modal = document.getElementById('shotModal');
    if (!modal || !shot) return;
    const sc = ShotScorer.score(shot);
    const g = sc!==null ? ShotScorer.grade(sc) : null;
    const faults = FaultEngine.detectFaults([shot]);

    const cmp = (field, dec) => {
      const v = shot[field], a = avg(sessionShots, field);
      if (typeof v!=='number' || a===null) return '';
      const d = v - a;
      return `<span class="sm-cmp ${d>=0?'up':'down'}">${d>=0?'+':''}${fmt(d,dec)} vs avg</span>`;
    };

    const rows = [
      ['Club', clubLabel(shot.clubType), ''],
      ['Ball Speed', `${fmt(shot.ballSpeed,1)} mph`, cmp('ballSpeed',1)],
      ['Club Speed', `${fmt(shot.clubSpeed,1)} mph`, cmp('clubSpeed',1)],
      ['Smash Factor', fmt(shot.smashFactor,2), cmp('smashFactor',2)],
      ['Carry', `${fmt(shot.carryDistance,1)} yds`, cmp('carryDistance',1)],
      ['Total', `${fmt(shot.totalDistance,1)} yds`, cmp('totalDistance',1)],
      ['Launch Angle', `${fmt(shot.launchAngle,1)}°`, cmp('launchAngle',1)],
      ['Launch Dir', `${fmt(shot.launchDirection,1)}°`, ''],
      ['Side Carry', `${fmt(shot.sideCarry,1)} yds`, ''],
      ['Club Path', `${fmt(shot.clubPath,1)}°`, ''],
      ['Attack Angle', `${fmt(shot.attackAngle,1)}°`, ''],
      ['Face-to-Path', `${fmt(facePath(shot),1)}°`, ''],
      ['Apex', `${fmt(shot.apex,0)} ft`, ''],
      shot.spinRate ? ['Spin Rate', `${fmt(shot.spinRate,0)} rpm`, ''] : null,
      shot.spinAxis ? ['Spin Axis', `${fmt(shot.spinAxis,1)}°`, ''] : null,
    ].filter(Boolean);

    document.getElementById('shotModalTitle').innerHTML =
      `Shot #${shot._row||'?'} · ${clubLabel(shot.clubType)}` +
      (g ? ` <span class="sm-grade" style="color:${g.color}">${sc}/100 (${g.letter})</span>` : '');

    document.getElementById('shotModalBody').innerHTML = `
      <div class="sm-traj">${Trajectory.shot(shot)}</div>
      <table class="sm-table">${rows.map(([k,v,c])=>`<tr><td class="sm-k">${k}</td><td class="sm-v">${v}</td><td class="sm-c">${c}</td></tr>`).join('')}</table>
      ${faults.length ? `
        <div class="sm-faults-title">Faults on this shot</div>
        ${faults.map(f=>`<div class="sm-fault severity-${f.severity}">${f.icon} ${f.name}</div>`).join('')}
      ` : `<div class="sm-clean">✅ No faults flagged on this shot</div>`}`;

    modal.hidden = false;
  }

  // ── Yardage book + personal bests ─────────────────────────────
  function renderYardages(sessions) {
    const empty = document.getElementById('yardages-empty');
    const content = document.getElementById('yardages-content');
    if (!sessions.length) { empty.style.display=''; content.hidden=true; return; }
    empty.style.display='none'; content.hidden=false;

    const book = Analytics.yardageBook(sessions);
    const totalShots = sessions.reduce((a,s)=>a+s.shots.length,0);
    document.getElementById('yardageMeta').textContent =
      `${book.length} clubs · ${totalShots} shots · ${sessions.length} session${sessions.length>1?'s':''}`;

    // Add drill finder for weakest clubs
    try {
      const drillHost = document.getElementById('drillFinderHost');
      if (drillHost) {
        const weakest = book.filter(b=>b.count>=5).sort((a,b)=>b.stdCarry-a.stdCarry).slice(0,2);
        const drillTexts = {
          'tight': { desc: 'Your distance is tight but repeatable', action: 'Maintain rhythm' },
          'moderate': { desc: 'Working on consistency — build confidence', action: 'Target practice' },
          'wide': { desc: 'Distance varies — focus on setup', action: 'Setup drill' }
        };
        drillHost.innerHTML = '<h3 class="section-title" style="margin-bottom:.8rem">🎯 Drill Focus</h3>' + weakest.map(b => {
          const cons = b.stdCarry===0?'tight': b.stdCarry<6?'tight':b.stdCarry<12?'moderate':'wide';
          const drillInfo = drillTexts[cons];
          return `<div class="drill-card" onclick="Router.show('sessions')">
            <div class="drill-icon">${clubColor(b.club)}</div>
            <div class="drill-title">${clubLabel(b.club)} (${cons.toUpperCase()})</div>
            <div class="drill-desc">${drillInfo.desc}</div>
            <div class="drill-time">→ ${drillInfo.action}</div>
          </div>`;
        }).join('');
      }
    } catch(e){ console.error('drillFinder',e); }

    document.getElementById('yardageTable').innerHTML = `
      <thead><tr><th>Club</th><th>Stock Carry</th><th>Range</th><th>Consistency</th><th>Avg Total</th><th>Shots</th></tr></thead>
      <tbody>${book.map(b=>{
        const cons = b.stdCarry===0?'—': b.stdCarry<6?'Tight':b.stdCarry<12?'Moderate':'Wide';
        const consC = b.stdCarry<6?'#22c55e':b.stdCarry<12?'#eab308':'#ef4444';
        return `<tr>
          <td><span class="club-dot" style="background:${clubColor(b.club)}"></span><strong>${clubLabel(b.club)}</strong></td>
          <td><strong style="font-size:1.05rem">${fmt(b.avgCarry,0)}</strong> yds</td>
          <td>${fmt(b.minCarry,0)}–${fmt(b.maxCarry,0)}</td>
          <td><span style="color:${consC};font-weight:600">${cons}</span> <small style="color:var(--text-muted)">±${fmt(b.stdCarry,0)}</small></td>
          <td>${fmt(b.avgTotal,0)} yds</td>
          <td>${b.count}</td>
        </tr>`;
      }).join('')}</tbody>`;

    const bests = Analytics.personalBests(sessions);
    document.getElementById('recordsGrid').innerHTML = bests.map(b=>`
      <div class="record-card">
        <div class="record-value">${b.value}<span class="record-unit">${b.unit}</span></div>
        <div class="record-label">${b.label}</div>
        <div class="record-meta">${b.club} · ${b.date}</div>
      </div>`).join('');
  }

  // ── Progress ──────────────────────────────────────────────────
  function renderProgress(sessions) {
    const empty = document.getElementById('progress-empty');
    const content = document.getElementById('progress-content');
    if (sessions.length<2) { empty.style.display=''; content.hidden=true; return; }
    empty.style.display='none'; content.hidden=false;

    // Add performance alerts and goals at the top
    try {
      const alertsHost = document.getElementById('alertsHost');
      if (alertsHost) {
        const alerts = Features.performanceAlerts(sessions);
        if (alerts.length) {
          alertsHost.innerHTML = '<div class="section-title" style="margin-bottom:.8rem">⚡ Alerts</div>' + alerts.map(a =>
            `<div class="alert-item ${a.type}">${a.msg}</div>`
          ).join('');
        } else {
          alertsHost.innerHTML = '';
        }
      }
    } catch(e){ console.error('alerts',e); }

    // Show goal progress
    try {
      const goalsHost = document.getElementById('goalsHost');
      if (goalsHost) {
        const progress = Features.goalProgress(sessions);
        if (Object.keys(progress).length) {
          const metricLabels = { carry: 'Longest Carry', ball_speed: 'Ball Speed', smash: 'Smash', score: 'Form Score', sessions: 'Sessions' };
          goalsHost.innerHTML = '<div class="section-title" style="margin-bottom:.8rem">🎯 Goals</div>' + Object.entries(progress).map(([m, p]) =>
            `<div class="goal-item">
              <div>
                <div class="goal-metric">${metricLabels[m]}</div>
                <div class="goal-progress"><strong>${p.current}${p.unit}</strong> / ${p.target}${p.unit}</div>
                <div class="goal-bar"><div class="goal-bar-fill" style="width:${p.pct}%"></div></div>
              </div>
            </div>`
          ).join('');
        } else {
          goalsHost.innerHTML = '';
        }
      }
    } catch(e){ console.error('goals',e); }

    // Show club benchmarks
    try {
      const benchHost = document.getElementById('benchHost');
      if (benchHost) {
        const benches = Features.benchmarks(sessions);
        if (Object.keys(benches).length) {
          benchHost.innerHTML = '<div class="section-title" style="margin-bottom:.8rem">📊 Club Benchmarks</div>' +
            '<table class="benchmark-table"><thead><tr><th>Club</th><th>Avg Carry</th><th>Shots</th></tr></thead><tbody>' +
            Object.entries(benches).map(([c, b]) => `<tr><td>${clubLabel(c)}</td><td>${b.avg} yds</td><td>${b.count}</td></tr>`).join('') +
            '</tbody></table>';
        } else {
          benchHost.innerHTML = '';
        }
      }
    } catch(e){ console.error('benchmarks',e); }

    const allClubs = [...new Set(sessions.flatMap(s=>sortedClubs(s.shots)))];
    const clubSel = document.getElementById('progressClub');
    clubSel.innerHTML = ['all',...allClubs].map(c=>
      `<option value="${c}">${c==='all'?'All clubs':clubLabel(c)}</option>`).join('');
    clubSel.onchange = () => renderProgressCharts(sessions, clubSel.value);
    renderProgressCharts(sessions,'all');
    try { renderCompare(sessions); } catch(e){ console.error('compare',e); }
  }

  // ── Feature: side-by-side session comparison ───────────────────
  function renderCompare(sessions) {
    const host = document.getElementById('compareHost');
    if (!host) return;
    const opts = sessions.map((s,i)=>`<option value="${s.id}">${formatDate(s.date)} · ${s.shots.length} shots</option>`).join('');
    host.innerHTML = `
      <div class="section-title">Compare sessions</div>
      <div class="compare-card">
        <div class="compare-selects">
          <select id="cmpA" class="cmp-sel">${opts}</select>
          <span class="cmp-vs">vs</span>
          <select id="cmpB" class="cmp-sel">${opts}</select>
        </div>
        <div id="cmpResult" class="compare-result"></div>
      </div>`;
    const selA = host.querySelector('#cmpA');
    const selB = host.querySelector('#cmpB');
    selA.selectedIndex = 0;
    selB.selectedIndex = Math.min(1, sessions.length-1);
    const draw = () => {
      const a = sessions.find(s=>s.id===selA.value);
      const b = sessions.find(s=>s.id===selB.value);
      const res = host.querySelector('#cmpResult');
      if (!a || !b || a.id===b.id) { res.innerHTML = `<p class="cmp-hint">Pick two different sessions to compare.</p>`; return; }
      const rows = Features.compare(a, b);
      res.innerHTML = rows.map(r => {
        const arrow = r.dir==='up'?'▲':r.dir==='down'?'▼':'–';
        const cls = r.good===true?'good':r.good===false?'bad':'neutral';
        return `<div class="cmp-row">
            <span class="cmp-label">${r.label}</span>
            <span class="cmp-a">${r.a}<small>${r.unit}</small></span>
            <span class="cmp-delta ${cls}">${arrow} ${r.delta!=null?r.delta:''}</span>
            <span class="cmp-b">${r.b}<small>${r.unit}</small></span>
          </div>`;
      }).join('') + `<div class="cmp-legend"><span>${formatDate(a.date)} (left)</span><span>${formatDate(b.date)} (right)</span></div>`;
    };
    selA.onchange = draw; selB.onchange = draw;
    draw();
  }

  function renderProgressCharts(sessions, clubFilter) {
    const filtered = sessions.map(s=>({
      label:formatDate(s.date),
      shots: clubFilter==='all'?s.shots:s.shots.filter(sh=>sh.clubType===clubFilter),
    })).filter(s=>s.shots.length>0);

    const labels = filtered.map(s=>s.label);
    const d = f => filtered.map(s=>avg(s.shots,f));

    // session quality scores
    const qualityData = filtered.map(s=>{
      const scores = s.shots.map(ShotScorer.score).filter(x=>x!==null);
      return scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    });

    const mkCfg = (data,color,yLabel) => ({
      type:'line', data:{labels,datasets:[{
        data, borderColor:color, backgroundColor:color+'22',
        tension:0.3, pointRadius:5, fill:true, borderWidth:2,
      }]},
      options:{
        responsive:true, maintainAspectRatio:true,
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{color:'#496657',font:{size:10}},grid:{color:'#d4e2d8'}},
          y:{ticks:{color:'#496657',font:{size:10}},grid:{color:'#d4e2d8'},
            title:{display:!!yLabel,text:yLabel||'',color:'#496657',font:{size:10}}},
        },
      },
    });

    const defs=[
      {id:'chartSmash',     data:d('smashFactor'), color:'#16a34a',yLabel:'Smash Factor'},
      {id:'chartCarry',     data:d('carryDistance'),color:'#2563eb',yLabel:'Carry (yds)'},
      {id:'chartLaunch',    data:d('launchAngle'), color:'#d97706',yLabel:'Launch Angle (°)'},
      {id:'chartBallSpeed', data:d('ballSpeed'),   color:'#7c3aed',yLabel:'Ball Speed (mph)'},
      {id:'chartPath',      data:d('clubPath'),    color:'#0891b2',yLabel:'Club Path (°)'},
      {id:'chartAA',        data:d('attackAngle'), color:'#ea580c',yLabel:'Attack Angle (°)'},
      {id:'chartQuality',   data:qualityData,      color:'#15803d',yLabel:'Session Score'},
    ];

    defs.forEach(({id,data,color,yLabel})=>{
      destroyChart(id);
      const canvas = document.getElementById(id);
      if (canvas) _charts[id] = new Chart(canvas, mkCfg(data,color,yLabel));
    });

    // render trend summary
    const trendEl = document.getElementById('progressTrend');
    if (!trendEl) return;
    const recent = sessions.slice(0,3);
    const older  = sessions.slice(3,6);
    if (recent.length<2||older.length<1) { trendEl.innerHTML=''; return; }

    const compare = (field,label,higherBetter=true) => {
      const r = avg(recent.flatMap(s=>s.shots),field);
      const o = avg(older.flatMap(s=>s.shots),field);
      if (!r||!o) return '';
      const diff = r-o, pct = Math.abs(diff/o*100);
      const better = higherBetter ? diff>0 : diff<0;
      const icon = pct<1?'→': better?'↑':'↓';
      const cls = pct<1?'neutral': better?'positive':'negative';
      return `<div class="trend-row trend-${cls}">
        <span class="trend-icon">${icon}</span>
        <span class="trend-label">${label}</span>
        <span class="trend-val">${better?'+':''}${fmt(diff, field==='smashFactor'?2:0)}${field==='launchAngle'||field==='attackAngle'?'°': field==='smashFactor'?'':' yds'} (${fmt(pct,0)}%)</span>
      </div>`;
    };

    trendEl.innerHTML = `
      <div class="trend-box">
        <div class="trend-heading">Last 3 sessions vs previous 3</div>
        ${compare('carryDistance','Carry distance')}
        ${compare('ballSpeed','Ball speed')}
        ${compare('smashFactor','Smash factor')}
        ${compare('launchAngle','Launch angle',false)}
        ${compare('attackAngle','Attack angle (driver benefit when > 0)',true)}
      </div>`;
  }

  function renderPractice(sessions) {
    const empty = document.getElementById('practice-empty');
    const content = document.getElementById('practice-content');
    if (!sessions.length) { empty.style.display=''; content.hidden=true; return; }
    empty.style.display='none'; content.hidden=false;

    const plans = PracticePlans.generatePlan(sessions);
    const grid = document.getElementById('practiceGrid');
    if (!grid || !plans) return;

    grid.innerHTML = plans.map((p,i) => `
      <div class="drill-card" style="padding:1rem;cursor:pointer;text-align:center">
        <div style="font-size:2rem;margin-bottom:.4rem">${p.name.split(' ')[0]}</div>
        <div class="drill-title" style="font-size:.9rem">${p.name.substring(p.name.indexOf(' ')+1)}</div>
        <div class="drill-time" style="margin-top:.5rem">${p.duration} min</div>
        <div style="font-size:.7rem;color:var(--text-muted);margin-top:.4rem">${p.difficulty}</div>
        <button class="btn-primary" onclick="toast('${p.name} session started!')" style="width:100%;margin-top:.6rem;padding:.4rem;font-size:.75rem">Start</button>
      </div>`
    ).join('');
  }

  return { renderSessionList, renderHome, renderDetail, renderProgress, renderYardages, renderPractice };
})();

// ────────────────────────────────────────────────────────────────
// Router
// ────────────────────────────────────────────────────────────────
const Router = (() => {
  function show(viewId) {
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(`view-${viewId}`)?.classList.add('active');
    document.querySelectorAll('[data-view]').forEach(el=>
      el.classList.toggle('active', el.dataset.view===viewId));
  }

  // Wrap a render so a single rendering error can never block navigation or
  // freeze a tab — the view still switches, we just log and toast.
  function safeRender(label, fn, viewId) {
    try { fn(); }
    catch (e) {
      console.error(`[ShotLab] render error in ${label}:`, e);
      toast(`Couldn't fully load ${label}.`);
    }
    show(viewId);
  }

  async function showDetail(id) {
    const session = await Store.getSession(id);
    if (!session) { toast('Session not found.'); return; }
    safeRender('session', () => UI.renderDetail(session), 'session-detail');
  }

  async function showProgress() {
    const sessions = await Store.getSessions();
    safeRender('progress', () => UI.renderProgress(sessions), 'progress');
  }

  async function showYardages() {
    const sessions = await Store.getSessions();
    safeRender('yardages', () => UI.renderYardages(sessions), 'yardages');
  }

  async function showSessions() {
    const sessions = await Store.getSessions();
    safeRender('sessions', () => UI.renderHome(sessions), 'sessions');
  }

  async function showPractice() {
    const sessions = await Store.getSessions();
    safeRender('practice', () => UI.renderPractice(sessions), 'practice');
  }

  function showImport() {
    document.querySelectorAll('.import-step').forEach(s=>s.classList.remove('active'));
    document.getElementById('step-pick').classList.add('active');
    document.getElementById('fileInput').value='';
    show('import');
  }

  return { show, showDetail, showProgress, showYardages, showSessions, showPractice, showImport };
})();

// ────────────────────────────────────────────────────────────────
// Import flow
// ────────────────────────────────────────────────────────────────
const ImportFlow = (() => {
  let _shots = null;

  function goStep(id) {
    document.querySelectorAll('.import-step').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { alert('Please select a CSV file.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        _shots = CSVParser.parse(e.target.result);
        showPreview(_shots, file.name);
      } catch(err) { alert('Could not parse CSV: '+err.message); }
    };
    reader.readAsText(file);
  }

  function showPreview(shots, filename) {
    document.getElementById('previewCount').textContent =
      `${shots.length} shots · ${[...new Set(shots.map(s=>s.clubType))].length} clubs · `+
      `${shots.some(s=>s.spinRate)?'Spin data included':'No spin data'}`;

    const match = filename.match(/(\d{6})/);
    if (match) {
      const d=match[1];
      document.getElementById('metaDate').value = `20${d.slice(4,6)}-${d.slice(0,2)}-${d.slice(2,4)}`;
    } else {
      document.getElementById('metaDate').value = new Date().toISOString().slice(0,10);
    }

    const cols = ['clubType','clubBrand','ballSpeed','smashFactor','carryDistance','launchAngle','clubPath','attackAngle'];
    const labs = {clubType:'Club',clubBrand:'Brand',ballSpeed:'Ball Spd',smashFactor:'Smash',carryDistance:'Carry',launchAngle:'Launch°',clubPath:'Path°',attackAngle:'AoA°'};
    document.getElementById('previewTable').innerHTML = `
      <thead><tr>${cols.map(c=>`<th>${labs[c]||c}</th>`).join('')}</tr></thead>
      <tbody>${shots.slice(0,5).map(s=>`<tr>${cols.map(c=>`<td>${s[c]??'—'}</td>`).join('')}</tr>`).join('')}</tbody>`;
    goStep('step-preview');
  }

  async function save() {
    const date  = document.getElementById('metaDate').value;
    const notes = document.getElementById('metaNotes').value.trim();
    const wind  = document.getElementById('metaWind').value.trim();
    const temp  = document.getElementById('metaTemp').value.trim();
    const session = {
      id: crypto.randomUUID(), date: date||new Date().toISOString().slice(0,10),
      notes, conditions:(wind||temp)?{wind,temp}:null, shots:_shots, createdAt:Date.now(),
    };
    // Save to MemDB and show instantly — no spinner
    MemDB.saveSession(session);
    UI.renderDetail(session);
    Router.show('session-detail');
    // Persist to cloud in background if logged in (auto-sync on import)
    if (Auth.getUser()) {
      CloudDB.saveSession(session).then(() => {
        toast('Saved to cloud ✓');
        showDebug('CLOUD SYNC: ✓ saved session to cloud as ' + Auth.getUser().email);
      }).catch(e => {
        toast('Cloud sync failed: ' + (e?.message || 'unknown error'));
        showDebug('CLOUD SYNC FAILED:\n' + (e?.message || JSON.stringify(e)));
      });
    }
  }

  return { goStep, handleFile, save };
})();

// ────────────────────────────────────────────────────────────────
// Confirm modal
// ────────────────────────────────────────────────────────────────
function showConfirm(title, body, onOk) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent  = body;
  modal.hidden = false;
  const ok=document.getElementById('confirmOk'), cancel=document.getElementById('confirmCancel');
  const cleanup = () => { modal.hidden=true; ok.onclick=null; cancel.onclick=null; };
  ok.onclick = () => { cleanup(); onOk(); };
  cancel.onclick = cleanup;
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────
async function init() {
  // Reflect persisted theme on the Settings switch (class already set early)
  applyTheme(document.documentElement.classList.contains('dark'));

  // Nav — use event delegation on document for maximum robustness
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-view]');
    if (!el) return;
    e.preventDefault();
    const v = el.dataset.view;
    try {
      if (v==='import')   { Router.showImport(); return; }
      if (v==='progress') { await Router.showProgress(); return; }
      if (v==='yardages') { await Router.showYardages(); return; }
      if (v==='sessions') { await Router.showSessions(); return; }
      Router.show(v);
    } catch (err) {
      // Never let a view-render error leave the tab feeling "dead"
      console.error('Navigation error:', err);
      toast('Could not open ' + v + ': ' + (err?.message || 'unknown error'));
      Router.show(v);
    }
  });

  document.getElementById('topImportBtn')?.addEventListener('click', ()=>Router.showImport());
  document.getElementById('sessionsImportBtn')?.addEventListener('click', ()=>Router.showImport());
  document.getElementById('emptyCTA')?.addEventListener('click', ()=>Router.showImport());
  document.getElementById('importBackBtn').addEventListener('click', ()=>Router.showSessions());
  document.getElementById('detailBackBtn').addEventListener('click', ()=>Router.showSessions());

  // In-page section nav (session detail)
  document.querySelectorAll('.subnav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target=document.getElementById(link.dataset.target);
      if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
    });
  });

  // File pick
  const fileInput=document.getElementById('fileInput'), dropZone=document.getElementById('dropZone');
  document.getElementById('browseBtn').addEventListener('click', ()=>fileInput.click());
  dropZone.addEventListener('click', e=>{ if(e.target!==document.getElementById('browseBtn')) fileInput.click(); });
  fileInput.addEventListener('change', ()=>ImportFlow.handleFile(fileInput.files[0]));
  dropZone.addEventListener('dragover', e=>{ e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', ()=>dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e=>{ e.preventDefault(); dropZone.classList.remove('dragover'); ImportFlow.handleFile(e.dataTransfer.files[0]); });

  // Import steps
  document.getElementById('previewBack').addEventListener('click', ()=>ImportFlow.goStep('step-pick'));
  document.getElementById('previewNext').addEventListener('click', ()=>ImportFlow.goStep('step-meta'));
  document.getElementById('metaBack').addEventListener('click',    ()=>ImportFlow.goStep('step-preview'));
  document.getElementById('saveSession').addEventListener('click', ()=>ImportFlow.save());

  // Delete
  document.getElementById('deleteSessionBtn').addEventListener('click', function() {
    showConfirm('Delete session?','This cannot be undone.', async ()=>{
      await Store.deleteSession(this.dataset.id);
      await Router.showSessions();
    });
  });

  // Settings
  document.getElementById('exportDataBtn').addEventListener('click', async ()=>{
    try {
      const data = await Store.getSessions();
      // Create CSV export
      let csv = 'Date,Club,Carry,Total,Ball Speed,Smash,Launch,Spin,Notes\n';
      data.forEach(s => {
        s.shots.forEach(shot => {
          csv += `${s.date},${shot.clubType},${shot.carryDistance||''},${shot.totalDistance||''},${shot.ballSpeed||''},${shot.smashFactor||''},${shot.launchAngle||''},${shot.spinRate||''},"${s.notes||''}"\n`;
        });
      });
      // Offer both formats
      const format = confirm('JSON (OK) or CSV (Cancel)?') ? 'json' : 'csv';
      const blob = format === 'json'
        ? new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
        : new Blob([csv],{type:'text/csv'});
      const a = Object.assign(document.createElement('a'),{
        href: URL.createObjectURL(blob),
        download: `shotlab-${new Date().toISOString().slice(0,10)}.${format}`,
      });
      a.click();
      toast(`Exported ${data.length} sessions as ${format.toUpperCase()}`);
    } catch(err) { toast('Export failed: ' + (err.message || 'could not reach the cloud')); }
  });

  document.getElementById('clearDataBtn').addEventListener('click', ()=>{
    showConfirm('Clear all data?','All sessions will be permanently deleted.', async ()=>{
      try {
        const sessions = await Store.getSessions();
        for (const s of sessions) await Store.deleteSession(s.id);
        await Router.showSessions();
        toast(`Cleared ${sessions.length} session${sessions.length===1?'':'s'}.`);
      } catch(err) { toast('Clear failed: ' + (err.message || 'could not reach the cloud')); }
    });
  });

  // Shot detail modal close
  const shotModal = document.getElementById('shotModal');
  document.getElementById('shotModalClose').addEventListener('click', ()=>shotModal.hidden=true);
  shotModal.addEventListener('click', e=>{ if(e.target===shotModal) shotModal.hidden=true; });

  // Achievements modal close
  const achModal = document.getElementById('achModal');
  if (achModal) {
    document.getElementById('achModalClose')?.addEventListener('click', ()=>achModal.hidden=true);
    achModal.addEventListener('click', e=>{ if(e.target===achModal) achModal.hidden=true; });
  }

  // Dark-mode toggle (persisted)
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const dark = !document.documentElement.classList.contains('dark');
      applyTheme(dark);
      try { localStorage.setItem('slTheme', dark ? 'dark' : 'light'); } catch(_) {}
    });
  }

  async function afterAuth() {
    const user = Auth.getUser();
    if (!user) return;
    await Router.showSessions();
  }

  // Auth tab switching
  document.getElementById('authTabLogin').addEventListener('click', Auth.switchToLogin);
  document.getElementById('authTabSignup').addEventListener('click', Auth.switchToSignup);
  document.getElementById('authSwitchSignup').addEventListener('click', e=>{ e.preventDefault(); Auth.switchToSignup(); });
  document.getElementById('authSwitchLogin').addEventListener('click', e=>{ e.preventDefault(); Auth.switchToLogin(); });

  // Auth form submission
  document.getElementById('authLoginBtn').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email || !password) { document.getElementById('authError').textContent = 'Please fill in all fields.'; return; }
    try {
      await Auth.login(email, password);
      document.getElementById('authEmail').value = '';
      document.getElementById('authPassword').value = '';
      await afterAuth();
    } catch(err) {
      document.getElementById('authError').textContent = err.message;
    }
  });

  document.getElementById('authSignupBtn').addEventListener('click', async () => {
    const email = document.getElementById('authSignupEmail').value.trim();
    const password = document.getElementById('authSignupPassword').value.trim();
    const confirm = document.getElementById('authSignupConfirm').value.trim();
    if (!email || !password || !confirm) { document.getElementById('authError').textContent = 'Please fill in all fields.'; return; }
    if (password !== confirm) { document.getElementById('authError').textContent = 'Passwords do not match.'; return; }
    if (password.length < 6) { document.getElementById('authError').textContent = 'Password must be at least 6 characters.'; return; }
    try {
      await Auth.signup(email, password);
      document.getElementById('authSignupEmail').value = '';
      document.getElementById('authSignupPassword').value = '';
      document.getElementById('authSignupConfirm').value = '';
      if (Auth.getUser()) await afterAuth();
      else document.getElementById('authError').textContent = 'Check your email to confirm your account, then sign in.';
    } catch(err) {
      document.getElementById('authError').textContent = err.message;
    }
  });

  // Social sign-in
  document.getElementById('authGoogleBtn').addEventListener('click', async () => {
    try { await Auth.oauth('google'); }
    catch(err) { document.getElementById('authError').textContent = err.message; }
  });
  // Continue as guest
  document.getElementById('authGuestBtn').addEventListener('click', async () => {
    Auth.setGuest();
    Auth.hideAuth();
    await Router.showSessions();
  });

  // Settings account controls
  document.getElementById('accountSignInBtn').addEventListener('click', () => Auth.showAuth(false));
  document.getElementById('accountSignOutBtn').addEventListener('click', async () => {
    await Auth.logout();
    await Router.showSessions();
  });

  // Manual cloud sync: push every local session up, then re-render from cloud
  document.getElementById('syncCloudBtn').addEventListener('click', async () => {
    if (!Auth.getUser()) { toast('Sign in to sync.'); return; }
    const btn = document.getElementById('syncCloudBtn');
    const label = btn.querySelector('span');
    const original = label.textContent;
    label.textContent = 'Syncing…';
    btn.disabled = true;
    try {
      const local = MemDB.getSessions();
      let pushed = 0;
      for (const s of local) { await CloudDB.saveSession(s); pushed++; }
      const rows = await CloudDB.getSessions(Auth.getUser().id);
      toast(`Synced ✓ (${pushed} uploaded, ${rows.length} in cloud)`);
      showDebug(`CLOUD SYNC ✓\nuploaded: ${pushed}\nin cloud now: ${rows.length}`);
      await Router.showSessions();
    } catch (e) {
      console.error('Sync failed:', e);
      toast('Sync failed: ' + (e?.message || 'unknown error'));
      showDebug('CLOUD SYNC FAILED:\n' + (e?.message || JSON.stringify(e)));
    } finally {
      label.textContent = original;
      btn.disabled = false;
    }
  });

  // Keyboard shortcuts for power users
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select')) return; // don't interfere with form inputs
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); Router.showImport(); }
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); Router.showSessions(); }
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); Router.showProgress(); }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); Router.showYardages(); }
    }
  });

  // Show keyboard tips in console
  console.log('%cShotLab Keyboard Shortcuts', 'font-weight:bold;font-size:14px;color:#0b4d2e');
  console.log('Ctrl+I: Import | Ctrl+H: Home | Ctrl+P: Progress | Ctrl+Y: Yardages');

  // View preferences toggles
  const prefs = ViewPrefs.getPrefs();
  ['Heatmap','Faults','ClubBreak','Comparison','Density'].forEach(name => {
    const key = name.charAt(0).toLowerCase() + name.slice(1);
    const storageKey = 'show' + name[0].toUpperCase() + name.slice(1);
    const btn = document.getElementById('pref' + name);
    const toggle = document.getElementById('pref' + name + 'Toggle');
    if (btn && toggle) {
      btn.addEventListener('click', () => {
        const newVal = ViewPrefs.togglePref(storageKey === 'showDensity' ? 'densityMode' : storageKey);
        toggle.textContent = newVal ? '✓' : '';
        toggle.style.color = newVal ? 'var(--pine)' : 'var(--text-dim)';
      });
      const isOn = prefs[storageKey === 'showDensity' ? 'densityMode' : storageKey];
      toggle.textContent = isOn ? '✓' : '';
      toggle.style.color = isOn ? 'var(--pine)' : 'var(--text-dim)';
    }
  });

  // Goals management
  const renderGoals = async () => {
    const list = document.getElementById('goalsList');
    if (!list) return;
    const goals = Goals.getGoals();
    const sessions = await Store.getSessions();
    const metricLabels = { carry: 'Longest Carry', ball_speed: 'Ball Speed', smash: 'Smash', score: 'Form Score', sessions: 'Sessions' };
    list.innerHTML = Object.entries(goals).map(([metric, goal]) => {
      const progress = Goals.getProgress(metric, sessions);
      const pct = Math.round((progress / goal.target) * 100);
      return `<div style="display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:center;padding:.6rem;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:.5rem">
        <div>
          <div style="font-weight:600;color:var(--text);font-size:.9rem">${metricLabels[metric]}</div>
          <div style="font-size:.75rem;color:var(--text-muted)"><strong>${progress}${goal.unit}</strong> of <strong>${goal.target}${goal.unit}</strong></div>
          <div style="height:6px;background:var(--border);border-radius:3px;margin-top:.4rem;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--pine);transition:width .3s"></div></div>
        </div>
        <button onclick="Goals.deleteGoal('${metric}');location.reload()" style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:1rem">✕</button>
      </div>`;
    }).join('');
  };

  document.getElementById('setGoalBtn')?.addEventListener('click', async () => {
    const metric = document.getElementById('goalMetric')?.value;
    const target = parseInt(document.getElementById('goalTarget')?.value||0);
    if (!metric || !target) { toast('Select metric and target'); return; }
    const units = { carry: 'yds', ball_speed: 'mph', smash: '', score: '', sessions: '' };
    Goals.setGoal(metric, target, units[metric]||'');
    await renderGoals();
    document.getElementById('goalMetric').value = '';
    document.getElementById('goalTarget').value = '';
    toast('Goal set! 🎯');
  });

  await renderGoals();

  // Auth — all UI handlers above are wired up first, so a slow network here
  // can never leave Sign Out / Clear Data unresponsive
  await Auth.init();

  // Landed here from an email confirmation / magic link
  if (_authRedirect) {
    history.replaceState(null, '', location.pathname);
    if (_authError) {
      const expired = /expired|otp_expired|invalid|access_denied/.test(_redirectStr);
      toast(_authErrorMsg
        ? `Sign-in failed: ${_authErrorMsg}`
        : (expired ? 'That link has expired. Please sign in or request a new one.' : 'Sign-in failed. Please try again.'));
    } else {
      Auth.hideAuth();
      const fromEmail = /type=(signup|magiclink|recovery|email_change|invite)/.test(_redirectStr);
      if (Auth.getUser()) toast(fromEmail ? 'Email verified — you’re signed in!' : 'Signed in!');
      else toast('Email verified — please sign in.');
    }
  }

  if (Auth.getUser()) {
    await afterAuth();
  } else {
    Auth.showAuth(true); // mandatory sign-in; guest option after 5s
    await Router.showSessions(); // render empty sessions behind the modal
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

// ────────────────────────────────────────────────────────────────
// Bulletproofing — global safety net
// ────────────────────────────────────────────────────────────────
// A friendly recovery screen so a fatal startup error never leaves a blank
// page. Offers a reload and a "reset app" escape hatch (clears caches/SW).
function showFatalError(err) {
  console.error('[ShotLab fatal]', err);
  try {
    const existing = document.getElementById('slFatal');
    if (existing) return;
    const el = document.createElement('div');
    el.id = 'slFatal';
    el.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#edf4ee;display:flex;' +
      'align-items:center;justify-content:center;padding:2rem;font-family:system-ui,sans-serif';
    el.innerHTML =
      '<div style="max-width:340px;text-align:center">' +
      '<div style="font-size:2.5rem;margin-bottom:.5rem">⛳</div>' +
      '<h2 style="font-size:1.2rem;color:#0c1f14;margin-bottom:.5rem">Something hiccuped</h2>' +
      '<p style="color:#496657;font-size:.9rem;margin-bottom:1.25rem;line-height:1.5">' +
      'The app hit an unexpected snag while loading. Your saved data is safe.</p>' +
      '<button id="slReload" style="background:#0b4d2e;color:#fff;border:none;border-radius:8px;' +
      'padding:.7rem 1.4rem;font-weight:700;cursor:pointer;width:100%;margin-bottom:.6rem">Reload app</button>' +
      '<button id="slReset" style="background:none;color:#496657;border:1px solid #b8cebd;' +
      'border-radius:8px;padding:.6rem 1.4rem;font-weight:600;cursor:pointer;width:100%">Reset &amp; reload</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('slReload').onclick = () => location.reload();
    document.getElementById('slReset').onclick = async () => {
      try {
        if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
        if ('serviceWorker' in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); }
      } catch (_) {}
      location.reload();
    };
  } catch (_) { /* last resort: do nothing rather than loop */ }
}

// Surface uncaught errors/rejections to the console (not as scary popups —
// most are non-fatal). The recovery screen is reserved for startup failure.
window.addEventListener('error', e => console.error('[ShotLab] uncaught:', e.error || e.message));
window.addEventListener('unhandledrejection', e => console.error('[ShotLab] unhandled promise:', e.reason));

document.addEventListener('DOMContentLoaded', () => {
  init().catch(showFatalError);
});

// ════════════════════════════════════════════════════════════════
// SwingAnalytics — Advanced swing pattern detection
// ════════════════════════════════════════════════════════════════
const SwingAnalytics = (() => {
  function detectPattern(shots) {
    if (!shots.length) return null;

    const carries = shots.map(s => s.carryDistance || 0).filter(c => c > 0);
    const launches = shots.map(s => s.launchAngle || 0);
    const ballSpeeds = shots.map(s => s.ballSpeed || 0).filter(b => b > 0);

    const pattern = {
      consistency: Math.round(100 - stdDev(carries)),
      avgCarry: Math.round(avg(shots, 'carryDistance') || 0),
      bestCarry: Math.max(...carries),
      worstCarry: Math.min(...carries),
      launchTendency: launches.length ? Math.round(avg(shots, 'launchAngle') * 10) / 10 : 0,
      ballSpeedTrend: ballSpeeds.length ? 'stable' : 'unknown',
      dispersalPattern: stdDev(carries) < 5 ? 'tight' : stdDev(carries) < 12 ? 'moderate' : 'wide',
    };

    return pattern;
  }

  function compareToBaseline(sessions, club) {
    const allClubShots = sessions.flatMap(s => s.shots).filter(sh => sh.clubType === club);
    const recentShots = sessions.slice(0, 3).flatMap(s => s.shots).filter(sh => sh.clubType === club);

    if (!allClubShots.length) return null;

    const allPattern = detectPattern(allClubShots);
    const recentPattern = detectPattern(recentShots);

    return {
      baseline: allPattern,
      recent: recentPattern,
      improvement: recentPattern && allPattern ? recentPattern.avgCarry - allPattern.avgCarry : 0,
      consistencyChange: recentPattern && allPattern ? recentPattern.consistency - allPattern.consistency : 0,
    };
  }

  return { detectPattern, compareToBaseline };
})();

// ════════════════════════════════════════════════════════════════
// InsightEngine — Generate actionable insights
// ════════════════════════════════════════════════════════════════
const InsightEngine = (() => {
  function generateInsights(sessions) {
    const insights = [];

    if (!sessions.length) return insights;

    const recent5 = sessions.slice(0, 5);
    const scores = recent5.flatMap(s => s.shots.map(ShotScorer.score)).filter(x => x !== null);
    const recent_avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

    // Insight 1: Form trend
    if (sessions.length >= 3) {
      const recent3_scores = sessions.slice(0, 3).flatMap(s => s.shots.map(ShotScorer.score)).filter(x => x !== null);
      const prev3_scores = sessions.slice(3, 6).flatMap(s => s.shots.map(ShotScorer.score)).filter(x => x !== null);
      const recent3_avg = recent3_scores.length ? Math.round(recent3_scores.reduce((a,b)=>a+b,0)/recent3_scores.length) : 0;
      const prev3_avg = prev3_scores.length ? Math.round(prev3_scores.reduce((a,b)=>a+b,0)/prev3_scores.length) : 0;

      if (recent3_avg > prev3_avg + 5) {
        insights.push({ icon: '📈', text: `You're improving! +${recent3_avg - prev3_avg} pts vs last week`, type: 'positive' });
      } else if (recent3_avg < prev3_avg - 5) {
        insights.push({ icon: '⚠️', text: `Form dipped slightly. Focus on ${FaultEngine.detectFaults(sessions[0].shots)[0]?.name || 'basics'}`, type: 'warning' });
      }
    }

    // Insight 2: Consistency
    const allShots = sessions.flatMap(s => s.shots);
    const carries = allShots.map(s => s.carryDistance || 0).filter(c => c > 0);
    const consistency = 100 - stdDev(carries);
    if (consistency > 85) {
      insights.push({ icon: '🎯', text: `Your swing is very consistent (${Math.round(consistency)}%)`, type: 'positive' });
    }

    // Insight 3: Practice frequency
    const st = Features.streak(sessions);
    if (st.current >= 3 && st.current <= 7) {
      insights.push({ icon: '🔥', text: `Nice ${st.current}-day streak! Keep it going`, type: 'positive' });
    }

    // Insight 4: Fatigue detection
    if (sessions.length >= 2) {
      const shot_counts = sessions.slice(0, 3).map(s => s.shots.length);
      const avg_shots = shot_counts.reduce((a,b)=>a+b,0) / shot_counts.length;
      if (shot_counts[0] > avg_shots * 1.3) {
        insights.push({ icon: '😴', text: `Long session! Make sure to rest between rounds`, type: 'info' });
      }
    }

    return insights;
  }

  return { generateInsights };
})();


// ════════════════════════════════════════════════════════════════
// CoachingMode — Interactive guidance system
// ════════════════════════════════════════════════════════════════
const CoachingMode = (() => {
  const TIPS = {
    'Slice': [
      '🎯 Grip: Check your grip pressure - aim for 6/10 tightness',
      '📐 Path: Feel like you\'re swinging from inside-to-out',
      '🔄 Rotation: Ensure full shoulder turn on backswing',
      '📍 Alignment: Check your shoulders point slightly left of target',
    ],
    'Hook': [
      '📍 Alignment: Try opening your stance slightly',
      '🎯 Grip: Check for over-strong grip',
      '📐 Path: Focus on outside-to-in path feels',
      '🔄 Rotation: Practice 3/4 swing to feel the path',
    ],
    'Thin': [
      '📍 Ball Position: Move ball forward in stance',
      '🧍 Posture: Maintain spine angle through impact',
      '👀 Eye Focus: Keep your eyes on the back of the ball',
      '🔄 Low Point: Practice hitting divots 2 inches AFTER the ball',
    ],
    'Fat': [
      '⚖️ Weight Transfer: Shift weight to front foot during downswing',
      '🧍 Posture: Keep your head still until after impact',
      '📍 Ball Position: Try moving ball back in stance',
      '🔄 Practice: Hit tees in the ground - swing over them',
    ],
  };

  function getTips(faultName) {
    return TIPS[faultName] || [
      '🎯 Focus on your fundamentals',
      '📊 Record your swing on video',
      '🔄 Practice with purpose, not just volume',
      '💪 Work on one thing at a time',
    ];
  }

  function generateSession(fault) {
    return {
      warmup: '5 min light stretching & 10 swings to loosen up',
      focus: `Work on ${fault || 'consistency'}`,
      drills: getTips(fault),
      cooldown: 'Review what worked and what didn\'t',
      duration: 30,
    };
  }

  return { getTips, generateSession };
})();

// ════════════════════════════════════════════════════════════════
// SessionSnapshot — Create shareable summaries
// ════════════════════════════════════════════════════════════════
const SessionSnapshot = (() => {
  function create(session) {
    const shots = session.shots;
    const scores = shots.map(ShotScorer.score).filter(x=>x!==null);
    const avg_score = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    const grade = ShotScorer.grade(avg_score);
    const faults = FaultEngine.detectFaults(shots).slice(0, 3);

    return {
      date: formatDate(session.date),
      shotCount: shots.length,
      formScore: avg_score,
      grade: grade.letter,
      avgCarry: fmt(avg(shots, 'carryDistance'), 0),
      avgBallSpeed: fmt(avg(shots, 'ballSpeed'), 1),
      topFault: faults[0]?.name || 'None',
      faultCount: FaultEngine.detectFaults(shots).length,
      clubs: sortedClubs(shots).map(clubLabel).join(', '),
      notes: session.notes || '',
      summary: `${shots.length} shots | Form: ${avg_score}/100 (${grade.letter}) | ${session.notes || 'Range session'}`
    };
  }

  function toShareText(snapshot) {
    return `📊 ShotLab Session Summary\n\n` +
      `Date: ${snapshot.date}\n` +
      `Score: ${snapshot.formScore}/100 (${snapshot.grade})\n` +
      `Shots: ${snapshot.shotCount}\n` +
      `Avg Carry: ${snapshot.avgCarry} yds\n` +
      `Top Issue: ${snapshot.topFault}\n` +
      `\n${snapshot.summary}\n\n` +
      `Tracked with ShotLab 🎯`;
  }

  return { create, toShareText };
})();

// ════════════════════════════════════════════════════════════════
// PerformanceGrade — Comprehensive scoring
// ════════════════════════════════════════════════════════════════
const PerformanceGrade = (() => {
  function calculateFullGrade(sessions) {
    if (!sessions.length) return null;

    const all_shots = sessions.flatMap(s => s.shots);
    const scores = all_shots.map(ShotScorer.score).filter(x => x !== null);
    const form_score = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    
    const carries = all_shots.map(s => s.carryDistance || 0).filter(c => c > 0);
    const consistency = Math.round(100 - stdDev(carries));
    
    const session_count = sessions.length;
    const total_shots = all_shots.length;
    
    const st = Features.streak(sessions);
    const streak_bonus = st.current >= 3 ? 10 : st.current === 2 ? 5 : 0;

    const overall = Math.min(100, Math.round((form_score * 0.5 + consistency * 0.3 + (session_count > 10 ? 20 : session_count * 2)) * 0.9 + streak_bonus));

    return {
      overall,
      form: form_score,
      consistency,
      frequency: session_count,
      totalShots: total_shots,
      streak: st.current,
      grade: ShotScorer.grade(overall).letter,
    };
  }

  return { calculateFullGrade };
})();

