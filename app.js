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
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Detect OAuth / magic-link redirects so we can show the right UI state.
// Also capture OAuth tokens from the hash immediately, before Supabase processes them.
const _redirectStr = (location.hash + '&' + location.search).toLowerCase();
const _authError = /error=|error_code=|error_description=/.test(_redirectStr);
const _authRedirect = _authError ||
  /type=(signup|magiclink|recovery|email_change|invite)|access_token=|[?&]code=/.test(_redirectStr);

// If we have OAuth tokens in the hash, extract them for manual processing.
// This ensures we install the exact token that was returned, not stale storage.
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

  async function init() {
    // Set up the listener first, before checking the session.
    sb.auth.onAuthStateChange(async (event, session) => {
      const eventUser = session?.user || null;
      console.log('[AUTH]', event, '→', eventUser?.email || 'nobody');
      if (_signingOut) return;

      if (event === 'SIGNED_OUT') {
        _user = null;
        updateUI();
        showAuth(false);
        return;
      }

      // User signed in or session restored
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && eventUser) {
        _user = eventUser;
        updateUI();
        if (event === 'SIGNED_IN') {
          await Router.showSessions();
        }
        return;
      }
    });

    // If we came back from OAuth with a token in the hash, install it now.
    // This ensures we use the exact fresh token, not stale storage.
    if (_oauthTokens) {
      try {
        const { error } = await sb.auth.setSession(_oauthTokens);
        if (error) throw error;
        console.log('[AUTH] installed OAuth token');
      } catch (e) {
        console.error('[AUTH] failed to install OAuth token:', e.message);
      }
    }

    // Restore any existing session from storage (or refresh the one we just installed)
    const { data, error } = await sb.auth.getSession();
    if (data?.session?.user) {
      _user = data.session.user;
      updateUI();
      console.log('[AUTH] session user:', _user.email);
    } else {
      console.log('[AUTH] no session');
    }

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
    // Start the OAuth flow; Supabase handles the redirect and session restoration.
    // skipBrowserRedirect: false ensures the browser actually redirects to Google.
    // prompt: 'select_account' ensures Google shows the account chooser.
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: location.origin,
        queryParams: { prompt: 'select_account' },
        skipBrowserRedirect: false,
      },
    });
    if (error) throw error;
  }

  async function logout() {
    _signingOut = true;
    try {
      // Sign out locally first (stops auto-refresh immediately)
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
      // Then revoke globally (server-side, best effort)
      await sb.auth.signOut({ scope: 'global' }).catch(() => {});
    } finally {
      // Clear local state and reload
      _user = null;
      updateUI();
      window.location.replace(location.origin + location.pathname);
    }
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
    // Render tip of the day
    try {
      const tips = [
        '💡 Pro tip: Consistency matters more than distance. Focus on repeatable swings.',
        '🎯 Track your practice: Use notes to reflect on what\'s working.',
        '📊 Check your analytics: Understand your swing patterns.',
        '🏆 Set a goal: Use the Goals feature to stay motivated.',
        '🔥 Build a streak: Practice regularly to build momentum.',
        '📚 Learn something new: Visit the Learning Library today.',
        '🎨 Experiment: Try different clubs to find your strengths.',
        '⚡ Quality over quantity: 20 focused shots beat 100 mindless ones.',
      ];
      const todayTip = tips[new Date().getDate() % tips.length];
      const tipHost = document.getElementById('tipHost');
      if (tipHost) {
        tipHost.innerHTML = `<div style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);padding:.8rem;border-radius:var(--radius-sm);margin-bottom:1rem;font-size:.95rem;color:var(--text)">${todayTip}</div>`;
      }
    } catch(e){ console.error('tip',e); }

    // Render enhanced metrics widget (replace, never append)
    try {
      const widgetHost = document.getElementById('metricsWidgetHost');
      if (widgetHost) {
        if (sessions.length) {
          const stats = EnhancedMetricsWidget.renderMiniStats(sessions);
          widgetHost.innerHTML = EnhancedMetricsWidget.renderWidget(stats) || '';
        } else {
          widgetHost.innerHTML = '';
        }
      }
    } catch(e){ console.error('metrics-widget',e); }

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

    // Render alerts (replace, never append)
    try {
      const alertsHost = document.getElementById('alertsHost');
      if (alertsHost) {
        const alerts = PerformanceAlerts.generateAlerts(sessions);
        alertsHost.innerHTML = alerts.length ? `
          <div style="margin-top:1rem;display:flex;flex-direction:column;gap:.6rem">
            ${alerts.map(a => `
              <div style="padding:.8rem;background:${a.severity==='high'?'rgba(239,68,68,.1)':a.severity==='info'?'rgba(96,165,250,.1)':'rgba(34,197,94,.1)'};border-left:4px solid ${a.severity==='high'?'#ef4444':a.severity==='info'?'#60a5fa':'#22c55e'};border-radius:var(--radius-sm)">
                <div style="font-weight:600;margin-bottom:.3rem">${a.icon} ${a.title}</div>
                <div style="font-size:.9rem;color:var(--text-dim)">${a.message}</div>
              </div>
            `).join('')}
          </div>` : '';
      }
    } catch(e){ console.error('alerts',e); }

    // Render performance grade & coaching (replace, never append)
    try {
      const coachHost = document.getElementById('coachHost');
      if (coachHost) {
        const grade = PerformanceGrade.calculateFullGrade(sessions);
        const coach = PersonalCoach.analyzeSessions(sessions);
        coachHost.innerHTML = (grade && coach) ? `
            <div style="margin-top:1.5rem;padding:1.2rem;background:linear-gradient(135deg,rgba(11,77,46,.08),rgba(16,185,129,.04));border-radius:var(--radius-md);border:1px solid rgba(16,185,129,.2)">
              <div style="font-weight:700;margin-bottom:.5rem;font-size:1.05rem">${coach.greeting}</div>
              <div style="font-size:.9rem;color:var(--text-dim);margin-bottom:.8rem">${coach.assessment}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.8rem">
                <div style="background:rgba(255,255,255,.05);padding:.8rem;border-radius:var(--radius-sm)">
                  <div style="font-size:.75rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Overall Grade</div>
                  <div style="font-size:1.8rem;font-weight:800;color:#4ade80">${grade.grade}</div>
                  <div style="font-size:.8rem;color:var(--text-dim);margin-top:.2rem">${grade.overall}/100</div>
                </div>
                <div style="background:rgba(255,255,255,.05);padding:.8rem;border-radius:var(--radius-sm)">
                  <div style="font-size:.75rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Next Goal</div>
                  <div style="font-size:1rem;margin-bottom:.3rem">${coach.nextMilestone.progress}%</div>
                  <div style="background:rgba(0,0,0,.2);height:4px;border-radius:2px;overflow:hidden">
                    <div style="background:#4ade80;height:100%;width:${coach.nextMilestone.progress}%"></div>
                  </div>
                </div>
              </div>
              <div style="font-size:.9rem;padding:.8rem;background:rgba(255,255,255,.05);border-radius:var(--radius-sm);margin-bottom:.8rem">
                <strong>💡 Focus:</strong> ${coach.topFocus?.name || 'Consistency'} — ${coach.drillRecommendation}
              </div>
              <div style="font-size:.85rem;color:#a3e635;font-weight:600">${coach.motivationalMessage}</div>
            </div>` : '';
      }
    } catch(e){ console.error('coaching',e); }

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
  let _searchableSessions = [];
  function renderSearchBar(sessions) {
    // Always refresh the searchable list — the input's listener reads this,
    // so search stays current even after new sessions are imported.
    _searchableSessions = sessions;
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
      const filtered = Features.searchSessions(_searchableSessions, input.value);
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
              <div style="display:flex;gap:.4rem;margin-top:.6rem;font-size:.8rem">
                <button data-share="${s.id}" style="background:rgba(74,222,128,.15);border:none;color:#4ade80;padding:.3rem .6rem;border-radius:4px;cursor:pointer;flex:1">📤 Share</button>
                <button data-export="${s.id}" style="background:rgba(96,165,250,.15);border:none;color:#60a5fa;padding:.3rem .6rem;border-radius:4px;cursor:pointer;flex:1">📊 Export</button>
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

    // Share and export button handlers
    el.querySelectorAll('[data-share]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sessionId = btn.dataset.share;
        const session = await DB.getSession(sessionId);
        if (session) {
          const text = SessionSharing.shareText(session);
          SessionSharing.copyToClipboard(text);
        }
      });
    });

    el.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sessionId = btn.dataset.export;
        const session = await DB.getSession(sessionId);
        if (session) {
          SessionSharing.exportAsJSON([session]);
        }
      });
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
    // Gapping always uses the full session, so render it once per session
    // open instead of rebuilding its chart on every club-filter tap.
    renderGapping(session.shots);
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

  document.getElementById('showAnalyticsBtn')?.addEventListener('click', async () => {
    const sessions = await Store.getSessions();
    if (!sessions.length) { toast('No sessions to analyze'); return; }
    const metrics = AnalyticsHub.generateMetricsDashboard(sessions);
    if (!metrics) { toast('Unable to generate metrics'); return; }

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="analyticsModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:500px;width:100%;max-height:80vh;overflow-y:auto;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center">
            📊 Advanced Analytics
            <button onclick="document.getElementById('analyticsModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
          </div>
          <div style="display:grid;gap:1rem">
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Total Sessions</div>
              <div style="font-size:2rem;font-weight:800">${metrics.totalSessions}</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Total Shots</div>
              <div style="font-size:2rem;font-weight:800">${metrics.totalShots}</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Avg Carry Distance</div>
              <div style="font-size:2rem;font-weight:800">${metrics.avgCarry} yds</div>
              <div style="font-size:.9rem;color:var(--text-dim);margin-top:.5rem">Consistency: ${metrics.carryConsistency}%</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Ball Speed</div>
              <div style="font-size:1.5rem;font-weight:800">${metrics.ballSpeedAvg} mph avg</div>
              <div style="font-size:.9rem;color:var(--text-dim);margin-top:.5rem">Max: ${metrics.ballSpeedMax} mph</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Launch Angle</div>
              <div style="font-size:1.5rem;font-weight:800">${metrics.launchAngleAvg}°</div>
              <div style="font-size:.9rem;color:var(--text-dim);margin-top:.5rem">Range: ${metrics.launchAngleRange[0].toFixed(1)}° - ${metrics.launchAngleRange[1].toFixed(1)}°</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Practice Frequency</div>
              <div style="font-size:1.5rem;font-weight:800">${metrics.sessionFrequency}</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.3rem">Trend</div>
              <div style="font-size:1.1rem;font-weight:700;color:#4ade80">${metrics.improvementTrend}</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.6rem">Top Clubs</div>
              <div style="display:flex;flex-direction:column;gap:.4rem">
                ${metrics.topPerformers.map(c => `
                  <div style="display:flex;justify-content:space-between;padding:.4rem .6rem;background:rgba(0,0,0,.1);border-radius:4px">
                    <span>${c.club}</span>
                    <span style="color:#60a5fa;font-weight:600">${c.avgCarry} yds (${c.shots} shots)</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  });

  document.getElementById('showBenchmarksBtn')?.addEventListener('click', async () => {
    const sessions = await Store.getSessions();
    if (!sessions.length) { toast('No sessions to compare'); return; }
    const comparison = CommunityInsights.compareToommunity(sessions);
    if (!comparison) { toast('Unable to generate comparison'); return; }

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="benchmarkModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:500px;width:100%;max-height:80vh;overflow-y:auto;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:.5rem;display:flex;justify-content:space-between;align-items:center">
            🏆 Community Comparison
            <button onclick="document.getElementById('benchmarkModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
          </div>
          <div style="font-size:.9rem;color:var(--text-dim);margin-bottom:1.2rem">vs ${comparison.skillLevel.toUpperCase()} golfers</div>
          <div style="display:grid;gap:1rem">
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.6rem">Carry Distance</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:.6rem">
                <div><span style="color:var(--text-dim)">You:</span> <strong>${comparison.carry.user} yds</strong></div>
                <div><span style="color:var(--text-dim)">Avg:</span> <strong>${comparison.carry.community} yds</strong></div>
              </div>
              <div style="font-size:1rem;color:#4ade80;font-weight:600">${comparison.carry.percentile}</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.6rem">Consistency</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:.6rem">
                <div><span style="color:var(--text-dim)">You:</span> <strong>${comparison.consistency.user}%</strong></div>
                <div><span style="color:var(--text-dim)">Avg:</span> <strong>${comparison.consistency.community}%</strong></div>
              </div>
              <div style="font-size:1rem;color:#4ade80;font-weight:600">${comparison.consistency.percentile}</div>
            </div>
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.6rem">Form Score</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:.6rem">
                <div><span style="color:var(--text-dim)">You:</span> <strong>${comparison.formScore.user}/100</strong></div>
                <div><span style="color:var(--text-dim)">Avg:</span> <strong>${comparison.formScore.community}/100</strong></div>
              </div>
              <div style="font-size:1rem;color:#4ade80;font-weight:600">${comparison.formScore.percentile}</div>
            </div>
            <div style="background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);padding:1rem;border-radius:var(--radius-sm);margin-top:.5rem">
              <div style="font-size:.95rem;color:#4ade80"><strong>💡 Tip:</strong> Benchmarks are simulated. Real community data will be available soon!</div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  });

  document.getElementById('showLearningBtn')?.addEventListener('click', async () => {
    const sessions = await Store.getSessions();
    const path = LearningPath.generatePath(sessions);
    const tips = ContentLibrary.getContentFor('Consistency');

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="learningModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:550px;width:100%;max-height:90vh;overflow-y:auto;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:.5rem;display:flex;justify-content:space-between;align-items:center">
            📚 Learning Library
            <button onclick="document.getElementById('learningModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
          </div>
          ${path ? `
            <div style="margin-bottom:1.5rem">
              <div style="font-size:.9rem;color:var(--text-dim);margin-bottom:.6rem">Your Skill Level: <strong>${path.skillLevel.toUpperCase()}</strong></div>
              <div style="display:grid;gap:.8rem">
                ${path.modules.map((m, i) => `
                  <div style="padding:1rem;background:rgba(255,255,255,.05);border-radius:var(--radius-sm);border:1px solid rgba(255,255,255,.1);opacity:${m.status==='locked'?'0.5':'1'}">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:.4rem">
                      <div style="flex:1">
                        <div style="font-weight:600;margin-bottom:.2rem">${m.icon} ${m.title}</div>
                        <div style="font-size:.85rem;color:var(--text-dim)">${m.description}</div>
                      </div>
                      <div style="font-size:.75rem;background:${m.status==='in-progress'?'rgba(74,222,128,.2)':m.status==='recommended'?'rgba(251,146,60,.2)':'rgba(107,114,128,.2)'};color:${m.status==='in-progress'?'#4ade80':m.status==='recommended'?'#fb923c':'#9ca3af'};padding:.3rem .6rem;border-radius:3px;white-space:nowrap;margin-left:.5rem">${m.status}</div>
                    </div>
                    <div style="font-size:.8rem;color:var(--text-dim)">${m.lessons} lessons</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:1rem;margin-top:1rem">
            <div style="font-weight:600;margin-bottom:.8rem">💡 Recommended Content</div>
            <div style="display:grid;gap:.6rem">
              ${tips.slice(0, 3).map(t => `
                <div style="padding:.8rem;background:rgba(96,165,250,.1);border-left:3px solid #60a5fa;border-radius:4px">
                  <div style="font-weight:600;font-size:.95rem">${t.title}</div>
                  <div style="font-size:.8rem;color:var(--text-dim);margin-top:.3rem">${t.duration} • ${t.level}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  });

  document.getElementById('showClubAnalysisBtn')?.addEventListener('click', async () => {
    const sessions = await Store.getSessions();
    if (!sessions.length) { toast('No data to analyze'); return; }
    const clubs = ClubAnalyzer.compareClubs(sessions);
    if (!clubs.length) { toast('No club data'); return; }

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="clubModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:550px;width:100%;max-height:90vh;overflow-y:auto;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center">
            🏌️ Club Performance Analysis
            <button onclick="document.getElementById('clubModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
          </div>
          <div style="display:grid;gap:.8rem">
            ${clubs.map(c => `
              <div style="padding:1rem;background:rgba(255,255,255,.05);border-radius:var(--radius-sm);border-left:4px solid ${clubColor(c.club === clubLabel(c.club) ? Object.keys(CLUB_LABELS).find(k => CLUB_LABELS[k] === c.club) : c.club)}">
                <div style="font-weight:600;margin-bottom:.6rem">${c.club}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.6rem">
                  <div>
                    <div style="font-size:.8rem;color:var(--text-dim)">Avg Carry</div>
                    <div style="font-size:1.3rem;font-weight:800">${c.avgCarry} yds</div>
                  </div>
                  <div>
                    <div style="font-size:.8rem;color:var(--text-dim)">Shots</div>
                    <div style="font-size:1.3rem;font-weight:800">${c.shotCount}</div>
                  </div>
                  <div>
                    <div style="font-size:.8rem;color:var(--text-dim)">Consistency</div>
                    <div style="font-size:1.3rem;font-weight:800">${c.consistency}%</div>
                  </div>
                  <div>
                    <div style="font-size:.8rem;color:var(--text-dim)">Ball Speed</div>
                    <div style="font-size:1.3rem;font-weight:800">${c.avgBallSpeed} mph</div>
                  </div>
                </div>
                <div style="font-size:.9rem;color:${c.trend.startsWith('📈') ? '#4ade80' : c.trend.startsWith('📉') ? '#ef4444' : 'var(--text-dim)'};font-weight:600">${c.trend}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  });

  document.getElementById('showEfficiencyBtn')?.addEventListener('click', async () => {
    const sessions = await Store.getSessions();
    if (!sessions.length) { toast('No sessions yet'); return; }
    const efficiency = PracticeEfficiency.calculateEfficiency(sessions);
    if (!efficiency) { toast('Unable to calculate'); return; }

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="efficiencyModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:450px;width:100%;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center">
            ⚡ Practice Efficiency
            <button onclick="document.getElementById('efficiencyModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
          </div>
          <div style="display:grid;gap:1rem">
            <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-size:.85rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:.6rem">Rating</div>
              <div style="font-size:2rem;font-weight:800;color:#4ade80">${efficiency.efficiencyRating}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
              <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
                <div style="font-size:.8rem;color:var(--text-dim);margin-bottom:.3rem">Sessions (recent 5)</div>
                <div style="font-size:1.6rem;font-weight:800">${efficiency.recentSessions}</div>
              </div>
              <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
                <div style="font-size:.8rem;color:var(--text-dim);margin-bottom:.3rem">Total Shots</div>
                <div style="font-size:1.6rem;font-weight:800">${efficiency.totalShots}</div>
              </div>
              <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
                <div style="font-size:.8rem;color:var(--text-dim);margin-bottom:.3rem">Shots/Hour</div>
                <div style="font-size:1.6rem;font-weight:800">${efficiency.shotsPerHour}</div>
              </div>
              <div style="background:rgba(255,255,255,.05);padding:1rem;border-radius:var(--radius-sm)">
                <div style="font-size:.8rem;color:var(--text-dim);margin-bottom:.3rem">Avg Quality</div>
                <div style="font-size:1.6rem;font-weight:800">${efficiency.avgQuality}/100</div>
              </div>
            </div>
            <div style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);padding:1rem;border-radius:var(--radius-sm)">
              <div style="font-weight:600;margin-bottom:.4rem">💡 Recommendation</div>
              <div style="font-size:.95rem;color:var(--text)">${efficiency.recommendation}</div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
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
      if (e.key === '/' || e.key === '?') { e.preventDefault(); showKeyboardShortcuts(); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); Router.showYardages(); }
      if (e.key === 'g' || e.key === 'G') { e.preventDefault(); toast('👁️ Quick actions coming soon'); }
    }
  });

  function showKeyboardShortcuts() {
    const shortcuts = [
      { key: 'Ctrl+I', action: 'Import CSV' },
      { key: 'Ctrl+H', action: 'Home / Sessions' },
      { key: 'Ctrl+P', action: 'Progress' },
      { key: 'Ctrl+Y', action: 'Yardages' },
      { key: 'Ctrl+S', action: 'Yardages' },
      { key: 'Ctrl+?', action: 'Show this help' },
    ];

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="shortcutsModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:400px;width:100%;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center">
            ⌨️ Keyboard Shortcuts
            <button onclick="document.getElementById('shortcutsModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
          </div>
          <div style="display:grid;gap:.8rem">
            ${shortcuts.map(s => `
              <div style="display:flex;justify-content:space-between;padding:.6rem;background:rgba(255,255,255,.05);border-radius:var(--radius-sm)">
                <span style="font-family:monospace;font-weight:600;color:#60a5fa">${s.key}</span>
                <span style="color:var(--text-dim)">${s.action}</span>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:1.2rem;padding:.8rem;background:rgba(99,102,241,.1);border-radius:var(--radius-sm);font-size:.85rem;color:var(--text-dim)">
            Press <kbd style="background:rgba(0,0,0,.2);padding:.2rem .4rem;border-radius:3px;font-size:.8rem">Escape</kbd> to close this dialog
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Close on Escape
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        document.getElementById('shortcutsModal')?.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  // Show keyboard tips in console
  console.log('%cShotLab Keyboard Shortcuts', 'font-weight:bold;font-size:14px;color:#0b4d2e');
  console.log('Ctrl+I: Import | Ctrl+H: Home | Ctrl+P: Progress | Ctrl+Y: Yardages | Ctrl+?: Help');

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

  // Initialize accessibility enhancements
  try { AccessibilityEnhancements.init(); } catch(e){ console.error('accessibility',e); }

  // Initialize responsive UX enhancements
  try { ResponsiveEnhancements.enhanceMobileUX(); } catch(e){ console.error('responsive',e); }

  // Show welcome message with tips
  console.log('%cWelcome to ShotLab v3.0 🏌️', 'font-size:16px;font-weight:bold;color:#0b4d2e');
  console.log('%cPress Ctrl+? for keyboard shortcuts', 'font-size:12px;color:#496657');
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

// ════════════════════════════════════════════════════════════════
// SessionSharing — Share, export, and clipboard functions
// ════════════════════════════════════════════════════════════════
const SessionSharing = (() => {
  function shareText(session) {
    const snap = SessionSnapshot.create(session);
    return SessionSnapshot.toShareText(snap);
  }

  function copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => {
      toast('📋 Copied to clipboard!');
      return true;
    }).catch(() => {
      toast('Unable to copy. Try manual copy.');
      return false;
    });
  }

  function exportAsJSON(sessions) {
    const data = JSON.stringify(sessions, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shotlab-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('📥 Downloaded backup!');
  }

  function exportAsCSV(sessions) {
    let csv = 'Date,Club,Ball Speed,Smash,Launch,Spin,Carry,Total,Notes\n';
    sessions.forEach(s => {
      s.shots.forEach(sh => {
        csv += `"${formatDate(s.date)}","${clubLabel(sh.clubType)}",${sh.ballSpeed||''},${sh.smashFactor||''},${sh.launchAngle||''},${sh.spinRate||''},${sh.carryDistance||''},${sh.totalDistance||''},"${s.notes||''}"\n`;
      });
    });
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shotlab-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('📊 Exported to CSV!');
  }

  function createShareLink(session) {
    const snap = SessionSnapshot.create(session);
    const encoded = btoa(JSON.stringify(snap));
    return `${window.location.origin}?shared=${encoded}`;
  }

  return { shareText, copyToClipboard, exportAsJSON, exportAsCSV, createShareLink };
})();

// ════════════════════════════════════════════════════════════════
// DrillTracker — Track completed practice drills
// ════════════════════════════════════════════════════════════════
const DrillTracker = (() => {
  const storageKey = 'slDrillHistory';

  function getDrillHistory() {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : {};
  }

  function recordDrill(drillId, sessionId) {
    const history = getDrillHistory();
    if (!history[drillId]) history[drillId] = [];
    history[drillId].push({
      sessionId,
      date: new Date().toISOString(),
      completed: true,
    });
    localStorage.setItem(storageKey, JSON.stringify(history));
    return true;
  }

  function getDrillStats(drillId) {
    const history = getDrillHistory();
    const drills = history[drillId] || [];
    return {
      totalCompleted: drills.length,
      lastCompleted: drills.length ? new Date(drills[drills.length-1].date).toLocaleDateString() : 'Never',
      completionStreak: calculateStreak(drills),
    };
  }

  function calculateStreak(drills) {
    if (!drills.length) return 0;
    let streak = 0;
    const today = new Date();
    for (let i = drills.length - 1; i >= 0; i--) {
      const drillDate = new Date(drills[i].date);
      const daysDiff = Math.floor((today - drillDate) / (1000*60*60*24));
      if (daysDiff <= i + 1) streak++;
      else break;
    }
    return streak;
  }

  function getAllStats() {
    const history = getDrillHistory();
    const stats = {};
    Object.keys(history).forEach(drillId => {
      stats[drillId] = getDrillStats(drillId);
    });
    return stats;
  }

  return { recordDrill, getDrillStats, getAllStats, getDrillHistory };
})();

// ════════════════════════════════════════════════════════════════
// PersonalCoach — AI-style personalized coaching
// ════════════════════════════════════════════════════════════════
const PersonalCoach = (() => {
  function analyzeSessions(sessions) {
    if (!sessions.length) return null;

    const recent = sessions.slice(0, 5);
    const allShots = recent.flatMap(s => s.shots);
    const faults = FaultEngine.detectFaults(allShots);
    const topFault = faults[0];

    const coachingPlan = {
      greeting: getGreeting(),
      assessment: generateAssessment(recent),
      topFocus: topFault,
      tips: CoachingMode.getTips(topFault?.name),
      drillRecommendation: generateDrillRecommendation(topFault, recent),
      motivationalMessage: getMotivation(sessions),
      nextMilestone: calculateNextMilestone(sessions),
    };

    return coachingPlan;
  }

  function getGreeting() {
    const greetings = [
      '🎯 Ready to improve your game?',
      '⛳ Let\'s work on your consistency!',
      '🚀 Time to level up your swing.',
      '💪 Keep grinding — you\'re getting better!',
      '📈 Progress is the priority.',
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  function generateAssessment(recentSessions) {
    const shots = recentSessions.flatMap(s => s.shots);
    const consistency = Math.round(100 - stdDev(shots.map(s => s.carryDistance || 0)));
    const formScore = Math.round(avg(shots.map(ShotScorer.score), undefined) || 0);

    if (consistency > 85) return '🌟 Excellent consistency! Your repeatable swing is a strength.';
    if (consistency > 70) return '✅ Good consistency. One or two small tweaks could make a big difference.';
    if (consistency > 50) return '📊 Moderate. Focus on one fundamental at a time for breakthrough improvement.';
    return '🔧 High variability. Video your swing and identify one key pattern to fix.';
  }

  function generateDrillRecommendation(fault, sessions) {
    const clubsUsed = new Set(sessions.flatMap(s => s.shots.map(sh => sh.clubType)));
    const clubList = Array.from(clubsUsed).map(clubLabel).join(' & ');

    if (!fault) return `Practice with your ${clubList} to build consistency.`;

    const drills = {
      'Slice': 'Inside-out drill: Swing from 4 o\'clock to 10 o\'clock feeling.',
      'Hook': 'Outside-in feel: Exaggerate an out-to-in swing path.',
      'Thin': 'Tee drill: Hit tees on the ground, contact after the tee.',
      'Fat': 'Single-plane drill: Swing keeping your hands ahead at impact.',
    };

    return drills[fault.name] || `Work on ${fault.name.toLowerCase()} awareness with focused practice.`;
  }

  function getMotivation(sessions) {
    const grade = PerformanceGrade.calculateFullGrade(sessions);
    if (!grade) return 'Start by importing your first session!';

    const messages = {
      'A': '🏆 Top tier! You\'re mastering this. Push toward consistency at the highest level.',
      'B': '👏 Strong performance! You\'re in the zone. Maintain this trajectory.',
      'C': '💯 Good foundation. A few focused improvements will unlock your next level.',
      'D': '📈 You\'re building skills. Every session teaches you something.',
      'F': '🎯 Every pro started here. Focus on one thing and watch your improvement.',
    };

    return messages[grade.grade] || 'Keep practicing — progress takes time!';
  }

  function calculateNextMilestone(sessions) {
    const shotCount = sessions.flatMap(s => s.shots).length;
    const milestones = [100, 250, 500, 1000, 2500, 5000];
    const nextMilestone = milestones.find(m => m > shotCount);

    if (!nextMilestone) return { milestone: 10000, progress: 'You\'ve logged 5000+ shots! Legend status.' };

    const progress = Math.round((shotCount / nextMilestone) * 100);
    return {
      milestone: nextMilestone,
      current: shotCount,
      progress,
      message: `${nextMilestone} shots unlocks new insights!`,
    };
  }

  return { analyzeSessions };
})();

// ════════════════════════════════════════════════════════════════
// AnalyticsHub — Advanced metrics dashboard
// ════════════════════════════════════════════════════════════════
const AnalyticsHub = (() => {
  function generateMetricsDashboard(sessions) {
    if (!sessions.length) return null;

    const allShots = sessions.flatMap(s => s.shots);
    const carries = allShots.map(s => s.carryDistance || 0).filter(c => c > 0);
    const ballSpeeds = allShots.map(s => s.ballSpeed || 0).filter(b => b > 0);
    const launchAngles = allShots.map(s => s.launchAngle || 0);

    return {
      totalSessions: sessions.length,
      totalShots: allShots.length,
      avgCarry: fmt(avg(allShots, 'carryDistance'), 0),
      carryConsistency: Math.round(100 - stdDev(carries)),
      ballSpeedAvg: fmt(avg(allShots, 'ballSpeed'), 1),
      ballSpeedMax: Math.max(...ballSpeeds),
      launchAngleAvg: fmt(avg(allShots, 'launchAngle'), 1),
      launchAngleRange: [Math.min(...launchAngles), Math.max(...launchAngles)],
      sessionFrequency: calculateFrequency(sessions),
      improvementTrend: calculateTrend(sessions),
      topPerformers: getTopClubs(allShots),
    };
  }

  function calculateFrequency(sessions) {
    if (sessions.length < 2) return 'Starting';
    const oldest = new Date(sessions[sessions.length-1].date);
    const newest = new Date(sessions[0].date);
    const days = Math.ceil((newest - oldest) / (1000*60*60*24));
    const sessionsPerWeek = (sessions.length / days * 7).toFixed(1);
    return `${sessionsPerWeek} sessions/week`;
  }

  function calculateTrend(sessions) {
    if (sessions.length < 3) return 'Insufficient data';
    const first3 = sessions.slice(-3).flatMap(s => s.shots).map(ShotScorer.score).filter(x=>x!==null);
    const last3 = sessions.slice(0, 3).flatMap(s => s.shots).map(ShotScorer.score).filter(x=>x!==null);

    if (!first3.length || !last3.length) return 'Insufficient data';

    const firstAvg = first3.reduce((a,b)=>a+b,0) / first3.length;
    const lastAvg = last3.reduce((a,b)=>a+b,0) / last3.length;
    const change = lastAvg - firstAvg;

    if (change > 5) return '📈 Strong improvement';
    if (change > 0) return '📊 Slight improvement';
    if (change < -5) return '📉 Needs attention';
    return '→ Staying consistent';
  }

  function getTopClubs(shots) {
    const clubStats = {};
    shots.forEach(s => {
      if (!clubStats[s.clubType]) {
        clubStats[s.clubType] = { shots: 0, totalCarry: 0 };
      }
      clubStats[s.clubType].shots++;
      clubStats[s.clubType].totalCarry += s.carryDistance || 0;
    });

    return Object.entries(clubStats)
      .map(([club, stats]) => ({
        club: clubLabel(club),
        shots: stats.shots,
        avgCarry: Math.round(stats.totalCarry / stats.shots),
      }))
      .sort((a, b) => b.shots - a.shots)
      .slice(0, 5);
  }

  return { generateMetricsDashboard };
})();

// ════════════════════════════════════════════════════════════════
// ContentLibrary — Video/article references for improvement
// ════════════════════════════════════════════════════════════════
const ContentLibrary = (() => {
  const contents = {
    'Slice': [
      { title: 'Fix Your Slice Forever', duration: '12 min', type: 'video', level: 'beginner' },
      { title: 'Inside-Out Swing Path Drill', duration: '8 min', type: 'video', level: 'intermediate' },
      { title: 'Grip Pressure Fundamentals', duration: '6 min', type: 'video', level: 'beginner' },
    ],
    'Hook': [
      { title: 'Stop the Hook: Complete Guide', duration: '15 min', type: 'video', level: 'beginner' },
      { title: 'Club Face Control Drills', duration: '10 min', type: 'video', level: 'intermediate' },
      { title: 'Stance & Alignment Secrets', duration: '7 min', type: 'video', level: 'beginner' },
    ],
    'Consistency': [
      { title: 'The Key to Repeatable Swings', duration: '14 min', type: 'video', level: 'all' },
      { title: 'Tempo Training for Better Control', duration: '9 min', type: 'video', level: 'intermediate' },
      { title: 'Pre-Shot Routine Mastery', duration: '5 min', type: 'video', level: 'beginner' },
    ],
    'Distance': [
      { title: 'Unlock Hidden Distance', duration: '13 min', type: 'video', level: 'all' },
      { title: 'Smash Factor Optimization', duration: '8 min', type: 'video', level: 'intermediate' },
      { title: 'Lag & Release Secrets', duration: '11 min', type: 'video', level: 'intermediate' },
    ],
  };

  function getContentFor(topic) {
    return contents[topic] || contents['Consistency'] || [];
  }

  function getByLevel(level) {
    const allContent = Object.values(contents).flat();
    return allContent.filter(c => c.level === 'all' || c.level === level);
  }

  return { getContentFor, getByLevel };
})();

// ════════════════════════════════════════════════════════════════
// CommunityInsights — Simulated community benchmarking
// ════════════════════════════════════════════════════════════════
const CommunityInsights = (() => {
  // Simulated benchmark data (would be real in production)
  const benchmarks = {
    avgCarry: { all: 160, bySkill: { beginner: 140, intermediate: 165, advanced: 180 } },
    consistency: { all: 72, bySkill: { beginner: 65, intermediate: 75, advanced: 85 } },
    formScore: { all: 68, bySkill: { beginner: 60, intermediate: 70, advanced: 80 } },
  };

  function estimateSkillLevel(sessions) {
    if (!sessions.length) return 'beginner';
    const grade = PerformanceGrade.calculateFullGrade(sessions);
    if (!grade) return 'beginner';
    if (grade.overall >= 80) return 'advanced';
    if (grade.overall >= 70) return 'intermediate';
    return 'beginner';
  }

  function compareToommunity(sessions) {
    const skillLevel = estimateSkillLevel(sessions);
    const metrics = AnalyticsHub.generateMetricsDashboard(sessions);

    if (!metrics) return null;

    const userCarry = parseInt(metrics.avgCarry);
    const userConsistency = metrics.carryConsistency;
    const userForm = PerformanceGrade.calculateFullGrade(sessions)?.overall || 0;

    return {
      skillLevel,
      carry: {
        user: userCarry,
        community: benchmarks.avgCarry.bySkill[skillLevel],
        percentile: userCarry > benchmarks.avgCarry.bySkill[skillLevel] ? '↑ Above average' : '← Below average',
      },
      consistency: {
        user: userConsistency,
        community: benchmarks.consistency.bySkill[skillLevel],
        percentile: userConsistency > benchmarks.consistency.bySkill[skillLevel] ? '↑ More consistent' : '← Work on it',
      },
      formScore: {
        user: userForm,
        community: benchmarks.formScore.bySkill[skillLevel],
        percentile: userForm > benchmarks.formScore.bySkill[skillLevel] ? '↑ Better form' : '← Keep practicing',
      },
    };
  }

  return { compareToommunity, estimateSkillLevel };
})();

// ════════════════════════════════════════════════════════════════
// LearningPath — Personalized improvement curriculum
// ════════════════════════════════════════════════════════════════
const LearningPath = (() => {
  function generatePath(sessions) {
    if (!sessions.length) return null;

    const faults = FaultEngine.detectFaults(sessions.flatMap(s => s.shots));
    const topFaults = faults.slice(0, 3);
    const skillLevel = CommunityInsights.estimateSkillLevel(sessions);

    const modules = [];

    if (skillLevel === 'beginner') {
      modules.push({
        level: 1,
        title: '⛳ Fundamentals',
        description: 'Master grip, stance, and alignment',
        lessons: 6,
        icon: '🎯',
        status: 'in-progress',
      });
      modules.push({
        level: 2,
        title: '🔄 The Swing',
        description: 'Build a repeatable swing motion',
        lessons: 8,
        icon: '🔄',
        status: 'locked',
      });
    } else if (skillLevel === 'intermediate') {
      modules.push({
        level: 1,
        title: '⚡ Ball Striking',
        description: 'Improve contact consistency',
        lessons: 7,
        icon: '⚡',
        status: 'in-progress',
      });
      modules.push({
        level: 2,
        title: '📊 Swing Patterns',
        description: 'Understand your swing characteristics',
        lessons: 5,
        icon: '📊',
        status: 'in-progress',
      });
    } else {
      modules.push({
        level: 1,
        title: '🎨 Shot Shaping',
        description: 'Master curve and trajectory control',
        lessons: 6,
        icon: '🎨',
        status: 'in-progress',
      });
      modules.push({
        level: 2,
        title: '💪 Swing Speed',
        description: 'Optimize tempo and acceleration',
        lessons: 5,
        icon: '💪',
        status: 'available',
      });
    }

    const faultCourses = topFaults.map(f => ({
      level: 'priority',
      title: `Fix ${f.name}`,
      description: `Target your #${faults.indexOf(f)+1} fault`,
      lessons: 4,
      icon: f.icon,
      status: 'recommended',
    }));

    return {
      skillLevel,
      modules: [...modules, ...faultCourses],
      nextUp: modules.find(m => m.status === 'in-progress') || modules[0],
    };
  }

  return { generatePath };
})();

// ════════════════════════════════════════════════════════════════
// SessionNotes — Rich journaling and reflections
// ════════════════════════════════════════════════════════════════
const SessionNotes = (() => {
  const storageKey = 'slSessionNotes';

  function saveNotes(sessionId, notes, reflection) {
    const store = JSON.parse(localStorage.getItem(storageKey) || '{}');
    store[sessionId] = {
      notes,
      reflection,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey, JSON.stringify(store));
    return true;
  }

  function getNotes(sessionId) {
    const store = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return store[sessionId] || null;
  }

  function getAllNotes() {
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  }

  function generatePrompts() {
    return [
      'What went well today?',
      'What was the biggest challenge?',
      'Which fault showed up the most?',
      'What will you work on next time?',
      'How did your consistency compare to last session?',
      'Did you feel fatigued? When?',
      'What club surprised you today?',
    ];
  }

  return { saveNotes, getNotes, getAllNotes, generatePrompts };
})();

// ════════════════════════════════════════════════════════════════
// PerformanceAlerts — Pro-active notifications
// ════════════════════════════════════════════════════════════════
const PerformanceAlerts = (() => {
  function generateAlerts(sessions) {
    const alerts = [];

    if (!sessions.length) return alerts;

    const recent = sessions.slice(0, 3);
    const allShots = recent.flatMap(s => s.shots);
    const faults = FaultEngine.detectFaults(allShots);

    // Consistency alert
    const carries = allShots.map(s => s.carryDistance || 0).filter(c => c > 0);
    const consistency = Math.round(100 - stdDev(carries));
    if (consistency < 60) {
      alerts.push({
        icon: '⚠️',
        severity: 'high',
        title: 'Consistency Alert',
        message: `Low carry distance consistency (${consistency}%). Focus on repeatable swing.',`,
      });
    }

    // Fault escalation
    if (faults[0]?.severity === 'high') {
      alerts.push({
        icon: '🔴',
        severity: 'high',
        title: faults[0].name,
        message: `${faults[0].name} detected in ${Math.round(faults[0].pct * 100)}% of recent shots. Priority fix.`,
      });
    }

    // Streak alert
    const st = Features.streak(sessions);
    if (st.current > 3 && st.current % 5 === 0) {
      alerts.push({
        icon: '🔥',
        severity: 'info',
        title: `Streak Milestone!`,
        message: `${st.current} day streak! Keep the momentum going.`,
      });
    }

    // Recovery suggestion
    if (sessions[0] && new Date() - new Date(sessions[0].date) > 7*24*60*60*1000) {
      alerts.push({
        icon: '📅',
        severity: 'info',
        title: 'Time to practice',
        message: `It's been ${Math.floor((new Date() - new Date(sessions[0].date)) / (24*60*60*1000))} days. Schedule a session!`,
      });
    }

    return alerts;
  }

  return { generateAlerts };
})();

// ════════════════════════════════════════════════════════════════
// PerformanceTimeline — Historical trend visualization
// ════════════════════════════════════════════════════════════════
const PerformanceTimeline = (() => {
  function generateTimeline(sessions) {
    if (!sessions.length) return [];

    return sessions.map((s, idx) => {
      const scores = s.shots.map(ShotScorer.score).filter(x=>x!==null);
      const formScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
      const grade = ShotScorer.grade(formScore);
      const shotCount = s.shots.length;
      const avgCarry = Math.round(avg(s.shots, 'carryDistance') || 0);

      return {
        date: s.date,
        formattedDate: formatDate(s.date),
        formScore,
        grade: grade.letter,
        shotCount,
        avgCarry,
        clubs: sortedClubs(s.shots).length,
        improvement: idx > 0 ? {
          formDelta: formScore - (sessions[idx-1].shots.map(ShotScorer.score).filter(x=>x!==null).reduce((a,b)=>a+b,0) / sessions[idx-1].shots.map(ShotScorer.score).filter(x=>x!==null).length || 0),
          carrydelta: avgCarry - Math.round(avg(sessions[idx-1].shots, 'carryDistance') || 0),
        } : null,
      };
    });
  }

  return { generateTimeline };
})();

// ════════════════════════════════════════════════════════════════
// UICustomizer — Store and apply UI preferences
// ════════════════════════════════════════════════════════════════
const UICustomizer = (() => {
  function getPreferences() {
    return JSON.parse(localStorage.getItem('slUIPrefs') || '{}');
  }

  function setPreferences(prefs) {
    const current = getPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem('slUIPrefs', JSON.stringify(updated));
    applyPreferences(updated);
  }

  function applyPreferences(prefs) {
    if (prefs.compactMode) document.body.style.setProperty('--spacing-scale', '0.85');
    if (prefs.largeText) document.body.style.setProperty('--text-scale', '1.1');
    if (prefs.reducedAnimations) document.body.style.setProperty('--animation-duration', '0.05s');
  }

  function resetPreferences() {
    localStorage.removeItem('slUIPrefs');
    applyPreferences({});
  }

  return { getPreferences, setPreferences, applyPreferences, resetPreferences };
})();

// ════════════════════════════════════════════════════════════════
// WeeklySummary — Generate weekly practice reports
// ════════════════════════════════════════════════════════════════
const WeeklySummary = (() => {
  function generateReport(sessions) {
    if (!sessions.length) return null;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekSessions = sessions.filter(s => new Date(s.date) >= oneWeekAgo);

    if (!weekSessions.length) return null;

    const allShots = weekSessions.flatMap(s => s.shots);
    const scores = allShots.map(ShotScorer.score).filter(x=>x!==null);
    const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    const grade = ShotScorer.grade(avgScore);

    const faults = FaultEngine.detectFaults(allShots);
    const clubs = sortedClubs(allShots);
    const bestSession = weekSessions.reduce((best, s) => {
      const sScores = s.shots.map(ShotScorer.score).filter(x=>x!==null);
      const sAvg = sScores.length ? sScores.reduce((a,b)=>a+b,0)/sScores.length : 0;
      const bScores = best.shots.map(ShotScorer.score).filter(x=>x!==null);
      const bAvg = bScores.length ? bScores.reduce((a,b)=>a+b,0)/bScores.length : 0;
      return sAvg > bAvg ? s : best;
    });

    return {
      weekStart: formatDate(new Date(new Date().getTime() - 7*24*60*60*1000)),
      weekEnd: formatDate(new Date()),
      sessionCount: weekSessions.length,
      totalShots: allShots.length,
      avgFormScore: avgScore,
      grade: grade.letter,
      topFault: faults[0]?.name || 'None',
      clubCount: clubs.length,
      bestSession: {
        date: formatDate(bestSession.date),
        shots: bestSession.shots.length,
      },
      summary: `${weekSessions.length} sessions · ${allShots.length} shots · Grade: ${grade.letter}`,
    };
  }

  function formatAsText(report) {
    if (!report) return 'No practice this week. Let\'s get started!';
    return `📊 Week in Review\n\n` +
      `Sessions: ${report.sessionCount}\n` +
      `Total Shots: ${report.totalShots}\n` +
      `Grade: ${report.grade}\n` +
      `Top Focus: ${report.topFault}\n` +
      `Clubs Worked: ${report.clubCount}\n\n` +
      `Keep grinding! 🎯`;
  }

  return { generateReport, formatAsText };
})();

// ════════════════════════════════════════════════════════════════
// AdvancedFilters — Complex session filtering
// ════════════════════════════════════════════════════════════════
const AdvancedFilters = (() => {
  function filterSessions(sessions, criteria) {
    return sessions.filter(s => {
      // Filter by date range
      if (criteria.dateFrom) {
        const sDate = new Date(s.date);
        if (sDate < new Date(criteria.dateFrom)) return false;
      }
      if (criteria.dateTo) {
        const sDate = new Date(s.date);
        if (sDate > new Date(criteria.dateTo)) return false;
      }

      // Filter by clubs
      if (criteria.clubs && criteria.clubs.length) {
        const clubsInSession = new Set(s.shots.map(sh => sh.clubType));
        const hasAllClubs = criteria.clubs.every(c => clubsInSession.has(c));
        if (!hasAllClubs) return false;
      }

      // Filter by shot count
      if (criteria.minShots && s.shots.length < criteria.minShots) return false;
      if (criteria.maxShots && s.shots.length > criteria.maxShots) return false;

      // Filter by form score
      if (criteria.minScore || criteria.maxScore) {
        const scores = s.shots.map(ShotScorer.score).filter(x=>x!==null);
        const avgScore = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
        if (criteria.minScore && avgScore < criteria.minScore) return false;
        if (criteria.maxScore && avgScore > criteria.maxScore) return false;
      }

      // Filter by faults
      if (criteria.hasFault) {
        const faults = FaultEngine.detectFaults(s.shots);
        const hasFault = faults.some(f => f.name === criteria.hasFault);
        if (!hasFault) return false;
      }

      return true;
    });
  }

  return { filterSessions };
})();

// ════════════════════════════════════════════════════════════════
// QuickActions — Rapid-access common operations
// ════════════════════════════════════════════════════════════════
const QuickActions = (() => {
  const actions = {
    'share-last': { label: 'Share last session', icon: '📤', action: async () => {
      const sessions = await Store.getSessions();
      if (sessions.length) {
        const text = SessionSharing.shareText(sessions[0]);
        SessionSharing.copyToClipboard(text);
      }
    }},
    'export-all': { label: 'Export all data', icon: '📊', action: async () => {
      const sessions = await Store.getSessions();
      SessionSharing.exportAsJSON(sessions);
    }},
    'view-grade': { label: 'View your grade', icon: '🏆', action: async () => {
      const sessions = await Store.getSessions();
      const grade = PerformanceGrade.calculateFullGrade(sessions);
      if (grade) toast(`Your Grade: ${grade.grade} (${grade.overall}/100)`);
      else toast('No data yet. Import a session!');
    }},
    'see-insights': { label: 'Generate insights', icon: '💡', action: async () => {
      const sessions = await Store.getSessions();
      const insights = InsightEngine.generateInsights(sessions);
      if (insights.length) {
        const text = insights.map(i => `${i.icon} ${i.text}`).join('\n');
        toast(text.substring(0, 100) + '...');
      }
    }},
  };

  function getActions() {
    return Object.entries(actions).map(([id, action]) => ({ id, ...action }));
  }

  function executeAction(actionId) {
    const action = actions[actionId];
    if (action) action.action();
  }

  return { getActions, executeAction };
})();

// ════════════════════════════════════════════════════════════════
// ResponsiveEnhancements — Mobile-first UX optimizations
// ════════════════════════════════════════════════════════════════
const ResponsiveEnhancements = (() => {
  function enhanceMobileUX() {
    // Add swipe support for session cards
    let touchStartX = 0;
    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 100) {
        const card = e.target.closest('.session-card');
        if (card && diff > 0) {
          // Swiped left — show more actions
          card.style.transform = 'translateX(-20px)';
          setTimeout(() => card.style.transform = '', 300);
        }
      }
    }, { passive: true });
  }

  function getViewportSize() {
    return {
      isPhone: window.innerWidth < 480,
      isTablet: window.innerWidth >= 480 && window.innerWidth < 1024,
      isDesktop: window.innerWidth >= 1024,
    };
  }

  function addOrientationListener(callback) {
    window.addEventListener('orientationchange', callback);
  }

  return { enhanceMobileUX, getViewportSize, addOrientationListener };
})();

// ════════════════════════════════════════════════════════════════
// ClubAnalyzer — Deep-dive club-by-club performance
// ════════════════════════════════════════════════════════════════
const ClubAnalyzer = (() => {
  function analyzeClub(shots, clubType) {
    const clubShots = shots.filter(s => s.clubType === clubType);
    if (!clubShots.length) return null;

    const carries = clubShots.map(s => s.carryDistance || 0).filter(c => c > 0);
    const ballSpeeds = clubShots.map(s => s.ballSpeed || 0).filter(b => b > 0);

    const analysis = {
      club: clubLabel(clubType),
      shotCount: clubShots.length,
      avgCarry: carries.length ? Math.round(carries.reduce((a,b)=>a+b,0)/carries.length) : 0,
      bestCarry: Math.max(...carries, 0),
      worstCarry: Math.min(...carries, 1000),
      carryRange: Math.max(...carries, 0) - Math.min(...carries, 1000),
      consistency: Math.round(100 - stdDev(carries)),
      avgBallSpeed: ballSpeeds.length ? fmt(ballSpeeds.reduce((a,b)=>a+b,0)/ballSpeeds.length, 1) : '—',
      maxBallSpeed: Math.max(...ballSpeeds, 0),
      gapToNext: null, // filled in by Gap Engine
      gapToPrev: null,
      trend: calculateClubTrend(clubShots),
    };

    return analysis;
  }

  function calculateClubTrend(clubShots) {
    if (clubShots.length < 3) return '→ Insufficient data';
    const recent = clubShots.slice(0, 3).map(s => s.carryDistance || 0).filter(c => c > 0);
    const older = clubShots.slice(3, 6).map(s => s.carryDistance || 0).filter(c => c > 0);

    if (!recent.length || !older.length) return '→ Insufficient data';

    const recentAvg = recent.reduce((a,b)=>a+b,0)/recent.length;
    const olderAvg = older.reduce((a,b)=>a+b,0)/older.length;
    const change = recentAvg - olderAvg;

    if (change > 3) return '📈 Improving';
    if (change < -3) return '📉 Declining';
    return '→ Stable';
  }

  function compareClubs(sessions) {
    const allShots = sessions.flatMap(s => s.shots);
    const clubs = sortedClubs(allShots);
    return clubs.map(c => analyzeClub(allShots, c)).filter(Boolean);
  }

  return { analyzeClub, compareClubs };
})();

// ════════════════════════════════════════════════════════════════
// FormQualityTimeline — Visual progression of swing quality
// ════════════════════════════════════════════════════════════════
const FormQualityTimeline = (() => {
  function buildTimeline(sessions) {
    if (!sessions.length) return [];

    return sessions.map((s, idx) => {
      const scores = s.shots.map(ShotScorer.score).filter(x=>x!==null);
      const formScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
      const grade = ShotScorer.grade(formScore);
      const faults = FaultEngine.detectFaults(s.shots);

      return {
        date: formatDate(s.date),
        dayIndex: idx,
        formScore,
        grade: grade.letter,
        color: grade.color,
        faults: faults.length,
        topFault: faults[0]?.name || null,
        shotCount: s.shots.length,
      };
    });
  }

  function getVisualization(sessions) {
    const timeline = buildTimeline(sessions);
    if (!timeline.length) return null;

    const maxScore = Math.max(...timeline.map(t => t.formScore), 80);
    const minScore = Math.min(...timeline.map(t => t.formScore), 40);
    const range = maxScore - minScore || 1;

    return timeline.map(t => {
      const normalized = (t.formScore - minScore) / range;
      return {
        ...t,
        barHeight: Math.round(normalized * 100),
      };
    });
  }

  return { buildTimeline, getVisualization };
})();

// ════════════════════════════════════════════════════════════════
// PracticeEfficiency — Calculate quality vs quantity metrics
// ════════════════════════════════════════════════════════════════
const PracticeEfficiency = (() => {
  function calculateEfficiency(sessions) {
    if (!sessions.length) return null;

    const recent = sessions.slice(0, 5);
    const allShots = recent.flatMap(s => s.shots);
    const totalTime = recent.length * 1; // assume 1 hour per session

    const scores = allShots.map(ShotScorer.score).filter(x=>x!==null);
    const qualityScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    const shotCount = allShots.length;
    const efficiencyRatio = Math.round((qualityScore / 100) * (shotCount / (totalTime * 60)));

    return {
      recentSessions: recent.length,
      totalShots: shotCount,
      avgQuality: qualityScore,
      hoursSpent: totalTime,
      shotsPerHour: Math.round(shotCount / totalTime),
      qualityPerHour: Math.round((qualityScore * shotCount) / (totalTime * 100)),
      efficiencyRating: efficiencyRatio > 80 ? 'Excellent' : efficiencyRatio > 60 ? 'Good' : efficiencyRatio > 40 ? 'Fair' : 'Low',
      recommendation: generateEfficiencyRecommendation(efficiencyRatio, shotCount, qualityScore),
    };
  }

  function generateEfficiencyRecommendation(ratio, shotCount, quality) {
    if (ratio > 80) return '🎯 Great focus! Keep up the intentional practice.';
    if (shotCount > 500 && quality < 60) return '📈 Try fewer, more focused shots. Quality > Quantity.';
    if (quality > 80 && shotCount < 200) return '💪 You\'re doing well! Add more volume to solidify skills.';
    return '⚡ Mix it up: balance quality feedback with practice volume.';
  }

  return { calculateEfficiency };
})();

// ════════════════════════════════════════════════════════════════
// GapAnalysis — Understand club gapping and distances
// ════════════════════════════════════════════════════════════════
const GapAnalysis = (() => {
  function analyzeGaps(sessions) {
    const allShots = sessions.flatMap(s => s.shots);
    const clubs = sortedClubs(allShots);

    const clubData = clubs.map(c => {
      const clubShots = allShots.filter(s => s.clubType === c);
      const carries = clubShots.map(s => s.carryDistance || 0).filter(c => c > 0);
      return {
        club: c,
        label: clubLabel(c),
        avgCarry: carries.length ? Math.round(carries.reduce((a,b)=>a+b,0)/carries.length) : 0,
        count: clubShots.length,
      };
    }).filter(c => c.count > 0);

    // Calculate gaps
    const gaps = [];
    for (let i = 0; i < clubData.length - 1; i++) {
      const gap = clubData[i].avgCarry - clubData[i+1].avgCarry;
      gaps.push({
        fromClub: clubData[i].label,
        toClub: clubData[i+1].label,
        gap: gap,
        status: gap < 5 ? '⚠️ Small gap' : gap > 15 ? '⚠️ Large gap' : '✓ Good gap',
      });
    }

    return {
      clubData,
      gaps,
      consistency: calculateGapConsistency(gaps),
    };
  }

  function calculateGapConsistency(gaps) {
    if (!gaps.length) return 'Insufficient data';
    const gapValues = gaps.map(g => g.gap).filter(g => g > 0);
    const avgGap = gapValues.reduce((a,b)=>a+b,0) / gapValues.length;
    const variance = Math.sqrt(gapValues.map(g => (g-avgGap)**2).reduce((a,b)=>a+b,0) / gapValues.length);

    if (variance < 3) return 'Excellent — consistent gaps';
    if (variance < 6) return 'Good — mostly consistent';
    return 'Needs work — inconsistent gaps';
  }

  return { analyzeGaps };
})();

// ════════════════════════════════════════════════════════════════
// SessionComparison — Side-by-side session metrics
// ════════════════════════════════════════════════════════════════
const SessionComparison = (() => {
  function compare(sessionA, sessionB) {
    const getMetrics = (s) => {
      const scores = s.shots.map(ShotScorer.score).filter(x=>x!==null);
      const avgScore = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
      const carries = s.shots.map(s => s.carryDistance || 0).filter(c => c > 0);
      return {
        date: formatDate(s.date),
        shotCount: s.shots.length,
        formScore: Math.round(avgScore),
        grade: ShotScorer.grade(avgScore).letter,
        avgCarry: Math.round(avg(s.shots, 'carryDistance') || 0),
        consistency: Math.round(100 - stdDev(carries)),
        avgBallSpeed: fmt(avg(s.shots, 'ballSpeed'), 1),
        faultCount: FaultEngine.detectFaults(s.shots).length,
      };
    };

    const metricsA = getMetrics(sessionA);
    const metricsB = getMetrics(sessionB);

    const comparison = {
      sessionA: metricsA,
      sessionB: metricsB,
      deltas: {
        formScore: metricsB.formScore - metricsA.formScore,
        avgCarry: metricsB.avgCarry - metricsA.avgCarry,
        consistency: metricsB.consistency - metricsA.consistency,
        faults: metricsB.faultCount - metricsA.faultCount,
      },
      verdict: generateComparisonVerdict(metricsA, metricsB),
    };

    return comparison;
  }

  function generateComparisonVerdict(a, b) {
    const improvements = [];
    if (b.formScore > a.formScore) improvements.push('Form improved 📈');
    if (b.avgCarry > a.avgCarry) improvements.push('Distance increased 💪');
    if (b.consistency > a.consistency) improvements.push('Consistency improved ✓');
    if (b.faultCount < a.faultCount) improvements.push('Fewer faults 🎯');

    if (!improvements.length) return 'Work to do — focus on one area';
    return improvements.join(' · ');
  }

  return { compare };
})();

// ════════════════════════════════════════════════════════════════
// EnhancedMetricsWidget — Beautiful stats display
// ════════════════════════════════════════════════════════════════
const EnhancedMetricsWidget = (() => {
  function renderMiniStats(sessions) {
    if (!sessions.length) return null;

    const allShots = sessions.flatMap(s => s.shots);
    const scores = allShots.map(ShotScorer.score).filter(x=>x!==null);
    const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    const grade = ShotScorer.grade(avgScore);

    const carries = allShots.map(s => s.carryDistance || 0).filter(c => c > 0);
    const consistency = Math.round(100 - stdDev(carries));
    const st = Features.streak(sessions);

    return {
      grade: grade.letter,
      score: avgScore,
      carry: Math.round(avg(allShots, 'carryDistance') || 0),
      consistency,
      sessions: sessions.length,
      shots: allShots.length,
      streak: st.current,
      color: grade.color,
    };
  }

  function renderWidget(stats) {
    if (!stats) return '';
    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:1.2rem">
        <div style="padding:1rem;background:rgba(${parseInt(stats.color.slice(1,3),16)},${parseInt(stats.color.slice(3,5),16)},${parseInt(stats.color.slice(5,7),16)},.1);border-radius:var(--radius-sm);text-align:center">
          <div style="font-size:2.5rem;font-weight:800;color:${stats.color}">${stats.grade}</div>
          <div style="font-size:.75rem;color:var(--text-dim);margin-top:.3rem">FORM GRADE</div>
        </div>
        <div style="padding:1rem;background:rgba(74,222,128,.1);border-radius:var(--radius-sm);text-align:center">
          <div style="font-size:2.5rem;font-weight:800;color:#4ade80">${stats.consistency}%</div>
          <div style="font-size:.75rem;color:var(--text-dim);margin-top:.3rem">CONSISTENCY</div>
        </div>
        <div style="padding:1rem;background:rgba(251,146,60,.1);border-radius:var(--radius-sm);text-align:center">
          <div style="font-size:2rem;font-weight:800;color:#fb923c">🔥 ${stats.streak}</div>
          <div style="font-size:.75rem;color:var(--text-dim);margin-top:.3rem">DAY STREAK</div>
        </div>
      </div>`;
  }

  return { renderMiniStats, renderWidget };
})();

// ════════════════════════════════════════════════════════════════
// NotificationCenter — Smart alerts and messages
// ════════════════════════════════════════════════════════════════
const NotificationCenter = (() => {
  const notifications = [];

  function addNotification(type, message, duration = 4000) {
    const id = Math.random().toString(36).slice(2);
    notifications.push({ id, type, message, time: Date.now() });

    const html = `
      <div id="notif-${id}" style="animation:slideUp .3s ease-out;padding:1rem;background:${
        type === 'success' ? 'rgba(34,197,94,.9)' :
        type === 'error' ? 'rgba(239,68,68,.9)' :
        type === 'info' ? 'rgba(59,130,246,.9)' : 'rgba(168,85,247,.9)'
      };color:#fff;border-radius:var(--radius-sm);margin-bottom:.5rem;font-size:.95rem;display:flex;justify-content:space-between;align-items:center">
        <span>${message}</span>
        <button onclick="document.getElementById('notif-${id}').remove()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1rem">✕</button>
      </div>`;

    const container = document.getElementById('notificationsContainer') || (() => {
      const cont = document.createElement('div');
      cont.id = 'notificationsContainer';
      cont.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9998;max-width:400px;max-height:500px;overflow-y:auto';
      document.body.appendChild(cont);
      return cont;
    })();

    container.insertAdjacentHTML('beforeend', html);

    if (duration) {
      setTimeout(() => {
        document.getElementById(`notif-${id}`)?.remove();
      }, duration);
    }
  }

  return { addNotification };
})();

// ════════════════════════════════════════════════════════════════
// AccessibilityEnhancements — WCAG 2.1 AA compliance
// ════════════════════════════════════════════════════════════════
const AccessibilityEnhancements = (() => {
  function init() {
    // Ensure all buttons have proper ARIA labels
    document.querySelectorAll('button:not([aria-label])').forEach(btn => {
      const text = btn.textContent?.trim();
      if (text) btn.setAttribute('aria-label', text);
    });

    // Add focus styles
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-focus');
      }
    });

    document.addEventListener('click', () => {
      document.body.classList.remove('keyboard-focus');
    });

    // High contrast mode support
    if (window.matchMedia('(prefers-contrast: more)').matches) {
      document.documentElement.style.setProperty('--contrast', '1.2');
    }

    // Reduced motion support
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.setProperty('--animation-duration', '0.01s');
    }
  }

  return { init };
})();

// ════════════════════════════════════════════════════════════════
// PerformanceOptimizations — Keep the app fast
// ════════════════════════════════════════════════════════════════
const PerformanceOptimizations = (() => {
  function lazyLoadImages() {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  function memoize(func) {
    const cache = new Map();
    return (...args) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = func(...args);
      cache.set(key, result);
      return result;
    };
  }

  return { lazyLoadImages, debounce, memoize };
})();

// ════════════════════════════════════════════════════════════════
// DocumentationCenter — In-app help and guides
// ════════════════════════════════════════════════════════════════
const DocumentationCenter = (() => {
  const docs = {
    'getting-started': {
      title: '🚀 Getting Started',
      content: 'Import your Rapsodo CSV file to begin tracking your swing metrics. Sessions are stored locally on your device.',
    },
    'forms': {
      title: '📋 Understanding Forms',
      content: 'The form score (0-100) reflects shot quality. Higher = better contact, consistency, and flight characteristics.',
    },
    'faults': {
      title: '⚠️ Fault Categories',
      content: 'The Fault Engine detects issues: Contact (thin/fat), Path (slice/hook), Launch angle problems, and consistency faults.',
    },
    'goals': {
      title: '🎯 Setting Goals',
      content: 'Set targets for distance, form, speed, or just practice frequency. Track progress to stay motivated.',
    },
    'export': {
      title: '📤 Exporting Data',
      content: 'Export your sessions as JSON (backup) or CSV (spreadsheet analysis). Your data always belongs to you.',
    },
    'privacy': {
      title: '🔒 Privacy',
      content: 'All data is stored on your device by default. Optional cloud sync uses your own Supabase account.',
    },
  };

  function getDoc(key) {
    return docs[key] || null;
  }

  function getAllDocs() {
    return Object.values(docs);
  }

  function showDocModal(key) {
    const doc = getDoc(key);
    if (!doc) return;

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="docModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:450px;width:100%;padding:1.5rem">
          <div style="font-size:1.2rem;font-weight:800;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
            ${doc.title}
            <button onclick="document.getElementById('docModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
          </div>
          <div style="font-size:.95rem;line-height:1.6;color:var(--text)">${doc.content}</div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  return { getDoc, getAllDocs, showDocModal };
})();

