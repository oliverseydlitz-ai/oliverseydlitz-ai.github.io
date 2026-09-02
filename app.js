/* ═══════════════════════════════════════════════════════════════
   ShotLab v2 — app.js
   DB · CSV Parser · Fault Engine · Benchmarks · ShotScorer ·
   SwingDNA · ClubGapping · UI · Router · ImportFlow · Main
═══════════════════════════════════════════════════════════════ */
'use strict';

// ────────────────────────────────────────────────────────────────
// Security utilities — XSS prevention
// ────────────────────────────────────────────────────────────────
const Sanitize = (() => {
  const div = document.createElement('div');
  // Escape HTML special characters to prevent XSS
  function escape(text) {
    if (!text) return '';
    div.textContent = text;
    return div.innerHTML;
  }
  // Safe text node creation (no HTML parsing)
  function text(str) {
    const node = document.createTextNode(str || '');
    return node;
  }
  return { escape, text };
})();

// ────────────────────────────────────────────────────────────────
// Cookie consent management
// ────────────────────────────────────────────────────────────────
const CookieConsent = (() => {
  const CONSENT_KEY = 'slCookieConsent';
  const CONSENT_VERSION = '1';

  function hasConsent() {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      return saved === CONSENT_VERSION;
    } catch (_) { return false; }
  }

  function setConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
    } catch (_) {}
    hideBanner();
  }

  function showBanner() {
    if (hasConsent()) return;
    const banner = document.getElementById('cookieConsent');
    if (banner) banner.hidden = false;
  }

  function hideBanner() {
    const banner = document.getElementById('cookieConsent');
    if (banner) banner.hidden = true;
  }

  return { hasConsent, setConsent, showBanner, hideBanner };
})();

// ────────────────────────────────────────────────────────────────
// Agreement gate — blocking clickwrap consent to Terms & Privacy.
// Records the accepted version + timestamp so consent is provable and
// re-prompts if the terms version changes.
// ────────────────────────────────────────────────────────────────
const Agreement = (() => {
  const KEY = 'slTermsAccepted';
  const VERSION = '2026-06-16';

  function hasAccepted() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      return saved && saved.version === VERSION;
    } catch (_) { return false; }
  }

  function accept() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        version: VERSION,
        acceptedAt: new Date().toISOString(),
      }));
    } catch (_) {}
    hideGate();
  }

  function showGate() {
    if (hasAccepted()) return;
    const gate = document.getElementById('agreementGate');
    if (gate) gate.hidden = false;
  }

  function hideGate() {
    const gate = document.getElementById('agreementGate');
    if (gate) gate.hidden = true;
  }

  return { hasAccepted, accept, showGate, hideGate, VERSION };
})();

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
  // `s?.[field]` rather than `s[field]`: several call sites pass an array of
  // computed values where an element can legitimately be null (ShotScorer
  // returns null for a shot with nothing scorable on it), and reading a
  // property off that threw and took the whole render down.
  const vals = (arr || []).map(s => s?.[field]).filter(v => typeof v === 'number' && !isNaN(v) && v !== 0);
  if (!vals.length) return null;
  return vals.reduce((a,b) => a+b, 0) / vals.length;
}

function stdDev(values) {
  const v = values.filter(x => typeof x === 'number' && !isNaN(x));
  if (v.length < 2) return 0;
  const mean = v.reduce((a,b) => a+b,0) / v.length;
  return Math.sqrt(v.map(x => (x-mean)**2).reduce((a,b) => a+b,0) / v.length);
}

// A 0-100 consistency score. The old form was `100 - stdDev(carries)`, which
// goes NEGATIVE for any realistic dispersion (a 25-yard SD scored 75, a
// 120-yard spread across clubs scored -20) and treated an absolute yard figure
// as if it were a percentage. This uses the coefficient of variation, so it is
// scale-free: a driver and a wedge with the same relative spread score alike.
function consistencyScore(values) {
  const v = (values || []).filter(x => Number.isFinite(x) && x > 0);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  if (m <= 0) return null;
  const cv = stdDev(v) / m;                 // 0 = identical, 0.15 = loose
  return Math.max(0, Math.min(100, Math.round(100 - cv * 400)));
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

// Mean of a plain array of numbers (avg() above works on objects + a field name).
function mean(values) {
  const v = (values || []).filter(x => Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

// ── D-Plane geometry ────────────────────────────────────────────
// Start direction is a WEIGHTED BLEND of face and path:
//     StartDir = R·FaceAngle + (1-R)·ClubPath
// so face-to-path inverts to  (StartDir - ClubPath) / R.
//
// IMPORTANT: the MLM2PRO does NOT measure face angle. It is not in Rapsodo's
// published metric set. Face-to-path here is a DERIVED, ERROR-AMPLIFIED
// quantity, never a reading — see Metrics.TIER and never state a face angle.
//
// R falls with loft: path's contribution roughly doubles from driver to wedge.
// The "85% face / 15% path" rule taught everywhere is a driver-only figure.
// PING 2020 (157 golfers, 1,575 shots, Vicon 720fps + Foresight, air-cannon
// validated) reconciled with TrackMan gives driver 0.84, 7-iron 0.78, PW 0.71,
// interpolated on SPIN LOFT rather than club number.
// R is interpolated piecewise through the MEASURED anchors, so the curve
// passes exactly through every club anyone actually measured rather than
// approximating them with a straight line. Anchors are PING 2020 (157
// golfers, 1,575 shots, Vicon 720fps + Foresight, air-cannon validated)
// reconciled with TrackMan, placed at each club's own tour spin loft:
//
//     driver      spin loft 14.7°   R 0.84   (PING 0.83±0.08, TrackMan 0.87)
//     7-iron      spin loft 27.5°   R 0.78   (PING 0.81±0.05, TrackMan 0.75)
//     pitching w. spin loft 35.2°   R 0.71   (PING 0.72±0.06, TrackMan 0.70)
//
// Outside that span R is held at the end anchors rather than extrapolated —
// running a fitted line past its own data is how the edges go confidently
// wrong. No value outside [0.71, 0.84] is supported by anything measured.
const R_ANCHORS = [
  { spinLoft: 14.7, R: 0.84 },
  { spinLoft: 27.5, R: 0.78 },
  { spinLoft: 35.2, R: 0.71 },
];

function R_BY_SPINLOFT(sl) {
  const a = R_ANCHORS;
  if (sl <= a[0].spinLoft) return a[0].R;
  if (sl >= a[a.length - 1].spinLoft) return a[a.length - 1].R;
  for (let i = 1; i < a.length; i++) {
    if (sl <= a[i].spinLoft) {
      const lo = a[i - 1], hi = a[i];
      return lo.R + (hi.R - lo.R) * (sl - lo.spinLoft) / (hi.spinLoft - lo.spinLoft);
    }
  }
  return a[a.length - 1].R;
}

// Per-club R for every club in the bag, derived from that club's OWN tour
// spin loft rather than a coarse driver/iron/wedge banding. Used when a shot
// has no launch or attack angle of its own to compute spin loft from.
// Built lazily on first use: Benchmarks is declared further down the file, so
// computing this at module-init would hit the temporal dead zone and take the
// whole app down at load.
let _rByClub = null;
function rByClub(t) {
  if (_rByClub === null) {
    _rByClub = {};
    for (const c of CLUB_ORDER) {
      const b = Benchmarks.get(c);
      if (!b) continue;
      const kv = (isWood(c) || isHybrid(c)) ? LOFT_RATIO_WOOD : LOFT_RATIO_IRON;
      _rByClub[c] = R_BY_SPINLOFT((b.pga.la - b.pga.aa) / kv);
    }
  }
  return _rByClub[t];
}

function faceRatio(shot) {
  const t = typeof shot === 'string' ? shot : shot?.clubType;
  const sl = typeof shot === 'object' ? spinLoft(shot) : null;
  // Best: this shot's own spin loft. A 7-iron delivered with a wide-open face
  // has a different spin loft, and therefore a different R, than a normal one.
  if (Number.isFinite(sl) && sl >= 8 && sl <= 60) return R_BY_SPINLOFT(sl);
  // Next: this specific club's tour spin loft, not a club-family band.
  const byClub = rByClub(t);
  if (byClub !== undefined) return byClub;
  return R_ANCHORS[1].R;   // unknown club — the mid anchor
}

// Vertical analogue: launchAngle = kv·dynamicLoft + (1-kv)·AoA, so
// spin loft (dynamicLoft - AoA) = (launchAngle - AoA) / kv. These kv values
// reproduce TrackMan's PUBLISHED tour spin lofts exactly: driver 10.9/-1.3
// -> 14.7 (published 14.7), 6i 14.1/-4.1 -> 24.3 (published 24.3).
const LOFT_RATIO_WOOD = 0.83;
const LOFT_RATIO_IRON = 0.75;
const loftRatio = t => (isWood(t) || isHybrid(t)) ? LOFT_RATIO_WOOD : LOFT_RATIO_IRON;

// Estimated spin loft — the angle between where the face points and where the
// club is travelling. Drives both spin and smash factor. Estimated, not read:
// Rapsodo does not export dynamic loft.
function spinLoft(shot) {
  const la = shot.launchAngle, aoa = shot.attackAngle;
  if (!Number.isFinite(la) || !Number.isFinite(aoa)) return null;
  const sl = (la - aoa) / loftRatio(shot.clubType);
  return (sl > 0 && sl < 70) ? sl : null;
}

// Face-to-path in degrees. Positive = face open to path. null when either
// input is missing. Device error is treated as zero (see Metrics.DEVICE_ERROR);
// uncertainty is quoted from the golfer's own shot-to-shot spread instead.
function facePath(shot) {
  const ld = shot.launchDirection, cp = shot.clubPath;
  if (!Number.isFinite(ld) || !Number.isFinite(cp)) return null;
  return (ld - cp) / faceRatio(shot);
}

// ESTIMATED FACE ANGLE, relative to the target line.
//   StartDir = R*Face + (1-R)*Path   =>   Face = (StartDir - (1-R)*Path) / R
// The device does not measure face angle. This inverts the same D-plane
// relation facePath() uses, so the two are consistent by construction:
// faceAngle(s) - clubPath === facePath(s). Positive = open.
function faceAngle(shot) {
  const ld = shot.launchDirection, cp = shot.clubPath;
  if (!Number.isFinite(ld) || !Number.isFinite(cp)) return null;
  const R = faceRatio(shot);
  return (ld - (1 - R) * cp) / R;
}

// GEAR EFFECT — the edge case that breaks the whole derivation.
// The D-plane inversion assumes centre-face contact. On a toe strike the head
// twists open, pushing launch direction right while gear effect adds draw
// spin; a heel strike does the opposite. Both make the derived face angle
// wrong, and Rapsodo reports no impact location, so it cannot be corrected.
//
// It CAN be detected, though, when spin axis is measured (RPT ball only):
// compare the axis the face-to-path geometry predicts against the axis the
// device actually saw. A large disagreement in the direction opposite to the
// face-to-path is the gear-effect signature of an off-centre strike.
// How far the measured spin axis sits from what the face and path predict. A
// large gap is the signature of an off-centre strike: the head twisted, so the
// derivation that assumes it did not is invalid for that shot.
function gearResidual(shot) {
  if (!Spin.measured(shot) || !Number.isFinite(shot.spinAxis)) return null;
  const predicted = spinAxisFrom(shot);
  return Number.isFinite(predicted) ? shot.spinAxis - predicted : null;
}

// The threshold this is judged against, from the golfer's own residuals for
// this club — the last hand-picked number in the app that decided something a
// golfer sees. The old 5 degrees was an honest guess and it was wrong in both
// directions at once: too tight for someone whose derivation runs noisy, so
// ordinary shots got called mis-hits, and too loose for a consistent striker,
// whose genuine toe strike sat under it and passed as clean.
//
// Centred on the MEDIAN residual, not on zero, because a systematic offset in
// the derivation is a property of the model and the club, not of any one
// strike — anchoring at zero would flag every shot for a golfer whose
// residuals happen to sit a few degrees off. Scaled by MAD, which blow-ups
// cannot capture, so the mis-hits being looked for do not set the bar for
// finding them.
//
// No floor is put under the personal threshold, deliberately. The obvious
// worry is that a very consistent golfer gets a threshold so tight it flags
// measurement noise — but an observed residual spread ALREADY contains that
// noise, exactly as Metrics.DEVICE_ERROR = 0 argues, so a floor would be
// adding the same error a second time under another name.
const GEAR_K = 3;                    // residuals beyond 3 robust SDs of their own centre
function gearThreshold(peers, clubType) {
  const res = (peers || [])
    .filter(s => !clubType || s.clubType === clubType)
    .map(gearResidual).filter(Number.isFinite);
  if (res.length < Metrics.MIN_SHOTS_REPORT) {
    // Not enough of this club to know their own spread. Fall back to the loose
    // screen, which only ever catches gross mis-hits — and say which was used.
    return { centre: 0, cut: 5, source: 'screen', n: res.length };
  }
  const sorted = [...res].sort((a, b) => a - b);
  const centre = sorted[Math.floor((sorted.length - 1) / 2)];
  const dev = res.map(r => Math.abs(r - centre)).sort((a, b) => a - b);
  const mad = dev[Math.floor((dev.length - 1) / 2)];
  const scale = 1.4826 * mad;
  if (!(scale > 0)) return { centre, cut: 5, source: 'screen', n: res.length };
  return { centre, cut: GEAR_K * scale, source: 'personal', n: res.length };
}

function gearEffectSuspected(shot, peers) {
  const residual = gearResidual(shot);
  if (residual === null) return null;
  const t = gearThreshold(peers, shot.clubType);
  if (Math.abs(residual - t.centre) < t.cut) return null;
  const toe = residual < t.centre;
  return {
    residual, threshold: t.cut, centre: t.centre, source: t.source, n: t.n,
    likely: toe ? 'toe' : 'heel',
    note: `Measured spin axis is ${fmt(Math.abs(residual - t.centre),1)}° ${toe ? 'more draw' : 'more fade'} ` +
          `than the face and path can account for — the signature of a ${toe ? 'toe' : 'heel'} strike. ` +
          `Face angle derived from this shot will be off, because the head twisted at impact.` +
          (t.source === 'personal'
            ? ` Judged against your own ${t.n} shots with this club, where anything past ${fmt(t.cut,1)}° is unusual.`
            : ` Judged against a loose ${fmt(t.cut,0)}° screen — ${Metrics.MIN_SHOTS_REPORT}+ shots of this club ` +
              `with an RPT ball would let this be measured against your own spread instead.`),
  };
}

// Spin axis from face-to-path and spin loft. A driver punishes face-to-path
// ~1.7x harder than a 6-iron because its spin loft is lower.
function spinAxisFrom(shot) {
  const f2p = facePath(shot), sl = spinLoft(shot);
  if (!Number.isFinite(f2p) || !Number.isFinite(sl) || sl <= 0) return null;
  const rad = Math.PI / 180;
  return Math.atan(Math.tan(f2p * rad) / Math.tan(sl * rad)) / rad;
}

// Curvature in yards. Fitted to TrackMan's worked examples within 4.5%.
// Saturates above ~6° face-to-path.
function curveYards(shot) {
  const f2p = facePath(shot), carry = shot.carryDistance, sl = spinLoft(shot);
  if (!Number.isFinite(f2p) || !Number.isFinite(carry) || carry <= 0) return null;
  const c = Number.isFinite(sl) ? (2.6e-3 - 4.2e-5 * sl) : 2.0e-3;
  const raw = c * Math.pow(carry, 1.5) * f2p;
  return Math.abs(f2p) > 6 ? raw * 0.95 : raw;
}

// ────────────────────────────────────────────────────────────────
// Metrics — measurement trust, noise floors and per-user error
// ────────────────────────────────────────────────────────────────
// An app that prescribes against noise is worse than an app that says nothing.
// Everything downstream of the launch monitor is gated through here.
const Metrics = (() => {
  // Trust tiers. Gate EVERY prescription on these.
  //  1 = prescribe freely   2 = display, never prescribe alone   3 = never prescribe
  const TIER = {
    ballSpeed: 1, clubSpeed: 1, smashFactor: 1, carryDistance: 1,
    launchAngle: 2, attackAngle: 2, clubPath: 2,
    // Tier 3: consumer-radar limits of agreement on spin (-2,628 to +5,103 rpm)
    // are wider than the entire amateur-to-tour spin gap (589 rpm), and even a
    // TrackMan's between-session spin ICC bottoms out at 0.02. Spin axis and
    // launch direction scored ICC < 0.26 in the only study to measure them.
    spinRate: 3, spinAxis: 3, launchDirection: 3,
    // Modelled outputs, not measurements — carry included, but carry is the
    // one model output with enough downstream value to keep at tier 1.
    totalDistance: 3, sideCarry: 3, apex: 3, descentAngle: 3,
  };
  const tier = m => TIER[m] || 3;
  const canPrescribe = m => tier(m) === 1;

  // REFERENCE ONLY — never used to compute a +/- shown to the golfer.
  // These are published population figures. They are surfaced in Settings so
  // the numbers behind the app are inspectable, but every interval and every
  // change verdict comes from the golfer's own shots. A population constant
  // describes a sample of other people; it says nothing about this swing.
  // MDC95 = 2.77 x SD_total / sqrt(n), Hopkins' typical-error framework.
  const MDC_N10 = {
    ballSpeed: 4.0, clubSpeed: 2.0, carryDistance: 13, spinRate: 500,
    clubPath: 3.0, attackAngle: 2.2, launchAngle: 1.6, smashFactor: 0.03,
  };
  const mdc = (metric, n = 10) => {
    const base = MDC_N10[metric];
    if (!base || !n) return null;
    return base * Math.sqrt(10 / n);
  };

  // DEVICE ERROR IS TREATED AS ZERO, deliberately.
  //
  // Not because it is zero — it is not — but because carrying it as a separate
  // constant is both unsourced and double-counted:
  //
  //   Unsourced: the published sqrt(0.5^2 + 1.46^2)/0.84 ~= 1.8 deg combines
  //   Rapsodo's real club-path RMSE (1.46) with a launch-direction sigma of
  //   0.5 that nobody has ever measured. No error data exists from any source
  //   for MLM2PRO launch direction, so half that figure was invented.
  //
  //   Double-counted: an observed shot-to-shot spread already CONTAINS the
  //   device error — observed variance = swing variance + device variance.
  //   Once an interval is computed from the golfer's own shots, adding a
  //   device term on top counts the same error twice.
  //
  // So: attribute all observed spread to the golfer, and quote uncertainty
  // only from data we actually have. With a properly levelled and aligned
  // unit the residual device contribution is small relative to swing
  // variability, which is what makes this a reasonable modelling choice
  // rather than a convenient one.
  const DEVICE_ERROR = 0;

  // Empirical single-shot spread for a metric, from this golfer's own shots.
  // Replaces the old population constant: if we have their data, use it.
  function shotSpread(shots, metric, clubType) {
    const vals = (shots || [])
      .filter(s => !clubType || s.clubType === clubType)
      .map(s => metric === 'facePath' ? facePath(s)
              : metric === 'faceAngle' ? faceAngle(s)
              : s[metric]);
    const { kept } = trimOutliers(vals);
    return kept.length >= 3 ? stdDev(kept) : null;
  }

  // Sample floors before a mean may be reported at all.
  const MIN_SHOTS_REPORT  = 10;  // any club mean
  const MIN_SHOTS_DELIVERY = 15; // club path / attack angle change claims
  const MIN_SHOTS_TAIL    = 30;  // dispersion tails

  // Wild misreads destroy a 10-shot mean (one user logged a 147 mph swing and
  // a 0 mph swing back to back). Trim on MAD, and always report how many went.
  function trimOutliers(values) {
    const v = (values || []).filter(Number.isFinite);
    if (v.length < 4) return { kept: v, dropped: 0 };
    const sorted = [...v].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const mad = sorted.map(x => Math.abs(x - med)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)] || 0;
    if (mad === 0) return { kept: v, dropped: 0 };
    const kept = v.filter(x => Math.abs(x - med) / (1.4826 * mad) <= 3.5);
    return { kept, dropped: v.length - kept.length };
  }

  // PER-USER TYPICAL ERROR — the strongest methodological move available.
  // After ~5 sessions this golfer's own noise floor is better known than any
  // published population default. Falls back to the table until then.
  function typicalError(sessions, metric, clubType) {
    const perSession = (sessions || []).map(sn => {
      const shots = (sn.shots || []).filter(s => !clubType || s.clubType === clubType);
      const { kept } = trimOutliers(shots.map(s => s[metric]));
      return kept.length >= 3 ? stdDev(kept) : null;
    }).filter(Number.isFinite);
    if (perSession.length < 3) return { value: null, source: 'population', n: perSession.length };
    return { value: mean(perSession), source: 'personal', n: perSession.length };
  }

  // Is a change between two session means real, or inside the noise floor?
  // Is a change real? Judged ONLY against this golfer's own typical error.
  // With too little history the honest answer is "cannot say yet", not a
  // population substitute — borrowing someone else's variability to rule on
  // this golfer's progress is exactly the kind of confident wrong answer the
  // rest of this module exists to prevent.
  function changeIsReal(metric, delta, n, sessions, clubType) {
    const te = typicalError(sessions, metric, clubType);
    if (te.value === null) {
      return { real: null, threshold: null, source: 'insufficient-history',
               need: Math.max(0, 3 - te.n),
               note: `Needs ${Math.max(1, 3 - te.n)} more session${3 - te.n === 1 ? '' : 's'} ` +
                     `before a change in this can be called real or not.` };
    }
    const threshold = 2.77 * te.value / Math.sqrt(Math.max(1, n));
    return { real: Math.abs(delta) >= threshold, threshold, source: 'personal' };
  }

  // Format a mean the honest way: an interval, never a bare point estimate.
  function interval(values, unit = '', decimals = 1) {
    const { kept, dropped } = trimOutliers(values);
    if (kept.length < 2) return null;
    const m = mean(kept);
    const ci = 1.96 * stdDev(kept) / Math.sqrt(kept.length);
    return {
      mean: m, ci, n: kept.length, dropped,
      text: `${fmt(m, decimals)} ± ${fmt(ci, decimals)}${unit} (${kept.length} shots` +
        (dropped ? `, ${dropped} trimmed` : '') + ')',
    };
  }

  return { TIER, tier, canPrescribe, MDC_N10, mdc, DEVICE_ERROR, shotSpread,
           MIN_SHOTS_REPORT, MIN_SHOTS_DELIVERY, MIN_SHOTS_TAIL,
           trimOutliers, typicalError, changeIsReal, interval };
})();


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
// LocalDB — whether a session survives closing the tab, and saying so
// ────────────────────────────────────────────────────────────────
// `DB` above has always been a complete IndexedDB store, and nothing has ever
// called it. Everything local went to `MemDB`, a plain array, so a guest who
// imported ninety shots and hit refresh lost all of it with no warning — while
// the button they clicked to get there said "your data stays on this device".
// It stayed nowhere. That was the only outright false statement in an app whose
// entire argument is that it does not tell you things it cannot support.
//
// The fix is not to turn persistence on for everyone. Storing a golfer's
// session history on a device without asking is its own broken promise, and
// the privacy policy correctly documented the ephemeral behaviour. So it is a
// choice, made explicitly, defaulting to off — and the guest button now
// describes what actually happens either way.
//
// The design keeps the blast radius to two lines in `Store`. On boot, if
// device storage is on, IndexedDB is read once into `MemDB`; from then on
// `MemDB` stays the single read path — synchronous, and unchanged for every
// call site — while writes fan out to IndexedDB as well. If IndexedDB is
// unavailable (private browsing, a full quota, a locked-down browser) the app
// keeps working from memory and SAYS the setting did not take, rather than
// leaving a switch on that quietly does nothing.
const LocalDB = (() => {
  const KEY = 'slKeepLocal';
  let _on = false;          // resolved from storage at hydrate()
  let _broken = null;       // the reason IndexedDB refused, if it did

  const readFlag = () => {
    try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; }
  };
  const writeFlag = on => {
    try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (_) {}
  };

  const enabled = () => _on && !_broken;
  const unavailable = () => _broken;

  // Every IndexedDB call goes through here. A rejected write must never take
  // the import down with it: the session is already in memory and usable, and
  // the honest response is to fall back to ephemeral and tell the user once.
  async function guard(fn, what) {
    try { return await fn(); }
    catch (e) {
      console.error('LocalDB ' + what + ' failed:', e);
      if (!_broken) {
        _broken = e?.message || 'this browser refused to store data';
        try {
          toast('Device storage is unavailable — this session is kept in memory only.');
        } catch (_) {}
      }
      return null;
    }
  }

  // Read the device store into MemDB once, at startup. After this the rest of
  // the app never needs to know which store a session came from.
  async function hydrate() {
    _on = readFlag();
    if (!_on) return { restored: 0 };
    const rows = await guard(() => DB.getSessions(), 'read');
    if (!rows) return { restored: 0 };
    rows.forEach(s => MemDB.saveSession(s));
    return { restored: rows.length };
  }

  const persist = s => (enabled() && s ? guard(() => DB.saveSession(s), 'write') : Promise.resolve(null));
  const forget  = id => (enabled() ? guard(() => DB.deleteSession(id), 'delete') : Promise.resolve(null));

  // Turning it ON writes everything already in memory, so the switch applies to
  // the session you just imported and not only to future ones — a setting that
  // silently starts from now is the kind of surprise this module exists to
  // remove. Turning it OFF erases the device copy immediately; leaving it
  // behind would make "off" mean "off from now on", which is not what it says.
  async function setEnabled(on) {
    if (on) {
      // The FLAG is written first, and rolled back on failure, rather than
      // last. `hydrate()` re-reads the flag into `_on`, and both it and this
      // yield at every await — so a boot still in flight when the switch is
      // flipped used to land in between and reset `_on` to a flag that had not
      // been written yet, leaving a switch that read "on", stored nothing, and
      // gave no reason. Flag first means every reader agrees at every await.
      _broken = null; writeFlag(true); _on = true;
      const rollback = reason => { writeFlag(false); _on = false; return { on: false, reason }; };
      // Probe before promising. A first-time guest has nothing saved yet, so
      // writing "everything already in memory" writes nothing, and the switch
      // would flip on cleanly in a browser that is going to refuse the very
      // first real import. A round trip through the store is the only way to
      // find that out now rather than at the moment the data matters.
      const probe = { id: '__probe__', date: new Date(0).toISOString(), shots: [] };
      await guard(async () => { await DB.saveSession(probe); await DB.deleteSession(probe.id); }, 'probe');
      if (_broken) return rollback(_broken);
      const existing = MemDB.getSessions();
      for (const s of existing) await persist(s);
      if (_broken) return rollback(_broken);
      return { on: true, saved: existing.length };
    }
    const had = await guard(() => DB.getSessions(), 'read');
    await guard(() => DB.clearAll(), 'clear');
    _on = false; writeFlag(false);
    return { on: false, erased: had ? had.length : 0 };
  }

  // What to tell the golfer, in the two states. Deliberately concrete about
  // the failure mode rather than reassuring about the success one.
  const describe = () => _broken
    ? `This browser will not let the app store data — private browsing and a full disk both do this. ` +
      `Sessions stay in memory and are lost when you close the tab.`
    : enabled()
      ? 'Sessions are kept on this device and will still be here when you come back. Clearing your ' +
        'browser data removes them, and they are not encrypted — this is a convenience, not a backup.'
      : 'Sessions are held in memory only and are lost when you close the tab. Nothing is written to ' +
        'this device. Turn this on to keep them, or sign in to sync them to the cloud.';

  return { hydrate, persist, forget, setEnabled, enabled, unavailable, describe, KEY };
})();

// ────────────────────────────────────────────────────────────────
// Supabase Auth & Cloud DB
// ────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://jdmahrrxtxqrcpcwmwvx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FK_S_xmH5hwC2r8Zm8rT2Q_dT8bLfKH';
// Contact for privacy / data-deletion requests. EDIT THIS to your real address.
const SUPPORT_EMAIL = 'shotlab_legal@oliverseydlitz.com';
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
  if (meta) meta.setAttribute('content', dark ? '#000000' : '#ffffff');
}
(function initThemeEarly(){
  try {
    const saved = localStorage.getItem('slTheme');
    const dark = saved ? saved === 'dark'
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(_) {}
})();

// Scroll lock — prevent the background page from scrolling while any modal is
// open. iOS Safari ignores overflow:hidden on <body>; the only reliable fix is
// position:fixed + top = saved scrollY (we restore it on close so the page
// doesn't jump). Android gets overscroll-behavior:contain from CSS; both
// mechanisms work together.
(function initScrollLock() {
  let _savedY = 0;
  function sync() {
    const open = !!document.querySelector('.modal-overlay:not([hidden])');
    const locked = document.body.classList.contains('modal-open');
    if (open && !locked) {
      _savedY = window.scrollY;
      document.documentElement.style.setProperty('--scroll-y', `-${_savedY}px`);
      document.body.classList.add('modal-open');
    } else if (!open && locked) {
      document.body.classList.remove('modal-open');
      document.documentElement.style.removeProperty('--scroll-y');
      window.scrollTo(0, _savedY);
    }
  }
  new MutationObserver(sync).observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['hidden']
  });
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

  let _installingOAuth = false;  // true while we process a fresh Google return

  // Single source of truth: ask the Supabase server who the JWT belongs to.
  // getUser() validates the token against the server, so it can't return a
  // stale/cached identity the way reading localStorage can.
  //
  // IMPORTANT: pass an explicit access token when we have one (a fresh OAuth
  // return). getUser() with NO argument validates whatever token is in storage,
  // which can still be a stale session or an auto-refreshed old token — that was
  // the real source of the "old email after Google login" bug. getUser(token)
  // validates THAT exact token, so the account the user just picked always wins.
  async function refreshUserFromServer(explicitToken) {
    const { data, error } = explicitToken
      ? await sb.auth.getUser(explicitToken)
      : await sb.auth.getUser();
    _user = (!error && data?.user) ? data.user : null;
    console.log('[AUTH] getUser →', _user?.email || '(none)', error ? 'err:'+error.message : '');
    updateUI();
    return _user;
  }

  async function init() {
    sb.auth.onAuthStateChange(async (event, session) => {
      const eventUser = session?.user || null;
      console.log('[AUTH EVENT]', event, '→ session user:', eventUser?.email || '(none)');
      if (_signingOut) return;
      // While we're deterministically installing a fresh Google login, ignore
      // every background event (INITIAL_SESSION / TOKEN_REFRESHED from any stale
      // stored session) so it can't clobber _user with the old identity.
      if (_installingOAuth) return;

      if (event === 'SIGNED_OUT') {
        _user = null;
        updateUI();
        if (!_signingOut) showAuth(false);
        return;
      }

      // IDENTITY IS OWNED BY EXPLICIT FLOWS (init's getUser, login, logout).
      // The background listener must NEVER swap the signed-in account from
      // under us — that's the intermittent "wrong email" bug: a stale
      // INITIAL_SESSION / TOKEN_REFRESHED carrying the previous account could
      // arrive just after the install guard lifted and overwrite _user.
      // So: if we already know who's signed in, only accept events for that
      // same user id; ignore anything for a different account.
      if (_user && eventUser && eventUser.id !== _user.id) {
        console.warn('[AUTH] ignoring event for a different account:', eventUser.email);
        return;
      }

      // Genuine guest → signed-in transition (an in-tab sign-in that didn't go
      // through our OAuth-hash path). Adopt the new user and refresh the view.
      if (!_user && eventUser && event === 'SIGNED_IN') {
        _user = eventUser;
        updateUI();
        await Router.showSessions();
      }
    });

    // ── Deterministic OAuth handling ──────────────────────────────────────
    // If we just came back from Google (implicit flow), the URL hash held a
    // fresh access/refresh token that we captured synchronously into
    // _oauthTokens. We:
    //   1. purge any stale stored session FIRST (so nothing old can be read)
    //   2. strip the hash so a refresh can't reprocess it
    //   3. install the fresh token with setSession()
    //   4. validate the EXACT fresh access token with getUser(token)
    // This removes every race that could surface a previously-used account.
    if (_oauthTokens) {
      _installingOAuth = true;
      try {
        purgeAuthStorage();                       // kill any lingering old session
        history.replaceState(null, '', location.pathname);  // drop #access_token
        const { error } = await sb.auth.setSession(_oauthTokens);
        if (error) throw error;
        // Validate the precise token we just received — immune to stale storage.
        await refreshUserFromServer(_oauthTokens.access_token);
      } catch (e) {
        console.error('[AUTH] setSession failed:', e);
        showDebug('LOGIN INSTALL FAILED:\n' + (e?.message || JSON.stringify(e)));
      } finally {
        _installingOAuth = false;
      }
    }

    // Read the server-validated user as the single source of truth (covers
    // returning visitors with a stored session, and confirms the OAuth login).
    if (!_user) await refreshUserFromServer();

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
    const delAcct = document.getElementById('deleteAccountBtn');
    const authModal = document.getElementById('authModal');
    if (_user) {
      clearTimeout(_guestTimer);
      emailRow.hidden = false;
      document.getElementById('accountEmail').textContent = _user.email;
      signIn.hidden = true;
      signOut.hidden = false;
      if (syncBtn) syncBtn.hidden = false;   // sync only available when signed in
      if (delAcct) delAcct.hidden = false;   // account deletion only when signed in
      authModal.hidden = true;
    } else if (_guest) {
      // Guest mode: show a clear "Guest" label instead of an empty dash
      emailRow.hidden = false;
      document.getElementById('accountEmail').textContent = 'Guest (local only)';
      signIn.hidden = false;
      signOut.hidden = true;
      if (syncBtn) syncBtn.hidden = true;
      if (delAcct) delAcct.hidden = true;
    } else {
      emailRow.hidden = true;
      signIn.hidden = false;
      signOut.hidden = true;
      if (syncBtn) syncBtn.hidden = true;
      if (delAcct) delAcct.hidden = true;
    }
  }

  function setGuest() {
    _guest = true;
    // Remembered so a returning guest is not made to wait out the sign-in
    // nudge again — see showAuth(). Someone who has already declined once,
    // and may have sessions stored on this device, should not have to sit
    // through a five-second countdown to reach them on every visit.
    try { localStorage.setItem('slGuestChosen', '1'); } catch (_) {}
    updateUI();
  }
  const choseGuestBefore = () => {
    try { return localStorage.getItem('slGuestChosen') === '1'; } catch (_) { return false; }
  };

  // mandatory=true: guest option hidden until 5s pass; false: guest shown right away
  function showAuth(mandatory = false) {
    const modal = document.getElementById('authModal');
    const guest = document.getElementById('authGuestWrap');
    modal.hidden = false;
    switchToLogin();
    clearTimeout(_guestTimer);
    // The five-second delay is a nudge towards signing in, and it is worth
    // having exactly once. Making a returning guest sit through it every load —
    // especially one whose sessions are stored on this device and are sitting
    // right behind the modal — is friction with no argument behind it.
    if (mandatory && !choseGuestBefore() && !LocalDB.enabled()) {
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
  // Ball type and surface are properties of the SESSION but every gate
  // downstream works on shots, often flattened across sessions (the yardage
  // book, progress trends). Stamping the measurement context onto each shot
  // here — the one place sessions enter the app — means no call site has to
  // thread it, and no call site can forget to.
  function stamp(sn) {
    if (!sn || !Array.isArray(sn.shots)) return sn;
    const ball = sn.conditions?.ball || 'unknown';
    const surface = sn.conditions?.surface || 'unknown';
    const aligned = sn.conditions?.alignment === 'confirmed';
    sn.shots.forEach(s => { s._ball = ball; s._surface = surface; s._aligned = aligned; });
    return sn;
  }

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
    const local = MemDB.getSessions().map(stamp);
    if (!cloud()) return local;
    try {
      const rows = await CloudDB.getSessions(Auth.getUser().id);
      const cloudIds = new Set(rows.map(r => r.id));
      const pending = local.filter(s => !cloudIds.has(s.id));
      return [...pending, ...rows.map(r => stamp(fromRow(r)))].sort((a,b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.error('Cloud load failed:', e);
      showDebug('CLOUD LOAD FAILED:\n' + (e?.message || JSON.stringify(e)) + '\n(showing local sessions)');
      return local;
    }
  }
  async function getSession(id) {
    const mem = MemDB.getSession(id);   // covers just-imported sessions
    if (mem) return stamp(mem);
    if (!cloud()) return null;
    try {
      const rows = await CloudDB.getSessions(Auth.getUser().id);
      const r = rows.find(x => x.id === id);
      return r ? stamp(fromRow(r)) : null;
    } catch (e) {
      console.error('Cloud load failed:', e);
      return null;
    }
  }
  // The two LOCAL stores, together. Every path that adds a session locally goes
  // through here, because the import path did not and that cost the whole
  // device-storage feature: ImportFlow wrote straight to MemDB, so a golfer who
  // had already switched device storage on lost every session they imported
  // afterwards. It only ever appeared to work because turning the setting on
  // flushes whatever is in memory, and that was the order the test used.
  //
  // Cloud is deliberately NOT in here. The import path renders the session
  // immediately and syncs to the cloud in the background with its own toast,
  // and folding an awaited network call into the local write would put a
  // spinner in front of a render that is currently instant.
  function saveLocal(s) {
    MemDB.saveSession(s);               // instant, always works
    return LocalDB.persist(s);          // device store, if that is switched on
  }

  async function saveSession(s) {
    await saveLocal(s);
    if (cloud()) await CloudDB.saveSession(s);
  }
  async function deleteSession(id) {
    MemDB.deleteSession(id);
    await LocalDB.forget(id);
    if (cloud()) { try { await CloudDB.deleteSession(id); } catch (e) { console.error('Cloud delete failed:', e); } }
  }
  return { getSessions, getSession, saveSession, saveLocal, deleteSession, stamp };
})();

// ────────────────────────────────────────────────────────────────
// FeedbackEngine — how numbers are scheduled, not which drill is chosen
// ────────────────────────────────────────────────────────────────
// The guidance hypothesis is the strongest evidence in the research base and
// it indicts this entire product category. Winstein & Schmidt (1990), three
// experiments, n=240: constant feedback and faded feedback were
// INDISTINGUISHABLE during acquisition and at 5-10 minutes. At 24 hours the
// faded group had 35% less error (6.5 vs 10.0 RMS, p<.01). Butki & Hoffman
// (n=78) and Smith et al. (n=48, 10% bandwidth) corroborate it in golf.
//
// The implication is precise and uncomfortable: showing a number after every
// shot inflates in-session performance while degrading next-day retention,
// and an app that measures itself on within-session improvement CANNOT SEE
// THE DAMAGE IT IS DOING. Every launch monitor on the market shows numbers
// after every shot. This module is the deliberate departure.
const FeedbackEngine = (() => {
  const KEY = 'slFeedbackMode';

  const MODES = {
    // Default. Numbers hidden; the golfer taps to reveal. Self-controlled
    // feedback is contested as a mechanism but reliably produces sub-100%
    // frequency, which is the part that works — and it is far more palatable
    // than the app unilaterally hiding data.
    onRequest: {
      id: 'onRequest', label: 'Tap to reveal (recommended)',
      blurb: 'Numbers stay hidden until you ask. You keep control, and you naturally look less often — which is the part the evidence supports.',
    },
    // Silence inside tolerance, report only outside it. Silence acts as
    // implicit positive feedback and self-reduces as the player improves.
    bandwidth: {
      id: 'bandwidth', label: 'Only tell me when I miss',
      blurb: 'Nothing shown when the shot is inside your tolerance band. You only hear about the misses, and the app goes quieter as you get better.',
    },
    // High early, progressively reduced across the session.
    faded: {
      id: 'faded', label: 'Fade out across the session',
      blurb: 'Frequent feedback while you warm up, tapering to almost none by the end. This is the exact schedule from the retention studies.',
    },
    // The industry default, offered honestly labelled.
    always: {
      id: 'always', label: 'Every shot (not recommended)',
      blurb: 'What every other launch monitor does. Feels better in the moment and measurably costs you next-day retention.',
    },
  };

  function getMode() {
    try { return MODES[localStorage.getItem(KEY)] ? localStorage.getItem(KEY) : 'onRequest'; }
    catch (_) { return 'onRequest'; }
  }
  function setMode(m) { try { if (MODES[m]) localStorage.setItem(KEY, m); } catch (_) {} }

  // Faded schedule: ~100% over the first fifth, decaying to ~20% by the end.
  function fadedFrequency(idx, total) {
    if (!total || total < 5) return 1;
    const p = idx / total;
    return Math.max(0.2, 1 - p * 1.1);
  }

  // WHICH shots the faded schedule reveals, and it has to be deterministic.
  // The first version drew Math.random() per shot, which is defensible as a
  // sampling scheme and wrong as a UI: the shot table re-renders on every sort,
  // so the same shot would hide and reveal itself as the golfer clicked column
  // headers. A schedule that changes when you look at it is not a schedule.
  //
  // Fixed quarters instead of a random draw — 100% over the first fifth, then
  // every second shot, then every third, then every fifth. That lands in the
  // 33–50% average band the retention studies used, fades monotonically, and
  // is explainable in one sentence to the golfer, which a random draw is not.
  function fadedReveal(idx, total) {
    if (!total || total < 5) return true;
    const p = idx / total;
    if (p < 0.2) return true;
    if (p < 0.5) return idx % 2 === 0;
    if (p < 0.8) return idx % 3 === 0;
    return idx % 5 === 0;
  }

  // Is this shot inside the golfer's own tolerance band? Bandwidth feedback
  // stays silent when it is. Tolerance is the golfer's own typical error, not
  // a population constant — so the band tightens as they get more consistent.
  function insideBand(shot, metric, target, tolerance) {
    const v = shot[metric];
    if (!Number.isFinite(v) || !Number.isFinite(target)) return true;
    return Math.abs(v - target) <= tolerance;
  }

  // The decision the UI asks on every shot.
  function shouldReveal(ctx) {
    const { index = 0, total = 0, mode = getMode(), outsideBand = false } = ctx || {};
    switch (mode) {
      case 'always':    return { reveal: true,  reason: 'every shot' };
      case 'faded':     return { reveal: fadedReveal(index, total),
                                 reason: `faded (${Math.round(fadedFrequency(index, total) * 100)}% here)` };
      case 'bandwidth': return { reveal: outsideBand, reason: outsideBand ? 'outside your band' : 'inside your band — the silence is the feedback' };
      default:          return { reveal: false, reason: 'tap to reveal' };
    }
  }

  // Error estimation preserves the intrinsic error-detection process that
  // constant feedback displaces. Ask before showing, on a sample of shots.
  function shouldAskPrediction(index) { return index > 0 && index % 5 === 0; }

  // The tolerance band for bandwidth feedback, from THIS golfer's own spread —
  // never a published figure. A band borrowed from other people would go quiet
  // on shots that are unusual for this golfer and shout about shots that are
  // not, which is the opposite of what bandwidth feedback is for. It also
  // tightens on its own as they get more consistent, which is the property that
  // makes the mode self-reducing.
  // 1.5 rather than 1 standard deviation, and the reason is arithmetic. One SD
  // puts about a third of a normal distribution outside it BY CONSTRUCTION, so
  // a band at 1 SD breaks silence on one shot in three no matter how well the
  // golfer is striking it. That is not a miss, that is ordinary variation with
  // an alarm on it, and it would train someone to ignore the alarm. At 1.5 SD
  // roughly one shot in eight is reported, which is a miss.
  const BAND_K = 1.5;
  function tolerance(shots, metric, clubType) {
    const sd = Metrics.shotSpread(shots, metric, clubType);
    return Number.isFinite(sd) && sd > 0 ? BAND_K * sd : null;
  }

  // The whole schedule for a set of shots, in the order they were hit.
  //
  // WHAT THIS DOES AND DOES NOT CLAIM. The guidance hypothesis is about
  // knowledge of results during acquisition — the number that appears after
  // each swing. This app cannot control that: the golfer was looking at a
  // Rapsodo screen at the time, and by the time a CSV is imported the session
  // is over. What it controls is its OWN per-shot surface, which for anyone
  // reviewing mid-session is the same loop, and whether it asks for an error
  // estimate before it reveals anything.
  //
  // Session AGGREGATES are deliberately never faded. A mean with an interval
  // is not per-trial feedback, it is the summary the retention literature
  // actively wants a learner to have. Hiding it would be copying the shape of
  // the finding rather than the finding.
  function plan(shots, opts = {}) {
    const list = shots || [];
    const mode = opts.mode || getMode();
    const metric = opts.metric || 'smashFactor';

    // The band is computed PER CLUB. Pooled across a mixed session it measures
    // the gap between a driver and a wedge rather than anything about the
    // strike: tour smash runs 1.48 at driver and 1.20 at lob wedge, so a
    // single band over both leaves most shots "outside" it and the mode
    // degrades into showing almost everything. On a real 74-shot two-club
    // session that was 53% reported, which is not bandwidth feedback.
    const bands = new Map();
    const bandFor = club => {
      if (bands.has(club)) return bands.get(club);
      const vals = list.filter(s => s.clubType === club).map(s => s[metric]);
      const { kept } = Metrics.trimOutliers(vals);
      const band = { centre: kept.length ? mean(kept) : null,
                     tol: opts.tolerance ?? tolerance(list, metric, club) };
      bands.set(club, band);
      return band;
    };

    return list.map((shot, index) => {
      const { centre, tol } = opts.clubType || opts.target !== undefined
        ? { centre: opts.target ?? bandFor(shot.clubType).centre, tol: opts.tolerance ?? bandFor(shot.clubType).tol }
        : bandFor(shot.clubType);
      const outsideBand = (tol === null || centre === null)
        ? true                       // no band yet: cannot stay silent about a shot it cannot judge
        : !insideBand(shot, metric, centre, tol);
      const d = shouldReveal({ index, total: list.length, mode, outsideBand });
      return { index, shot, ...d, predict: shouldAskPrediction(index), outsideBand };
    });
  }

  // How well the golfer can call their own strike, from the estimates they have
  // made. This is the point of asking: error estimation trains the internal
  // error-detection process that constant feedback displaces, and the size of
  // the gap between what they called and what happened IS the thing being
  // trained. Judged against their own shot-to-shot spread, because being out
  // by 0.03 means something different to someone whose strike varies by 0.01
  // than to someone whose varies by 0.05.
  const MIN_CALLS = 3;
  function calibration(calls, shots, metric = 'smashFactor', clubType = null) {
    const pairs = (calls || []).filter(c => Number.isFinite(c.called) && Number.isFinite(c.actual));
    if (pairs.length < MIN_CALLS) {
      return { ok: false, n: pairs.length, need: MIN_CALLS - pairs.length,
               note: `Call ${MIN_CALLS - pairs.length} more before you look and the app can tell you how well ` +
                     `you read your own strike.` };
    }
    const errs = pairs.map(c => Math.abs(c.called - c.actual));
    const mae = mean(errs);
    const bias = mean(pairs.map(c => c.called - c.actual));
    const spread = Metrics.shotSpread(shots, metric, clubType);
    const ratio = Number.isFinite(spread) && spread > 0 ? mae / spread : null;
    return {
      ok: true, n: pairs.length, mae, bias, spread, ratio,
      note: ratio === null
        ? `Your calls are out by ${fmt(mae, 3)} on average across ${pairs.length}.`
        : ratio <= 1
          ? `Across ${pairs.length} calls you are out by ${fmt(mae, 3)} on average, which is inside your own ` +
            `shot-to-shot spread of ${fmt(spread, 3)}. You can feel this shot before you see it — that is the ` +
            `error detection the numbers displace when they arrive first.`
          : `Across ${pairs.length} calls you are out by ${fmt(mae, 3)}, against a shot-to-shot spread of ` +
            `${fmt(spread, 3)}. You cannot read this one yet by feel, which is exactly what calling it before ` +
            `you look is training` +
            (Math.abs(bias) > mae * 0.6
              ? `, and you lean ${bias > 0 ? 'high' : 'low'} rather than scattering — a systematic read, not noise.`
              : '.'),
    };
  }

  // One line explaining what the golfer is looking at, because a table full of
  // hidden numbers with no explanation reads as a broken app rather than as a
  // deliberate schedule.
  function explain(mode = getMode(), n = 0) {
    switch (mode) {
      case 'always':
        return 'Every number shown, which is what every other launch monitor does. It feels better now and ' +
               'measurably costs you next-day retention — the setting to change it is in Settings.';
      case 'faded':
        return `Numbers fade across the ${n} shots: all of them early, then every second, third and fifth as ` +
               'you go. This is the schedule from the retention studies, not a sample — the same shot always ' +
               'shows the same way.';
      case 'bandwidth':
        return 'Only shots outside your own tolerance band are shown, and the band is worked out separately ' +
               'for each club from your own shot-to-shot spread. It tightens as you get more consistent, and ' +
               'the silence on everything else is the feedback.';
      default:
        return 'Numbers are hidden until you tap a row. Looking less often is the part of this the evidence ' +
               'supports, and you keep the choice of when.';
    }
  }

  // Volume distribution: 4 x 60 beats 1 x 240. Warn on marathons.
  function volumeAdvice(shotCount) {
    if (shotCount >= 150) {
      return 'That is a long session. Four 60-ball sessions beat one 240-ball session — ' +
             'the extra volume in a single sitting mostly buys fatigue.';
    }
    if (shotCount >= 100) return 'Long session. Consider splitting the next one across two days.';
    return null;
  }

  return { MODES, getMode, setMode, shouldReveal, shouldAskPrediction, BAND_K, MIN_CALLS,
           insideBand, fadedFrequency, fadedReveal, tolerance, plan, explain, calibration, volumeAdvice };
})();

// ────────────────────────────────────────────────────────────────
// Conditions — ball type and hitting surface change the measurement
// ────────────────────────────────────────────────────────────────
// A swing robot with literally zero variability produces 2-4x the lateral
// dispersion with range balls, and a pitching wedge goes FURTHER on half the
// spin. That inflation is comparable in size to the whole skill gap between
// an 80-golfer and a 100-golfer, so a dispersion figure from range-ball data
// is measuring the ball, not the golfer. Mats separately hide fat strikes,
// because a rigid surface lets the sole bounce instead of the edge digging.
const Conditions = (() => {
  const BALLS = {
    premium:  { id:'premium',  label:'Premium (own ball)', dispersionValid:true,  gappingValid:true  },
    rpt:      { id:'rpt',      label:'Rapsodo RPT',        dispersionValid:true,  gappingValid:true, spinMeasured:true },
    range:    { id:'range',    label:'Range balls',        dispersionValid:false, gappingValid:false },
    unknown:  { id:'unknown',  label:'Not recorded',       dispersionValid:false, gappingValid:false },
  };
  const SURFACES = {
    grass: { id:'grass', label:'Grass',  masksFatStrikes:false },
    mat:   { id:'mat',   label:'Mat',    masksFatStrikes:true  },
    unknown:{id:'unknown',label:'Not recorded', masksFatStrikes:true },
  };

  const ball = sn => BALLS[sn?.conditions?.ball] || BALLS.unknown;
  const surface = sn => SURFACES[sn?.conditions?.surface] || SURFACES.unknown;

  // Alignment is a genuinely different kind of error from the rest of this
  // module. Ball type and surface change the NOISE; alignment changes the
  // BIAS. A unit aimed 2 degrees right does not scatter the readings, it
  // shifts every one of them by the same amount, so averaging cannot remove it
  // and more shots only make the app more confident in the wrong answer.
  //
  // That cuts both ways. Once alignment IS confirmed, launch direction becomes
  // meaningful in absolute terms — aimed at a known target rather than at
  // wherever the unit happened to point — and the prescriptions that depend on
  // absolute start line become admissible at the normal sample floor instead
  // of being held back to a 30-shot aggregate.
  function aligned(x) {
    if (!x) return false;
    if (Array.isArray(x)) return x.length > 0 && x.every(s => s._aligned === true);
    if (typeof x._aligned === 'boolean') return x._aligned;
    return x?.conditions?.alignment === 'confirmed';
  }

  // The sample floor for a launch-direction-derived claim, given alignment.
  const startLineFloor = x => aligned(x) ? Metrics.MIN_SHOTS_REPORT : Metrics.MIN_SHOTS_TAIL;

  // Reasons to withhold a prescription, in plain language.
  function caveats(sn) {
    const out = [];
    const b = ball(sn), sf = surface(sn);
    if (!b.dispersionValid) {
      out.push(b.id === 'range'
        ? 'Range balls: dispersion here is 2–4× wider than your own ball would give, and gapping is unreliable — a wedge can fly further on half the spin. Treat the shape as real and the spread as not.'
        : 'Ball type not recorded, so dispersion and gapping figures are not comparable between sessions.');
    }
    if (!aligned(sn)) {
      out.push('Alignment not confirmed for this session. Launch direction is measured against wherever ' +
        'the unit was pointing, so any aiming error becomes a constant offset on every shot — and unlike ' +
        'random error, averaging more shots will not remove it. Start-line and face-to-path readings are ' +
        'held to a larger sample until you confirm the Impact Vision alignment.');
    }
    if (sf.masksFatStrikes) {
      out.push(sf.id === 'mat'
        ? 'Mat: the sole bounces instead of the leading edge digging, so a strike several centimetres behind the ball still reads near-normal. Mats systematically hide fat strikes — the exact thing a low-point drill is meant to catch.'
        : 'Surface not recorded — if you were on a mat, fat strikes may be hidden.');
    }
    return out;
  }

  // Never compare across measurement conditions as if the difference were skill.
  function comparable(a, b2) {
    return ball(a).id === ball(b2).id && surface(a).id === surface(b2).id;
  }

  return { BALLS, SURFACES, ball, surface, aligned, startLineFloor, caveats, comparable };
})();

// ────────────────────────────────────────────────────────────────
// Spin — measured only with an RPT ball, and never a prescription
// ────────────────────────────────────────────────────────────────
// Two separate facts get conflated about spin, and they point different ways:
//
//   1. DEVICE. With a Rapsodo RPT ball the MLM2PRO genuinely measures spin at
//      240fps, and it is decent: MDC 500 rpm over 10 shots. WITHOUT an RPT
//      ball spin is not measured at all — the figure shown is not a reading,
//      and the spec's instruction is to suppress it entirely.
//
//   2. BIOLOGY. Spin is not a stable characteristic of a golfer between
//      sessions. On a TrackMan — gold standard, device error negligible —
//      between-session spin ICC runs 0.02 to 0.60 with SEM 241–455 rpm. The
//      golfer's own spin wanders more than most training effects do.
//
// So the RPT ball fixes (1) and cannot fix (2). Spin is therefore legitimate
// for DESCRIBING a session and illegitimate for TRACKING CHANGE or driving a
// drill, on any device, with any ball. That is why there is no spin fault:
// not because the number is unreadable, but because "your spin improved"
// is not a claim this data can support.
//
// The actionable route to spin is SPIN LOFT, which is derived from launch
// angle and attack angle (both tier 2) and is the mechanism that produces
// spin in the first place. The app prescribes from that instead.
const Spin = (() => {
  // Is spin a reading at all for this session?
  // Accepts a session, or a single shot stamped by Store.stamp().
  function measured(x) {
    if (!x) return false;
    if (typeof x._ball === 'string') return x._ball === 'rpt';
    return Conditions.ball(x).id === 'rpt';
  }

  // Session-level spin summary. Returns null when not measured, so every call
  // site suppresses rather than showing a number that is not one.
  function summary(session, clubType) {
    if (!measured(session)) return null;
    const shots = (session?.shots || []).filter(s => (!clubType || s.clubType === clubType) && Number.isFinite(s.spinRate) && s.spinRate > 0);
    const iv = Metrics.interval(shots.map(s => s.spinRate), ' rpm', 0);
    if (!iv || iv.n < 3) return null;
    // Spread is the golfer's own, from the shots in this session. No
    // population MDC is attached: a constant derived from other people would
    // make this interval describe a sample rather than this swing.
    return { ...iv, enoughForMean: iv.n >= Metrics.MIN_SHOTS_REPORT,
             spread: stdDev(shots.map(s => s.spinRate)) };
  }

  // The sentence that must accompany any spin figure, so it is never read as
  // a trend. Deliberately blunt.
  const CHANGE_CAVEAT =
    'Spin is measured here because you used an RPT ball, so this describes today accurately. ' +
    'It is still not a number to track between sessions: a golfer’s own spin varies more ' +
    'session to session than almost any training effect, even on a TrackMan.';

  const NOT_MEASURED =
    'Spin is only measured with a Rapsodo RPT ball. This session was not logged with one, ' +
    'so no spin figure is shown — anything the device reported would be inferred, not read.';

  // What to look at instead, and why it is legitimate.
  const ALTERNATIVE =
    'Spin loft is the mechanism behind spin, and it is derived from launch angle and attack ' +
    'angle rather than measured off the ball — so it survives without an RPT ball and is ' +
    'stable enough to prescribe from. That is what the fault engine uses.';

  return { measured, summary, CHANGE_CAVEAT, NOT_MEASURED, ALTERNATIVE };
})();

// ────────────────────────────────────────────────────────────────
// Dispersion — the tail engine, and the only strokes valuation this
// device can honestly support
// ────────────────────────────────────────────────────────────────
// Three findings force the shape of this module.
//
//   1. FAIRWAYS DO NOT TRACK HANDICAP; PENALTIES DO. Fairways hit runs 50% for
//      a scratch and 46% for a 20-handicap — essentially flat. Penalty rates
//      vary roughly eightfold over the same range. So the statistic worth
//      reporting is the TAIL of the offline distribution, not its centre and
//      not its standard deviation alone.
//
//   2. THE CHAIN FROM FACE ANGLE TO STROKES IS BROKEN. Face angle -> start
//      line is known; face-to-path -> curvature is known; directional spread
//      -> strokes is known (Broadie & Ko). The missing link is face-angle SD
//      -> directional spread: nobody has published it, and curvature amplifies
//      start-line error non-linearly, so it cannot be assumed. The correct
//      response is to skip the chain: measure the directional spread DIRECTLY
//      off the device's own outputs and feed that into the published curves.
//      Face-to-path is then the explanation offered alongside a drill, never
//      the input to the valuation.
//
//   3. A GAUSSIAN UNDER-PREDICTS THE THING THAT COSTS THE STROKES. Broadie &
//      Ko model every non-putt shot as a two-component mixture — a "good"
//      shot with probability p and a "bad" shot otherwise — because real shot
//      patterns are skewed and heavy-tailed. Fit a normal curve to 20 range
//      shots and the fat tail that generates the penalties disappears. That is
//      the reason for the 30-shot floor: the bad-shot component is rare by
//      construction, and a 15-shot sample often contains none of it.
//
// Consequences that look odd until you know why:
//
//   * OUTLIERS ARE NOT TRIMMED HERE. Everywhere else in this app a wild value
//     is a misread to be removed. Here the wild value is the measurement.
//     Trimming it would delete the bad-shot component and turn the engine into
//     exactly the Gaussian that under-predicts penalties. Only physically
//     impossible geometry is screened out.
//   * SPREAD SURVIVES A MISALIGNED UNIT, ABSOLUTE MISS DOES NOT. Aiming error
//     is a constant offset, and a constant offset cancels out of any spread
//     around the golfer's own centre. So sigma is admissible without confirmed
//     alignment; a miss measured from the target line is not, and is withheld.
//   * MEASURED SIGMA IS AN UPPER BOUND. Side carry is a modelled tier-3
//     output and carries device noise, and noise adds variance — it can never
//     subtract it. The golfer's true directional spread is at most what is
//     shown here, which means the strokes available from tightening it are at
//     most what is shown too.
const Dispersion = (() => {
  // Broadie & Ko (2009), Winter Simulation Conference, calibrated on Golfmetrics
  // (55,000+ amateur shots). The two calibrated skill levels, and the strokes
  // saved per degree of directional SD removed. These are DRIVER figures on a
  // treed course — both qualifications matter, see CAVEATS.
  const BK = [
    { score: 100, sigma: 7.9, drive: 225.0, saved: { 1: 1.4, 2: 2.6, 3: 3.9 } },
    { score:  80, sigma: 5.5, drive: 250.6, saved: { 1: 1.1, 2: 2.1, 3: 2.7 } },
  ];
  // How far outside the calibrated 5.5-7.9 band the curves may still be used,
  // with the result flagged as clamped rather than interpolated. Beyond this
  // the honest answer is no number at all.
  const EXTRAP_MARGIN = 1.5;

  // Geometry screen, not a statistical one. A shot cannot have flown less than
  // 20 yards of carry and still be a full swing worth measuring, and offline
  // beyond 45 degrees is a mis-read rather than a bad shot.
  const MIN_CARRY = 20;
  const MAX_ANGLE = 45;

  // Broadie & Ko's own two-component split: shots inside the core are the
  // "good" component, shots outside it are the "bad" one. 2 sigma of the
  // robust core puts 4.55% of a true Gaussian outside — the reference rate
  // every observed tail is tested against.
  const TAIL_K = 2;
  const GAUSSIAN_TAIL = 0.0455;
  // SD of a normal truncated at +/-2 sigma, as a fraction of the untruncated
  // SD: sqrt(1 - 2k*phi(k)/(2*Phi(k)-1)) at k=2. Dividing by it un-shrinks a
  // scale measured inside the cut back to the scale of the core it came from.
  const TRUNC_FACTOR = 0.8796;

  const CAVEATS = [
    'These curves are for a treed course. On a course with no trees, or with rough ' +
    'and no penalty areas, Broadie & Ko\'s own simulations flip the verdict and distance ' +
    'beats accuracy outright. The strokes below are not universal.',
    'The published accuracy and distance scenarios are not difficulty-equated — the ' +
    'accuracy steps span a wider slice of real skill than the distance steps do, which ' +
    'inflates how valuable accuracy looks. Treat the direction as supported and the size as uncertain.',
    'Side carry is a modelled output, not a reading, and measurement noise adds spread ' +
    'without ever removing it. Your true directional spread is at most what is shown, so ' +
    'the strokes on offer are at most this too.',
    'This values the spread. It says nothing about what caused it — face, path, strike ' +
    'and wind all land in the same number, and no published work maps any one of them onto ' +
    'strokes. Any drill offered here is an explanation, not part of the arithmetic.',
  ];

  // ── The measurement ───────────────────────────────────────────
  // Directional error in degrees, right positive. Angle rather than yards
  // because it is the scale-invariant, target-relative form — the same form
  // that survived the only study to test whether range performance predicts
  // on-course performance, and the form Broadie & Ko's model consumes.
  function offlineAngle(shot) {
    const side = shot?.sideCarry, carry = shot?.carryDistance;
    if (!Number.isFinite(side) || !Number.isFinite(carry) || carry < MIN_CARRY) return null;
    const a = Math.atan2(side, carry) * 180 / Math.PI;
    return Math.abs(a) > MAX_ANGLE ? null : a;
  }

  // ── Gates ─────────────────────────────────────────────────────
  // Shots carry their measurement context from Store.stamp(), so this works on
  // a session's shots and on a set flattened across sessions alike.
  const ballOk = s => s?._ball === 'premium' || s?._ball === 'rpt';
  const aligned = shots => shots.length > 0 && shots.every(s => s._aligned === true);

  function eligible(shots, clubType) {
    const all = (shots || []).filter(s => !clubType || s.clubType === clubType);
    const onBall = all.filter(ballOk);
    const usable = onBall.filter(s => offlineAngle(s) !== null);
    const reasons = [];
    if (all.length && onBall.length < all.length) {
      reasons.push(onBall.length === 0
        ? 'Range balls, or a ball type that was never recorded. Range-ball dispersion runs 2–4× ' +
          'wider than your own ball off a zero-variance robot, so a tail measured on them is the ' +
          'ball\'s tail as much as yours. Nothing below can be computed from these shots.'
        : `${all.length - onBall.length} of ${all.length} shots were not hit with a premium or RPT ` +
          'ball and are excluded — range-ball spread is not comparable to your own ball\'s.');
    }
    if (usable.length < onBall.length) {
      reasons.push(`${onBall.length - usable.length} shot${onBall.length - usable.length === 1 ? '' : 's'} ` +
        'had no side carry or no carry distance, so no offline angle could be computed.');
    }
    // Only a real shortfall, not one the ball gate has already caused — saying
    // "you have 0 of the 30 needed" under "none of these balls count" reads as
    // a second, independent problem when it is the same one twice.
    if (usable.length < Metrics.MIN_SHOTS_TAIL && onBall.length > 0) {
      reasons.push(`A tail needs ${Metrics.MIN_SHOTS_TAIL} usable shots and this has ${usable.length}. ` +
        'The bad shot is rare by definition — a small sample usually contains none of them, and ' +
        'reporting a tail without one would say your dispersion is tighter than it is.');
    }
    return { ok: usable.length >= Metrics.MIN_SHOTS_TAIL, shots: usable,
             n: usable.length, need: Math.max(0, Metrics.MIN_SHOTS_TAIL - usable.length), reasons };
  }

  // ── Statistics ────────────────────────────────────────────────
  function percentile(sorted, p) {
    if (!sorted.length) return null;
    const i = (sorted.length - 1) * p;
    const lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  // Exact upper-tail binomial probability. Used to ask whether the observed
  // number of bad shots is more than a Gaussian would produce by chance —
  // "heavy-tailed" is a claim, so it gets tested rather than asserted.
  function binomTail(k, n, p) {
    if (k <= 0) return 1;
    let term = Math.pow(1 - p, n), sum = 0;
    for (let i = 0; i < k && i <= n; i++) {
      sum += term;
      term *= (p / (1 - p)) * ((n - i) / (i + 1));
    }
    return Math.max(0, Math.min(1, 1 - sum));
  }

  // Scale of the good-shot component. The MAD is the starting point — it has a
  // 50% breakdown point, so blow-ups cannot capture it — and then the scale is
  // re-measured from the shots currently inside the cut and un-shrunk for the
  // truncation, until it settles on the core.
  //
  // THE REFINEMENT ONLY EVER GOES DOWN, and that is not a tweak. The iteration
  // has two fixed points. The lower one is the core, which is what is wanted.
  // The upper one is the whole contaminated spread divided by TRUNC_FACTOR,
  // and it is self-sustaining: once the cut sits past every shot, nothing is
  // truncated, so the correction inflates a scale that was never shrunk, which
  // widens the cut further. An unguarded version of this walked a 40-shot set
  // from a 7.5 deg MAD up to 9.3 deg and then reported zero bad shots in a
  // pattern that plainly had some. Refusing every upward step keeps it on the
  // branch that converges to the core; on clean data the true sigma is already
  // a fixed point, so nothing is given up.
  function coreScale(devs) {
    const sorted = [...devs].sort((a, b) => a - b);
    let scale = 1.4826 * percentile(sorted, 0.5);
    if (!(scale > 0)) return 0;
    for (let i = 0; i < 20; i++) {
      const inside = devs.filter(d => d <= TAIL_K * scale);
      if (inside.length < 4) break;
      const next = Math.sqrt(inside.reduce((a, d) => a + d * d, 0) / inside.length) / TRUNC_FACTOR;
      if (!(next > 0) || next >= scale || scale - next < 1e-6 * scale) break;
      scale = next;
    }
    return scale;
  }

  function tail(shots, clubType) {
    const gate = eligible(shots, clubType);
    if (!gate.ok) return { ok: false, ...gate };
    const set = gate.shots;
    const angles = set.map(offlineAngle);
    const sorted = [...angles].sort((a, b) => a - b);
    const centre = percentile(sorted, 0.5);

    // Scale of the "good shot" component, measured so that the bad shots do
    // not inflate the yardstick used to find them. See coreScale().
    const dev = angles.map(a => Math.abs(a - centre)).sort((a, b) => a - b);
    const core = coreScale(dev);

    // The full SD is what Broadie & Ko's sigma_alpha means: the spread of the
    // whole mixture, bad shots included. Not the core.
    const sigma = stdDev(angles);

    const cut = TAIL_K * core;
    const bad = core > 0 ? angles.filter(a => Math.abs(a - centre) > cut) : [];
    const expected = GAUSSIAN_TAIL * angles.length;
    const pValue = core > 0 ? binomTail(bad.length, angles.length, GAUSSIAN_TAIL) : 1;

    return {
      ok: true, n: angles.length, clubType: clubType || null,
      aligned: aligned(set),
      centre, sigma, core,
      p90: percentile(dev, 0.90), p95: percentile(dev, 0.95),
      worst: dev[dev.length - 1],
      // Absolute miss is only meaningful measured from a target the unit
      // actually knew about. Without confirmed alignment the centre is
      // wherever the unit happened to point, so this is withheld rather than
      // quoted against a target line that was never established.
      bias: aligned(set) ? mean(angles) : null,
      bad: bad.length, badRate: bad.length / angles.length,
      expectedBad: expected, pValue,
      // Heavy-tailed means: more bad shots than a normal curve fitted to your
      // own core would produce, at the 5% level. This is the component that
      // costs the strokes, and the one a Gaussian summary would hide.
      heavyTailed: bad.length > expected && pValue < 0.05,
      caveats: gate.reasons,
    };
  }

  // ── Two-sided miss census ─────────────────────────────────────
  // A one-way miss and a two-way miss are different problems needing different
  // work, and averaging them produces a centre that looks fine while both
  // tails are live. Classified on the tail shots only — where the strokes are.
  function census(shots, clubType) {
    const t = tail(shots, clubType);
    if (!t.ok) return { ok: false, ...t };
    const gate = eligible(shots, clubType);
    const angles = gate.shots.map(offlineAngle);
    if (!(t.core > 0)) {
      return { ok: true, left: 0, right: 0, total: 0, verdict: 'indeterminate', cut: 0, centre: t.centre,
               note: 'Your shots are too tightly clustered for a core spread to be measured, so there is ' +
                     'no tail to take a side. Nothing to classify — that is a good problem.' };
    }
    const cut = TAIL_K * t.core;
    const left = angles.filter(a => a - t.centre < -cut).length;
    const right = angles.filter(a => a - t.centre > cut).length;
    const total = left + right;
    let verdict = 'indeterminate', note;
    if (total < 3) {
      note = `Only ${total} shot${total === 1 ? '' : 's'} landed outside your own core, which is too few ` +
             'to tell a one-way miss from a two-way one. That is not a bad sign — it means the tail is thin.';
    } else if (left >= 2 && right >= 2) {
      verdict = 'two-way';
      note = `Your misses go both ways — ${left} left and ${right} right, beyond your own core spread. ` +
             'A two-way miss is a different problem from a one-way one: there is no side of the target ' +
             'you can safely aim away from, so the same corridor costs you twice as much.';
    } else {
      verdict = 'one-way';
      const side = left > right ? 'left' : 'right';
      note = `Your tail is one-way — ${Math.max(left, right)} of ${total} bad shots go ${side}. ` +
             'That is the more manageable pattern: a one-way miss can be aimed around while you work on it.';
    }
    return { ok: true, left, right, total, verdict, note, cut, centre: t.centre };
  }

  // ── Valuation ─────────────────────────────────────────────────
  // The only strokes number in this app. It converts a change in directional
  // spread, and nothing else, using published curves. It does not convert a
  // club-delivery metric, and it never attributes the change to a cause.
  function value(sigma, deltaDeg) {
    if (!Number.isFinite(sigma) || !Number.isFinite(deltaDeg) || deltaDeg <= 0) return null;
    const hi = BK[0], lo = BK[1];   // 7.9 deg and 5.5 deg
    let s = sigma, mode = 'interpolated';
    if (sigma > hi.sigma || sigma < lo.sigma) {
      if (sigma > hi.sigma + EXTRAP_MARGIN || sigma < lo.sigma - EXTRAP_MARGIN) {
        return { strokes: null, mode: 'out-of-range',
                 note: `Broadie & Ko calibrated these curves on golfers between ${lo.sigma}° and ` +
                       `${hi.sigma}° of directional spread, and yours is ${fmt(sigma, 1)}°. Extending ` +
                       'their numbers that far past their own data would be inventing a figure, so there is none.' };
      }
      s = Math.min(hi.sigma, Math.max(lo.sigma, sigma));
      mode = 'clamped';
    }
    const d = Math.min(3, deltaDeg);
    // Linear on the published 1/2/3-degree steps, through the origin.
    const step = curve => {
      const k = Math.floor(d), frac = d - k;
      const at = j => (j <= 0 ? 0 : curve[Math.min(3, j)]);
      return at(k) + frac * (at(k + 1) - at(k));
    };
    const w = (s - lo.sigma) / (hi.sigma - lo.sigma);     // 0 at the 80-golfer, 1 at the 100-golfer
    const strokes = step(lo.saved) + w * (step(hi.saved) - step(lo.saved));
    return {
      strokes, mode, sigmaUsed: s, delta: d,
      truncated: deltaDeg > 3,
      note: mode === 'clamped'
        ? `Your spread of ${fmt(sigma, 1)}° sits outside the ${lo.sigma}°–${hi.sigma}° band Broadie & Ko ` +
          `calibrated, so this is their nearest calibrated golfer at ${fmt(s, 1)}° rather than you. Read it as an order of magnitude.`
        : null,
      caveats: CAVEATS,
    };
  }

  // ── Trend ─────────────────────────────────────────────────────
  // Directional spread per session, and whether the latest move is bigger than
  // this golfer's own session-to-session wobble. Sessions measured under
  // different conditions are dropped rather than compared: a range-ball session
  // next to a premium-ball one shows a change in the ball, not the swing.
  function trend(sessions, clubType) {
    const points = (sessions || [])
      .filter(sn => Conditions.ball(sn).dispersionValid)
      .map(sn => {
        const t = tail(Store.stamp(sn).shots, clubType);
        return t.ok ? { date: sn.date, id: sn.id, sigma: t.sigma, p95: t.p95, n: t.n } : null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (points.length < 2) {
      return { ok: false, points, note: points.length === 1
        ? 'One qualifying session so far. A tail is only a trend once there are several to compare.'
        : 'No session yet has 30 usable shots on a premium or RPT ball, so there is no tail to trend.' };
    }
    const sigmas = points.map(p => p.sigma);
    const delta = sigmas[sigmas.length - 1] - sigmas[sigmas.length - 2];
    // The golfer's own between-session wobble is the yardstick. Under five
    // sessions it is not established well enough to rule on, and saying so is
    // the honest output — a population figure would describe other people.
    const noise = points.length >= 5 ? stdDev(sigmas.slice(0, -1)) : null;
    return {
      ok: true, points, delta, noise,
      real: noise === null ? null : Math.abs(delta) > noise,
      note: noise === null
        ? `${points.length} qualifying session${points.length === 1 ? '' : 's'}. It takes five before your own ` +
          'session-to-session variation is known well enough to say whether a move in the tail is real.'
        : Math.abs(delta) > noise
          ? `${delta < 0 ? 'Tighter' : 'Wider'} by ${fmt(Math.abs(delta), 1)}°, which is more than your own ` +
            `session-to-session variation of ${fmt(noise, 1)}°. That is a real move.`
          : `${fmt(Math.abs(delta), 1)}° of movement, inside your own session-to-session variation of ` +
            `${fmt(noise, 1)}°. No detectable change — which is not the same as no change.`,
    };
  }

  // ── The report ────────────────────────────────────────────────
  // Valuation is driver-only on purpose: Broadie & Ko's published curves are
  // driver curves, and there is no equivalent table for an 8-iron. Every other
  // club gets the tail audit without a strokes figure, which is the honest
  // split rather than a missing feature.
  function report(shots, clubType, target = 1) {
    const t = tail(shots, clubType);
    if (!t.ok) return { ok: false, ...t };
    const c = census(shots, clubType);
    const valuable = clubType === 'd';
    return {
      ok: true, tail: t, census: c,
      value: valuable ? value(t.sigma, target) : null,
      valuationWithheld: valuable ? null :
        'Broadie & Ko calibrated their strokes curves on tee shots with a driver. There is no published ' +
        'equivalent for the rest of the bag, so the tail is reported here and left unpriced.',
    };
  }

  return { BK, CAVEATS, MIN_CARRY, MAX_ANGLE, TAIL_K, GAUSSIAN_TAIL,
           offlineAngle, eligible, tail, census, value, trend, report };
})();

// ────────────────────────────────────────────────────────────────
// Strike — the highest-value lever an amateur has, and the only one
// this device measures at tier 1 end to end
// ────────────────────────────────────────────────────────────────
// The single most actionable finding in the research base, from the USGA/R&A's
// own 2022 equipment table:
//
//              club spd   ball spd   spin    smash
//   PGA Tour      113        167     2,686   1.478
//   LPGA Tour       94       140     2,611   1.489
//   Avg male am     93       133     3,275   1.430
//
// The average male amateur already swings at LPGA club speed — 93 against 94 —
// and makes 7 mph less ball speed doing it. The amateur driver problem is not
// engine speed. It is where the ball meets the face, and that shows up whole in
// smash factor, which is a tier-1 metric on this device: no derivation, no
// model output, no spin. It is also the fastest lever to move — weeks of strike
// work against months of physical training — and it is the opposite of what
// almost every golfer self-selects, which is speed training.
//
// So this module exists to make the strike gap visible and to keep it honest:
//
//   * IT STOPS AT YARDS. The distance-to-strokes link is real and published
//     (1.2 to 1.8 strokes per 20 yards), so a strokes figure here would not be
//     the broken face-to-strokes chain. It is still not offered. This app has
//     exactly ONE strokes number, in `Dispersion`, computed from a directly
//     measured spread — and a second one, arrived at down a different road,
//     would leave a golfer holding two figures with no way to know which
//     question each answers or whether they may be added. The yards are the
//     honest end of this chain.
//   * THE CARRY CONVERSION IS DRIVER-ONLY. The research base works its example
//     at driver ball speeds; no published anchor gives yards per mph for a
//     9-iron, where a shorter flight makes the ratio smaller. Other clubs get
//     the ball-speed figure and no yardage.
//   * EVERY GAP IS CHECKED AGAINST THE GOLFER'S OWN SAMPLING NOISE before it
//     is called a gap at all. A 0.01 shortfall measured over ten shots with a
//     0.02 spread is not a shortfall, it is the same number twice.
const Strike = (() => {
  // Chain B in the research base, worked at driver speeds: closing 1.430 to
  // 1.478 at 93 mph takes ball speed 133 to 137.5, +4.5 mph, and that is put
  // at +7 to +8 yards. So 1.55 to 1.78 yards per mph of ball speed — carried
  // as the RANGE the source gives rather than collapsed to a midpoint, because
  // the range is the honest precision of the claim.
  const YD_PER_BALL_MPH = { lo: 7 / 4.5, hi: 8 / 4.5 };

  // A club-speed spread this wide is needed before a smash-versus-speed slope
  // means anything: fit a line through ten swings that were all the same
  // effort and the slope is noise with a direction.
  const MIN_SPEED_RANGE = 5;      // mph
  const MIN_SPEED_SHOTS = 15;

  const clubShots = (shots, club) =>
    (shots || []).filter(s => (!club || s.clubType === club) && Number.isFinite(s.smashFactor) && s.smashFactor > 0);

  // What this club's strike is worth aiming at. Tour smash falls steeply with
  // loft — 1.48 at driver, 1.36 at 7-iron, 1.20 at lob wedge — so a single
  // "good smash" number across the bag would call every wedge a disaster.
  function reference(club) {
    const row = Benchmarks.get(club);
    return row ? row.pga.sf : null;
  }

  // ── Baseline (drill A1) ───────────────────────────────────────
  // A measurement, not a training session. Mean AND spread, because the spread
  // is the thing most strike drills actually move — a golfer can hold a mean
  // while turning a tight pattern into a scattered one.
  function baseline(shots, club) {
    const set = clubShots(shots, club);
    const iv = Metrics.interval(set.map(s => s.smashFactor), '', 3);
    if (!iv || iv.n < Metrics.MIN_SHOTS_REPORT) {
      return { ok: false, n: iv ? iv.n : set.length,
               need: Math.max(0, Metrics.MIN_SHOTS_REPORT - (iv ? iv.n : set.length)),
               note: `Smash factor needs ${Metrics.MIN_SHOTS_REPORT} shots of a club before a mean is worth ` +
                     `reporting, and this has ${iv ? iv.n : set.length}.` };
    }
    return { ok: true, club, mean: iv.mean, ci: iv.ci, n: iv.n, dropped: iv.dropped,
             spread: stdDev(set.map(s => s.smashFactor)),
             clubSpeed: Metrics.interval(set.map(s => s.clubSpeed), '', 1),
             ballSpeed: Metrics.interval(set.map(s => s.ballSpeed), '', 1) };
  }

  // ── The gap, and what it is worth (drill A1 + chain B) ────────
  function headroom(shots, club) {
    const b = baseline(shots, club);
    if (!b.ok) return { ok: false, ...b };
    const ref = reference(club);
    if (ref === null) return { ok: false, note: 'No tour reference for this club.' };
    const gap = ref - b.mean;

    // Beyond this golfer's own sampling noise, or not a gap at all.
    if (gap <= b.ci) {
      return { ok: true, club, mean: b.mean, ref, gap, real: false, n: b.n,
               note: gap <= 0
                 ? `Your ${clubLabel(club)} smash of ${fmt(b.mean, 3)} is at or above the tour reference of ` +
                   `${fmt(ref, 2)}. There is no strike gap to work on here — look at another club.`
                 : `The ${fmt(gap, 3)} between your ${fmt(b.mean, 3)} and the tour ${fmt(ref, 2)} is smaller than ` +
                   `the ±${fmt(b.ci, 3)} on your own ${b.n}-shot average. That is not a gap yet, it is the same ` +
                   `number measured twice. More shots would settle it.` };
    }

    const speed = b.clubSpeed && b.clubSpeed.n >= Metrics.MIN_SHOTS_REPORT ? b.clubSpeed.mean : null;
    const ballGain = speed === null ? null : gap * speed;
    const carry = (club === 'd' && ballGain !== null)
      ? { lo: ballGain * YD_PER_BALL_MPH.lo, hi: ballGain * YD_PER_BALL_MPH.hi } : null;
    return {
      ok: true, club, mean: b.mean, ref, gap, real: true, n: b.n, ci: b.ci,
      clubSpeed: speed, ballGain, carry,
      // Named as a chained inference every time it is shown. Each link is
      // sourced, the arithmetic is exact, and the result is still an estimate
      // built out of three separate claims rather than something measured.
      chained: true,
      note: speed === null
        ? `Your ${clubLabel(club)} smash is ${fmt(gap, 3)} below the tour reference. Club speed was not ` +
          `recorded often enough to say what that is worth in ball speed.`
        : `Closing that ${fmt(gap, 3)} at your own ${fmt(speed, 0)} mph club speed is worth about ` +
          `${fmt(ballGain, 1)} mph of ball speed` +
          (carry ? `, which works out at roughly ${fmt(carry.lo, 0)}–${fmt(carry.hi, 0)} yards of carry.` : '.'),
    };
  }

  // ── The weak link across the bag (drill A13) ──────────────────
  // Strike quality is rarely uniform, and the club a golfer practises is
  // rarely the one costing them most. Only clubs with a real sample compete.
  function weakLink(shots) {
    const clubs = [...new Set((shots || []).map(s => s.clubType).filter(Boolean))];
    const rows = clubs.map(c => {
      const b = baseline(shots, c);
      const ref = reference(c);
      if (!b.ok || ref === null) return null;
      return { club: c, mean: b.mean, ref, gap: ref - b.mean, ci: b.ci, n: b.n, real: ref - b.mean > b.ci };
    }).filter(Boolean).sort((a, b2) => b2.gap - a.gap);
    if (!rows.length) {
      return { ok: false, rows: [],
               note: `No club has the ${Metrics.MIN_SHOTS_REPORT} shots needed to compare strike quality across the bag.` };
    }
    const worst = rows.find(r => r.real) || null;
    return {
      ok: true, rows, worst,
      note: worst
        ? `Across the ${rows.length} club${rows.length === 1 ? '' : 's'} with enough shots, your ` +
          `${clubLabel(worst.club)} sits furthest below its own tour reference — ${fmt(worst.gap, 3)} of smash. ` +
          `Strike quality is rarely uniform, and this is not usually the club people practise.`
        : `None of the ${rows.length} club${rows.length === 1 ? '' : 's'} with enough shots is measurably below ` +
          `its tour reference. Nothing to rank.`,
    };
  }

  // ── Does swinging harder cost you the strike? (drill A14) ─────
  // The question every golfer who has bought a speed trainer should ask first.
  // A least-squares slope of smash on club speed, reported only when the
  // session actually varied the effort and the slope clears its own error.
  function speedCost(shots, club) {
    const set = clubShots(shots, club).filter(s => Number.isFinite(s.clubSpeed) && s.clubSpeed > 0);
    if (set.length < MIN_SPEED_SHOTS) {
      return { ok: false, n: set.length,
               note: `This needs ${MIN_SPEED_SHOTS} shots of one club with club speed recorded; there are ${set.length}.` };
    }
    const xs = set.map(s => s.clubSpeed), ys = set.map(s => s.smashFactor);
    const range = Math.max(...xs) - Math.min(...xs);
    if (range < MIN_SPEED_RANGE) {
      return { ok: false, n: set.length, range,
               note: `Every swing here was within ${fmt(range, 1)} mph of the others. A line fitted through one ` +
                     `effort level has a slope, but it does not mean anything — hit a block deliberately varying ` +
                     `effort between about 60% and full to answer this.` };
    }
    const mx = mean(xs), my = mean(ys);
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
    const resid = ys.map((y, i) => y - (my + slope * (xs[i] - mx)));
    const se = Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / (set.length - 2) / sxx);
    const real = Math.abs(slope) > 1.96 * se;
    const perTen = slope * 10;
    return {
      ok: true, club, n: set.length, range, slope, se, real, perTen,
      note: !real
        ? `Across a ${fmt(range, 0)} mph spread of club speed your strike held steady — the slope is inside its ` +
          `own error, so there is no evidence here that swinging harder costs you the middle of the face.`
        : slope < 0
          ? `Your smash falls about ${fmt(Math.abs(perTen), 3)} for every 10 mph of extra club speed, and that ` +
            `slope is bigger than its own error. Speed is costing you strike — which is the case where speed ` +
            `training makes a golfer shorter, not longer.`
          : `Your smash RISES about ${fmt(perTen, 3)} per 10 mph. Strike holds up as you swing harder, so speed ` +
            `work is not being paid for out of contact.`,
    };
  }

  // ── Does it hold up over a long session? (drill A15) ──────────
  // Fatigue is a within-session physical effect, so unlike a learning claim it
  // is legitimately measured within the session. Judged against this golfer's
  // own shot-to-shot spread, never a published threshold.
  function fatigue(shots, club) {
    const set = clubShots(shots, club);
    const third = Math.floor(set.length / 3);
    if (third < 5) {
      return { ok: false, n: set.length,
               note: `A fatigue check compares the first third of a block with the last, and needs at least 15 ` +
                     `shots of one club to do it. There are ${set.length}.` };
    }
    const first = set.slice(0, third).map(s => s.smashFactor);
    const last = set.slice(-third).map(s => s.smashFactor);
    const drop = mean(first) - mean(last);
    // The spread of a difference of two means, from this golfer's own shots.
    const band = 1.96 * Math.sqrt((stdDev(first) ** 2 + stdDev(last) ** 2) / third);
    return {
      ok: true, club, n: set.length, per: third, first: mean(first), last: mean(last), drop, band,
      real: Math.abs(drop) > band,
      note: Math.abs(drop) <= band
        ? `Your strike at the end of the block matched the start to within your own variation. No measurable ` +
          `fade over ${set.length} shots.`
        : drop > 0
          ? `Your smash fell ${fmt(drop, 3)} from the first ${third} shots to the last ${third}, beyond your own ` +
            `variation. Past that point in a block you are practising a strike you do not have fresh.`
          : `Your smash ROSE ${fmt(-drop, 3)} across the block, beyond your own variation — you were warming up, ` +
            `not tiring. The first ${third} shots are not your baseline.`,
    };
  }

  // ── Trend (drill A18) ─────────────────────────────────────────
  // A trend across sessions, never a paired before-and-after: two sessions
  // cannot separate a change from the golfer's ordinary week-to-week swing.
  function trend(sessions, club) {
    const points = (sessions || [])
      .map(sn => {
        const b = baseline((sn.shots || []), club);
        return b.ok ? { date: sn.date, id: sn.id, mean: b.mean, spread: b.spread, n: b.n } : null;
      })
      .filter(Boolean)
      .sort((a, b2) => new Date(a.date) - new Date(b2.date));
    if (points.length < 3) {
      return { ok: false, points,
               note: `Smash trends need at least three sessions with ${Metrics.MIN_SHOTS_REPORT}+ shots of this ` +
                     `club; there ${points.length === 1 ? 'is 1' : `are ${points.length}`}. Two sessions cannot ` +
                     `tell a change from an ordinary week.` };
    }
    const means = points.map(p => p.mean);
    const delta = means[means.length - 1] - means[0];
    const noise = stdDev(means.slice(0, -1));
    return {
      ok: true, points, delta, noise, real: Math.abs(delta) > 1.96 * noise,
      note: Math.abs(delta) > 1.96 * noise
        ? `${delta > 0 ? 'Up' : 'Down'} ${fmt(Math.abs(delta), 3)} across ${points.length} sessions, beyond your ` +
          `own session-to-session variation. That is a real change in strike quality.`
        : `${fmt(Math.abs(delta), 3)} of movement across ${points.length} sessions, inside your own ` +
          `session-to-session variation. No detectable change — which is not the same as no change.`,
    };
  }

  function report(shots, club) {
    return { club, baseline: baseline(shots, club), headroom: headroom(shots, club),
             speedCost: speedCost(shots, club), fatigue: fatigue(shots, club) };
  }

  return { YD_PER_BALL_MPH, MIN_SPEED_RANGE, MIN_SPEED_SHOTS,
           reference, baseline, headroom, weakLink, speedCost, fatigue, trend, report };
})();

// ────────────────────────────────────────────────────────────────
// QuietEye — the best-evidenced intervention in golf, and the only
// part of this app that runs without the launch monitor
// ────────────────────────────────────────────────────────────────
// Every other module here is downstream of a radar unit. This one is not, and
// that is the point: the MLM2PRO does not measure putting at all, while the
// intervention with the largest surviving effect in the entire research base
// is a putting one.
//
//   Vine, Moore & Wilson (2011), 22 elite golfers, mean handicap 2.78. Ten
//   competitive rounds of baseline, ONE 20-putt training session with gaze
//   video feedback, ten more competitive rounds:
//
//     putts per round      27.61 trained vs 29.89 control   (-1.92, p<.05)
//     6-10 ft holed        +5%           vs no change
//     under pressure       60% holed     vs 36%             (p<.005)
//     pressure error       4.45 cm       vs 10.28 cm        (p<.005)
//
//   Lebeau et al. (2016), meta-analysis of 36 studies: d = 0.84, falling to
//   0.69 after trim-and-fill for publication bias. Lab versus field was not a
//   significant moderator. Replicated by He et al. (2024).
//
// d ~= 0.69 after bias correction is the largest effect in this document by
// some distance — external focus of attention, which the whole coaching layer
// is built around, sits at 0.15.
//
// THE HARD LIMIT, AND WHY THE MODULE IS SHAPED THIS WAY. Quiet eye is a
// property of the golfer's GAZE: how long the eyes fixate the back of the ball
// before the stroke starts, and whether they hold after impact. A phone can
// record that; this app cannot see it. So the app must never say a quiet eye
// got longer, shorter or better. What it can do is state the protocol exactly
// as it was run, and track the OUTCOME the study actually moved — which is
// putts holed, not gaze.
//
// That split is enforced in the code: there is no field anywhere in here for a
// gaze duration, because a number the app cannot measure is a number it would
// eventually be tempted to display.
const QuietEye = (() => {
  const KEY = 'slPutts';

  // The protocol as published. The timings are the intervention — a routine
  // without them is just a routine.
  const PROTOCOL = [
    { n: 1, title: 'Fix the routine first',
      detail: 'Same number of looks at the hole, same number of practice strokes, every putt. The gaze ' +
              'timings below are measured from a stable routine; without one there is nothing to time.' },
    { n: 2, title: 'Fixate the back of the ball for 2–3 seconds',
      detail: 'Before the stroke starts, not during it. This is the quiet-eye period itself, and its ' +
              'duration predicted 43% of the variance in putting performance in the original study.' },
    { n: 3, title: 'Hold the gaze 200–300 ms after impact',
      detail: 'Roughly a quarter of a second on the spot where the ball was. Looking up early is what ' +
              'collapses under pressure — untrained golfers dropped from 2,794 ms of quiet eye to 1,405 ms.' },
    { n: 4, title: 'Twenty putts is the whole intervention',
      detail: 'A single 20-putt session with video feedback produced the result. This is not a programme ' +
              'that needs months; it needs a phone on a tripod and one honest session.' },
  ];

  // What may and may not be claimed. Kept as data so the UI cannot render the
  // effect without the qualifications attached to it.
  const EVIDENCE = {
    effect: 'd ≈ 0.69 after correction for publication bias, across 36 studies — the largest effect of any ' +
            'intervention in this app\'s research base. For comparison, the external-focus cueing that the ' +
            'rest of the coaching here is built on sits at about 0.15.',
    caveats: [
      'The −1.92 putts per round came from 22 golfers with a mean handicap of 2.78. It is a real, ' +
      'competition-measured result, and it is not a promise to a mid-handicapper — an elite putter and a ' +
      'weekend one have different amounts of room to gain.',
      'This app cannot see your eyes. It records what you hole; it has no idea how long you fixated, and ' +
      'it will never tell you your quiet eye improved. Record yourself if you want to check the gaze part — ' +
      'video feedback was the training vehicle in the study, not an optional extra.',
      'Nothing here comes from the launch monitor. The MLM2PRO does not measure putting, so every number ' +
      'in this section is one you entered.',
    ],
  };

  // Distance bands. 6-10 ft is called out because that is the band where the
  // trained group gained, and pooling it with tap-ins would bury the signal.
  const BANDS = [
    { id: 'short', label: 'Inside 6 ft', lo: 0,  hi: 6 },
    { id: 'mid',   label: '6–10 ft',     lo: 6,  hi: 10, focus: true },
    { id: 'long',  label: '10–20 ft',    lo: 10, hi: 20 },
    { id: 'lag',   label: '20 ft +',     lo: 20, hi: Infinity, lag: true },
  ];
  const band = ft => BANDS.find(b => ft >= b.lo && ft < b.hi) || BANDS[BANDS.length - 1];

  // Wilson score interval. The normal approximation is wrong at these sample
  // sizes — it can hand back a lower bound below zero on a 20-putt session,
  // which is not a probability. Wilson stays inside 0..1 and behaves at the
  // extremes, including the 20-for-20 case where the naive interval has zero
  // width and claims certainty.
  function wilson(holed, n, z = 1.96) {
    if (!n) return null;
    const p = holed / n, z2 = z * z;
    const d = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / d;
    const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / d;
    return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), n };
  }

  // HOW MANY PUTTS BEFORE A CHANGE IS VISIBLE. This is the number that keeps
  // the rest of the module honest, and it is deliberately shown BEFORE a
  // golfer logs anything rather than as a footnote afterwards.
  //
  // The study's headline is +5% holed from 6-10 ft. Detecting a five-point
  // move in a proportion around 0.3 needs a few hundred putts per side at
  // conventional power — so a 20-putt session cannot show it, and any app that
  // graphs 20 putts against 20 putts and calls the difference progress is
  // graphing noise. Two-proportion normal approximation, alpha .05, power .80.
  function puttsToDetect(baseRate, delta = 0.05) {
    const p1 = Math.min(0.999, Math.max(0.001, baseRate));
    const p2 = Math.min(0.999, Math.max(0.001, p1 + delta));
    const pbar = (p1 + p2) / 2;
    const za = 1.959964, zb = 0.8416212;
    const n = Math.pow(za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2)
              / Math.pow(p2 - p1, 2);
    return Math.ceil(n);
  }

  // The same question turned round, and the more useful direction. "You need
  // 1,400 putts a side to see the study's five points" is true and it is where
  // a lot of self-tracking quietly dies — nobody hits 1,400 six-footers. So
  // also answer: given the putts you HAVE, what size of change could you see?
  //
  // That is always answerable, it shrinks usefully as the log grows, and it
  // turns a dead end into a bound. Two hundred putts a side cannot confirm a
  // five-point gain, but it can rule out a fifteen-point one, and knowing which
  // claims your own data can and cannot support is the whole point.
  function detectableDelta(nPerSide, baseRate) {
    if (!nPerSide || nPerSide < 5) return null;
    let lo = 0.001, hi = 0.9;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (puttsToDetect(baseRate, mid) <= nPerSide) hi = mid; else lo = mid;
    }
    return hi;
  }

  // ── Stored sessions ───────────────────────────────────────────
  // A putt is { ft, holed, inches? } — distance, whether it went in, and how
  // far away it finished if it did not. There is no gaze field. On purpose.
  function all() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-200))); } catch (_) {}
  }
  function record(session) {
    const putts = (session?.putts || []).filter(p => Number.isFinite(p.ft) && p.ft >= 0);
    if (!putts.length) return null;
    const row = {
      id: (crypto.randomUUID ? crypto.randomUUID() : 'qe-' + Date.now()),
      date: session.date || new Date().toISOString(),
      protocol: session.protocol === true,     // did they run the QE protocol this session?
      putts,
    };
    const list = all(); list.push(row); save(list);
    return row;
  }
  function clear() { save([]); }

  // ── Scoring one session ───────────────────────────────────────
  function score(putts) {
    const list = (putts || []).filter(p => Number.isFinite(p.ft));
    if (!list.length) return null;
    const byBand = BANDS.map(b => {
      const inBand = list.filter(p => band(p.ft).id === b.id);
      if (!inBand.length) return null;
      const holed = inBand.filter(p => p.holed).length;
      const left = inBand.filter(p => !p.holed && Number.isFinite(p.inches)).map(p => p.inches);
      return {
        band: b.id, label: b.label, focus: !!b.focus, lag: !!b.lag,
        n: inBand.length, holed, rate: wilson(holed, inBand.length),
        // From long range the study's own measure is proximity, not holed —
        // scoring a 40-footer on whether it dropped is scoring luck.
        proximity: left.length ? mean(left) : null,
      };
    }).filter(Boolean);
    const holed = list.filter(p => p.holed).length;
    return { n: list.length, holed, rate: wilson(holed, list.length), bands: byBand };
  }

  // ── Across sessions ───────────────────────────────────────────
  // Compares only the 6-10 ft band, because that is the band the study moved
  // and pooling it with tap-ins would drown a five-point change in a hundred
  // gimmes. Reports whether the data can even resolve the change before it
  // reports the change.
  function trend(sessions = all()) {
    const points = sessions.map(s => {
      const inBand = (s.putts || []).filter(p => band(p.ft).id === 'mid');
      if (!inBand.length) return null;
      return { date: s.date, protocol: !!s.protocol, n: inBand.length,
               holed: inBand.filter(p => p.holed).length };
    }).filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));

    const totalN = points.reduce((a, p) => a + p.n, 0);
    // One session is enough to report from. It is not enough to call a trend,
    // and the note below never does — but answering "nothing to compare" to
    // someone who has just logged twenty putts hides the one number they came
    // for, which is what their own hole rate looks like with an interval on it.
    if (!points.length) {
      return { ok: false, points, totalN,
               note: `No 6–10 ft putts logged yet. That band is where the study found its gain; inside 6 ft ` +
                     `almost everything drops whatever you do, so it cannot show a change.` };
    }
    const holed = points.reduce((a, p) => a + p.holed, 0);
    const overall = wilson(holed, totalN);
    const need = puttsToDetect(overall.p, 0.05);
    const withP = points.filter(p => p.protocol), without = points.filter(p => !p.protocol);
    const sum = arr => arr.reduce((a, p) => ({ n: a.n + p.n, holed: a.holed + p.holed }), { n: 0, holed: 0 });
    const a = sum(withP), b = sum(without);
    const perSide = Math.min(a.n, b.n) || totalN;
    const mde = detectableDelta(perSide, overall.p);
    const comparable = !!(a.n >= need && b.n >= need);
    return {
      ok: true, points, totalN, overall, need, comparable,
      protocolled: a.n ? { ...wilson(a.holed, a.n) } : null,
      plain: b.n ? { ...wilson(b.holed, b.n) } : null,
      mde,
      note: (a.n && b.n)
        ? (comparable
            ? `With the protocol you have holed ${fmt(a.holed / a.n * 100, 0)}% from 6–10 ft against ` +
              `${fmt(b.holed / b.n * 100, 0)}% without it, on enough putts either side to separate a ` +
              `five-point difference.`
            : `${a.n} putts with the protocol against ${b.n} without. At your hole rate that is enough to ` +
              `see a change of about ${fmt(mde * 100, 0)} points or bigger — the study's gain was 5, so your ` +
              `own log cannot confirm it either way yet. What it CAN do is rule out anything larger than ` +
              `${fmt(mde * 100, 0)} points, which is worth more than a percentage that moves every session.`)
        : `${totalN} putt${totalN === 1 ? '' : 's'} logged from 6–10 ft, holing ` +
          `${fmt(overall.p * 100, 0)}% (${fmt(overall.lo * 100, 0)}–${fmt(overall.hi * 100, 0)}%). ` +
          `That is a baseline, not a score: a log this size can only show a change of about ` +
          `${fmt(mde * 100, 0)} points or more.`,
    };
  }

  return { KEY, PROTOCOL, EVIDENCE, BANDS, band, wilson, puttsToDetect, detectableDelta,
           all, record, clear, score, trend };
})();

// ────────────────────────────────────────────────────────────────
// DrillLibrary — 104 drills, and the gate on each one
// ────────────────────────────────────────────────────────────────
// The list is the least interesting part. Any coaching app can hold a hundred
// drills; the research base's own framing is that the v1 library "optimised
// the wrong axis" by generating drill CONTENT when what decides whether
// practice transfers is drill STRUCTURE — when the numbers are shown, how the
// blocks are ordered, and whether the measurement behind the prescription is
// admissible at all.
//
// So every drill here carries its section's measurement gate as data, and
// `admissible()` answers a single question: given what this golfer actually
// hit, on what ball, off what surface, is this drill's precondition met? A
// drill that fails is not hidden — it is returned WITH the reason, because
// "hit 30 of these on your own ball and this unlocks" is a more useful thing
// to read than a drill list that quietly omits half of itself.
//
// The wrappers in section I are not drills and are not chosen instead of one.
// They are the Tier-A rules from the motor-learning evidence made operational,
// and they apply OVER whatever drill is running — which is why the spec says
// they matter more than which drill they wrap.
const DrillLibrary = (() => {
  // Section gates. `shots` is per club unless noted; `ball` and `surface` name
  // conditions that change what the numbers mean rather than how noisy they are.
  const SECTIONS = {
    A: { id: 'A', name: 'Strike quality', count: 18,
         why: 'The average male amateur has LPGA club speed and 1.430 smash against the tour 1.478. ' +
              'Tier-1 measurement, weeks not months, roughly 0.8–1.3 strokes a round available.',
         gate: { shots: 10, metric: 'smashFactor' },
         structure: 'Errorless progression. Bandwidth feedback: silence inside ±0.03 of target.' },
    B: { id: 'B', name: 'Dispersion tails', count: 14,
         why: 'Fairways hit is flat across handicaps, 50% to 46%. Penalties vary eightfold. ' +
              'Broadie & Ko: −2° of directional spread is −2.6 strokes for a 100-golfer, and the ' +
              'mechanism is catastrophe avoidance rather than fairways.',
         gate: { shots: 30, ball: 'premium', metric: 'sideCarry' },
         structure: 'Track p90 and p95 absolute offline, never SD alone. Blocked → serial → random.' },
    C: { id: 'C', name: 'Start-line control', count: 10,
         why: 'Face contributes 76–84% of start direction with a driver, falling to about 71% for a wedge.',
         gate: { shots: 15, metric: 'launchDirection', alignment: true },
         structure: 'Bandwidth feedback at ±2° tolerance.' },
    D: { id: 'D', name: 'Face-to-path control', count: 10,
         why: 'Face-to-path is derived here, not measured, and carries about ±1.8° of single-shot noise.',
         gate: { shots: 15, preferred: 20, metric: 'clubPath' },
         structure: 'Multi-shot mean with an interval, always. Never a single-shot value, never a ' +
                    'diagnosis from one ball. If the interval spans zero the honest output is ' +
                    '"no consistent tendency", not a drill.' },
    E: { id: 'E', name: 'Low point and strike height', count: 12,
         why: 'Attack angle is tier 2 — consumer-radar reliability for irons runs as low as 0.01–0.06 — ' +
              'and mats hide the fat strikes a low-point drill exists to catch.',
         gate: { shots: 15, metric: 'attackAngle', surface: 'grass' },
         structure: 'Prefer turf. A mat session is flagged, not refused: the shape is still real.' },
    F: { id: 'F', name: 'Distance control and gapping', count: 12,
         why: 'Carry is a model output with a 13-yard minimum detectable change at ten shots, and ' +
              'range balls destroy gapping outright — a wedge can fly further on half the spin.',
         gate: { shots: 10, ball: 'premium', metric: 'carryDistance' },
         structure: 'Premium balls only. Ten shots per club, and gapping is never read off range balls.' },
    G: { id: 'G', name: 'Speed development', count: 10,
         why: 'Strength and power first, overspeed as an adjunct. Expect +2–4 mph over 8–12 weeks, ' +
              'not +8, and never read a response off one before-and-after pair.',
         gate: { shots: 10, metric: 'clubSpeed' },
         structure: 'Trend across eight or more sessions with a band. Every speed block pairs with a ' +
                    'smash check, because speed bought out of strike quality is a net loss.' },
    H: { id: 'H', name: 'Quiet eye and putting', count: 8,
         why: 'The best-evidenced intervention in golf: d ≈ 0.69 after bias correction, −1.92 putts ' +
              'per round in competition.',
         gate: { none: true },
         structure: 'Runs on video and outcome scoring. The launch monitor measures none of it.' },
    I: { id: 'I', name: 'Practice-structure wrappers', count: 10,
         why: 'The Tier-A motor-learning rules made operational. These matter more than which drill ' +
              'they wrap.',
         gate: { none: true }, wrapper: true,
         structure: 'Applied over any drill above, never instead of one.' },
  };

  // n = the number in the research base, kept so a drill can be traced back.
  const D = (n, section, name, desc, extra = {}) => ({ n, section, name, desc, ...extra,
    id: section.toLowerCase() + n });

  const ALL = [
    // ── A. Strike quality (18) ──
    D(1,'A','Smash Baseline Audit','20 shots, log the mean AND the spread. A measurement session, not a training one — nothing later can claim a change without it.'),
    D(2,'A','Face-tape strike map','Impact tape or foot spray, 10 shots, photograph the pattern. The only direct strike-location data the MLM2PRO cannot give you.',{noDevice:true}),
    D(3,'A','Centre-strike block, tee height fixed','Remove tee-height variance before blaming the swing for strike scatter.'),
    D(4,'A','Errorless distance ladder','Start at 40% effort where centre contact is near-guaranteed; add 10% per successful block of five.'),
    D(5,'A','Toe-bias / heel-bias alternation','Deliberately strike toe, then heel, then centre. Builds strike-location control rather than avoidance.'),
    D(6,'A','High-face / low-face alternation','Same on the vertical axis. Vertical gear effect runs about 1.5–2× the horizontal.'),
    D(7,'A','Setup-distance calibration','An alignment stick as a fixed reference; re-measure smash after standardising distance from the ball.'),
    D(8,'A','Posture-hold block','Hold spine angle through impact — a common toe-strike cause. Compare smash before and after.'),
    D(9,'A','Connection-strap block','Arms-body connector. Log smash SPREAD, not the mean.'),
    D(10,'A','Half-speed proprioception reps','Ten swings at 50%, predicting the strike location before the reveal.',{prediction:true}),
    D(11,'A','Eyes-closed strike feel','Five shots, call the strike location before looking. Error estimation.',{prediction:true}),
    D(12,'A','Progressive difficulty ladder','Tee → mat → tight lie. Strike quality that only survives an easy lie is not strike quality.'),
    D(13,'A','Club-by-club smash audit','Ten shots each across the bag. Strike quality is rarely uniform; find the weak link.'),
    D(14,'A','Smash-vs-speed scatter session','Vary effort 60/80/100% and plot smash against club speed. Finds the personal speed at which strike degrades.',{shots:15}),
    D(15,'A','One-club fatigue probe','Smash in the first ten against the last ten of a long block.',{shots:15}),
    D(16,'A','Ball-position sweep','Three positions, ten shots each, smash logged per position.'),
    D(17,'A','Strike-first-then-speed sequencing','Ten strike-focused, then ten speed-focused. Tests whether speed intent costs strike.'),
    D(18,'A','Weekly smash trend review','Trend across five or more sessions with a band — never a paired comparison.',{sessions:5}),

    // ── B. Dispersion tails (14) ──
    D(19,'B','Tail Audit','30+ shots; compute p90 and p95 absolute offline. The single most diagnostic session in the app.'),
    D(20,'B','Two-sided miss census','Classify every miss left or right. A two-way miss is a different problem needing different work.'),
    D(21,'B','Worst-shot scoring game','Score the session on its worst three shots only. Trains the tail directly.'),
    D(22,'B','Penalty-simulation block','Define out-of-bounds corridors and count violations. Converts dispersion into the currency that costs strokes.'),
    D(23,'B','Committed-shape block','One shape, every ball. Two-way misses usually come from indecision, not mechanics.'),
    D(24,'B','Narrow-corridor progression','Start at a corridor you hit 90% of the time; narrow 10% per successful block.'),
    D(25,'B','Pre-shot routine enforcement','Same routine every ball; log p95 with and without.'),
    D(26,'B','Random-club tail probe','Never the same club twice in a row, 30 shots, log the tail. Range-only consistency does not transfer.'),
    D(27,'B','Fatigue tail probe','First 15 against last 15 of a long session.'),
    D(28,'B','First-ball-of-the-day protocol','Log the first shot of each session separately over ten sessions. The cold-start miss is a real, separate skill.',{sessions:10}),
    D(29,'B','Pressure tail block','A consequence attached — restart the count on a tail miss.'),
    D(30,'B','Target-change block','A new target every three balls.'),
    D(31,'B','Wind-visualisation block','Nominate an imagined crosswind, adjust the shape, log the offline.'),
    D(32,'B','Tail trend review','p95 across five or more sessions with a confidence band.',{sessions:5}),

    // ── C. Start-line control (10) ──
    D(33,'C','Start-line gate','Alignment sticks forming a gate 3–4 m ahead. Physical feedback beats numeric feedback here.'),
    D(34,'C','Alignment audit','Sticks on stance and target line. Rule out setup before diagnosing the swing.'),
    D(35,'C','Blind alignment probe','Set up, close your eyes, then look at the actual launch direction. Separates aim error from delivery error.'),
    D(36,'C','Gate progression','Start at a gate width you pass 90% of the time and narrow it. Errorless.'),
    D(37,'C','Two-target alternation','Alternate targets 20° apart every ball.'),
    D(38,'C','Start-line prediction reps','Call the start direction before the readout appears.',{prediction:true}),
    D(39,'C','Club-varied start-line block','Same drill across driver, 7-iron and wedge. The face contribution changes with loft, so the feel required genuinely differs — this is physics, not variety for its own sake.'),
    D(40,'C','Routine-consistency block','Log launch-direction spread with and without a fixed routine.'),
    D(41,'C','Narrow-fairway simulation','Start line and shape target combined.'),
    D(42,'C','Start-line trend review','Spread across sessions with a band.',{sessions:5}),

    // ── D. Face-to-path control (10) ──
    D(43,'D','Face-to-path baseline','20 shots, mean with an interval. If the interval spans zero the answer is "no consistent tendency", not a drill.',{shots:20}),
    D(44,'D','True-zero calibration','Bracket deliberately closed and open to find your personal neutral. Required before any shaping work.',{shots:20}),
    D(45,'D','Draw-bias bracket','Target −2° face-to-path, 15 shots.'),
    D(46,'D','Fade-bias bracket','Target +2° face-to-path, 15 shots.'),
    D(47,'D','Shape alternation ladder','Alternate draw and fade every three balls. Builds command rather than a single default.'),
    D(48,'D','Small-curve precision','Hold spin axis inside 3° for approach shots.'),
    D(49,'D','Big-curve command','8–12° for shaping around trouble. A course-management skill, not a fault fix.'),
    D(50,'D','Strike-location cross-check','Before blaming the face for a spin-axis change, check the strike map — gear effect produces the same change with a perfect face.'),
    D(51,'D','Club-contrast block','Same face-to-path on driver and 6-iron. The driver punishes it about 1.7× harder, which is why the same small error costs more.'),
    D(52,'D','Face-to-path trend review','Mean and interval across five or more sessions.',{sessions:5}),

    // ── E. Low point and strike height (12) ──
    D(53,'E','Divot-line drill','A line just ahead of the ball; the divot must start past it. Physical feedback where the metric is unreliable.'),
    D(54,'E','Towel behind the ball','Penalty feedback for a low point too far back.'),
    D(55,'E','Attack-angle baseline by club','15 shots each with driver, 7-iron and wedge. Confirms club-appropriate delivery.'),
    D(56,'E','Tee-height ladder (driver)','Attack angle logged per height to find your personal window.'),
    D(57,'E','Ball-position sweep (irons)','Three positions; attack angle and strike quality at each.'),
    D(58,'E','Weight-forward block','75% on the lead side at impact; attack angle and smash read together.'),
    D(59,'E','Errorless low-point ladder','Half swings where the strike is near-guaranteed, lengthening progressively.'),
    D(60,'E','Turf-versus-mat comparison','The same drill on both surfaces on the same day. Quantifies YOUR mat bias — no published number for it exists.'),
    D(61,'E','Lie-variation block','Fairway, light rough, tight lie, upslope.'),
    D(62,'E','Speed-ladder low point','50/75/100% effort; low-point consistency at each.'),
    D(63,'E','Kneeling strike drill','Removes leg drive to isolate hand and arm control of the low point.'),
    D(64,'E','Low-point trend review','Attack-angle spread across sessions.',{sessions:5}),

    // ── F. Distance control and gapping (12) ──
    D(65,'F','Full-bag gapping matrix','Ten shots per club on premium balls; log mean and spread. The output is your real yardage chart.'),
    D(66,'F','Overlap detection','Flag clubs whose carry distributions overlap by more than half. That is a gapping problem, not a swing problem.'),
    D(67,'F','Wedge matrix','Three wedges × three swing lengths × eight shots. Your personal wedge chart.'),
    D(68,'F','Three-quarter ladder','Carry per swing length, one club.'),
    D(69,'F','Clock-face wedge system','9, 10 and 11 o\'clock backswing lengths; carry logged per position.'),
    D(70,'F','Landing-window drill','Nominate a carry window and score in or out. Bandwidth feedback.'),
    D(71,'F','Descending-target ladder','60, 70, 80, 90 yards in sequence. The hardest distance-control test in golf.'),
    D(72,'F','Random-distance call','A random carry number called out, which you then have to produce.'),
    D(73,'F','Groove-condition check','A sudden unexplained spin drop: rule out equipment. Worn grooves cost up to 47% of spin and triple the shot-to-shot spin spread.'),
    D(74,'F','Uphill/downhill adjustment','If you are outdoors with slopes available.'),
    D(75,'F','Fatigue distance probe','Carry spread in the first ten against the last ten.',{shots:20}),
    D(76,'F','Gapping trend review','Re-run the matrix quarterly. Equipment and technique both drift.',{sessions:3}),

    // ── G. Speed development (10) ──
    D(77,'G','Speed baseline','Ten max-effort swings, mean and spread. Establishes your personal noise floor.'),
    D(78,'G','Jump-impulse assessment','The strongest physical correlate of club speed, around r = 0.68. Track it alongside.',{noDevice:true}),
    D(79,'G','Med-ball rotational throw block','Explosive strength — the second-strongest correlate.',{noDevice:true}),
    D(80,'G','Lower-body force block','Squat, deadlift and jump progression, two or three times a week.',{noDevice:true}),
    D(81,'G','Upper-body explosive block','The r = 0.58 correlate.',{noDevice:true}),
    D(82,'G','Overspeed block, ~30 swings','An implement within 10–12% of your driver. Volume plateaus early — 100-swing protocols are not supported.',{noDevice:true}),
    D(83,'G','Bodyweight plyometric block','The active comparator that matched speed sticks exactly. Free, and equally supported.',{noDevice:true}),
    D(84,'G','Speed-with-smash guard','Pair every speed session with a smash check. Going 100 to 105 mph gained only 2 yards because spin rose — speed bought out of strike is a net loss.'),
    D(85,'G','12-week trend block','A regression slope with a band across eight or more sessions. The only honest way to detect a speed change.',{sessions:8}),
    D(86,'G','Junior swing-volume monitor','Cap and log maximal-effort swings per week. For a growing spine the load that matters is rotational swing volume, not barbell load.',{noDevice:true}),

    // ── H. Quiet eye and putting (8) ──
    D(87,'H','Quiet-eye baseline (video)','Record gaze and head stability over 20 putts.',{noDevice:true}),
    D(88,'H','Quiet-eye training protocol','Fixate the back of the ball 2–3 s before the stroke; hold the gaze 200–300 ms after impact. A single 20-putt session produced the published result.',{noDevice:true}),
    D(89,'H','Quiet eye under pressure','The same protocol with a consequence. Untrained golfers collapse from 2,794 ms of quiet eye to 1,405 ms under pressure.',{noDevice:true}),
    D(90,'H','Errorless putting ladder','Three feet outward, expanding only after near-total success.',{noDevice:true}),
    D(91,'H','6–10 ft focus block','The range where the training produced its +5%.',{noDevice:true}),
    D(92,'H','Three-putt-avoidance lag block','From 30 ft and beyond, scored on proximity rather than on holing.',{noDevice:true}),
    D(93,'H','Routine-consistency putting block','A fixed routine, logged.',{noDevice:true}),
    D(94,'H','Competitive putts-per-round tracking','The outcome measure the study actually moved.',{noDevice:true}),

    // ── I. Practice-structure wrappers (10) ──
    D(95,'I','Faded-feedback session','Numbers on for the first third, then half the shots, then off. The default session type.'),
    D(96,'I','Bandwidth session','Silence inside tolerance; feedback only outside it. Silence works as implicit positive feedback and self-reduces as you improve.'),
    D(97,'I','Prediction session','Call the number before every reveal.',{prediction:true}),
    D(98,'I','Self-selected feedback session','Tap to see the numbers, and log how often you do.'),
    D(99,'I','Next-day retention probe','Ten shots with NO feedback at all, 24 hours later. This is the efficacy metric, not within-session change.'),
    D(100,'I','Blocked → serial → random','Three-stage session structure. Increasing interference beat both extremes.'),
    D(101,'I','Distributed-volume plan','4 × 60 balls rather than 1 × 240.'),
    D(102,'I','Differential-learning block','Vary grip pressure, stance width, tempo and ball position every rep, never repeating. Optional and advanced — the evidence is promising and heterogeneous.',{optional:true}),
    D(103,'I','Representative-constraint wrapper','A nominated target and shape before every ball, a scoring consequence, an enforced routine, and no two identical consecutive shots.'),
    D(104,'I','Session-noise report','Every session ends with your own typical error per metric, so you learn what size of change is real.'),
  ];

  const byId = id => ALL.find(d => d.id === id) || null;
  const bySection = s => ALL.filter(d => d.section === s);
  const wrappers = () => bySection('I');

  // Faults name a mechanism; sections name a measurement. This is the join, and
  // it is deliberately many-to-one: several faults land on strike quality
  // because that is where the evidence says the strokes are.
  //
  // Every key here is a real id from FaultEngine, checked against it. The first
  // version of this table was written from the section headings rather than
  // from the code, so it mapped inventions like 'open-face' and 'two-way-miss'
  // and returned null for almost every fault the app can actually raise — a
  // join that looks complete and joins nothing.
  const FAULT_SECTION = {
    // Strike quality — smash factor and energy transfer
    'poor-contact': 'A', 'inconsistent-contact': 'A', 'low-ball-speed': 'A',
    'session-fatigue': 'A',                 // A15 is the fatigue probe
    // Dispersion tails
    'dispersion-wide': 'B',
    // Start line — where the ball set off, before any curve
    'pull-left': 'C', 'push-right': 'C',
    // Face-to-path — curvature and the spin axis it produces
    'slice': 'D', 'hook': 'D', 'high-spin-axis': 'D', 'low-spin-axis': 'D',
    // Low point and vertical strike — attack angle, launch height, spin loft,
    // and the thin/fat strikes that come from the same delivery
    'fat-shot': 'E', 'wedge-thin': 'E',
    'driver-negative-aa': 'E', 'driver-very-steep': 'E',
    'iron-shallow-aa': 'E', 'iron-very-steep': 'E',
    'driver-high-launch': 'E', 'driver-low-launch': 'E', 'variable-launch': 'E',
    'high-spin-loft': 'E', 'low-spin-loft-iron': 'E',
  };
  const sectionForFault = fid => FAULT_SECTION[fid] || null;

  // ── The gate ──────────────────────────────────────────────────
  // ctx: { shots: [...], clubType, sessions }  — shots already stamped by
  // Store.stamp(), so ball, surface and alignment travel with them.
  //
  // A failing gate returns its reasons rather than hiding the drill. "Hit 30
  // of these on your own ball and this unlocks" tells a golfer what to do
  // next; a list that quietly omits half of itself tells them nothing.
  function admissible(drill, ctx = {}) {
    const sec = SECTIONS[drill.section];
    const gate = { ...(sec.gate || {}), ...(drill.shots ? { shots: drill.shots } : {}) };
    const reasons = [];
    if (drill.noDevice || gate.none) return { ok: true, reasons, section: sec, offDevice: true };

    const all = (ctx.shots || []);
    const set = ctx.clubType ? all.filter(s => s.clubType === ctx.clubType) : all;

    const needShots = drill.shots || gate.shots;
    if (needShots && set.length < needShots) {
      reasons.push(`Needs ${needShots} shots${ctx.clubType ? ' of ' + clubLabel(ctx.clubType) : ''} and you have ${set.length}.`);
    }
    if (gate.ball === 'premium' && set.length && !set.every(s => s._ball === 'premium' || s._ball === 'rpt')) {
      reasons.push('Needs your own premium or RPT ball. Range-ball spread is 2–4× wider and gapping off them is not comparable.');
    }
    if (gate.alignment && set.length && !set.every(s => s._aligned === true)) {
      reasons.push('Needs a confirmed Impact Vision alignment, because an aiming error becomes a constant offset on every start line and averaging will not remove it.');
    }
    if (gate.surface === 'grass' && set.length && set.every(s => s._surface === 'mat')) {
      // Flagged, not refused — the spec is explicit that a mat session still
      // shows the shape, it just hides the fat strikes.
      reasons.push('MAT: a strike several centimetres behind the ball still reads near-normal off a mat, so this drill can show you the pattern but not the fat strikes it exists to catch.');
    }
    if (drill.sessions && (ctx.sessions || 0) < drill.sessions) {
      reasons.push(`Needs ${drill.sessions} qualifying sessions and you have ${ctx.sessions || 0}. A trend is not a before-and-after.`);
    }
    // A mat note alone does not block: it qualifies.
    const blocking = reasons.filter(r => !r.startsWith('MAT:'));
    return { ok: blocking.length === 0, reasons: reasons.map(r => r.replace(/^MAT: /, '')),
             section: sec, flaggedOnly: blocking.length === 0 && reasons.length > 0 };
  }

  // Everything in a section, each with its verdict — the whole point being
  // that the locked ones stay visible with the reason attached.
  function forSection(s, ctx) {
    return bySection(s).map(d => ({ drill: d, ...admissible(d, ctx) }));
  }

  const count = () => ALL.length;

  return { SECTIONS, ALL, byId, bySection, wrappers, sectionForFault, FAULT_SECTION,
           admissible, forSection, count };
})();

// ────────────────────────────────────────────────────────────────
// ShortGame — putting and chipping, built on what the RCTs actually found
// ────────────────────────────────────────────────────────────────
// `QuietEye` covers one intervention in depth. This covers the rest of the
// short game, and it is built around a specific piece of evidence rather than
// around a list of drills someone liked.
//
// THE SPINE: a 2024 systematic review in Frontiers in Sports and Active Living
// screened the randomised controlled trials on golf motor learning and included
// 52 of them, grouped by strategy — cognitive training, practice scheduling,
// augmented feedback, implicit/explicit learning, focus of attention. Three
// methods came out superior within their strategy:
//
//   ERRORLESS LEARNING      practice arranged so almost nothing is missed
//   CONTEXTUAL INTERFERENCE random / varied order rather than blocked
//   EXTERNAL FOCUS          attention on the ball, club or target, not the body
//
// For cognitive training and augmented feedback, no single method came out
// ahead — which is worth saying, because that is where most golf content lives.
//
// AND THE LIMITATION, STATED BY THE REVIEWERS THEMSELVES: over half the 52
// trials were statistically underpowered, and most studied simple putting tasks
// in novices. So the direction is well supported and the magnitude, for a
// competent golfer on a real green, is not. Every drill here carries the tier
// it earned rather than a uniform confident tone.
//
// WHERE THE STROKES ACTUALLY ARE. About 65% of shots in a round happen from 100
// yards in, and amateurs give away most of their short-game strokes to
// three-putts from outside 25 feet and to chunked chips. But Broadie's own
// comparison is blunter than the folklore: a typical 90-shooter loses roughly
// six strokes to a scratch golfer across approach play and the short game and
// only about two to putting. Putting is the cheapest thing to fix, not the
// biggest hole. The module says so rather than flattering the practice green.
const ShortGame = (() => {
  const KEY = 'slShortGame';

  // The three structures, applied OVER a drill rather than instead of one —
  // the same relationship section I has to the full-swing library.
  const STRUCTURES = {
    errorless: {
      id: 'errorless', name: 'Errorless',
      how: 'Start at a distance where you hole or finish stone dead almost every time, and only move back ' +
           'once you have. The point is to make very few mistakes, not to be challenged.',
      why: 'Maxwell, Masters, Kerr & Weedon (2001): golfers who learned putting with few errors were ' +
           'unaffected when a second task was loaded on top, while golfers who learned by missing fell ' +
           'apart. Fewer misses means fewer conscious corrections to test, so less of the skill is held ' +
           'explicitly — and explicit skill is what breaks first under pressure.',
      tier: 'strong',
    },
    random: {
      id: 'random', name: 'Random order',
      how: 'Never the same shot twice in a row. Change distance, lie or club every ball, and do not let ' +
           'yourself groove one repetition.',
      why: 'It will feel worse than blocked practice while you do it and better a week later. Fazeli et al. ' +
           '(2017), 30 golfers over six days: the random group putted worse during practice and more ' +
           'accurately at retention, and ended with a mental representation closer to a skilled golfer\'s. ' +
           'The same held for chipping across three shot variations.',
      tier: 'strong',
    },
    external: {
      id: 'external', name: 'External focus',
      how: 'Attention on the ball, the clubhead, the landing spot or the hole — never on a body part.',
      why: 'Named superior within its strategy in the 2024 review, and the effect is small: about g = 0.15 ' +
           'once publication bias is corrected for. Worth doing because it costs nothing, not because it ' +
           'will transform anything.',
      tier: 'moderate',
    },
  };

  // Tour reference points, for scale rather than as targets. From published
  // PGA Tour putting distributions.
  const TOUR = {
    make30ft: 0.07,        // makes about 7% from 30 feet
    threePutt30ft: 0.05,   // three-putts about 5% from 30 feet
    threePutt40to50ft: { lo: 0.10, hi: 0.20 },
    note: 'A tour player two-putts from 30 feet almost every time — they hole about 7% and three-putt ' +
          'about 5%. From 40–50 feet the three-putt rate climbs to somewhere between 10% and 20%. If you ' +
          'are looking for a target from long range, it is two putts, not one.',
  };

  const D = (id, name, trains, protocol, extra = {}) =>
    ({ id, name, trains, protocol, structures: [], tier: 'moderate', ...extra });

  // ── Putting ───────────────────────────────────────────────────
  const PUTTING = [
    D('p-gate', 'Errorless distance ladder',
      'Holing out under no pressure, then extending it',
      'Start at 2 ft and hole five in a row before moving back a foot. Drop back a foot on any miss. ' +
      'Stop when you first fail twice at a distance — that number is your session, not a failure.',
      { structures: ['errorless'], tier: 'strong',
        why: 'The clearest application of the errorless finding there is: the ladder is designed so you ' +
             'almost never miss, which is the mechanism, not a side effect.' }),

    D('p-speed', 'Speed ladder to the fringe',
      'Distance control from long range — where three-putts come from',
      'Putt to the fringe rather than a hole, from 20, 30, 40 and 50 ft. Score each one on whether it ' +
      'finishes within a putter length past the fringe. Never putt the same distance twice in a row.',
      { structures: ['random', 'external'], tier: 'strong',
        why: 'Amateurs lose more strokes to three-putts from outside 25 ft than to any other putting ' +
             'category, and from that range it is speed that decides the second putt, not line. Removing ' +
             'the hole removes the temptation to aim for a make.' }),

    D('p-circle', 'Three-foot circle from long range',
      'Lag putting scored the way it is actually judged',
      'Lay a ring of tees three feet around the hole. From 25 ft and beyond, score a putt as good if it ' +
      'finishes inside the ring — holed or not. Twenty putts, distance changing every time.',
      { structures: ['random'], tier: 'strong',
        why: 'The outcome that predicts your score from long range is proximity, not the make. Scoring the ' +
             'make trains you to run six feet past.' }),

    D('p-clock', 'Clock drill, 4 ft',
      'The distance that decides whether a lag was worth anything',
      'Eight balls in a circle at 4 ft. Hole all eight to finish. Restart the count on a miss.',
      { structures: ['errorless'], tier: 'moderate',
        why: 'A pressure-flavoured version of errorless practice: the restart is what makes the last two ' +
             'putts feel like putts that matter.' }),

    D('p-random-band', 'Random-distance call',
      'Producing a specific pace on demand',
      'Have someone call a distance — or shuffle cards marked 15, 25, 35, 45 ft — and putt to it. Never ' +
      'the same twice in a row. Twenty balls.',
      { structures: ['random', 'external'], tier: 'strong',
        why: 'Random order beat blocked at retention in the 2017 trial. This is that finding with the ' +
             'least equipment.' }),

    D('p-oneball', 'One ball, nine holes',
      'The only version of putting that resembles the game',
      'Play nine holes on the practice green with one ball. Full routine, no second attempts, and count ' +
      'the total. Repeat weekly and track the number.',
      { structures: ['random'], tier: 'moderate',
        why: 'Practice-green putting with a bucket of balls is blocked practice with an audience. This is ' +
             'the closest a green gets to the thing being trained.' }),

    D('p-eyes', 'Eyes-closed distance calls',
      'Feel for pace, tested rather than assumed',
      'From 20–40 ft, close your eyes as you strike and call whether the putt finished short, right, or ' +
      'long BEFORE you look. Ten putts. Score how often you were right, not how close you were.',
      { structures: ['errorless', 'external'], tier: 'moderate',
        why: 'Error estimation: judging your own outcome before it is shown to you preserves the internal ' +
             'error-detection that constant feedback displaces.' }),

    D('p-pressure', 'Consequence ladder',
      'Whether any of it survives caring about the result',
      'Five putts at 6 ft. Miss one and the count restarts. You may not leave until you finish it.',
      { structures: ['errorless'], tier: 'moderate',
        why: 'Quiet-eye duration collapses under pressure in untrained golfers — 1,405 ms against 2,794 ms ' +
             'trained. Practising without any consequence never tests the part that fails.' }),

    D('p-slope', 'Same hole, four sides',
      'Reading break instead of memorising one putt',
      'One hole, four balls at the same distance from four directions — uphill, downhill, and both breaks. ' +
      'Rotate every ball.',
      { structures: ['random'], tier: 'moderate',
        why: 'Varying the condition rather than the repetition is the contextual-interference finding ' +
             'applied to green reading.' }),

    D('p-firstputt', 'First putt of the day',
      'The cold start, which is a separate skill',
      'Log the first putt of every session separately, over ten sessions. One ball, no warm-up rolls.',
      { structures: [], tier: 'weak',
        why: 'No trial has tested this in golf. It is here because the first putt of a round is the one you ' +
             'never practise, and logging it costs nothing.' }),
  ];

  // ── Chipping ──────────────────────────────────────────────────
  const CHIPPING = [
    D('c-landing', 'Landing-spot drill',
      'Aiming at the spot the ball lands, not the hole',
      'Put a towel or a coin where you want the ball to pitch. Score whether it lands on the towel — ' +
      'ignore where it finishes. Ten balls, then move the towel.',
      { structures: ['external'], tier: 'strong',
        why: 'The most external target available in the short game: a spot on the ground you can see, ' +
             'rather than a feeling in your hands. External focus was one of three methods named superior ' +
             'in the 2024 review of 52 trials.' }),

    D('c-three-var', 'Three shots, random order',
      'Command of more than one chip',
      'Pick three genuinely different shots — low runner, standard, higher and softer. Play them in random ' +
      'order, never the same twice, about 54 balls in total.',
      { structures: ['random'], tier: 'strong',
        why: 'This is a published trial rather than an analogy. Golfers practised three chip variations ' +
             'blocked or randomly over 54 acquisition trials; both improved during practice with no ' +
             'difference between them, and the random group was significantly more accurate at the random ' +
             'retention test. Doing them in a row teaches you nothing you keep.' }),

    D('c-proximity', 'Proximity ladder',
      'The metric strokes gained around the green actually uses',
      'Ten chips from one lie. Score every one on how far it finishes from the hole in feet, and record ' +
      'the average — not how many went in.',
      { structures: [], tier: 'strong',
        why: 'Strokes gained around the green is a function of lie and proximity. Holing a chip is close to ' +
             'noise; finishing eight feet away instead of eighteen is not.' }),

    D('c-errorless-lie', 'Errorless lie progression',
      'Contact first, difficulty second',
      'Start on a clean, tight-ish lie from 10 yards where you catch it well nearly every time. Only move ' +
      'to rough, then a bare lie, then downslope, once a full set is struck cleanly.',
      { structures: ['errorless'], tier: 'strong',
        why: 'Errorless learning produced putting that survived a loaded secondary task. Chunked chips are ' +
             'the most pressure-sensitive shot in golf, which is exactly the failure mode it protects.' }),

    D('c-oneclub', 'One club, five distances',
      'Distance control through length of swing rather than club choice',
      'One club — a pitching wedge or 9-iron. Chip to five different distances between 5 and 30 yards, in ' +
      'random order, changing the length of the stroke rather than anything else.',
      { structures: ['random', 'external'], tier: 'moderate',
        why: 'Varies the parameter while holding the pattern, which is the shape contextual-interference ' +
             'work uses. Whether one club beats several is not settled — this is a way to practise, not a ' +
             'claim that it is the right method.' }),

    D('c-updown', 'Up-and-down count',
      'The outcome that actually appears on the card',
      'Nine chips from nine different lies around the green, each followed by the putt. Count how many you ' +
      'get up and down. One ball each, no retries.',
      { structures: ['random'], tier: 'moderate',
        why: 'Chipping practice that stops at the chip never tests the part that costs the stroke. It also ' +
             'forces random order, since no two lies are the same.' }),

    D('c-clock-face', 'Clock-face wedge lengths',
      'A repeatable set of distances you can trust on the course',
      'Three backswing lengths — think 9, 10 and 11 o\'clock — eight balls each, and record the carry for ' +
      'each position. The output is a chart, not a score.',
      { structures: [], tier: 'moderate',
        why: 'A data-generation session as much as practice. Most amateurs have no idea what their ' +
             'three-quarter wedge actually carries, and guessing it is a distance-control problem dressed ' +
             'up as a technique one.' }),

    D('c-bare', 'Worst-lie block',
      'The shot that produces the chunk',
      'Deliberately play from tight, bare and downslope lies. Ten balls. Score contact only — clean or ' +
      'not — and ignore the result.',
      { structures: ['external'], tier: 'moderate',
        why: 'Scoring contact rather than outcome keeps the feedback on the thing being trained. This is ' +
             'the one block that is deliberately NOT errorless, so run it after the errorless progression ' +
             'rather than instead of it.' }),

    D('c-bump', 'Bump-and-run versus flop, same shot',
      'Choosing the shot, not just hitting it',
      'From one spot, play the same shot two ways — low and running, then high and soft — and compare the ' +
      'proximity of ten of each.',
      { structures: ['random'], tier: 'moderate',
        why: 'Most amateurs default to the higher shot because it looks like golf on television. Measuring ' +
             'the two side by side is usually a short and uncomfortable argument.' }),

    D('c-pressure-updown', 'Three in a row, up and down',
      'Holding a technique when the count matters',
      'Get up and down three times consecutively before you may stop. Restart on a failure.',
      { structures: [], tier: 'weak',
        why: 'Pressure practice in golf is thinly studied and the transfer is not established. Included ' +
             'because the failure it targets is real, not because a trial supports this format.' }),
  ];

  const ALL = () => [...PUTTING, ...CHIPPING];
  const byId = id => ALL().find(d => d.id === id) || null;
  const structuresFor = drill =>
    (drill?.structures || []).map(s => STRUCTURES[s]).filter(Boolean);

  // ── Session builder ───────────────────────────────────────────
  // Errorless first, then random. That order is the finding, not a preference:
  // errorless work builds a skill that survives pressure, and contextual
  // interference is what makes it stick beyond the session — but random order
  // early, before anything is repeatable, is just missing in a varied order.
  function session(minutes = 30, area = 'both') {
    const pick = (list, id) => list.find(d => d.id === id);
    const blocks = [];
    const put = area !== 'chipping', chip = area !== 'putting';
    if (chip) blocks.push({ phase: 'Warm up without missing', drill: pick(CHIPPING, 'c-errorless-lie') });
    if (put)  blocks.push({ phase: 'Warm up without missing', drill: pick(PUTTING, 'p-gate') });
    if (chip) blocks.push({ phase: 'Then make it random',     drill: pick(CHIPPING, 'c-three-var') });
    if (put)  blocks.push({ phase: 'Then make it random',     drill: pick(PUTTING, 'p-speed') });
    blocks.push({ phase: 'Finish on the real thing',
                  drill: chip ? pick(CHIPPING, 'c-updown') : pick(PUTTING, 'p-oneball') });
    const each = Math.max(4, Math.round(minutes / blocks.length));
    return {
      minutes: each * blocks.length,
      blocks: blocks.map(b => ({ ...b, minutes: each, structures: structuresFor(b.drill) })),
      note: 'Errorless first, random second, and the last block is one ball with no retries. That order is ' +
            'the finding rather than a preference — random order before anything is repeatable is just ' +
            'missing in a varied sequence.',
    };
  }

  // ── Chipping log ──────────────────────────────────────────────
  // Proximity in feet, because that is what strokes gained around the green is
  // a function of. Holed chips are recorded as zero and are close to noise;
  // the number that moves a score is the average leave.
  function all() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-200))); } catch (_) {}
  }
  function record(entry) {
    const chips = (entry?.chips || []).filter(c => Number.isFinite(c.leaveFt) && c.leaveFt >= 0);
    if (!chips.length) return null;
    const row = {
      id: (crypto.randomUUID ? crypto.randomUUID() : 'sg-' + Date.now()),
      date: entry.date || new Date().toISOString(),
      lie: entry.lie || 'unknown',
      chips,
    };
    const list = all(); list.push(row); save(list);
    return row;
  }
  function clear() { save([]); }

  const MIN_CHIPS = 10;

  // Median as well as mean, and the median is the one to read. A single
  // chunked chip that finishes 40 feet away drags a ten-shot mean by four feet
  // — which is real, but it describes that one shot rather than the standard.
  // Both are shown so a large gap between them is visible, because that gap IS
  // the chunk rate.
  function proximity(chips) {
    const v = (chips || []).map(c => c.leaveFt).filter(Number.isFinite).sort((a, b) => a - b);
    if (v.length < 3) return null;
    const mid = Math.floor(v.length / 2);
    const median = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
    const avg = mean(v);
    return {
      n: v.length, mean: avg, median, best: v[0], worst: v[v.length - 1],
      holed: v.filter(x => x === 0).length,
      // A "disaster" is a chip that leaves you a putt you were never going to
      // hole. Three times the median is a scale-free way of saying that.
      disasters: v.filter(x => x > Math.max(15, median * 3)).length,
      enough: v.length >= MIN_CHIPS,
    };
  }

  function describe(p) {
    if (!p) return 'Log at least three chips and this will tell you something.';
    const gap = p.mean - p.median;
    const base = `${p.n} chips: typical leave ${fmt(p.median, 1)} ft, average ${fmt(p.mean, 1)} ft.`;
    if (!p.enough) {
      return `${base} Under ${MIN_CHIPS} chips this is an impression rather than a measurement.`;
    }
    if (p.disasters > 0) {
      return `${base} ${p.disasters} of them finished a long way out — and that is where the strokes went. ` +
             `Your average sits ${fmt(gap, 1)} ft above your typical chip because of them, so the thing to ` +
             `work on is the bad one, not the standard one.`;
    }
    return `${base} No blow-ups in this set, and the average and the typical chip are within ` +
           `${fmt(Math.abs(gap), 1)} ft of each other — which means the number above describes your ` +
           `chipping rather than one bad contact.`;
  }

  return { KEY, STRUCTURES, TOUR, PUTTING, CHIPPING, ALL, byId, structuresFor,
           session, all, record, clear, proximity, describe, MIN_CHIPS };
})();

// ────────────────────────────────────────────────────────────────
// MeasurementReference — the published error rates, kept out of the maths
// ────────────────────────────────────────────────────────────────
// Every +/- the app shows is computed from the golfer's own shots. These
// figures are what is known about the DEVICE, and they are deliberately not
// mixed into that: an observed spread already contains device error, so adding
// these on top would count it twice. They live here so the numbers behind the
// app are inspectable rather than hidden — and so it is obvious which ones
// nobody has ever actually measured.
const MeasurementReference = (() => {
  const ROWS = [
    { metric: 'Club path', mae: '1.19°', rmse: '1.46°', r: '0.86', bias: '+0.33°',
      source: 'Rapsodo, 1,021 shots vs Foresight GCQuad', measured: true },
    { metric: 'Angle of attack', mae: '1.05°', rmse: '1.42°', r: '0.92', bias: '+0.13°',
      source: 'Rapsodo, 1,021 shots vs Foresight GCQuad', measured: true },
    { metric: 'Launch direction', mae: '—', rmse: '—', r: '—', bias: '—',
      source: 'No error data exists, from any source', measured: false },
    { metric: 'Ball speed, club speed, launch angle, smash', mae: '—', rmse: '—', r: '—', bias: '—',
      source: 'No MLM2PRO-specific error data published', measured: false },
    { metric: 'Spin rate (consumer radar, general)', mae: '—', rmse: '—', r: '—',
      bias: '±2,600 to +5,100 rpm limits of agreement',
      source: 'Brennan et al. 2024, Mevo+ vs TrackMan 4', measured: true },
  ];

  const BIOLOGY = [
    { metric: 'Club head speed', icc: '0.99', sem: '1.64–1.67 mph' },
    { metric: 'Ball speed', icc: '0.97–0.99', sem: '2.46–4.42 mph' },
    { metric: 'Carry distance', icc: '0.91–0.97', sem: '7.80–14.21 yd' },
    { metric: 'Spin rate', icc: '0.02–0.60', sem: '241–455 rpm' },
  ];

  const POLICY =
    'ShotLab treats device error as zero when computing intervals. That is a modelling ' +
    'choice, not a claim the device is perfect. Two reasons: half the published single-shot ' +
    'figure for face-to-path was never measured by anyone, and the shot-to-shot spread of ' +
    'your own swing already contains whatever device error there is — adding a constant on ' +
    'top would count the same error twice. So every ± you see in this app is your swing.';

  const ALIGNMENT =
    'The one error this cannot absorb is alignment. A misaligned unit does not scatter your ' +
    'numbers, it shifts all of them the same way, and averaging cannot remove a constant. ' +
    'That is why setup is a separate checklist rather than a tolerance.';

  function show() {
    document.getElementById('measRefModal')?.remove();
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'measRefModal';
    m.innerHTML = `
      <div class="modal modal-wide">
        <div class="modal-head">
          <h2 class="modal-title">Measurement reference</h2>
          <button class="btn-icon" data-close-modal aria-label="Close">✕</button>
        </div>
        <div class="modal-scroll">
          <p class="setup-summary">${Sanitize.escape(POLICY)}</p>

          <h3 class="setup-h">Device error, where anyone has measured it</h3>
          <div class="tbl-wrap"><table class="ref-tbl">
            <thead><tr><th>Metric</th><th>MAE</th><th>RMSE</th><th>Bias</th></tr></thead>
            <tbody>${ROWS.map(r => `<tr class="${r.measured ? '' : 'unmeasured'}">
              <td>${Sanitize.escape(r.metric)}<div class="ref-src">${Sanitize.escape(r.source)}</div></td>
              <td>${r.mae}</td><td>${r.rmse}</td><td>${Sanitize.escape(r.bias)}</td></tr>`).join('')}</tbody>
          </table></div>

          <h3 class="setup-h">Your own variability, session to session</h3>
          <p class="ref-note">From TrackMan — a reference device where error is negligible, so these
            are approximately the golfer, not the machine. Note the last row: spin is the least
            stable thing a golfer does, which is why this app never prescribes from it.</p>
          <div class="tbl-wrap"><table class="ref-tbl">
            <thead><tr><th>Metric</th><th>ICC</th><th>Typical error</th></tr></thead>
            <tbody>${BIOLOGY.map(r => `<tr><td>${Sanitize.escape(r.metric)}</td>
              <td>${r.icc}</td><td>${Sanitize.escape(r.sem)}</td></tr>`).join('')}</tbody>
          </table></div>

          <h3 class="setup-h">The exception</h3>
          <p class="ref-note">${Sanitize.escape(ALIGNMENT)}</p>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  }

  return { ROWS, BIOLOGY, POLICY, ALIGNMENT, show };
})();

// ────────────────────────────────────────────────────────────────
// RetentionProbe — the app's primary efficacy metric
// ────────────────────────────────────────────────────────────────
// Everything else in this app measures a session. This measures whether a
// session CHANGED ANYTHING, which is a different and much harder question.
//
// Winstein & Schmidt is unambiguous about why it has to work this way: across
// three experiments (n=240), constant and faded feedback were indistinguishable
// during acquisition AND at 5-10 minutes, and only separated at 24 hours,
// where the faded group had 35% less error. Every within-session signal was
// blind to a real 35% difference in what was actually learned.
//
// So an app that grades a drill on whether the numbers improved during the
// session is measuring the one window the evidence says is uninformative — and
// it will report success while doing harm. The probe is the correction: the
// same club, roughly the same shot count, at least a day later, with feedback
// OFF, compared against the session that prescribed the work.
const RetentionProbe = (() => {
  const KEY = 'slProbes';
  const MIN_GAP_HOURS = 20;     // "next day" with slack for an evening session
  const MAX_GAP_DAYS  = 10;     // beyond this, too much else has happened
  const MIN_SHOTS     = 8;      // fewer than this and the comparison is noise

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-100))); } catch (_) {}
  }

  // Open a probe when a session prescribes work: record the baseline so the
  // follow-up has something to be compared against.
  function open(session, fault) {
    if (!session || !fault) return null;
    const shots = (session.shots || []).filter(s => s.clubType === fault.clubType);
    if (shots.length < MIN_SHOTS) return null;
    const probe = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      openedAt: new Date(session.date || Date.now()).getTime(),
      sessionId: session.id,
      clubType: fault.clubType,
      faultId: fault.id,
      faultName: fault.name,
      metric: fault.metric || 'smashFactor',
      baseline: baselineFor(shots, fault.metric || 'smashFactor'),
      status: 'open',
    };
    if (!probe.baseline) return null;
    const list = all().filter(p => !(p.faultId === probe.faultId && p.clubType === probe.clubType && p.status === 'open'));
    list.push(probe); save(list);
    return probe;
  }

  function baselineFor(shots, metric) {
    const iv = Metrics.interval(shots.map(s => s[metric]), '', 2);
    return iv ? { mean: iv.mean, ci: iv.ci, n: iv.n, spread: stdDev(shots.map(s => s[metric]).filter(Number.isFinite)) } : null;
  }

  // Which probes is this new session eligible to answer?
  function due(session, now = Date.now()) {
    const t = new Date(session?.date || now).getTime();
    return all().filter(p => {
      if (p.status !== 'open') return false;
      const gapH = (t - p.openedAt) / 36e5;
      if (gapH < MIN_GAP_HOURS || gapH > MAX_GAP_DAYS * 24) return false;
      return (session.shots || []).filter(s => s.clubType === p.clubType).length >= MIN_SHOTS;
    });
  }

  // Settle a probe against a later session. The verdict is deliberately
  // three-valued: a change smaller than this golfer's own noise is "no
  // detectable change", never "no improvement" — the app cannot tell those
  // apart and should not pretend otherwise.
  //
  // `practised` is the missing half, and without it this feature was quietly
  // making the strongest claim in the app out of nothing. A probe settles
  // against whatever session happens to come next, so a golfer who never went
  // near the drill still got "that is a real retained change — the strongest
  // evidence this app can produce that something worked." Nothing worked;
  // nothing was done. The measurement was fine and the attribution was
  // invented, which is the same failure as reading a strokes figure off a face
  // angle, one layer up.
  //
  // So the change and the credit for it are now separate. The number is
  // reported either way, because a change is worth knowing about regardless.
  // Only a probe the golfer confirms they practised is allowed to be evidence
  // that the drill did anything, and an unanswered probe says so rather than
  // assuming either way.
  function settle(probe, session, history, practised = null) {
    const shots = (session.shots || []).filter(s => s.clubType === probe.clubType);
    const after = baselineFor(shots, probe.metric);
    if (!after) return null;
    const delta = after.mean - probe.baseline.mean;
    const verdict = Metrics.changeIsReal(probe.metric, delta, after.n, history || [], probe.clubType);
    const gapDays = Math.round((new Date(session.date).getTime() - probe.openedAt) / 864e5);

    const settled = {
      ...probe, status: 'settled', settledAt: Date.now(), probeSessionId: session.id,
      after, delta, gapDays, practised,
      // Whether the drill may be credited with the change. Not the same
      // question as whether the change is real, and kept apart from it.
      attributable: practised === true,
      outcome: verdict.real === null ? 'unknown' : verdict.real ? (delta > 0 ? 'retained' : 'regressed') : 'no-change',
      threshold: verdict.threshold, source: verdict.source, note: verdict.note,
    };
    save(all().map(p => (p.id === probe.id ? settled : p)));
    return settled;
  }

  // Plain-language result. No cheerleading: the honest outcomes here are
  // mostly "cannot tell yet", and saying so is the point of the feature.
  //
  // The measurement sentence and the attribution sentence are built
  // separately, because they answer different questions and only one of them
  // depends on whether the golfer actually did the work.
  // The raw field name used to reach the golfer verbatim — "7i smashFactor:
  // +0.08" — which is a camelCase key, not English.
  const METRIC_LABEL = {
    smashFactor: 'smash factor', ballSpeed: 'ball speed', clubSpeed: 'club speed',
    carryDistance: 'carry', launchAngle: 'launch angle', attackAngle: 'attack angle',
    clubPath: 'club path', spinRate: 'spin rate',
  };
  const metricLabel = m => METRIC_LABEL[m] || String(m || '').replace(/([A-Z])/g, ' $1').toLowerCase().trim();

  function describe(r) {
    if (!r) return null;
    const club = clubLabel(r.clubType);
    const metric = metricLabel(r.metric);
    const d = `${r.delta > 0 ? '+' : ''}${fmt(r.delta, 2)}`;
    const days = `${r.gapDays} day${r.gapDays === 1 ? '' : 's'}`;
    let measured;
    switch (r.outcome) {
      case 'retained':
        measured = `${club} ${metric}: ${d} vs ${days} ago, bigger than your own shot-to-shot variation. ` +
                   `That is a real change, and it held over a day — which is the only window that shows learning.`;
        break;
      case 'regressed':
        measured = `${club} ${metric}: ${d} vs ${days} ago, beyond your own variation. It did not hold. ` +
                   `That is worth knowing — within-session numbers would have hidden it.`;
        break;
      case 'no-change':
        measured = `${club} ${metric}: ${d} over ${days} — smaller than your own shot-to-shot variation, ` +
                   `so no detectable change. Not the same as "no improvement": the change, if any, is below ` +
                   `what this data can resolve.`;
        break;
      default:
        return `${club}: not enough history yet to say whether this held. ${r.note || ''}`.trim();
    }
    if (r.practised === true) {
      return r.outcome === 'retained'
        ? `${measured} You practised it, so this is the strongest evidence this app can produce that ` +
          `something worked.`
        : `${measured} You practised it, so this is about the drill rather than about the week.`;
    }
    if (r.practised === false) {
      return `${measured} You did not work on this in between, so it is not a verdict on the drill — ` +
             (r.outcome === 'no-change'
               ? `it is a look at how steady this is when you leave it alone, which is the baseline any ` +
                 `future change has to beat.`
               : `it is your own week-to-week movement without any practice behind it. Useful to know: ` +
                 `changes this size can happen on their own.`);
    }
    return `${measured} Whether the drill did it is unknown — nothing recorded that you worked on it, and ` +
           `crediting practice that may not have happened is how a measurement turns into a story.`;
  }

  function openProbes() { return all().filter(p => p.status === 'open'); }
  function settled()    { return all().filter(p => p.status === 'settled'); }
  function clear()      { save([]); }

  return { open, due, settle, describe, openProbes, settled, all, clear,
           MIN_GAP_HOURS, MAX_GAP_DAYS, MIN_SHOTS };
})();

// ────────────────────────────────────────────────────────────────
// SetupGuide — getting the device honest before it gets read
// ────────────────────────────────────────────────────────────────
// Every angular prescription this app makes is downstream of how the unit was
// set up. Launch direction is measured relative to where the DEVICE thinks the
// target is, so a misaligned unit doesn't add noise — it adds a constant bias
// to every shot, and face-to-path inherits it amplified by 1/R (~1.2x). A unit
// aimed 2° right makes a straight swing look 2.4° open, all session, and the
// app would confidently prescribe an anti-slice drill for a swing fault that
// does not exist. Club path and attack angle additionally need the ball at the
// documented distance, and spin is not measured at all without an RPT ball.
const SetupGuide = (() => {
  const STEPS = [
    {
      n: 1,
      title: 'Level the unit before anything else',
      body: 'Adjust the legs until the unit sits flat. Front-to-back tilt must stay within ' +
            '<strong>0.2°</strong> — that is the axis attack angle and launch angle are read against, ' +
            'so a nose-down unit reports every shot as steeper than it was. Side-to-side matters less ' +
            'but keep it flat too. On an uneven bay, level the unit to the <em>ball</em>, not to the floor.',
      why: 'Tilt biases attack angle and launch angle on every single shot.',
    },
    {
      n: 2,
      title: 'Set the ball at the documented distance',
      body: 'Place the ball <strong>250 cm from the unit</strong>. Club path and angle of attack are only ' +
            'measured inside that placement window — outside it the device either drops them or reports ' +
            'them badly, and you will not always be told which.',
      why: 'Club path and attack angle depend on precise placement, not just on being in view.',
    },
    {
      n: 3,
      title: 'Switch to Impact Vision to aim',
      body: 'Open <strong>Impact Vision</strong> on your phone or tablet. It draws the line the device is ' +
            'actually measuring against. That line — not the bay, not the mat edge, not the target you ' +
            'picked by eye — is the zero your launch direction and club path are reported from.',
      why: 'You cannot align to something you cannot see. The on-screen line is the real reference.',
    },
    {
      n: 4,
      title: 'Lay an alignment stick along the on-screen line',
      body: 'Put an alignment stick — or a club — on the ground and adjust it until it sits exactly along ' +
            'the line shown on screen. Take your time here. Every degree you are out becomes a degree of ' +
            'phantom face-to-path in every shot the app analyses afterwards.',
      why: 'This is the step that transfers the device’s reference line into the real world.',
    },
    {
      n: 5,
      title: 'Slide the stick sideways — do not rotate it',
      body: 'Once the stick matches the line, move it <strong>sideways</strong> to clear the hitting area, ' +
            'keeping its direction identical. Slide it; never pivot it. Then put your ball where the stick ' +
            'just was, on the line, inside the club measurement box.',
      why: 'The stick keeps the direction; the ball takes the position.',
    },
    {
      n: 6,
      title: 'Check the end state, then play down the stick',
      body: 'You should now have the <strong>ball on the line inside the measurement box</strong>, and the ' +
            '<strong>alignment stick parallel beside it</strong> showing you the direction. Aim and swing ' +
            'down the stick, not at whatever looks like a target out on the range.',
      why: 'If you play to a different target than the device is measuring, every number is offset.',
    },
  ];

  // What each metric actually requires. Shown as a checklist, because "the app
  // said my face was open" is only meaningful if these were true at the time.
  const REQUIREMENTS = [
    { metric: 'Ball speed, club speed, smash factor',
      needs: 'Nothing special — these are the most reliable numbers the device produces.', ok: true },
    { metric: 'Attack angle, launch angle',
      needs: 'Unit levelled within 0.2° front-to-back.' },
    { metric: 'Club path, attack angle',
      needs: 'Ball placed 250 cm from the unit.' },
    { metric: 'Launch direction, face-to-path, any open/closed face reading',
      needs: 'Impact Vision alignment done properly (steps 3–6). This is the one people skip, and it is the one that silently biases every angular drill the app suggests.' },
    { metric: 'Spin rate, spin axis',
      needs: 'A Rapsodo RPT ball. Spin is NOT measured with range balls or with your own premium ball — the number you see is estimated, not read. ShotLab never prescribes from spin for this reason.',
      warn: true },
    { metric: 'Dispersion and gapping',
      needs: 'Your own premium balls. Range balls give 2–4× the spread off a machine with zero variability, and a wedge can fly further on half the spin.',
      warn: true },
  ];

  const SUMMARY = 'Ten minutes of setup decides whether the next hour of numbers means anything. ' +
    'A unit aimed 2° right makes a straight swing read 2.4° open — all session, on every shot — ' +
    'and this app would prescribe an anti-slice drill for a fault you do not have.';

  function html() {
    return `
      <div class="setup-guide">
        <p class="setup-summary">${SUMMARY}</p>

        <h3 class="setup-h">Setting up</h3>
        <ol class="setup-steps">
          ${STEPS.map(s => `
            <li class="setup-step">
              <div class="setup-step-n">${s.n}</div>
              <div class="setup-step-body">
                <div class="setup-step-title">${s.title}</div>
                <div class="setup-step-text">${s.body}</div>
                <div class="setup-step-why">${s.why}</div>
              </div>
            </li>`).join('')}
        </ol>

        <h3 class="setup-h">What each number needs to be true</h3>
        <div class="setup-reqs">
          ${REQUIREMENTS.map(r => `
            <div class="setup-req${r.warn ? ' warn' : ''}${r.ok ? ' ok' : ''}">
              <div class="setup-req-metric">${r.metric}</div>
              <div class="setup-req-needs">${r.needs}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function show() {
    document.getElementById('setupModal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'setupModal';
    modal.innerHTML = `
      <div class="modal modal-wide">
        <div class="modal-head">
          <h2 class="modal-title">Setting up your launch monitor</h2>
          <button class="btn-icon" data-close-modal aria-label="Close">✕</button>
        </div>
        <div class="modal-scroll">${html()}</div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  return { STEPS, REQUIREMENTS, SUMMARY, html, show };
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

  // A blank or unparseable numeric cell means "not measured", which is NOT
  // the same as a measured 0. Rapsodo leaves club-path / attack-angle /
  // spin-axis empty whenever the club data wasn't picked up, and coercing
  // those to 0 made them indistinguishable from a genuine zero reading —
  // ShotScorer then awarded them full marks for a "perfectly neutral" path
  // and "zero" dispersion. null keeps the two cases apart.
  const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

  // Columns that make a file a Rapsodo export rather than some other CSV.
  // Without this check any spreadsheet parsed "successfully": Papa returns
  // rows, none of the column names match, and every shot comes back holding
  // nothing but its row number. The import then showed "48 shots, 1 club" with
  // a table of dashes and saved it, and the failure only became visible later
  // as a session that analysed to nothing. Refusing at the door is the only
  // place this can be said clearly.
  const REQUIRED = ['Club Type', 'Ball Speed'];

  function parse(csvText) {
    const result = Papa.parse(csvText, { header:true, skipEmptyLines:true, transformHeader:h=>h.trim() });
    if (!result.data?.length) throw new Error('That file has no rows in it.');

    const headers = Object.keys(result.data[0] || {});
    const missing = REQUIRED.filter(c => !headers.includes(c));
    if (missing.length) {
      const known = headers.filter(h => h in COLUMN_MAP);
      throw new Error(
        `This does not look like a Rapsodo export — it has no ${missing.join(' or ')} column` +
        (known.length ? `, though ${known.length} other column${known.length === 1 ? '' : 's'} did match.`
                      : ` and none of its ${headers.length} columns match the ones Rapsodo writes.`) +
        ` Export from Rapsodo Cloud → Session → Share → CSV and try that file.`);
    }

    const shots = result.data.map((row,i) => {
      const shot = {_row:i+2};
      for (const [col,field] of Object.entries(COLUMN_MAP)) {
        if (!(col in row)) continue;
        shot[field] = NUM.has(field) ? num(row[col]) : row[col];
      }
      return shot;
    });

    // Right headers, no readings — a session that was exported before anything
    // was hit, or one where every row failed to record. Saving it produces a
    // session that silently analyses to nothing.
    const usable = shots.filter(s => Number.isFinite(s.ballSpeed) && s.ballSpeed > 0);
    if (!usable.length) {
      throw new Error(`The columns are right but none of the ${shots.length} rows has a ball speed in it, ` +
        `so there is nothing to analyse. Check the session actually recorded shots before exporting.`);
    }
    return shots;
  }

  return { parse, REQUIRED };
})();

// ────────────────────────────────────────────────────────────────
// Fault Engine — v2 with real swing mechanics
// ────────────────────────────────────────────────────────────────
const FaultEngine = (() => {

  // ── The inference boundary, §3.6 ──────────────────────────────
  // The fault cards list causes under a heading that read "Root causes", and
  // sixteen of the eighty entries name a body position: hip rotation, spine
  // tilt, a cupped lead wrist, casting, early extension. The research base is
  // explicit that none of these are recoverable from ball and club-head data.
  // Dynamic loft alone is the simultaneous outcome of shaft lean, wrist angle,
  // forearm rotation, shaft droop, attack angle and ball position — the
  // mapping is many-to-one and cannot be inverted, and there is no published
  // regression from a measured wrist angle to a measured dynamic loft
  // anywhere. "Casting", "over the top" and "early extension" are body-position
  // constructs; club path is an outcome that many different body actions
  // produce.
  //
  // The content is worth keeping — these ARE the things that commonly produce
  // the pattern, and a golfer with a video camera can check them. What was
  // wrong is the app asserting them as findings. So they are classified and
  // shown apart, under a heading that says the device cannot see them.
  //
  // The framing rule from §3.6, verbatim: say "your face was 3° open to your
  // path"; never say "your lead wrist was cupped."
  const BODY_CONSTRUCT = /\b(hip|hips|pelvis|torso|shoulder turn|wrist|wrists|lag|cast|casting|early exten|weight shift|ground|x-factor|spine|arm-dominant|over the top|release|posture|sway|slide|sliding|separation|knee|elbow|forearm|grip pressure|stance)\b/i;

  // Can the launch monitor actually see this, or is it a body position someone
  // would need video to check?
  const causeIsObservable = text => !BODY_CONSTRUCT.test(String(text || ''));
  function splitCauses(causes) {
    const list = (causes || []).filter(Boolean);
    return {
      observable: list.filter(causeIsObservable),
      body: list.filter(c => !causeIsObservable(c)),
    };
  }
  const BODY_CAVEAT =
    'The monitor sees the ball and the club head, not you. These are the body positions that commonly ' +
    'produce this pattern, and they are worth checking on video — but the app cannot see any of them, and ' +
    'several different actions produce the same club delivery. Treat them as things to look for, not as ' +
    'findings.';


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
      test: s => facePath(s) > 5,   // side carry is tier 3 (modelled) — not used
      description: shots => {
        const afp = mean(shots.map(facePath).filter(v => Number.isFinite(v) && v > 5));
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
      test: s => facePath(s) < -5,  // side carry is tier 3 (modelled) — not used
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
      minShotsFor: Conditions.startLineFloor,   // 10 when aligned, 30 when not
      test: s => s.launchDirection > 5 &&
        Number.isFinite(facePath(s)) && Math.abs(facePath(s)) < 4,
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
      minShotsFor: Conditions.startLineFloor,   // 10 when aligned, 30 when not
      test: s => s.launchDirection < -5 &&
        Number.isFinite(facePath(s)) && Math.abs(facePath(s)) < 4,
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
      minShots: 15,   // club-delivery metric — tier 2, needs a bigger sample
      id:'driver-negative-aa', name:'Negative Attack Angle on Driver', icon:'📉', category:'Attack Angle', severity:'high',
      test: s => s.clubType === 'd' && s.attackAngle < -1,
      description: shots => {
        const aa = avg(shots,'attackAngle');
        const carry = avg(shots,'carryDistance');
        return `Attack angle of ${fmt(aa,1)}° (hitting down on driver). ` +
          `Irons are built to be hit down on; a driver is not. Hitting down on a teed ball costs you carry.` +
          ` How much depends on your loft and ball, which this app cannot see, so no yardage is quoted here —` +
          ` published "+N yards per degree" figures assume the driver is re-fitted at the same time.`;
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
      minShots: 15,   // club-delivery metric — tier 2, needs a bigger sample
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
      minShots: 15,   // club-delivery metric — tier 2, needs a bigger sample
      id:'iron-shallow-aa', name:'Shallow Attack Angle on Irons', icon:'↗️', category:'Attack Angle', severity:'medium',
      test: s => isIron(s.clubType) && !isShort(s.clubType) &&
        Number.isFinite(s.attackAngle) && s.attackAngle > -0.5,
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
      minShots: 15,   // club-delivery metric — tier 2, needs a bigger sample
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
      test: s => s.clubType === 'd' && Number.isFinite(s.launchAngle) && s.launchAngle < 9,
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
        `A steeply ascending strike adds height without adding carry.`,
      causes:['Attack angle too steeply upward (> +6°)','Face too open at address producing a scooped hit',
        'Dynamic loft too high'],
      drills:[
        {name:'Lower tee test',desc:'Drop tee height so only 1/4 of the ball is above the crown. Note how trajectory flattens. Find the tee height that gives your peak trajectory without ballooning.'},
        {name:'Shoulder tilt check',desc:'Excessive spine tilt away from target creates high dynamic loft. Maintain natural shoulder tilt (~5° from horizontal) rather than exaggerating.'},
      ],
      optimalRange: () => '10–15° for most swing speeds',
    },

    // ── SPIN (when available) ──────────────────────────────────
    // NOTE: an 'Excessive Spin — Driver' fault used to live here. It is gone
    // on purpose. Consumer-radar spin limits of agreement run -2,628 to +5,103
    // rpm — wider than the entire amateur-to-tour spin gap (589 rpm) — and even
    // a TrackMan's between-session spin ICC bottoms out at 0.02. Spin is also
    // only measured at all with an RPT ball. "Reduce your spin" is the most
    // tempting and least defensible drill this app could ship.

    // ── SPIN LOFT (estimated) ──────────────────────────────────
    // Spin loft = dynamic loft - attack angle: the angle between where the
    // face points and where the club is travelling. It is the primary driver
    // of BOTH spin rate and smash factor, which is why it disambiguates a
    // fault that smash factor alone cannot: low smash from an off-centre
    // strike needs a completely different fix from low smash caused by
    // adding loft through impact. Estimated from launch and attack angle
    // (Rapsodo does not export dynamic loft) — see spinLoft().
    {
      id:'high-spin-loft', name:'Adding Loft Through Impact', icon:'📐', category:'Spin Loft', severity:'high',
      test: s => {
        const sl = spinLoft(s), band = Benchmarks.spinLoftBand(s.clubType);
        return sl !== null && sl > band.hi + 3;
      },
      description: shots => {
        const sl = mean(shots.map(spinLoft));
        const band = Benchmarks.spinLoftBand(shots[0]?.clubType);
        return `Estimated spin loft of ${fmt(sl,1)}° against a ${band.lo}–${band.hi}° window for this club ` +
          `(PGA Tour reference ${fmt(band.tour,1)}°). You are presenting more loft at impact than the club is ` +
          `travelling to deliver — the face is pointing well above the path. This costs ball speed and adds spin ` +
          `at the same time, which is why it feels like "good contact that goes nowhere". ` +
          `It is the single most common reason smash factor stays low even after strike location improves.`;
      },
      causes:['Casting / early release — the wrist angle unwinds before impact',
        'Scooping: trying to lift the ball rather than compressing it',
        'Cupped lead wrist at impact adding dynamic loft',
        'Ball too far forward, catching it past the low point with the face already open upward',
        'Hanging back on the trail foot so the shaft leans away from the target'],
      drills:[
        {name:'Punch-shot ladder',desc:'Hit 10 shots with a 7-iron trying to keep the ball under an imagined 10-foot bar 20 yards ahead. Finish with the hands low and the club no higher than your shoulder. The low finish is the constraint that removes added loft — you cannot flip and still keep it under the bar.'},
        {name:'Towel-line compression drill',desc:'Lay a towel flat 4 inches BEHIND the ball. Hit shots that miss the towel entirely and take turf in FRONT of the ball. The towel gives instant external feedback on where the low point is, which is what spin loft is really measuring.'},
        {name:'Trail-hand-only half swings',desc:'Hit 10 half shots with a 9-iron using only your trail hand on the club. It is almost impossible to cast one-handed without losing the club, so this trains retention of the wrist angle without any conscious "hold the lag" thought.'},
        {name:'Feet-together compression',desc:'Feet touching, 8-iron, 60% speed, 15 balls. Removes lateral slide so the strike has to come from rotation. Watch the spin loft estimate fall as strikes centre up.'},
      ],
      optimalRange: t => { const b = Benchmarks.spinLoftBand(t); return `${b.lo}–${b.hi}° spin loft`; },
    },

    {
      id:'low-spin-loft-iron', name:'Delofting Too Much (Irons)', icon:'🔻', category:'Spin Loft', severity:'medium',
      test: s => {
        if (!isIron(s.clubType)) return false;
        const sl = spinLoft(s), band = Benchmarks.spinLoftBand(s.clubType);
        return sl !== null && sl < band.lo - 3;
      },
      description: shots => {
        const sl = mean(shots.map(spinLoft));
        const band = Benchmarks.spinLoftBand(shots[0]?.clubType);
        return `Estimated spin loft of ${fmt(sl,1)}° sits below the ${band.lo}–${band.hi}° window for this club. ` +
          `You are delivering the club with very little loft — shots will come out low and hot with too little ` +
          `spin to hold a green. This is the opposite miss from casting and is usually over-correction: ` +
          `strong shaft lean driven by the hands rather than by body rotation.`;
      },
      causes:['Excessive forward shaft lean driven by the hands',
        'Ball too far back in the stance',
        'Stalling body rotation and dragging the handle through impact',
        'Over-coaching of "hit down on it" past the point of usefulness'],
      drills:[
        {name:'Ball-position reset',desc:'Alignment stick across the toes. Short irons one ball-width inside the lead heel, mid-irons two, long irons three. Most excessive deloft is simply a ball played too far back.'},
        {name:'Height ladder',desc:'With one club, hit 3 low, 3 stock, 3 high, repeating. Deliberately varying delivered loft rebuilds the range you have lost — you cannot hit the high ones with the handle dragged forward.'},
        {name:'Release-through-the-turf drill',desc:'Feel the clubhead pass the hands after impact into a full, high finish. Pair with a mirror or a phone camera: the lead arm should be extended and the club rising, not stalled low.'},
      ],
      optimalRange: t => { const b = Benchmarks.spinLoftBand(t); return `${b.lo}–${b.hi}° spin loft`; },
    },

    {
      id:'high-spin-axis', name:'High Spin Axis (Slice Spin)', icon:'🔄', category:'Spin', severity:'high',
      // Spin axis is only measured with an RPT ball, and is tier 3 even then.
      test: s => Spin.measured(s) && s.spinAxis && s.spinAxis > 15,
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
      test: s => Spin.measured(s) && s.spinAxis && s.spinAxis < -15,
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
      test: s => isShort(s.clubType) && Number.isFinite(s.smashFactor) && s.smashFactor < 1.20 &&
        Number.isFinite(s.launchAngle) && s.launchAngle > 35,
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

  // ── Reporting gates ───────────────────────────────────────────
  // The launch monitor's own error (MAE 1.05 deg attack angle, 1.19 deg club
  // path on the MLM2PRO vs a GCQuad) is wider than several of the thresholds
  // above. On any single shot that noise can push a good strike past a
  // threshold, so a per-shot trip is not evidence of anything.
  //
  // Noise does not survive averaging, though: it shrinks with sample size
  // while a real swing pattern does not. So rather than padding every
  // threshold (which would suppress genuine faults), a fault reports only
  // when it recurs at a rate noise alone would not produce, over a sample
  // big enough to judge. A fault on 9 of 12 seven-irons is a pattern; the
  // same fault on 2 of 12 is the radar.
  // Sample floors come from Metrics: 10 shots before ANY club mean is
  // reported, 15 before a club-path or attack-angle claim, 30 for dispersion
  // tails. A rule may raise its own floor via `minShots`.
  const MIN_AFFECTED = 2;      // never report a fault off a single shot
  const MIN_RATE     = 0.30;   // share of that club's shots that must trip it
  const FIRM_RATE    = 0.50;   // below this, report but downgrade severity

  const DOWNGRADE = { high: 'medium', medium: 'low', low: 'low' };

  function detectFaults(shots, session) {
    if (!shots.length) return [];
    const faults = [];

    for (const rule of PER_SHOT_RULES) {
      const affected = shots.filter(s => { try { return rule.test(s); } catch { return false; } });
      if (affected.length < MIN_AFFECTED) continue;

      // Judge the fault against the clubs it actually appeared on, not the
      // whole session — a driver fault should be measured against drivers.
      const clubs = new Set(affected.map(s => s.clubType));
      const relevant = shots.filter(s => clubs.has(s.clubType));
      const floor = rule.minShotsFor ? rule.minShotsFor(relevant.length ? relevant : session)
                  : (rule.minShots || Metrics.MIN_SHOTS_REPORT);
      if (relevant.length < floor) continue;

      const rate = affected.length / relevant.length;
      if (rate < MIN_RATE) continue;

      const firm = rate >= FIRM_RATE;
      faults.push({
        ...rule,
        severity: firm ? rule.severity : DOWNGRADE[rule.severity] || rule.severity,
        count: affected.length,
        total: relevant.length,
        rate,
        confidence: firm ? 'confirmed' : 'tentative',
        description: typeof rule.description === 'function' ? rule.description(affected) : rule.description,
        evidence: `${affected.length} of ${relevant.length} ${[...clubs].map(clubLabel).join('/')} shots` +
          (firm ? '' : ' — borderline, worth another session to confirm'),
        minShots: floor,
        affectedShots: affected.map(s=>s._row),
        // for RetentionProbe: which club, and which tier-1 metric to re-measure
        clubType: [...clubs][0],
        metric: rule.probeMetric || 'smashFactor',
      });
    }

    for (const rule of SESSION_RULES) {
      if (shots.length < Metrics.MIN_SHOTS_REPORT) break;  // too small a session to judge
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

  return { detectFaults, splitCauses, causeIsObservable, BODY_CAVEAT, BODY_CONSTRUCT,
           MIN_AFFECTED, MIN_RATE, FIRM_RATE };
})();

// ────────────────────────────────────────────────────────────────
// Shot Scorer — 0–100 per shot
// ────────────────────────────────────────────────────────────────
const ShotScorer = (() => {
  // Scored ONLY from metrics the device can be trusted on (Metrics.TIER).
  // Side carry and spin axis used to carry 35 of the 100 points between them.
  // Both are tier 3 — side carry is a ball-flight model output and spin axis
  // scored ICC < 0.26 in the only study to measure it. Scoring a golfer on
  // them was scoring them on noise, so they are gone. The weight moved to
  // smash factor (tier 1, the highest-value amateur lever) and to spin loft,
  // which is derived from launch and attack angle (both tier 2).
  function score(shot) {
    let pts = 0, max = 0;

    // Strike quality (0-45) — tier 1, and the biggest lever an amateur has
    if (Number.isFinite(shot.smashFactor) && shot.smashFactor > 0) {
      const elite = isWood(shot.clubType) || isHybrid(shot.clubType) ? 1.48 : 1.41;
      const raw = Math.min(1, Math.max(0, (shot.smashFactor - 1.10) / (elite - 1.10)));
      pts += raw * 45; max += 45;
    }

    // Attack angle vs optimal (0-25) — tier 2
    if (Number.isFinite(shot.attackAngle)) {
      const ideal = shot.clubType === 'd' ? 3 : isIron(shot.clubType) ? -3.5 : 1;
      pts += Math.max(0, 25 - Math.abs(shot.attackAngle - ideal) * 3.5); max += 25;
    }

    // Club path neutrality (0-15) — tier 2
    if (Number.isFinite(shot.clubPath)) {
      pts += Math.max(0, 15 - Math.abs(shot.clubPath) * 1.5); max += 15;
    }

    // Spin loft vs the club's window (0-15) — derived from two tier-2 metrics
    const sl = spinLoft(shot);
    if (Number.isFinite(sl)) {
      const band = Benchmarks.spinLoftBand(shot.clubType);
      const miss = sl < band.lo ? band.lo - sl : sl > band.hi ? sl - band.hi : 0;
      pts += Math.max(0, 15 - miss * 1.5); max += 15;
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
    const avgFP = mean(shots.map(facePath));
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

    // Spin — a reading only with an RPT ball, otherwise suppressed entirely
    const spinShots = shots.filter(s => s.spinRate && Spin.measured(s));
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
      const avgFPa = mean(shots.map(facePath));
      if (avgFPa !== null) {
      const fp = avgFPa > 8  ? {val:`Open +${fmt(avgFPa,1)}° (fading)`,tone:'bad'} :
                 avgFPa > 3  ? {val:`Slightly open +${fmt(avgFPa,1)}°`,tone:'ok'} :
                 avgFPa < -8 ? {val:`Closed ${fmt(avgFPa,1)}° (drawing)`,tone:'ok'} :
                 avgFPa < -3 ? {val:`Slightly closed ${fmt(avgFPa,1)}°`,tone:'good'} :
                               {val:`Square ${fmt(avgFPa,1)}° ✓`,tone:'good'};
      pills.push({category:'Face to Path',icon:'🎰',value:fp.val,tone:fp.tone});
      }
    }

    return pills;
  }

  return { analyze };
})();

// ────────────────────────────────────────────────────────────────
// Benchmarks — PGA Tour + Amateur averages per club
// ────────────────────────────────────────────────────────────────
const Benchmarks = (() => {
  // ── Tour reference data ───────────────────────────────────────
  // `pga` rows marked [TM] are TrackMan's published PGA Tour averages.
  // Rows marked [est] are interpolated across the TrackMan-anchored curve —
  // TrackMan does not publish every club, so those are clearly-labelled
  // estimates rather than sourced figures.
  //
  // The driver attack angle here was previously +3.0, which is NOT the PGA
  // Tour average — it is the LPGA Tour average, and +2..+5 is the range the
  // tour's LONGEST hitters use. The PGA Tour average is -1.3 (descending).
  // That number is corrected below; the +2..+5 figure survives as OPTIMAL
  // (see TARGET), because hitting up genuinely does add carry.
  const DATA = {
    d:   {label:'Driver',   pga:{sf:1.48,carry:275,bs:167,la:10.9,aa:-1.3}, am:{sf:1.42,carry:216,bs:133,la:12.6,aa:-1.6}}, // [TM]
    '2w':{label:'2 Wood',   pga:{sf:1.48,carry:255,bs:162,la:9.4, aa:-2.5}, am:{sf:1.40,carry:195,bs:120,la:11.0,aa:-2.8}}, // [est]
    '3w':{label:'3 Wood',   pga:{sf:1.48,carry:243,bs:158,la:9.2, aa:-2.9}, am:{sf:1.40,carry:183,bs:116,la:11.2,aa:-3.0}}, // [TM]
    '4w':{label:'4 Wood',   pga:{sf:1.47,carry:236,bs:155,la:9.3, aa:-3.1}, am:{sf:1.39,carry:178,bs:113,la:11.5,aa:-3.2}}, // [est]
    '5w':{label:'5 Wood',   pga:{sf:1.47,carry:230,bs:152,la:9.4, aa:-3.3}, am:{sf:1.39,carry:174,bs:110,la:11.8,aa:-3.4}}, // [TM]
    '7w':{label:'7 Wood',   pga:{sf:1.46,carry:222,bs:148,la:9.8, aa:-3.4}, am:{sf:1.38,carry:168,bs:107,la:12.4,aa:-3.5}}, // [est]
    '2h':{label:'2 Hybrid', pga:{sf:1.46,carry:232,bs:150,la:9.9, aa:-3.4}, am:{sf:1.38,carry:176,bs:109,la:12.4,aa:-3.5}}, // [est]
    '3h':{label:'3 Hybrid', pga:{sf:1.46,carry:228,bs:148,la:10.0,aa:-3.5}, am:{sf:1.37,carry:173,bs:107,la:12.7,aa:-3.6}}, // [est]
    '4h':{label:'4 Hybrid', pga:{sf:1.46,carry:225,bs:146,la:10.2,aa:-3.5}, am:{sf:1.37,carry:170,bs:105,la:13.0,aa:-3.6}}, // [TM]
    '5h':{label:'5 Hybrid', pga:{sf:1.45,carry:215,bs:142,la:10.8,aa:-3.6}, am:{sf:1.36,carry:162,bs:102,la:13.6,aa:-3.7}}, // [est]
    '1i':{label:'1i',       pga:{sf:1.46,carry:220,bs:145,la:9.8, aa:-2.8}, am:{sf:1.36,carry:165,bs:104,la:12.4,aa:-3.1}}, // [est]
    '2i':{label:'2i',       pga:{sf:1.45,carry:216,bs:143,la:10.1,aa:-3.0}, am:{sf:1.35,carry:162,bs:102,la:12.8,aa:-3.3}}, // [est]
    '3i':{label:'3i',       pga:{sf:1.45,carry:212,bs:142,la:10.4,aa:-3.1}, am:{sf:1.35,carry:159,bs:101,la:13.1,aa:-3.4}}, // [TM]
    '4i':{label:'4i',       pga:{sf:1.43,carry:203,bs:137,la:11.0,aa:-3.4}, am:{sf:1.34,carry:154,bs:100,la:13.5,aa:-3.6}}, // [TM]
    '5i':{label:'5i',       pga:{sf:1.41,carry:194,bs:132,la:12.1,aa:-3.7}, am:{sf:1.33,carry:143,bs:93, la:15.0,aa:-3.9}}, // [TM]
    '6i':{label:'6i',       pga:{sf:1.38,carry:183,bs:127,la:14.1,aa:-4.1}, am:{sf:1.32,carry:133,bs:87, la:16.5,aa:-4.3}}, // [TM]
    '7i':{label:'7i',       pga:{sf:1.36,carry:176,bs:120,la:16.3,aa:-4.3}, am:{sf:1.31,carry:122,bs:80, la:18.0,aa:-4.5}}, // [TM]
    '8i':{label:'8i',       pga:{sf:1.34,carry:164,bs:112,la:18.1,aa:-4.5}, am:{sf:1.29,carry:110,bs:74, la:19.5,aa:-4.7}}, // [TM]
    '9i':{label:'9i',       pga:{sf:1.32,carry:152,bs:103,la:20.4,aa:-4.7}, am:{sf:1.28,carry:98, bs:69, la:21.5,aa:-4.9}}, // [est]
    pw:  {label:'PW',       pga:{sf:1.28,carry:142,bs:95, la:24.2,aa:-5.0}, am:{sf:1.26,carry:87, bs:62, la:25.0,aa:-5.2}}, // [TM]
    aw:  {label:'AW',       pga:{sf:1.26,carry:128,bs:85, la:27.0,aa:-5.2}, am:{sf:1.24,carry:78, bs:57, la:28.0,aa:-5.4}}, // [est]
    sw:  {label:'SW',       pga:{sf:1.24,carry:112,bs:76, la:31.5,aa:-5.5}, am:{sf:1.20,carry:68, bs:50, la:33.0,aa:-5.6}}, // [est]
    lw:  {label:'LW',       pga:{sf:1.20,carry:92, bs:64, la:37.0,aa:-5.5}, am:{sf:1.16,carry:55, bs:42, la:40.0,aa:-5.5}}, // [est]
  };

  // What a golfer should AIM at — deliberately separate from what the tour
  // AVERAGES, because for attack angle those are different numbers and
  // conflating them is what produced the original error.
  const TARGET = {
    driverAttackAngle: {lo: 2,  hi: 5,   label: '+2° to +5° (hit up)'},
    ironAttackAngle:   {lo: -5, hi: -2,  label: '-2° to -5° (hit down)'},
    otherAttackAngle:  {lo: -2, hi: 0,   label: '0 to -2°'},
    driverSpin:        {lo: 2000, hi: 2800, label: '2000–2800 rpm'},
    woodSpin:          {lo: 2500, hi: 3500, label: '2500–3500 rpm'},
    ironSpin:          {lo: 3500, hi: 6000, label: '3500–6000 rpm'},
    driverLaunch:      {lo: 10, hi: 15,  label: '10–15°'},
    woodLaunch:        {lo: 9,  hi: 14,  label: '9–14°'},
    ironLaunch:        {lo: 13, hi: 22,  label: '13–22°'},
    shortIronLaunch:   {lo: 24, hi: 40,  label: '24–40°'},
    faceToPath:        {lo: -2, hi: 2,   label: 'within ±2°'},
  };

  // Resolve the target bands for a club. These used to be hardcoded as strings
  // inline in the launch-window table — a SECOND copy of numbers this table
  // already held, which is the precise shape of the bug the audit fixed once
  // already: the +3.0 driver attack angle that was the LPGA average sitting in
  // a table labelled PGA. One authoritative copy that nothing read, and one
  // inline copy that everything did. Correcting the first would not have
  // changed a single thing a golfer saw.
  function targetsFor(t) {
    const launch = t === 'd' ? TARGET.driverLaunch
                 : (isWood(t) || isHybrid(t)) ? TARGET.woodLaunch
                 : isShort(t) ? TARGET.shortIronLaunch
                 : TARGET.ironLaunch;
    const attack = t === 'd' ? TARGET.driverAttackAngle
                 : isIron(t) ? TARGET.ironAttackAngle
                 : TARGET.otherAttackAngle;
    const spin   = t === 'd' ? TARGET.driverSpin
                 : (isWood(t) || isHybrid(t)) ? TARGET.woodSpin
                 : TARGET.ironSpin;
    return { launch, attack, spin };
  }

  // Estimated spin loft by club family. TrackMan publishes PGA driver 14.7°
  // and 6-iron 24.3°; the most efficient drivers of the ball sit near 10–14°.
  // Spin rises with spin loft only up to ~45°, past which the ball slides up
  // the face, friction is lost and spin falls again.
  const SPIN_LOFT = {
    driver: {lo: 10, hi: 16, tour: 14.7},
    wood:   {lo: 12, hi: 19, tour: 16.5},
    hybrid: {lo: 15, hi: 22, tour: 19.0},
    longIron:{lo: 16, hi: 23, tour: 20.0},
    midIron: {lo: 20, hi: 28, tour: 24.3},
    shortIron:{lo: 26, hi: 36, tour: 31.0},
  };

  function spinLoftBand(t) {
    if (t === 'd') return SPIN_LOFT.driver;
    if (isWood(t)) return SPIN_LOFT.wood;
    if (isHybrid(t)) return SPIN_LOFT.hybrid;
    if (isShort(t)) return SPIN_LOFT.shortIron;
    if (isMid(t)) return SPIN_LOFT.midIron;
    return SPIN_LOFT.longIron;
  }

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

  return { get, status, TARGET, targetsFor, spinLoftBand };
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
  // ── Weighting practice time ───────────────────────────────────
  // Severity alone is the wrong ranking. It is hardcoded per fault and
  // identical for every golfer, so a session that happens to contain a lot of
  // driver swings hands most of its time to the driver whether or not the
  // driver is what is costing strokes.
  //
  // Strokes-gained work (Broadie) is clear that approach play explains the
  // largest share of scoring differences between players, and that the long
  // game — not putting — accounts for most of the amateur/professional gap.
  // ShotLab cannot compute true strokes gained: it sees range shots, not
  // rounds, and has no putting or short-game data. What it CAN do is stop
  // pretending every club matters equally. Scoring clubs — the irons and
  // wedges you hit into greens — get weighted up; a 3-wood most golfers hit
  // twice a round gets weighted down. Frequency within the session is folded
  // in too, because a fault on a club you actually hit matters more.
  function scoringWeight(clubType) {
    if (!clubType) return 1;
    if (clubType === 'd') return 1.15;      // driving distance is a real lever
    if (isWood(clubType)) return 0.7;       // few swings per round
    if (isHybrid(clubType)) return 0.9;
    if (isShort(clubType)) return 1.35;     // scoring clubs — approach play
    if (isMid(clubType)) return 1.3;        // approach play
    return 1.0;                             // long irons
  }

  // Which clubs a fault actually showed up on, from its affected shot rows.
  function faultClubs(fault, shots) {
    const rows = new Set(fault.affectedShots || []);
    const hit = shots.filter(s => rows.has(s._row));
    return hit.length ? hit : shots;
  }

  function generate(shots, totalMin = 45, session = null) {
    const faults = FaultEngine.detectFaults(shots, session).filter(f => f.drills && f.drills.length);
    if (!faults.length) return null;

    const scored = faults.map(f => {
      const clubs = faultClubs(f, shots);
      const sev = f.severity === 'high' ? 3 : f.severity === 'medium' ? 2 : 1;
      // average scoring weight across the clubs this fault appeared on
      const sw = mean(clubs.map(s => scoringWeight(s.clubType))) || 1;
      // how much of the session was those clubs — a fault on 2 shots out of 60
      // is worth less time than the same fault on 25 of them
      const share = clubs.length / shots.length;
      // tentative faults (borderline rate) earn less time than confirmed ones
      const conf = f.confidence === 'tentative' ? 0.6 : 1;
      return { f, weight: sev * sw * (0.5 + share) * conf };
    }).sort((a, b) => b.weight - a.weight);

    const top = scored.slice(0, 3);
    const totalW = top.reduce((a, b) => a + b.weight, 0) || 1;

    return top.map(({ f, weight }) => {
      const minutes = Math.max(5, Math.round(totalMin * weight / totalW));
      return {
        name: f.name, icon: f.icon, severity: f.severity,
        confidence: f.confidence, evidence: f.evidence,
        minutes,
        // Minutes alone let a golfer rake 120 balls in 20 minutes, which the
        // evidence says is exercise rather than practice. Ball count and
        // spacing are the part that actually constrains the session.
        balls: Math.max(10, Math.round(minutes * 1.5)),
        drill: f.drills[0],
        alternates: f.drills.slice(1, 3),
        ...libraryDrill(f, shots, session),
      };
    });
  }

  // ── The join to the gated library ─────────────────────────────
  // A fault names a mechanism; a DrillLibrary section names a measurement. The
  // fault's own drill text stays as the fallback, but the drill a plan actually
  // prescribes now comes from the library WITH its gate checked — so the app
  // cannot hand someone a dispersion drill off a range-ball session or a
  // start-line drill from an unaligned unit.
  //
  // When the whole section is locked the plan says so instead of substituting
  // something that happens to pass. Being told "this needs 30 shots of one club
  // on your own ball" is a instruction; being quietly given a different drill is
  // how a golfer ends up practising the thing that was measurable rather than
  // the thing that was wrong.
  function libraryDrill(fault, shots, session) {
    const section = DrillLibrary.sectionForFault(fault.id);
    if (!section) return {};
    const clubs = faultClubs(fault, shots);
    const club = clubs.length ? mode_(clubs.map(s => s.clubType)) : null;
    const ctx = { shots: clubs, clubType: club, sessions: 1 };
    const rows = DrillLibrary.forSection(section, ctx);
    const open = rows.filter(r => r.ok);
    const sec = DrillLibrary.SECTIONS[section];
    return {
      section, sectionName: sec.name, structure: sec.structure,
      libraryDrill: open.length ? open[0].drill : null,
      libraryAlternates: open.slice(1, 3).map(r => r.drill),
      // What is not available, and the one reason that would unlock the most.
      locked: rows.length - open.length,
      lockedNote: open.length ? null
        : (rows.find(r => r.reasons.length)?.reasons[0] ||
           'No drill in this section can be run on what this session measured.'),
    };
  }

  // Most common value — the club a fault actually lives on, rather than the
  // first one that happened to trip it.
  function mode_(vals) {
    const c = {};
    vals.forEach(v => { if (v) c[v] = (c[v] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null;
  }

  // The section-I wrapper that matches how the golfer has the app set up. These
  // are the highest-evidence items in the research base and they apply over
  // whatever drill is running, so a plan that lists drills without one is
  // missing the part that decides whether any of it transfers.
  function wrapperFor(mode = FeedbackEngine.getMode()) {
    const byMode = { faded: 'i95', bandwidth: 'i96', onRequest: 'i98', always: 'i95' };
    const d = DrillLibrary.byId(byMode[mode] || 'i95');
    if (!d) return null;
    return {
      ...d,
      note: mode === 'always'
        ? 'Your feedback is set to show every number, which is the one setting the evidence argues against. ' +
          'Run this wrapper over the session and change the setting when you are ready.'
        : 'This is how the session is run, not what is in it — and on the evidence it matters more than ' +
          'which drill above you pick.',
    };
  }

  // A block that belongs in every session regardless of fault, because the
  // thing range practice most reliably fails to train is the shot you
  // actually have to play: one ball, a new target, and no do-over.
  function transferBlock(totalMin = 45) {
    return {
      name: 'Play the course',
      icon: '⛳',
      minutes: Math.max(5, Math.round(totalMin * 0.25)),
      balls: 12,
      drill: {
        name: 'One ball, one target, full routine',
        desc: 'Play 9 imaginary holes. Change club and target every single ball, run your full pre-shot ' +
          'routine each time, and score each shot hit-or-miss against a target width you set in advance. ' +
          'No mulligans and no repeat shots. This is the closest a range gets to the thing you are actually ' +
          'practising for, and it is the block most golfers skip.',
      },
    };
  }

  return { generate, transferBlock, scoringWeight, libraryDrill, wrapperFor };
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
    const consistency = consistencyScore(all.map(s => s.carryDistance));

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
  // Comparing two sessions is where "never compare across measurement
  // conditions" gets broken most easily, and it was: any two sessions were put
  // side by side with green and red arrows, so a range-ball session against a
  // premium-ball one showed a carry "improvement" that was entirely the ball.
  // Conditions.comparable() existed for exactly this and nothing called it.
  //
  // The numbers still show — a golfer is entitled to see what they hit — but
  // the VERDICT is withheld on the rows the conditions actually change, which
  // is the same rule the shot table follows: the green arrow is the claim.
  function compare(a, b) {
    try {
      const metric = (s, f, dec=0) => fmt(avg(s.shots, f), dec);
      const num = (s, f) => avg(s.shots, f);
      const sameConditions = Conditions.comparable(a, b);
      const spinBoth = Spin.measured(a) && Spin.measured(b);
      const rows = [
        // conditionSensitive: does ball type or surface change what this
        // number MEANS, rather than just adding noise to it?
        ['Avg carry',  'carryDistance', 0, 'yds', true,  true],
        ['Ball speed', 'ballSpeed',     1, 'mph', true,  true],
        ['Smash',      'smashFactor',   2, '',    true,  false],
        ['Launch',     'launchAngle',   1, '°',   null,  false],
        // Spin is not a reading at all without an RPT ball, so it is dropped
        // rather than shown as a figure that was never measured.
        ...(spinBoth ? [['Spin', 'spinRate', 0, 'rpm', null, true]] : []),
        ['Apex',       'apex',          0, 'ft',  null,  true],
      ];
      const out = rows.map(([label, f, dec, unit, higherBetter, sensitive]) => {
        const av = num(a, f), bv = num(b, f);
        const delta = (av!=null && bv!=null) ? av - bv : null;
        const verdictOk = higherBetter != null && (sameConditions || !sensitive);
        return {
          label, unit, sensitive, withheld: sensitive && !sameConditions,
          a: metric(a, f, dec), b: metric(b, f, dec),
          delta: delta!=null ? fmt(Math.abs(delta), dec) : null,
          dir: delta==null||Math.abs(delta)<1e-9 ? 'flat' : delta>0 ? 'up' : 'down',
          good: (delta==null || !verdictOk) ? null : (higherBetter ? delta>0 : delta<0),
        };
      });
      out.comparable = sameConditions;
      out.caveats = [];
      if (!sameConditions) {
        const ba = Conditions.ball(a), bb = Conditions.ball(b);
        const sa = Conditions.surface(a), sb = Conditions.surface(b);
        if (ba.id !== bb.id) out.caveats.push(
          `These sessions used different balls — ${ba.label} against ${bb.label}. Ball type changes carry ` +
          `and dispersion by more than most training effects do, so the distance rows are shown without a ` +
          `verdict: the difference is the ball as much as you.`);
        if (sa.id !== sb.id) out.caveats.push(
          `Different surfaces — ${sa.label} against ${sb.label}. A mat lets the sole bounce instead of the ` +
          `edge digging, so a fat strike still reads near-normal and the two sets are not measuring the ` +
          `same thing.`);
      }
      if (!spinBoth) out.caveats.push(Spin.NOT_MEASURED);
      return out;
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
  // Putts being logged right now, before the session is saved. Held here so a
  // re-render does not throw away what has been tapped in so far.
  let _qeBuffer = [];
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
          <div class="drill-card" data-route="${Sanitize.escape(next.action)}">
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
            `<div style="padding:.7rem;background:rgba(0,112,243,.05);border-left:3px solid var(--pine);border-radius:var(--radius-sm);margin-bottom:.6rem">
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
              <div style="padding:.8rem;background:${a.severity==='high'?'rgba(238,0,0,.06)':a.severity==='info'?'rgba(0,112,243,.06)':'rgba(0,112,243,.06)'};border-left:3px solid ${a.severity==='high'?'var(--red)':a.severity==='info'?'var(--accent)':'var(--accent)'};border-radius:var(--radius-sm)">
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
          <div class="focus-title">No fault clears the reporting bar right now</div>
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
        const session = await Store.getSession(sessionId);
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
        const session = await Store.getSession(sessionId);
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
    _revealed = new Set();
    _predictions = new Map();
    _asking = null;
    try { renderConditionCaveats(session); } catch(e){ console.error('caveats',e); }
    renderRetention(session).catch(e => console.error('retention', e));
    // Opening a probe on the top fault is what makes the NEXT session able to
    // answer whether this one changed anything.
    try {
      const top = FaultEngine.detectFaults(session.shots, session)
        .filter(f => f.drills && f.drills.length)[0];
      if (top) RetentionProbe.open(session, top);
    } catch(e) { console.error('probe open', e); }
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
    renderStrike(shots, _session.shots);
    renderDispersion(shots);
    renderDispersionStats(shots);
    renderTail(shots);
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
  // Measurement caveats come FIRST, above any prescription, because they
  // change whether the prescription is admissible at all.
  // Probe results come first: whether the last thing you were told to work on
  // actually held is more important than what today's numbers say.
  async function renderRetention(session) {
    const el = document.getElementById('retentionHost');
    if (!el) return;
    let history = [];
    try { history = await Store.getSessions(); } catch (_) {}
    // Ask before settling. The probe cannot tell whether the drill was done,
    // and settling silently is what let it credit practice that never happened.
    const pending = RetentionProbe.due(session);
    if (pending.length) {
      el.hidden = false;
      el.innerHTML = `<div class="probe-block pending">
          <div class="probe-head">Before the verdict</div>
          ${pending.map(p => `<div class="probe-ask" data-probe="${Sanitize.escape(p.id)}">
              <div class="probe-item">Did you work on ${Sanitize.escape(p.faultName || 'it')}
                (${Sanitize.escape(clubLabel(p.clubType))}) since that session?</div>
              <div class="probe-btns">
                <button class="probe-btn" data-answer="yes">Yes</button>
                <button class="probe-btn" data-answer="no">No</button>
                <button class="probe-btn ghost" data-answer="unknown">Can't remember</button>
              </div>
            </div>`).join('')}
          <div class="tail-note">The change gets measured either way. This only decides whether the drill
            can be credited with it — a number the app cannot attribute is a number it should not attribute.</div>
        </div>`;
      el.querySelectorAll('.probe-ask').forEach(row => {
        row.querySelectorAll('.probe-btn').forEach(btn => btn.addEventListener('click', () => {
          const probe = pending.find(p => p.id === row.dataset.probe);
          const a = btn.dataset.answer;
          RetentionProbe.settle(probe, session, history, a === 'yes' ? true : a === 'no' ? false : null);
          renderRetention(session).catch(e => console.error('retention', e));
        }));
      });
      return;
    }

    const results = RetentionProbe.settled()
      .filter(r => r.probeSessionId === session.id);
    if (!results.length) {
      const open = RetentionProbe.openProbes();
      el.innerHTML = open.length
        ? `<div class="probe-block pending"><div class="probe-head">Retention check pending</div>
             <div class="probe-item">Come back at least a day later and hit
             ${open.map(p => `${RetentionProbe.MIN_SHOTS}+ ${Sanitize.escape(clubLabel(p.clubType))}`).join(' and ')}
             to find out whether ${open.length === 1 ? 'it' : 'they'} held. Within-session numbers cannot tell you.</div></div>`
        : '';
      el.hidden = !open.length;
      return;
    }
    el.hidden = false;
    el.innerHTML = `<div class="probe-block">
        <div class="probe-head">Did it hold?</div>
        ${results.map(r => `<div class="probe-item outcome-${r.outcome}">
            <span class="probe-dot"></span>${Sanitize.escape(RetentionProbe.describe(r))}</div>`).join('')}
      </div>`;
  }

  function renderConditionCaveats(session) {
    const el = document.getElementById('conditionCaveats');
    if (!el) return;
    const notes = Conditions.caveats(session);
    // Spin gets its own line either way: named as measured when an RPT ball
    // was used, named as absent when it was not. Silence would read as "no
    // spin problem" rather than "no spin data".
    notes.unshift(Spin.measured(session) ? Spin.CHANGE_CAVEAT : Spin.NOT_MEASURED + ' ' + Spin.ALTERNATIVE);
    const vol = FeedbackEngine.volumeAdvice((session.shots || []).length);
    if (vol) notes.push(vol);
    if (!notes.length) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="caveat-block">
        <div class="caveat-head">Before you read these numbers</div>
        ${notes.map(n => `<div class="caveat-item">${Sanitize.escape(n)}</div>`).join('')}
      </div>`;
  }

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
  // The SHAPE of the pattern only. This strip used to also show an average
  // miss, a max-minus-min "spread" and a bias in yards, off any session at
  // all — three numbers that were wrong in three different ways. Max minus min
  // grows with sample size and so says more about how long you practised than
  // how straight you hit it; the average miss and the bias were quoted from
  // range-ball sessions, where dispersion runs 2-4x wide, and from unaligned
  // units, where the whole pattern is offset by the aiming error. What
  // survives that is the shape, which is why it is all that is left here.
  // Everything quantitative moved to the gated tail engine below.
  function renderDispersionStats(shots) {
    const el = document.getElementById('dispersionStats');
    if (!el) return;
    const sides = shots.map(s=>s.sideCarry).filter(v=>typeof v==='number');
    if (!sides.length) { el.innerHTML=''; return; }
    const left  = sides.filter(v=>v < -7).length;
    const online = sides.filter(v=>v >= -7 && v <= 7).length;
    const right = sides.filter(v=>v > 7).length;
    const stats = [
      {label:'Left', value:`${left} (${Math.round(left/sides.length*100)}%)`},
      {label:'On line', value:`${online} (${Math.round(online/sides.length*100)}%)`},
      {label:'Right', value:`${right} (${Math.round(right/sides.length*100)}%)`},
    ];
    el.innerHTML = stats.map(s=>`
      <div class="disp-stat"><div class="disp-stat-val">${s.value}</div><div class="disp-stat-label">${s.label}</div></div>`).join('');
  }

  // ── Strike quality ────────────────────────────────────────────
  // Placed ABOVE dispersion in the detail view on purpose. It is the lever
  // with the largest evidenced return for an amateur, it is measured at tier 1
  // from end to end, and it moves in weeks — so it should be the first thing
  // read, not something found after scrolling past four charts.
  function renderStrike(shots, allShots) {
    const el = document.getElementById('strikeHost');
    if (!el) return;
    const esc = t => Sanitize.escape(t);
    const clubs = [...new Set((shots || []).map(s => s.clubType).filter(Boolean))]
      .sort((a, b) => (a === 'd' ? -1 : b === 'd' ? 1 : CLUB_ORDER.indexOf(a) - CLUB_ORDER.indexOf(b)));

    // The weak link is computed over the WHOLE session, not the current club
    // filter — its entire point is that the club costing you most is rarely
    // the one you were looking at.
    const wl = Strike.weakLink(allShots || shots);
    const bag = wl.ok && wl.worst
      ? `<div class="tail-block"><div class="tail-head">Across the bag</div>
           <div class="tail-item">${esc(wl.note)}</div>
           <div class="tail-stats">${wl.rows.slice(0, 3).map(r => `
             <div class="disp-stat"><div class="disp-stat-val">${fmt(r.mean, 2)}</div>
               <div class="disp-stat-label">${esc(clubLabel(r.club))} · ${fmt(Math.abs(r.gap), 2)} ${r.gap > 0 ? 'below' : 'above'} tour</div></div>`).join('')}</div>
         </div>`
      : '';

    const blocks = clubs.map(c => strikeBlock(shots, c)).filter(Boolean);
    if (!blocks.length && !bag) { el.innerHTML = ''; return; }
    el.innerHTML = bag + blocks.join('');
  }

  function strikeBlock(shots, club) {
    const esc = t => Sanitize.escape(t);
    const name = esc(clubLabel(club));
    const b = Strike.baseline(shots, club);
    if (!b.ok) {
      // Same rule as the tail: only worth a refusal if the golfer hit enough
      // of the club to have expected an answer.
      if ((shots || []).filter(s => s.clubType === club).length < 6) return '';
      return `<div class="tail-block pending"><div class="tail-head">${name} — strike</div>
          <div class="tail-note">${esc(b.note)}</div></div>`;
    }
    const h = Strike.headroom(shots, club);
    const sc = Strike.speedCost(shots, club);
    const fg = Strike.fatigue(shots, club);
    const gain = h.ok && h.real
      ? `<div class="tail-value">
           <div class="tail-value-num">${h.carry ? `${fmt(h.carry.lo, 0)}–${fmt(h.carry.hi, 0)} yards` : `${fmt(h.ballGain, 1)} mph ball speed`}</div>
           <div class="tail-value-sub">${esc(h.note)}</div>
         </div>
         <div class="tail-note">This is a chained estimate, not a measurement: your gap × your club speed ×
           a published yards-per-mph figure. Each link is sourced and the arithmetic is exact, which is not
           the same as the answer being measured. No strokes figure is offered from it — the app keeps one,
           in the tail audit below, and it comes from a spread it measured directly.</div>`
      : `<div class="tail-item">${esc(h.note || b.note || '')}</div>`;
    return `<div class="tail-block">
        <div class="tail-head">${name} — strike <span class="tail-n">${b.n} shots</span></div>
        <div class="tail-stats">
          <div class="disp-stat"><div class="disp-stat-val">${fmt(b.mean, 3)}</div>
            <div class="disp-stat-label">Your smash ±${fmt(b.ci, 3)}</div></div>
          <div class="disp-stat"><div class="disp-stat-val">${fmt(Strike.reference(club) ?? 0, 2)}</div>
            <div class="disp-stat-label">Tour reference</div></div>
          <div class="disp-stat"><div class="disp-stat-val">${fmt(b.spread, 3)}</div>
            <div class="disp-stat-label">Shot-to-shot spread</div></div>
        </div>
        ${gain}
        ${sc.ok ? `<div class="tail-item${sc.real && sc.slope < 0 ? ' heavy' : ''}">${esc(sc.note)}</div>`
                : `<div class="tail-note">${esc(sc.note)}</div>`}
        ${fg.ok ? `<div class="tail-item${fg.real && fg.drop > 0 ? ' heavy' : ''}">${esc(fg.note)}</div>`
                : `<div class="tail-note">${esc(fg.note)}</div>`}
      </div>`;
  }

  // ── The tail, and the one strokes number in the app ───────────
  // Rendered per club, because a directional spread pooled across the bag is
  // not a spread of anything. Driver first when it is in the selection, since
  // that is the only club Broadie & Ko's curves can price.
  function renderTail(shots) {
    const el = document.getElementById('tailHost');
    if (!el) return;
    const clubs = [...new Set((shots || []).map(s => s.clubType).filter(Boolean))]
      .sort((a, b) => (a === 'd' ? -1 : b === 'd' ? 1 : CLUB_ORDER.indexOf(a) - CLUB_ORDER.indexOf(b)));
    const blocks = clubs.map(c => tailBlock(shots, c)).filter(Boolean);
    if (!blocks.length) { el.innerHTML = ''; return; }
    el.innerHTML = blocks.join('');
  }

  function tailBlock(shots, club) {
    const r = Dispersion.report(shots, club, 1);
    const name = Sanitize.escape(clubLabel(club));
    const esc = t => Sanitize.escape(t);
    if (!r.ok) {
      // A refusal is only worth showing when there were enough shots of the
      // club for the golfer to have expected an answer. Below that it is
      // noise about a club they hit four of.
      if (r.n === 0 && (shots || []).filter(s => s.clubType === club).length < 8) return '';
      return `<div class="tail-block pending">
          <div class="tail-head">${name} — no tail yet</div>
          ${r.reasons.map(x => `<div class="tail-note">${esc(x)}</div>`).join('')}
        </div>`;
    }
    const t = r.tail;
    const cells = [
      { label: 'Directional spread', value: `${fmt(t.sigma, 1)}°` },
      { label: '9 in 10 inside', value: `${fmt(t.p90, 1)}°` },
      { label: '19 in 20 inside', value: `${fmt(t.p95, 1)}°` },
    ];
    const tailLine = t.heavyTailed
      ? `${t.bad} of your ${t.n} shots finished outside your own core spread, against the ${fmt(t.expectedBad, 1)} ` +
        `a normal curve fitted to that core would produce. Your bad shots are worse and more frequent than the ` +
        `middle of your pattern suggests — and that gap is where the strokes go, not the average.`
      : `${t.bad} of your ${t.n} shots finished outside your own core spread, against the ${fmt(t.expectedBad, 1)} ` +
        `expected. That is an ordinary tail for this pattern, so the spread figure above describes it fairly.`;
    const value = r.value && r.value.strokes !== null
      ? `<div class="tail-value">
           <div class="tail-value-num">${fmt(r.value.strokes, 1)} strokes</div>
           <div class="tail-value-sub">is what Broadie &amp; Ko's simulations put on taking 1° off a
             ${fmt(r.value.sigmaUsed, 1)}° directional spread — and the mechanism is not fairways hit, it is
             the drop in shots that finish out of bounds.</div>
         </div>
         ${r.value.note ? `<div class="tail-note">${esc(r.value.note)}</div>` : ''}
         ${r.value.caveats.map(x => `<div class="tail-note">${esc(x)}</div>`).join('')}`
      : `<div class="tail-note">${esc(r.value ? r.value.note : r.valuationWithheld)}</div>`;
    return `<div class="tail-block">
        <div class="tail-head">${name} — tail audit <span class="tail-n">${t.n} shots</span></div>
        <div class="tail-stats">${cells.map(c => `
          <div class="disp-stat"><div class="disp-stat-val">${c.value}</div>
            <div class="disp-stat-label">${c.label}</div></div>`).join('')}</div>
        <div class="tail-item${t.heavyTailed ? ' heavy' : ''}">${esc(tailLine)}</div>
        ${r.census.ok && r.census.note ? `<div class="tail-item">${esc(r.census.note)}</div>` : ''}
        ${t.bias === null
          ? `<div class="tail-note">Spread is measured around your own centre, so it survives a misaligned unit
               — an aiming error shifts every shot by the same amount and cancels out. How far that centre sits
               from the target does not, so it is not shown until you confirm alignment.</div>`
          : `<div class="tail-item">Your centre sits ${fmt(Math.abs(t.bias), 1)}°
               ${t.bias > 0 ? 'right' : 'left'} of the target line, on a confirmed alignment.</div>`}
        ${value}
      </div>`;
  }

  // ── Practice plan ─────────────────────────────────────────────
  function renderPracticePlan(shots) {
    const el = document.getElementById('practicePlan');
    if (!el) return;
    const plan = PracticePlan.generate(shots);
    // "Grooving" is the vocabulary of a claim the research base rejects: no
    // study supports a rep or week count that automatises a change, and the
    // word implies one. It also reads as "nothing here", when what the engine
    // actually found is that nothing recurred often enough to report.
    if (!plan) { el.innerHTML = `<div class="no-faults">Nothing recurred often enough to prescribe against.
      That is a real result, not an empty one — a fault has to appear on at least
      ${FaultEngine.MIN_AFFECTED ?? 2} shots and on ${Math.round((FaultEngine.MIN_RATE ?? 0.3) * 100)}% of the
      club's shots before it clears measurement noise. Run the transfer block below and bank the session.</div>`;
      return; }
    const transfer = PracticePlan.transferBlock();
    const blocks = [...plan, transfer];
    const total = blocks.reduce((a,b)=>a+b.minutes,0);
    const balls = blocks.reduce((a,b)=>a+(b.balls||0),0);
    const wrapper = PracticePlan.wrapperFor();
    el.innerHTML = `
      <div class="plan-intro">A ${total}-minute, ${balls}-ball session, weighted by how much each fault is
        likely costing you — severity, how often it recurred, and how much the clubs it appeared on matter
        to scoring. Leave 20s between shots.</div>
      ${blocks.map((p,i)=>`
        <div class="plan-item severity-${p.severity||'low'}">
          <div class="plan-num">${i+1}</div>
          <div class="plan-body">
            <div class="plan-head"><span>${p.icon} ${Sanitize.escape(p.name)}</span><span class="plan-min">${p.minutes} min · ${p.balls} balls</span></div>
            ${p.libraryDrill
              ? `<div class="plan-drill"><strong>${Sanitize.escape(p.libraryDrill.name)}:</strong>
                   ${Sanitize.escape(p.libraryDrill.desc)}</div>
                 <div class="plan-gate">${Sanitize.escape(p.sectionName)} · ${Sanitize.escape(p.structure)}</div>`
              : `<div class="plan-drill"><strong>${Sanitize.escape(p.drill.name)}:</strong> ${Sanitize.escape(p.drill.desc)}</div>`}
            ${p.lockedNote
              ? `<div class="plan-locked">Nothing in the ${Sanitize.escape(p.sectionName || 'matching')} section can be
                   run on what this session measured. ${Sanitize.escape(p.lockedNote)}</div>`
              : ''}
            ${p.evidence ? `<div class="plan-evidence">${Sanitize.escape(p.evidence)}</div>` : ''}
          </div>
        </div>`).join('')}
      ${wrapper ? `<div class="plan-item plan-wrapper">
          <div class="plan-num">↻</div>
          <div class="plan-body">
            <div class="plan-head"><span>Over the whole session</span><span class="plan-min">wrapper</span></div>
            <div class="plan-drill"><strong>${Sanitize.escape(wrapper.name)}:</strong> ${Sanitize.escape(wrapper.desc)}</div>
            <div class="plan-evidence">${Sanitize.escape(wrapper.note)}</div>
          </div>
        </div>` : ''}
      <div class="plan-note">${Sanitize.escape(CoachingMode.PROTOCOL.note)}</div>`;
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
      {label:'Carry',       field:'carryDistance',    dec:0, unit:'yds', col:'#0070f3'},
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
          legend:{labels:{color:'#888888',font:{size:11}}},
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
          x:{title:{display:true,text:'Side Carry (yds) — left / right',color:'#888888',font:{size:11}},
            ticks:{color:'#888888'},
            grid:{color: ctx => ctx.tick.value===0?'rgba(0,0,0,0.15)':'#ebebeb'},
          },
          y:{title:{display:true,text:'Carry Distance (yds)',color:'#888888',font:{size:11}},
            ticks:{color:'#888888'},grid:{color:'#ebebeb'},
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
          x:{ticks:{color:'#888888'},grid:{color:'#ebebeb'}},
          y:{ticks:{color:'#888888'},grid:{color:'#ebebeb'},
            title:{display:true,text:'Carry (yds)',color:'#888888',font:{size:11}}},
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
      const userSpin = avg(cs.filter(Spin.measured), 'spinRate');
      // Read from Benchmarks.TARGET rather than repeating it. What to AIM at is
      // deliberately separate from what the tour AVERAGES — the PGA driver
      // attack angle is -1.3°, descending, while +2 to +5 is the target — and
      // keeping a second inline copy is how those two got conflated the first
      // time. The status dots are computed from the same bands, so a number
      // shown as inside its target cannot be marked red.
      const tgt = Benchmarks.targetsFor(c);
      const optLA = tgt.launch.label, optAA = tgt.attack.label, optSpin = tgt.spin.label;
      const band = (v, b) => v === null ? 'na'
        : (v >= b.lo && v <= b.hi) ? 'green'
        : (v >= b.lo - (b.hi - b.lo) * 0.5 && v <= b.hi + (b.hi - b.lo) * 0.5) ? 'yellow' : 'red';
      const laStatus = band(userLA, tgt.launch);
      const aaStatus = band(userAA, tgt.attack);
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
                ${(() => {
                  // Split at the inference boundary: what the device measured
                  // versus what it cannot see. The old markup put both under
                  // "Root causes", which asserted body positions the launch
                  // monitor has no way of knowing.
                  const { observable, body } = FaultEngine.splitCauses(f.causes);
                  return (observable.length ? `
                    <div class="fault-section-title">What the numbers show</div>
                    <ul class="fault-causes">${observable.map(c=>`<li>${Sanitize.escape(c)}</li>`).join('')}</ul>` : '')
                  + (body.length ? `
                    <div class="fault-section-title">Often behind it — but not measured here</div>
                    <ul class="fault-causes fault-causes-body">${body.map(c=>`<li>${Sanitize.escape(c)}</li>`).join('')}</ul>
                    <p class="fault-inference-note">${Sanitize.escape(FaultEngine.BODY_CAVEAT)}</p>` : '');
                })()}
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

  // Rows the golfer has chosen to open, by the index the shot was HIT at.
  // Cleared when a different session is opened — a reveal is a choice about
  // these shots, not a global preference.
  let _revealed = new Set();
  // Estimates called before a reveal, same key. Kept so the comparison survives
  // a re-sort, and so a golfer cannot quietly re-guess after seeing the answer.
  let _predictions = new Map();
  // The row currently being asked about, if any.
  let _asking = null;

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
      {label:'Spin<br><small>rpm</small>',  render:s=>(Spin.measured(s)&&s.spinRate)?fmt(s.spinRate,0):'—', field:'spinRate'},
      {label:'Axis<br><small>°</small>',    render:s=>(Spin.measured(s)&&s.spinAxis)?fmt(s.spinAxis,1):'—', field:'spinAxis'},
      {label:'Apex<br><small>ft</small>',   render:s=>fmt(s.apex,0),        field:'apex'},
    ];

    const el = document.getElementById('shotTable');
    const heads = COLS.map(c=>{
      const a=_sortField===c.field; const arrow=a?(_sortDir===1?' ↑':' ↓'):'';
      return `<th ${c.field?`data-field="${c.field}"`:''}>${c.label}${arrow}</th>`;
    }).join('');

    // The feedback schedule, applied to the one surface in this app that is
    // per-shot knowledge of results. It is keyed on the order the shots were
    // HIT, not the order they are currently sorted in — a faded schedule that
    // re-decided itself when you clicked a column header would not be a
    // schedule. `_revealed` carries the rows the golfer has chosen to open,
    // and survives sorting for the same reason.
    const order = new Map(shots.map((s, i) => [s, i]));
    const decisions = new Map();
    FeedbackEngine.plan(shots).forEach(d => decisions.set(d.shot, d));

    const body = sorted.map((s,i) => {
      const hit = order.get(s) ?? i;
      const d = decisions.get(s);
      const open = !d || d.reveal || _revealed.has(hit);
      // The green/amber/red edge is a VERDICT on the shot, so it is feedback
      // just as much as the numbers are. Leaving it on a hidden row meant the
      // schedule hid the figures and told the golfer whether the shot was good
      // anyway — which is the whole thing it exists to prevent. It comes off
      // with them, and comes back when the row is opened.
      const sc = open ? ShotScorer.score(s) : null;
      const rowCls = sc===null?'': sc>=75?'row-good': sc>=50?'row-ok':'row-bad';
      const cells = COLS.map(c => {
        // The index column and the club stay visible whatever the schedule
        // says: knowing WHICH shot you are looking at is not feedback about it.
        if (open || c.field === null && c.label === '#') return `<td>${c.render(s,i)}</td>`;
        if (c.field === 'clubType') return `<td>${c.render(s,i)}</td>`;
        return `<td class="fb-hidden">·</td>`;
      }).join('');
      // Error estimation, Tier A rule 3: calling the number before it appears
      // preserves the intrinsic error-detection process that constant feedback
      // displaces. Asked on a sample of shots, not all of them — asking every
      // time is its own burden and stops being a probe.
      if (_asking === hit && !open) {
        return `<tr class="fb-ask-row" data-hit="${hit}"><td colspan="${COLS.length}">
            <div class="fb-ask">
              <span class="fb-ask-q">Shot ${hit + 1}. Call your smash factor before you look.</span>
              <input class="fb-ask-in" id="fbAskInput" type="number" step="0.01" min="0.5" max="2" placeholder="1.40" inputmode="decimal">
              <button class="probe-btn" id="fbAskGo">Reveal</button>
              <button class="probe-btn ghost" id="fbAskSkip">Just show me</button>
            </div></td></tr>`;
      }
      const guess = _predictions.get(hit);
      const guessRow = (open && guess !== undefined && Number.isFinite(s.smashFactor))
        ? `<tr class="fb-guess-row"><td colspan="${COLS.length}">
             <span class="fb-guess">You called ${fmt(guess, 2)}, it was ${fmt(s.smashFactor, 2)} —
               out by ${fmt(Math.abs(guess - s.smashFactor), 2)}.</span></td></tr>`
        : '';
      return `<tr class="${rowCls} shot-row${open ? '' : ' fb-row-hidden'}" data-idx="${i}" data-hit="${hit}">${cells}</tr>${guessRow}`;
    }).join('');

    const mode = FeedbackEngine.getMode();
    const shown = sorted.filter(s => { const d = decisions.get(s); return !d || d.reveal || _revealed.has(order.get(s)); }).length;
    // Rendered ABOVE the table rather than as a <caption>. A caption is as wide
    // as the table it belongs to, and this table scrolls horizontally inside
    // .table-wrap — so the explanation for why the numbers are hidden was
    // itself hidden off the right edge on a phone.
    const noteHost = document.getElementById('shotFeedbackNote');
    if (noteHost) {
      const calls = [..._predictions.entries()]
        .map(([hit, called]) => ({ called, actual: shots[hit] && shots[hit].smashFactor }));
      const cal = calls.length ? FeedbackEngine.calibration(calls, shots) : null;
      noteHost.innerHTML = mode === 'always' ? '' : `<div class="fb-caption">
          <span class="fb-caption-head">${shown} of ${sorted.length} shown · ${Sanitize.escape(FeedbackEngine.MODES[mode].label)}</span>
          ${Sanitize.escape(FeedbackEngine.explain(mode, sorted.length))}
          ${cal ? `<div class="fb-cal${cal.ok ? '' : ' pending'}">${Sanitize.escape(cal.note)}</div>` : ''}
          ${shown < sorted.length ? '<button class="fb-caption-btn" id="fbRevealAll">Show them all</button>' : ''}</div>`;
    }

    el.innerHTML=`<thead><tr>${heads}</tr></thead><tbody>${body}</tbody>`;
    // Tapping a hidden row opens that shot only. That is the whole of
    // self-selected feedback: the golfer keeps the choice, and choosing costs
    // them a deliberate action rather than happening by default.
    el.querySelectorAll('tr.fb-row-hidden').forEach(tr => tr.addEventListener('click', e => {
      e.stopPropagation();
      const hit = Number(tr.dataset.hit);
      const d = decisions.get(shots[hit]);
      // Ask for the estimate first, on the shots the schedule marks — but only
      // once per shot, and never after the answer has already been seen.
      if (d && d.predict && !_predictions.has(hit)) { _asking = hit; renderShotTable(shots); return; }
      _revealed.add(hit);
      renderShotTable(shots);
    }, { capture: true }));

    const answer = keep => {
      const hit = _asking;
      if (hit === null) return;
      const v = parseFloat(document.getElementById('fbAskInput')?.value);
      if (keep && Number.isFinite(v)) _predictions.set(hit, v);
      _asking = null;
      _revealed.add(hit);
      renderShotTable(shots);
    };
    document.getElementById('fbAskGo')?.addEventListener('click', () => answer(true));
    document.getElementById('fbAskSkip')?.addEventListener('click', () => answer(false));
    document.getElementById('fbAskInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); answer(true); }
    });
    document.getElementById('fbAskInput')?.focus();
    document.getElementById('fbRevealAll')?.addEventListener('click', () => {
      _asking = null;
      shots.forEach((_, i) => _revealed.add(i));
      renderShotTable(shots);
    });
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

    // Face-to-path is DERIVED, not measured, and carries ±1.8° on a single
    // shot — wider than most real values. A bare per-shot number here would be
    // exactly the claim the app must never make. Show the noise inline, and
    // put the club mean beside it, which is where it becomes trustworthy.
    const spinOK = Spin.measured(shot) || Spin.measured(_session);
    const f2pRaw = facePath(shot);
    // Uncertainty on a single shot is this golfer's own shot-to-shot spread
    // with this club, measured from their data — not a population constant.
    const ownSpread = Metrics.shotSpread(sessionShots, 'facePath', shot.clubType);
    const f2pSingle = Number.isFinite(f2pRaw)
      ? `${fmt(f2pRaw,1)}°` + (ownSpread ? ` <span class="sm-pm">± ${fmt(ownSpread,1)}</span>` : '')
      : '—';
    const clubF2P = (sessionShots || [])
      .filter(x => x.clubType === shot.clubType)
      .map(facePath).filter(Number.isFinite);
    let f2pClub = '<span class="sm-note">derived, not measured</span>';
    if (clubF2P.length >= Metrics.MIN_SHOTS_REPORT) {
      // The interval must come from YOUR shots, not from a population constant.
      // The observed spread already contains both your swing variability and
      // the device error, so the standard error computed from it is the honest
      // uncertainty in the average. Dividing a fixed 1.8° by sqrt(n) instead
      // gave every golfer the same +/- regardless of how consistent they are.
      const iv = Metrics.interval(clubF2P, '', 1);
      const spread = stdDev(clubF2P);
      f2pClub = `<span class="sm-cmp ${Math.abs(iv.mean) < 2 ? 'up' : 'down'}">` +
        `${clubLabel(shot.clubType)} avg ${fmt(iv.mean,1)}° ± ${fmt(iv.ci,1)} ` +
        `<span class="sm-note">(${iv.n} shots, spread ±${fmt(spread,1)}°)</span></span>`;
    } else if (clubF2P.length) {
      f2pClub = `<span class="sm-note">${clubF2P.length}/${Metrics.MIN_SHOTS_REPORT} shots — not enough to read yet</span>`;
    }

    // Estimated face angle, from the same D-plane inversion as face-to-path,
    // so the two are consistent by construction. Derived, never measured.
    const faRaw = faceAngle(shot);
    const faSpread = Metrics.shotSpread(sessionShots, 'faceAngle', shot.clubType);
    const faSingle = Number.isFinite(faRaw)
      ? `${fmt(faRaw,1)}°` + (faSpread ? ` <span class="sm-pm">± ${fmt(faSpread,1)}</span>` : '')
      : '—';
    const clubFA = (sessionShots || [])
      .filter(x => x.clubType === shot.clubType).map(faceAngle).filter(Number.isFinite);
    let faClub = '<span class="sm-note">derived, not measured</span>';
    if (clubFA.length >= Metrics.MIN_SHOTS_REPORT) {
      const fiv = Metrics.interval(clubFA, '', 1);
      faClub = `<span class="sm-cmp ${Math.abs(fiv.mean) < 2 ? 'up' : 'down'}">` +
        `${clubLabel(shot.clubType)} avg ${fmt(fiv.mean,1)}° ± ${fmt(fiv.ci,1)} ` +
        `<span class="sm-note">(${fiv.n} shots)</span></span>`;
    }
    // Gear effect makes the derivation invalid for this shot — say so loudly.
    const gear = gearEffectSuspected(shot, sessionShots);
    if (gear) faClub = `<span class="sm-warn">${Sanitize.escape(gear.likely)} strike suspected — ` +
      `face angle unreliable on this shot</span>`;

    const rows = [
      ['Club', clubLabel(shot.clubType), ''],
      ['Ball Speed', `${fmt(shot.ballSpeed,1)} mph`, cmp('ballSpeed',1)],
      ['Club Speed', `${fmt(shot.clubSpeed,1)} mph`, cmp('clubSpeed',1)],
      ['Smash Factor', fmt(shot.smashFactor,2), cmp('smashFactor',2)],
      ['Carry', `${fmt(shot.carryDistance,1)} yds`, cmp('carryDistance',1)],
      ['Total', `${fmt(shot.totalDistance,1)} yds`, cmp('totalDistance',1)],
      ['Launch Angle', `${fmt(shot.launchAngle,1)}°`, cmp('launchAngle',1)],
      ['Launch Dir', `${fmt(shot.launchDirection,1)}°`, ''],
      ['Side Carry', `${fmt(shot.sideCarry,1)} yds`, '<span class="sm-note">modelled</span>'],
      ['Club Path', `${fmt(shot.clubPath,1)}°`, ''],
      ['Attack Angle', `${fmt(shot.attackAngle,1)}°`, ''],
      ['Face-to-Path', f2pSingle, f2pClub],
      ['Face Angle', faSingle, faClub],
      ['Apex', `${fmt(shot.apex,0)} ft`, '<span class="sm-note">modelled</span>'],
      // Spin is a reading only with an RPT ball; otherwise it is not shown at all.
      (spinOK && shot.spinRate) ? ['Spin Rate', `${fmt(shot.spinRate,0)} rpm`, '<span class="sm-note">RPT measured</span>'] : null,
      (spinOK && shot.spinAxis) ? ['Spin Axis', `${fmt(shot.spinAxis,1)}°`, '<span class="sm-note">RPT measured</span>'] : null,
      (!spinOK && shot.spinRate) ? ['Spin', 'not measured', '<span class="sm-note">needs an RPT ball</span>'] : null,
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
          return `<div class="drill-card" data-route="sessions">
            <div class="drill-icon" style="width:14px;height:14px;border-radius:50%;background:${clubColor(b.club)}"></div>
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
      const alertsHost = document.getElementById('progressAlertsHost');
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
    clubSel.onchange = () => {
      renderProgressCharts(sessions, clubSel.value);
      renderTailTrend(sessions, clubSel.value);
      renderStrikeTrend(sessions, clubSel.value);
    };
    renderProgressCharts(sessions,'all');
    try { renderTailTrend(sessions, 'all'); } catch(e){ console.error('tail trend',e); }
    try { renderStrikeTrend(sessions, 'all'); } catch(e){ console.error('strike trend',e); }
    try { renderCompare(sessions); } catch(e){ console.error('compare',e); }
  }

  // ── Strike quality across sessions ────────────────────────────
  // Drill A18, and the same shape as the tail trend deliberately: a sparkline
  // for the shape and a sentence for the verdict, judged against this golfer's
  // own session-to-session variation. Never a paired before-and-after — two
  // sessions cannot separate a change from an ordinary week, and the module
  // refuses under three.
  //
  // Defaults to the club with the most shots across the history rather than to
  // the driver. Smash is the one metric where the weak link is usually NOT the
  // driver, which is the whole finding behind the strike track.
  function renderStrikeTrend(sessions, club) {
    const el = document.getElementById('strikeTrendHost');
    if (!el) return;
    const list = sessions || [];
    let target = club && club !== 'all' ? club : null;
    if (!target) {
      const counts = {};
      list.forEach(sn => (sn.shots || []).forEach(s => {
        if (s.clubType) counts[s.clubType] = (counts[s.clubType] || 0) + 1;
      }));
      target = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
    }
    if (!target) { el.innerHTML = ''; return; }

    const t = Strike.trend(list, target);
    const name = Sanitize.escape(clubLabel(target));
    const head = `<div class="tail-head">${name} — strike quality over time` +
      (club === 'all' || !club ? ` <span class="tail-n">your most-hit club</span>` : '') + `</div>`;
    if (!t.ok) {
      el.innerHTML = `<div class="tail-block pending">${head}
          <div class="tail-note">${Sanitize.escape(t.note)}</div></div>`;
      return;
    }
    const last = t.points[t.points.length - 1];
    const ref = Strike.reference(target);
    el.innerHTML = `<div class="tail-block">${head}
        ${sparkline(t.points.map(p => p.mean))}
        <div class="tail-spark-key">oldest → newest · higher is better</div>
        <div class="tail-stats">
          <div class="disp-stat"><div class="disp-stat-val">${fmt(last.mean, 3)}</div>
            <div class="disp-stat-label">Latest smash</div></div>
          <div class="disp-stat"><div class="disp-stat-val">${t.delta > 0 ? '+' : ''}${fmt(t.delta, 3)}</div>
            <div class="disp-stat-label">Change</div></div>
          <div class="disp-stat"><div class="disp-stat-val">${ref === null ? '—' : fmt(ref, 2)}</div>
            <div class="disp-stat-label">Tour reference</div></div>
        </div>
        <div class="tail-item${t.real ? '' : ' heavy'}">${Sanitize.escape(t.note)}</div>
        <div class="tail-note">Sessions with fewer than ${Metrics.MIN_SHOTS_REPORT} shots of this club are left
          out. Smash is tier 1 on this device — no derivation and no model output — which is why it is the one
          thing here you can track without a caveat about what the number is.</div>
      </div>`;
  }

  // ── Dispersion tail across sessions ───────────────────────────
  // The one trend in this view judged against the golfer's own session-to-
  // session variation rather than drawn as a line and left to be read. A line
  // chart of a spread invites reading a two-session wiggle as progress, which
  // is exactly what the rest of the app refuses to do — so the sparkline is
  // there to show shape, and the sentence under it is the verdict.
  //
  // "All clubs" cannot be a tail: pooling a driver and a wedge produces a
  // spread of the bag, not of anything you could practise. So it asks for a
  // club, and defaults to the driver, which is the only one the strokes curves
  // can price anyway.
  function renderTailTrend(sessions, club) {
    const el = document.getElementById('tailTrendHost');
    if (!el) return;
    const target = club && club !== 'all' ? club
      : (sessions.some(sn => (sn.shots || []).some(s => s.clubType === 'd')) ? 'd' : null);
    if (!target) { el.innerHTML = ''; return; }

    const t = Dispersion.trend(sessions, target);
    const name = Sanitize.escape(clubLabel(target));
    const head = `<div class="tail-head">${name} — directional spread over time` +
      (club === 'all' || !club ? ` <span class="tail-n">driver by default</span>` : '') + `</div>`;
    if (!t.ok) {
      el.innerHTML = `<div class="tail-block pending">${head}
          <div class="tail-note">${Sanitize.escape(t.note)}</div></div>`;
      return;
    }
    const last = t.points[t.points.length - 1];
    el.innerHTML = `<div class="tail-block">${head}
        ${sparkline(t.points.map(p => p.sigma))}
        <div class="tail-spark-key">oldest → newest · lower is tighter</div>
        <div class="tail-stats">
          <div class="disp-stat"><div class="disp-stat-val">${fmt(last.sigma, 1)}°</div>
            <div class="disp-stat-label">Latest</div></div>
          <div class="disp-stat"><div class="disp-stat-val">${t.delta > 0 ? '+' : ''}${fmt(t.delta, 1)}°</div>
            <div class="disp-stat-label">Change</div></div>
          <div class="disp-stat"><div class="disp-stat-val">${t.points.length}</div>
            <div class="disp-stat-label">Qualifying sessions</div></div>
        </div>
        <div class="tail-item${t.real ? '' : ' heavy'}">${Sanitize.escape(t.note)}</div>
        <div class="tail-note">Only sessions with ${Metrics.MIN_SHOTS_TAIL}+ usable shots of this club on a
          premium or RPT ball appear here. Range-ball sessions are left out rather than plotted, because a
          change in the ball would read as a change in you.</div>
      </div>`;
  }

  // Deliberately unlabelled and unscaled: it is a shape, not a chart to read
  // values off. The numbers that matter are in the tiles beneath it.
  function sparkline(values) {
    if (!values || values.length < 2) return '';
    const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
    const w = 100, h = 28;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - lo) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="tail-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"
        aria-label="Directional spread across ${values.length} sessions, oldest to newest. A lower line is a tighter spread.">
        <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"
          vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>`;
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
      const caveats = (rows.caveats || []).map(c =>
        `<div class="cmp-caveat">${Sanitize.escape(c)}</div>`).join('');
      res.innerHTML = caveats + rows.map(r => {
        const arrow = r.dir==='up'?'▲':r.dir==='down'?'▼':'–';
        const cls = r.good===true?'good':r.good===false?'bad':'neutral';
        return `<div class="cmp-row${r.withheld ? ' cmp-withheld' : ''}">
            <span class="cmp-label">${r.label}${r.withheld ? ' <small>· not comparable</small>' : ''}</span>
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
          x:{ticks:{color:'#888888',font:{size:10}},grid:{color:'#ebebeb'}},
          y:{ticks:{color:'#888888',font:{size:10}},grid:{color:'#ebebeb'},
            title:{display:!!yLabel,text:yLabel||'',color:'#888888',font:{size:10}}},
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
    // Quiet eye runs on no launch-monitor data at all, so it renders whether or
    // not a session has ever been imported — turning the empty state from a
    // dead end into the one thing a new user can actually do today.
    try { renderShortGame(); } catch (e) { console.error('short game', e); }
    try { renderQuietEye(); } catch (e) { console.error('quiet eye', e); }
    try { renderDrills(sessions); } catch (e) { console.error('drills', e); }
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
        <button class="btn-primary" data-start-plan="${Sanitize.escape(p.name)}" style="width:100%;margin-top:.6rem;padding:.4rem;font-size:.75rem">Start</button>
      </div>`
    ).join('');
  }

  // ── Drill library ─────────────────────────────────────────────
  // Locked drills stay on screen with their reason attached. A list that
  // quietly omits half of itself tells a golfer nothing; "hit 30 of these on
  // your own ball and this unlocks" tells them what to do next. That is the
  // whole argument for showing a gate rather than filtering on it.
  let _drillSection = 'A';
  function renderDrills(sessions) {
    const el = document.getElementById('drillHost');
    if (!el) return;
    const esc = t => Sanitize.escape(t);
    const list = sessions || [];
    const latest = list[0];
    const shots = latest ? (latest.shots || []) : [];
    // Gate against the club with the most shots in the latest session — the
    // one the golfer actually worked on — rather than the whole bag pooled.
    const counts = {};
    shots.forEach(s => { if (s.clubType) counts[s.clubType] = (counts[s.clubType] || 0) + 1; });
    const club = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
    const ctx = { shots, clubType: club, sessions: list.length };

    const secs = Object.values(DrillLibrary.SECTIONS);
    const tabs = secs.map(sc => `<button class="drill-tab${sc.id === _drillSection ? ' on' : ''}"
        data-drill-sec="${sc.id}">${sc.id} · ${esc(sc.name)}</button>`).join('');

    const sc = DrillLibrary.SECTIONS[_drillSection];
    const rows = DrillLibrary.forSection(_drillSection, ctx);
    const openN = rows.filter(r => r.ok).length;

    el.innerHTML = `
      <div class="drill-tabs">${tabs}</div>
      <div class="tail-block">
        <div class="tail-head">${esc(sc.name)}
          <span class="tail-n">${openN} of ${rows.length} open${club && !sc.gate.none ? ' · judged on ' + esc(clubLabel(club)) : ''}</span></div>
        <div class="tail-item">${esc(sc.why)}</div>
        <div class="tail-note"><strong>How this section is run.</strong> ${esc(sc.structure)}</div>
      </div>
      ${rows.map(r => `
        <div class="drill-row${r.ok ? '' : ' locked'}${r.flaggedOnly ? ' flagged' : ''}">
          <div class="drill-row-head">
            <span class="drill-row-name">${r.drill.n}. ${esc(r.drill.name)}</span>
            <span class="drill-row-state">${r.offDevice ? 'no device needed' : r.ok ? (r.flaggedOnly ? 'open · flagged' : 'open') : 'locked'}</span>
          </div>
          <div class="drill-row-desc">${esc(r.drill.desc)}</div>
          ${r.reasons.map(x => `<div class="drill-row-why">${esc(x)}</div>`).join('')}
        </div>`).join('')}
      ${_drillSection === 'I' ? '' : `<div class="tail-note" style="margin-top:.6rem">Whichever of these you
        pick, the wrappers in section I decide how much of it transfers — when the numbers appear, how the
        blocks are ordered, and whether anything checks a day later. Those matter more than the choice above.</div>`}`;

    el.querySelectorAll('[data-drill-sec]').forEach(b => b.addEventListener('click', () => {
      _drillSection = b.dataset.drillSec;
      renderDrills(sessions);
    }));
  }

  // ── Short game ────────────────────────────────────────────────
  let _sgTab = 'putting';
  let _chipBuffer = [];
  function renderShortGame() {
    const el = document.getElementById('shortGameHost');
    if (!el) return;
    const esc = t => Sanitize.escape(t);
    const S = ShortGame;
    const drills = _sgTab === 'chipping' ? S.CHIPPING : S.PUTTING;
    const plan = S.session(30, _sgTab);
    const log = S.all();
    const allChips = log.flatMap(r => r.chips || []);
    const prox = S.proximity(allChips);

    const tierChip = t => `<span class="sg-tier sg-tier-${t}">${t === 'strong' ? 'trial evidence'
      : t === 'moderate' ? 'supported' : 'no trial'}</span>`;

    el.innerHTML = `
      <div class="tail-block">
        <div class="tail-head">What the trials found <span class="tail-n">52 RCTs, 2024 review</span></div>
        ${Object.values(S.STRUCTURES).map(st => `
          <div class="tail-item"><strong>${esc(st.name)}.</strong> ${esc(st.how)}</div>
          <div class="tail-note">${esc(st.why)}</div>`).join('')}
        <div class="tail-note"><strong>And the limitation the reviewers state themselves.</strong> Over half
          of those 52 trials were statistically underpowered, and most used simple putting tasks in novices.
          The direction is well supported; the size of it, for a competent golfer on a real green, is not.</div>
        <div class="tail-note"><strong>Where the strokes actually are.</strong> About 65% of your shots happen
          from 100 yards in, and amateurs give away most of their short-game strokes to three-putts from
          outside 25 feet and to chunked chips. But a typical 90-shooter loses roughly six strokes to a
          scratch golfer across approach play and the short game and only about two to putting. Putting is
          the cheapest thing to fix, not the biggest hole — worth knowing before you spend a winter on it.</div>
      </div>

      <div class="drill-tabs">
        <button class="drill-tab${_sgTab === 'putting' ? ' on' : ''}" data-sg="putting">Putting · ${S.PUTTING.length}</button>
        <button class="drill-tab${_sgTab === 'chipping' ? ' on' : ''}" data-sg="chipping">Chipping · ${S.CHIPPING.length}</button>
      </div>

      <div class="tail-block">
        <div class="tail-head">A ${plan.minutes}-minute session <span class="tail-n">in this order</span></div>
        ${plan.blocks.map((b, i) => `
          <div class="tail-item"><strong>${i + 1}. ${esc(b.phase)} — ${esc(b.drill.name)}</strong>
            (${b.minutes} min). ${esc(b.drill.protocol)}</div>`).join('')}
        <div class="tail-note">${esc(plan.note)}</div>
      </div>

      ${drills.map(d => `
        <div class="drill-row sg-row">
          <div class="drill-row-head">
            <span class="drill-row-name">${esc(d.name)}</span>
            ${tierChip(d.tier)}
          </div>
          <div class="drill-row-desc"><strong>Trains:</strong> ${esc(d.trains)}</div>
          <div class="drill-row-desc">${esc(d.protocol)}</div>
          ${S.structuresFor(d).length ? `<div class="sg-structs">${S.structuresFor(d)
            .map(st => `<span class="sg-struct">${esc(st.name)}</span>`).join('')}</div>` : ''}
          <div class="drill-row-why">${esc(d.why)}</div>
        </div>`).join('')}

      <div class="tail-block">
        <div class="tail-head">Log a chip <span class="tail-n">${allChips.length} logged</span></div>
        <div class="qe-form">
          <label class="qe-field"><span>How far it finished from the hole (ft) — 0 if holed</span>
            <input type="number" id="sgLeave" min="0" max="200" step="1" placeholder="6" inputmode="decimal"></label>
          <label class="qe-field"><span>Lie</span>
            <select id="sgLie">
              <option value="fairway">Fairway / tight</option>
              <option value="rough">Rough</option>
              <option value="bare">Bare or downslope</option>
              <option value="bunker">Bunker</option>
            </select></label>
          <div class="probe-btns">
            <button class="probe-btn" id="sgAdd">Add chip</button>
            <button class="probe-btn ghost" id="sgSave">Save session (${_chipBuffer.length})</button>
          </div>
          <div class="tail-note" id="sgBufNote"></div>
        </div>
      </div>

      <div class="tail-block${prox ? '' : ' pending'}">
        <div class="tail-head">Your chipping</div>
        ${prox ? `<div class="tail-stats">
            <div class="disp-stat"><div class="disp-stat-val">${fmt(prox.median, 1)} ft</div>
              <div class="disp-stat-label">Typical leave</div></div>
            <div class="disp-stat"><div class="disp-stat-val">${fmt(prox.mean, 1)} ft</div>
              <div class="disp-stat-label">Average</div></div>
            <div class="disp-stat"><div class="disp-stat-val">${prox.disasters}</div>
              <div class="disp-stat-label">Blow-ups</div></div>
          </div>` : ''}
        <div class="tail-item">${esc(S.describe(prox))}</div>
        <div class="tail-note">${esc(S.TOUR.note)}</div>
      </div>`;

    el.querySelectorAll('[data-sg]').forEach(b => b.addEventListener('click', () => {
      _sgTab = b.dataset.sg; renderShortGame();
    }));
    document.getElementById('sgAdd')?.addEventListener('click', () => {
      const v = parseFloat(document.getElementById('sgLeave').value);
      if (!Number.isFinite(v) || v < 0) { toast('Enter how far it finished from the hole.'); return; }
      _chipBuffer.push({ leaveFt: v, lie: document.getElementById('sgLie').value });
      document.getElementById('sgLeave').value = '';
      const note = document.getElementById('sgBufNote');
      if (note) note.textContent = `${_chipBuffer.length} chip${_chipBuffer.length === 1 ? '' : 's'} this session. ` +
        `${ShortGame.MIN_CHIPS} is where the average starts describing you rather than the last one.`;
      document.getElementById('sgSave').textContent = `Save session (${_chipBuffer.length})`;
    });
    document.getElementById('sgSave')?.addEventListener('click', () => {
      if (!_chipBuffer.length) { toast('Add a chip first.'); return; }
      const n = _chipBuffer.length;
      ShortGame.record({ chips: _chipBuffer.slice(), lie: _chipBuffer[0].lie });
      _chipBuffer = [];
      toast(`Saved ${n} chip${n === 1 ? '' : 's'}.`);
      renderShortGame();
    });
  }

  // ── Quiet eye ─────────────────────────────────────────────────
  function renderQuietEye() {
    const el = document.getElementById('quietEyeHost');
    if (!el) return;
    const esc = t => Sanitize.escape(t);
    const t = QuietEye.trend();
    const sessions = QuietEye.all();

    const summary = t.ok
      ? `<div class="tail-stats">
           <div class="disp-stat"><div class="disp-stat-val">${fmt(t.overall.p * 100, 0)}%</div>
             <div class="disp-stat-label">Holed 6–10 ft</div></div>
           <div class="disp-stat"><div class="disp-stat-val">${t.totalN}</div>
             <div class="disp-stat-label">Putts logged</div></div>
           <div class="disp-stat"><div class="disp-stat-val">±${fmt(t.mde * 100, 0)}</div>
             <div class="disp-stat-label">Smallest change visible</div></div>
         </div>
         <div class="tail-item">${esc(t.note)}</div>`
      : `<div class="tail-note">${esc(t.note)}</div>`;

    el.innerHTML = `
      <div class="tail-block">
        <div class="tail-head">The protocol <span class="tail-n">one 20-putt session</span></div>
        ${QuietEye.PROTOCOL.map(p => `<div class="tail-item"><strong>${esc(p.title)}.</strong>
            ${esc(p.detail)}</div>`).join('')}
        <div class="tail-value">
          <div class="tail-value-num">d ≈ 0.69</div>
          <div class="tail-value-sub">${esc(QuietEye.EVIDENCE.effect)}</div>
        </div>
        ${QuietEye.EVIDENCE.caveats.map(c => `<div class="tail-note">${esc(c)}</div>`).join('')}
      </div>

      <div class="tail-block">
        <div class="tail-head">Log a putt <span class="tail-n">${sessions.length} session${sessions.length === 1 ? '' : 's'}</span></div>
        <div class="qe-form">
          <label class="qe-field"><span>Distance (ft)</span>
            <input type="number" id="qeFt" min="1" max="90" step="1" value="8"></label>
          <label class="qe-field"><span>Finished (in) — if missed</span>
            <input type="number" id="qeIn" min="0" max="240" step="1" placeholder="—"></label>
          <label class="check-row" for="qeProtocol">
            <input type="checkbox" id="qeProtocol" checked>
            <span>I ran the quiet-eye protocol on these putts</span></label>
          <div class="probe-btns">
            <button class="probe-btn" id="qeHoled">Holed it</button>
            <button class="probe-btn" id="qeMissed">Missed</button>
            <button class="probe-btn ghost" id="qeSave">Save session (${_qeBuffer.length})</button>
          </div>
          <div class="tail-note" id="qeBufferNote"></div>
        </div>
      </div>

      <div class="tail-block${t.ok ? '' : ' pending'}">
        <div class="tail-head">What your own putts can show</div>
        ${summary}
      </div>`;

    const ft = () => parseFloat(document.getElementById('qeFt').value);
    const inches = () => { const v = parseFloat(document.getElementById('qeIn').value); return Number.isFinite(v) ? v : undefined; };
    const push = holed => {
      const d = ft();
      if (!Number.isFinite(d) || d <= 0) { toast('Enter a distance first.'); return; }
      _qeBuffer.push({ ft: d, holed, inches: holed ? undefined : inches() });
      const note = document.getElementById('qeBufferNote');
      const holedN = _qeBuffer.filter(p => p.holed).length;
      if (note) note.textContent = `${_qeBuffer.length} putt${_qeBuffer.length === 1 ? '' : 's'} this session, ` +
        `${holedN} holed. Twenty is the number the study used.`;
      document.getElementById('qeSave').textContent = `Save session (${_qeBuffer.length})`;
      document.getElementById('qeIn').value = '';
    };
    document.getElementById('qeHoled')?.addEventListener('click', () => push(true));
    document.getElementById('qeMissed')?.addEventListener('click', () => push(false));
    document.getElementById('qeSave')?.addEventListener('click', () => {
      if (!_qeBuffer.length) { toast('Log a putt first.'); return; }
      const n = _qeBuffer.length;
      QuietEye.record({ putts: _qeBuffer.slice(), protocol: document.getElementById('qeProtocol').checked });
      _qeBuffer = [];
      toast(`Saved ${n} putt${n === 1 ? '' : 's'}.`);
      renderQuietEye();
    });
  }

  return { renderSessionList, renderHome, renderDetail, renderProgress, renderYardages, renderPractice,
           renderQuietEye, renderDrills, renderShortGame };
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

  // A Rapsodo session is a hundred rows or so, which parses far too fast to
  // need a worker — the note in the docs about moving this off the main thread
  // was solving a problem this file does not have. What it did need was for a
  // failure to say something useful. Every error here used to be a native
  // alert() reading "Could not parse CSV: ..." with the raw exception, and the
  // most common failure of all — the wrong CSV — did not error at all.
  const MAX_BYTES = 5 * 1024 * 1024;

  function importError(msg) {
    const el = document.getElementById('importError');
    if (el) { el.textContent = msg; el.hidden = false; }
    toast('Import failed — see the message on the import screen.');
  }
  function clearImportError() {
    const el = document.getElementById('importError');
    if (el) { el.textContent = ''; el.hidden = true; }
  }

  function handleFile(file) {
    clearImportError();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      importError(`"${file.name}" is not a CSV. Export from Rapsodo Cloud → Session → Share → CSV.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      importError(`That file is ${(file.size / 1048576).toFixed(1)} MB. A Rapsodo session export is a few ` +
        `kilobytes, so this is almost certainly a different file.`);
      return;
    }
    if (file.size === 0) { importError(`"${file.name}" is empty.`); return; }

    const reader = new FileReader();
    reader.onerror = () => importError('The browser could not read that file. Try exporting it again.');
    reader.onload = e => {
      try {
        _shots = CSVParser.parse(e.target.result);
        clearImportError();
        showPreview(_shots, file.name);
      } catch(err) {
        // The message is written to be read by a golfer, not a developer.
        importError(err.message || 'That file could not be read as a Rapsodo CSV.');
      }
    };
    reader.readAsText(file);
  }

  function showPreview(shots, filename) {
    document.getElementById('previewCount').textContent =
      `${shots.length} shots · ${[...new Set(shots.map(s=>s.clubType))].length} clubs · `+
      `${shots.some(s=>s.spinRate)?'Spin data present (only a reading with an RPT ball)':'No spin data'}`;

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
    const ball    = document.getElementById('metaBall')?.value || 'unknown';
    const surface = document.getElementById('metaSurface')?.value || 'unknown';
    const alignment = document.getElementById('metaAligned')?.checked ? 'confirmed' : 'unknown';
    const session = {
      id: crypto.randomUUID(), date: date||new Date().toISOString().slice(0,10),
      notes, conditions:{wind,temp,ball,surface,alignment}, shots:_shots, createdAt:Date.now(),
    };
    // Stamp measurement context before anything renders. The import path
    // bypasses Store.getSessions(), so without this a just-imported session
    // has unstamped shots and every ball-type gate silently reads "unknown".
    Store.stamp(session);
    // Save to BOTH local stores and show instantly — no spinner. This used to
    // call MemDB.saveSession directly, which meant a session imported after
    // device storage was switched on never reached the device at all.
    Store.saveLocal(session);
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

  // Blocking agreement gate — must accept Terms & Privacy before using the app.
  // Accepting also satisfies cookie consent, so the banner won't double-prompt.
  try {
    const checkbox = document.getElementById('agreementCheckbox');
    const acceptBtn = document.getElementById('agreementAcceptBtn');

    checkbox?.addEventListener('change', () => {
      if (acceptBtn) acceptBtn.disabled = !checkbox.checked;
    });

    acceptBtn?.addEventListener('click', () => {
      Agreement.accept();
      CookieConsent.setConsent();
    });

    // Review the full docs from inside the gate (open above it).
    document.getElementById('gateTermsLink')?.addEventListener('click', () =>
      document.getElementById('termsBtn')?.click());
    document.getElementById('gatePrivacyLink')?.addEventListener('click', () =>
      document.getElementById('privacyBtn')?.click());

    Agreement.showGate();
  } catch (e) { console.error('agreement gate init failed:', e); }

  // Initialize cookie consent banner (only if the gate was already accepted)
  try {
    if (Agreement.hasAccepted()) CookieConsent.showBanner();
    document.getElementById('cookieAcceptBtn')?.addEventListener('click', () => CookieConsent.setConsent());
    document.getElementById('cookieLearnBtn')?.addEventListener('click', () => {
      document.getElementById('privacyBtn')?.click();
    });
  } catch (e) { console.error('cookie consent init failed:', e); }

  // Privacy & Legal links in Settings
  try {
    const loadDocument = async (url, elementId) => {
      try {
        const response = await fetch(url);
        const text = await response.text();
        const el = document.getElementById(elementId);
        // Render markdown line-by-line. Strip simple emphasis markers and
        // always escape the text first (defense against any HTML in the docs).
        const inline = (s) => Sanitize.escape(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        el.innerHTML = text
          .split('\n')
          .map(line => {
            if (line.startsWith('### ')) return `<h3>${inline(line.slice(4))}</h3>`;
            if (line.startsWith('## ')) return `<h2>${inline(line.slice(3))}</h2>`;
            if (line.startsWith('# ')) return `<h1>${inline(line.slice(2))}</h1>`;
            if (line.startsWith('> ')) return `<blockquote>${inline(line.slice(2))}</blockquote>`;
            if (line.startsWith('- ')) return `<li>${inline(line.slice(2))}</li>`;
            if (line.trim() === '') return '';
            return `<p>${inline(line)}</p>`;
          })
          .join('\n');
      } catch (e) {
        console.error(`Failed to load ${url}:`, e);
        toast(`Could not load document`);
      }
    };

    document.getElementById('privacyBtn')?.addEventListener('click', async () => {
      await loadDocument('PRIVACY.md', 'privacyBody');
      document.getElementById('privacyModal').hidden = false;
    });
    document.getElementById('termsBtn')?.addEventListener('click', async () => {
      await loadDocument('TERMS.md', 'termsBody');
      document.getElementById('termsModal').hidden = false;
    });
    document.getElementById('cookiePrefsBtn')?.addEventListener('click', () => {
      CookieConsent.showBanner();
      toast('Cookie preferences shown');
    });

    // Privacy & Terms modal close handlers
    const privacyModal = document.getElementById('privacyModal');
    const termsModal = document.getElementById('termsModal');

    privacyModal?.addEventListener('click', e => { if (e.target === privacyModal) privacyModal.hidden = true; });
    termsModal?.addEventListener('click', e => { if (e.target === termsModal) termsModal.hidden = true; });

    document.getElementById('privacyModalClose')?.addEventListener('click', () => privacyModal.hidden = true);
    document.getElementById('termsModalClose')?.addEventListener('click', () => termsModal.hidden = true);
  } catch (e) { console.error('legal buttons init failed:', e); }

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
      // Practice used to fall through to Router.show(), which only toggles
      // visibility — so the tab showed whatever had last been painted into it,
      // which was nothing. Router.showPractice existed, was exported, and was
      // called from nowhere.
      if (v==='practice') { await Router.showPractice(); return; }
      Router.show(v);
    } catch (err) {
      // Never let a view-render error leave the tab feeling "dead"
      console.error('Navigation error:', err);
      toast('Could not open ' + v + ': ' + (err?.message || 'unknown error'));
      Router.show(v);
    }
  });

  // ── Delegated action handler (CSP-safe replacement for inline onclick) ──
  // Every dynamically-rendered button/card uses a data-* attribute instead of
  // an inline onclick handler. This lets us keep a strict CSP (no
  // script-src 'unsafe-inline') while still wiring up elements created later.
  document.addEventListener('click', async e => {
    const t = e.target.closest(
      '[data-route],[data-start-plan],[data-close],[data-close-modal],[data-export-close],[data-del-goal]'
    );
    if (!t) return;

    // Close a modal by element id
    if (t.hasAttribute('data-close')) {
      document.getElementById(t.getAttribute('data-close'))?.remove();
      return;
    }
    // Close the nearest modal overlay
    if (t.hasAttribute('data-close-modal')) {
      t.closest('.modal-overlay')?.remove();
      return;
    }
    // Export data, then close the surrounding modal. The GDPR panel's own
    // export button routes here rather than duplicating the download logic.
    if (t.hasAttribute('data-export-close')) {
      document.getElementById('exportCsvBtn')?.click();
      t.closest('.modal-overlay')?.remove();
      return;
    }
    // Delete a goal then refresh
    if (t.hasAttribute('data-del-goal')) {
      try { Goals.deleteGoal(t.getAttribute('data-del-goal')); } catch (_) {}
      location.reload();
      return;
    }
    // Practice-plan "Start" stub
    if (t.hasAttribute('data-start-plan')) {
      toast(t.getAttribute('data-start-plan') + ' session started!');
      return;
    }
    // Route to a view (same logic as the data-view nav delegator)
    if (t.hasAttribute('data-route')) {
      const v = t.getAttribute('data-route');
      try {
        if (v==='import')   { Router.showImport(); return; }
        if (v==='progress') { await Router.showProgress(); return; }
        if (v==='yardages') { await Router.showYardages(); return; }
        if (v==='sessions' || v==='drill') { await Router.showSessions(); return; }
        if (v==='practice') { await Router.showPractice(); return; }
        Router.show(v);
      } catch (err) {
        console.error('Route action error:', err);
        Router.show(v);
      }
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
  // Two buttons rather than one. This was a single row that asked the format
  // with confirm('JSON (OK) or CSV (Cancel)?') — a native dialog using OK and
  // Cancel to mean two different formats, which nobody can read correctly the
  // first time and which some browsers suppress entirely. It also carried its
  // own inline CSV writer, a second one with a different column order from
  // SessionSharing's, and neither escaped anything.
  const exportAs = fmt => async () => {
    try {
      const data = await Store.getSessions();
      if (!data.length) { toast('Nothing to export yet.'); return; }
      if (fmt === 'csv') SessionSharing.exportAsCSV(data);
      else SessionSharing.exportAsJSON(data);
    } catch (err) { toast('Export failed: ' + (err.message || 'could not reach the cloud')); }
  };
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportAs('csv'));
  document.getElementById('exportJsonBtn')?.addEventListener('click', exportAs('json'));

  // Delete account (authenticated users only)
  document.getElementById('deleteAccountBtn')?.addEventListener('click', ()=>{
    const user = Auth.getUser();
    if (!user) { toast('Sign in first'); return; }
    showConfirm(
      '⚠️ Delete account & all data?',
      `Your account (${user.email}) and ALL sessions will be permanently deleted. This cannot be undone.`,
      async ()=>{
        try {
          // 1. Delete all session data (anon key + RLS lets a user delete THEIR rows).
          const sessions = await Store.getSessions();
          for (const s of sessions) await Store.deleteSession(s.id);

          // 2. Remove the auth account (email/login) itself. The browser cannot do
          //    this with the publishable key — it requires the service_role, so we
          //    call the `delete-account` Edge Function (see SECURITY-HEADERS.md).
          let acctRemoved = false;
          try {
            const { error } = await sb.functions.invoke('delete-account');
            if (!error) acctRemoved = true;
          } catch (_) { /* function not deployed → fall back to email request */ }

          if (!acctRemoved) {
            // Data is gone, but the login record needs a manual/admin removal.
            window.alert(
              'All your session data has been permanently deleted.\n\n' +
              'To also remove your account login/email, email ' + SUPPORT_EMAIL +
              ' with the subject "Data Deletion Request". We remove it within 48 hours.'
            );
          }
          // 3. Sign out & purge tokens regardless (hard reload to a clean origin).
          await Auth.logout();
        } catch(err) { toast('Delete failed: ' + (err.message || 'unknown error')); }
      }
    );
  });

  // Data controls / GDPR/CCPA rights
  document.getElementById('dataControlsBtn')?.addEventListener('click', ()=>{
    const user = Auth.getUser();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-wide">
        <div class="modal-head">
          <h2 class="modal-title">📋 Your Data & Rights</h2>
          <button class="btn-icon" data-close-modal>✕</button>
        </div>
        <div style="padding:1.2rem;color:var(--text)">
          <h3 style="margin-top:0">Your Rights (GDPR / CCPA)</h3>
          <div style="background:rgba(16,185,129,.1);border-left:3px solid #10b981;padding:1rem;margin:1rem 0;border-radius:var(--radius-sm)">
            <strong>✅ Right to Access</strong><br>
            Click "Export all data" below to download your sessions as JSON or CSV.
          </div>
          <div style="background:rgba(16,185,129,.1);border-left:3px solid #10b981;padding:1rem;margin:1rem 0;border-radius:var(--radius-sm)">
            <strong>✅ Right to Delete</strong><br>
            ${user ? `
              Click "Delete my account & data" in Account section above to permanently delete your account and all sessions.
            ` : `
              Sign in first, then go to Account section to delete your account.
            `}
          </div>
          <div style="background:rgba(16,185,129,.1);border-left:3px solid #10b981;padding:1rem;margin:1rem 0;border-radius:var(--radius-sm)">
            <strong>✅ Right to Portability</strong><br>
            Your data is yours. Export it anytime using "Export all data" button in Data & Export section.
          </div>
          <div style="background:rgba(16,185,129,.1);border-left:3px solid #10b981;padding:1rem;margin:1rem 0;border-radius:var(--radius-sm)">
            <strong>✅ Right to Object</strong><br>
            ${user ? `You can request to opt-out. Email us with your account (${user.email}).` : `Email us to opt-out of data processing.`}
          </div>

          <h3 style="margin-top:2rem">What Data Do We Have?</h3>
          <ul style="margin:1rem 0;padding-left:1.5rem">
            <li>📧 Email: <strong>${user?.email || 'Not logged in'}</strong></li>
            <li>🏌️ Golf sessions: Your Rapsodo data (clubs, metrics, notes)</li>
            <li>⚙️ Preferences: Theme, goals, ratings (local only)</li>
            <li>📅 Timestamp: When you created your account & sessions</li>
          </ul>

          <h3 style="margin-top:2rem">How to Delete Everything</h3>
          <ol style="margin:1rem 0;padding-left:1.5rem">
            <li><strong>Option 1: Self-Service (Instant)</strong>
              <ul style="margin:0.5rem 0;padding-left:1.5rem">
                <li>Go to Settings → Account → "Delete my account & data"</li>
                <li>Confirm in the popup</li>
                <li>Done — all data deleted from our servers</li>
              </ul>
            </li>
            <li><strong>Option 2: Request (24-48 hours)</strong>
              <ul style="margin:0.5rem 0;padding-left:1.5rem">
                <li>Email us with subject: "Data Deletion Request"</li>
                <li>Include your email address</li>
                <li>We'll delete everything within 48 hours</li>
              </ul>
            </li>
          </ol>

          <h3 style="margin-top:2rem">What Gets Deleted?</h3>
          <ul style="margin:1rem 0;padding-left:1.5rem;color:var(--text-dim)">
            <li>✅ All sessions & golf data</li>
            <li>✅ Your account & email</li>
            <li>✅ Goals & preferences</li>
            <li>✅ Any stored backups (within 30 days)</li>
          </ul>

          <div style="background:rgba(220,38,38,.1);border-left:3px solid #dc2626;padding:1rem;margin-top:2rem;border-radius:var(--radius-sm)">
            <strong style="color:#dc2626">⚠️ This is permanent!</strong> Deleted data cannot be recovered. Make sure to export your data first if you want to keep it.
          </div>

          <button class="btn-primary" data-export-close style="width:100%;margin-top:1.5rem">
            📥 Export My Data First (Recommended)
          </button>
          <button class="btn-danger" data-close-modal style="width:100%;margin-top:.6rem">
            Close
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  });

  document.getElementById('clearDataBtn').addEventListener('click', ()=>{
    showConfirm(
      '🗑️ Clear all local data?',
      'This removes all sessions from your device. Your account stays active. If signed in, data will re-sync from the cloud on next visit.',
      async ()=>{
        try {
          const sessions = await Store.getSessions();
          for (const s of sessions) await Store.deleteSession(s.id);
          document.querySelectorAll('#analyticsModal, #benchmarkModal, #learningModal, #clubModal, #efficiencyModal, #shortcutsModal').forEach(el => el.remove());
          await Router.showSessions();
          toast(`Cleared ${sessions.length} session${sessions.length===1?'':'s'}.`);
        } catch(err) { toast('Clear failed: ' + (err.message || 'could not reach the cloud')); }
      }
    );
  });

  document.getElementById('showAnalyticsBtn')?.addEventListener('click', async () => {
    document.getElementById('analyticsModal')?.remove();
    const sessions = await Store.getSessions();
    if (!sessions.length) { toast('No sessions to analyze'); return; }
    const metrics = AnalyticsHub.generateMetricsDashboard(sessions);
    if (!metrics) { toast('Unable to generate metrics'); return; }

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="analyticsModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:500px;width:100%;max-height:80vh;overflow-y:auto;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center">
            📊 Advanced Analytics
            <button data-close="analyticsModal" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
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
    document.getElementById('benchmarkModal')?.remove();
    const sessions = await Store.getSessions();
    if (!sessions.length) { toast('No sessions to compare'); return; }
    const comparison = CommunityInsights.compareToommunity(sessions);
    if (!comparison) { toast('Unable to generate comparison'); return; }

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="benchmarkModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:500px;width:100%;max-height:80vh;overflow-y:auto;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:.5rem;display:flex;justify-content:space-between;align-items:center">
            🏆 Community Comparison
            <button data-close="benchmarkModal" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
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
    document.getElementById('learningModal')?.remove();
    const sessions = await Store.getSessions();
    const path = LearningPath.generatePath(sessions);
    const tips = ContentLibrary.getContentFor('Consistency');

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="learningModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:550px;width:100%;max-height:90vh;overflow-y:auto;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:.5rem;display:flex;justify-content:space-between;align-items:center">
            📚 Learning Library
            <button data-close="learningModal" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
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
    document.getElementById('clubModal')?.remove();
    const sessions = await Store.getSessions();
    if (!sessions.length) { toast('No data to analyze'); return; }
    const clubs = ClubAnalyzer.compareClubs(sessions);
    if (!clubs.length) { toast('No club data'); return; }

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="clubModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:550px;width:100%;max-height:90vh;overflow-y:auto;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center">
            🏌️ Club Performance Analysis
            <button data-close="clubModal" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
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
    document.getElementById('efficiencyModal')?.remove();
    const sessions = await Store.getSessions();
    if (!sessions.length) { toast('No sessions yet'); return; }
    const efficiency = PracticeEfficiency.calculateEfficiency(sessions);
    if (!efficiency) { toast('Unable to calculate'); return; }

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="efficiencyModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:450px;width:100%;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center">
            ⚡ Practice Efficiency
            <button data-close="efficiencyModal" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
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

  // Click-outside-to-close for all dynamically inserted modals
  document.addEventListener('click', e => {
    if (e.target.matches('#analyticsModal, #benchmarkModal, #learningModal, #clubModal, #efficiencyModal, #shortcutsModal')) {
      e.target.remove();
    }
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
      const local = MemDB.getSessions();   // hydrated from the device store at boot
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
    document.getElementById('shortcutsModal')?.remove();
    const shortcuts = [
      { key: 'Ctrl+I', action: 'Import CSV' },
      { key: 'Ctrl+H', action: 'Home / Sessions' },
      { key: 'Ctrl+P', action: 'Progress' },
      { key: 'Ctrl+Y', action: 'Yardages' },
      { key: 'Ctrl+S', action: 'Yardages' },
      { key: 'Ctrl+?', action: 'Show this help' },
    ];

    const html = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" id="shortcutsModal">
        <div style="background:var(--surface);border-radius:var(--radius-md);max-width:400px;width:100%;padding:1.5rem">
          <div style="font-size:1.3rem;font-weight:800;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center">
            ⌨️ Keyboard Shortcuts
            <button data-close="shortcutsModal" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>
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
  console.log('%cShotLab Keyboard Shortcuts', 'font-weight:bold;font-size:14px;color:#0070f3');
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

  // Device storage — off by default, and the note under it always says what
  // the current state actually means rather than what the switch is called.
  const keepBtn = document.getElementById('keepLocalBtn');
  const keepTog = document.getElementById('keepLocalToggle');
  const keepNote = document.getElementById('keepLocalNote');
  function paintKeepLocal() {
    if (!keepTog) return;
    const on = LocalDB.enabled();
    keepTog.textContent = on ? '✓' : '';
    keepTog.style.color = on ? 'var(--pine)' : 'var(--text-dim)';
    if (keepNote) keepNote.textContent = LocalDB.describe();
    const guestNote = document.getElementById('authGuestNote');
    if (guestNote) guestNote.textContent = LocalDB.describe();
    if (keepBtn) keepBtn.disabled = !!LocalDB.unavailable();
  }
  keepBtn?.addEventListener('click', async () => {
    const turningOn = !LocalDB.enabled();
    if (!turningOn) {
      const n = MemDB.getSessions().length;
      if (!confirm(`Turn off device storage?\n\nThe ${n} session${n === 1 ? '' : 's'} saved on this ` +
                   `device will be erased now, not just from here on. Anything synced to the cloud is untouched.`)) return;
    }
    keepBtn.disabled = true;
    const r = await LocalDB.setEnabled(turningOn);
    keepBtn.disabled = false;
    paintKeepLocal();
    if (r.on) toast(r.saved ? `Kept on this device (${r.saved} session${r.saved === 1 ? '' : 's'})` : 'Kept on this device');
    else if (r.reason) toast('Could not turn that on: ' + r.reason);
    else toast(r.erased ? `Erased ${r.erased} session${r.erased === 1 ? '' : 's'} from this device` : 'Device storage off');
  });
  paintKeepLocal();

  // Launch-monitor setup guide
  document.getElementById('setupGuideBtn')?.addEventListener('click', () => SetupGuide.show());
  document.getElementById('setupGuideLink')?.addEventListener('click', () => SetupGuide.show());
  document.getElementById('setupGuideLink2')?.addEventListener('click', () => SetupGuide.show());
  document.getElementById('measRefBtn')?.addEventListener('click', () => MeasurementReference.show());

  // Feedback-schedule picker — the app's most consequential setting.
  const renderFeedbackModes = () => {
    const host = document.getElementById('feedbackModes');
    if (!host) return;
    const cur = FeedbackEngine.getMode();
    host.innerHTML = Object.values(FeedbackEngine.MODES).map(m => `
      <button class="fb-option${m.id === cur ? ' on' : ''}" data-fb="${Sanitize.escape(m.id)}">
        <span class="fb-option-label">${Sanitize.escape(m.label)}${m.id === cur ? '<span class="fb-check">✓</span>' : ''}</span>
        <span class="fb-option-blurb">${Sanitize.escape(m.blurb)}</span>
      </button>`).join('');
  };
  document.getElementById('feedbackModes')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-fb]');
    if (!btn) return;
    FeedbackEngine.setMode(btn.getAttribute('data-fb'));
    renderFeedbackModes();
    toast('Feedback schedule updated');
  });
  renderFeedbackModes();

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
        <button data-del-goal="${Sanitize.escape(metric)}" style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:1rem">✕</button>
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

  // Restore anything kept on this device BEFORE the first render, so a
  // returning guest sees their sessions rather than an empty dashboard that
  // fills in a moment later.
  try {
    const { restored } = await LocalDB.hydrate();
    if (restored) showDebug(`LOCAL RESTORE: ${restored} session(s) from this device`);
  } catch (e) { console.error('local restore', e); }

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
  console.log('%cWelcome to ShotLab v3.0 🏌️', 'font-size:16px;font-weight:bold;color:#0070f3');
  console.log('%cPress Ctrl+? for keyboard shortcuts', 'font-size:12px;color:#888888');
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
    el.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#fafafa;display:flex;' +
      'align-items:center;justify-content:center;padding:2rem;font-family:system-ui,sans-serif';
    el.innerHTML =
      '<div style="max-width:340px;text-align:center">' +
      '<div style="font-size:2.5rem;margin-bottom:.5rem">⛳</div>' +
      '<h2 style="font-size:1.2rem;color:#171717;margin-bottom:.5rem">Something hiccuped</h2>' +
      '<p style="color:#4d4d4d;font-size:.9rem;margin-bottom:1.25rem;line-height:1.5">' +
      'The app hit an unexpected snag while loading. Your saved data is safe.</p>' +
      '<button id="slReload" style="background:#171717;color:#fff;border:none;border-radius:6px;' +
      'padding:.7rem 1.4rem;font-weight:600;cursor:pointer;width:100%;margin-bottom:.6rem">Reload app</button>' +
      '<button id="slReset" style="background:none;color:#4d4d4d;border:1px solid #ebebeb;' +
      'border-radius:6px;padding:.6rem 1.4rem;font-weight:500;cursor:pointer;width:100%">Reset &amp; reload</button>' +
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
  // ── Cues are written to an EXTERNAL focus, deliberately ────────
  // The best-supported finding in the motor-learning literature for golf is
  // that WHERE attention points changes performance. Internal cues — ones
  // about your own body parts ("keep your wrists straight", "keep your head
  // still") — interfere with automatic movement control and measurably
  // degrade accuracy. External cues — about the club, the ball, the turf, a
  // physical object, the target — improve consistency and reduce movement
  // variability. There is also a distance effect: a cue about ball flight
  // and landing point beats one about the clubhead.
  //
  // Every cue below therefore names something OUTSIDE the body. Where a fault
  // genuinely is about a body part, the cue is re-expressed as an object to
  // act on: not "shift your weight" but "press the lead heel into the ground".
  // (Recent reviews find the external-focus advantage less universal than
  // early summaries claimed, but it is consistent in direction and costs
  // nothing to apply.)
  const TIPS = {
    'Slice': [
      '⛳ Start line: pick a target 20 yards out and try to start the ball just right of it — let the curve bring it back',
      '🕳️ Headcover gate: put a headcover a foot outside the ball and swing so the club misses it coming down',
      '🎯 Toe-over-heel: feel the toe of the club pass the heel through the ball, like closing a door',
      '🪵 Trail elbow: let the club drop toward your trail hip pocket before it moves toward the ball',
    ],
    'Hook': [
      '⛳ Start line: aim to start the ball left of target and hold the face there through the finish',
      '🖐️ Grip check: at address, count 2 knuckles on the lead hand — not 3',
      '🏌️ Finish tall: swing to a full high finish with the club pointing at the sky behind you',
      '🎯 Chest to target: turn the shirt logo to face the target at the finish rather than letting the hands roll',
    ],
    'Thin': [
      '🪙 Coin drill: put a coin 3 inches in front of the ball and try to take turf where the coin is',
      '🧺 Towel behind: lay a towel 4 inches behind the ball and miss it on the way down',
      '⛳ Low point: try to bruise the grass in FRONT of the ball, not under it',
      '🎈 Trail shoulder: let the trail shoulder work down and under, so the club reaches the turf past the ball',
    ],
    'Fat': [
      '🦶 Lead heel: press the lead heel into the ground as the club starts down',
      '🧺 Towel behind: same towel 4 inches behind the ball — hitting it is the fault, missing it is the fix',
      '⛳ Turf mark: hit 10 shots and look only at where the turf is scuffed; aim to move that mark forward each time',
      '🚶 Step-through: after impact, walk through toward the target so the finish is on the lead side',
    ],
    'Adding Loft Through Impact': [
      '🚧 Under the bar: keep the ball under an imagined bar 10 feet high, 20 yards ahead',
      '✋ Low finish: finish with the hands no higher than the trail shoulder',
      '🧺 Towel behind: miss a towel 4 inches behind the ball and take turf in front of it',
      '⛳ Flight window: pick a lower window than feels natural and try to fly the ball through it',
    ],
    'Delofting Too Much (Irons)': [
      '🎈 High window: pick a target window twice as high as normal and fly the ball through it',
      '⛳ Ladder: hit 3 low, 3 stock, 3 high with the same club, repeating',
      '🏌️ Club passes hands: feel the clubhead overtake the hands after the ball, into a full finish',
      '📍 Ball forward: move the ball one ball-width forward and note the flight change',
    ],
  };

  const GENERIC = [
    '⛳ Pick a specific target for every ball — a flag, a post, a distinct patch of grass',
    '🎬 Film one swing per session from down the line, phone on the ground behind the ball',
    '⏱️ Leave 20+ seconds between shots — faster than that is exercise, not practice',
    '1️⃣ One cue per session. A second cue halves the value of the first',
  ];

  function getTips(faultName) { return TIPS[faultName] || GENERIC; }

  // ── Practice-session dosage ────────────────────────────────────
  // The most consistent guidance across the literature, and the part the app
  // previously left out entirely by prescribing minutes alone:
  //   · three focused ~50-ball sessions beat one 150-ball session
  //   · faster than one shot per 20 seconds is exercise, not practice
  //   · calibrate difficulty so the golfer succeeds ~70% of the time
  //   · warm up wedges first, 4-5 balls per club, before anything full power
  //   · deliberate practice accounted for ~30% of improvement in one golf
  //     study — a third of the process, not all of it
  const PROTOCOL = {
    ballsPerSession: 50,
    sessionsPerWeek: 3,
    minSecondsBetweenShots: 20,
    targetSuccessRate: 0.70,
    warmup: 'Wedges first: 4–5 balls per club, half speed, working up. No full-power swings until the body is warm.',
    note: 'Three focused 50-ball sessions beat one 150-ball marathon. Volume past attention is just exercise.',
  };

  function generateSession(fault, minutes = 30) {
    const balls = Math.min(PROTOCOL.ballsPerSession, Math.round(minutes * 1.5));
    return {
      warmup: PROTOCOL.warmup,
      focus: fault ? `One cue only: ${fault}` : 'One cue only: centred contact',
      drills: getTips(fault),
      balls,
      spacing: `Leave ${PROTOCOL.minSecondsBetweenShots}s between shots`,
      successTarget: `Aim to succeed on about ${Math.round(PROTOCOL.targetSuccessRate * 100)}% of attempts — ` +
        `if you are hitting it every time the task is too easy to teach you anything, and if you are missing ` +
        `nearly every time it is too hard to build anything.`,
      cooldown: 'Last 10 balls: one ball per club, full pre-shot routine, different target every time.',
      duration: minutes,
    };
  }

  return { getTips, generateSession, PROTOCOL };
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

  // RFC 4180 quoting. Session notes are free text, and neither of the two CSV
  // writers this app had escaped them: a note containing a comma silently
  // shifted every later column by one, and a note containing a double quote
  // broke the row outright. An export is the one artefact a golfer takes
  // somewhere else, so a corrupted one is worse than no export.
  const csvCell = v => {
    if (v === null || v === undefined || v === '') return '';
    const t = String(v);
    return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const csvRow = cells => cells.map(csvCell).join(',');

  function toCSV(sessions) {
    const head = ['Date','Club','Ball speed (mph)','Club speed (mph)','Smash','Launch (deg)',
                  'Attack angle (deg)','Club path (deg)','Carry (yds)','Total (yds)',
                  'Side carry (yds)','Spin (rpm)','Ball','Surface','Notes'];
    const lines = [csvRow(head)];
    (sessions || []).forEach(s => {
      const ball = Conditions.ball(s), surface = Conditions.surface(s);
      // Spin is not a reading without an RPT ball. Exporting the figure anyway
      // would put a number the device never measured into a file the golfer
      // takes away, where none of this app's caveats travel with it.
      const spinReal = Spin.measured(s);
      (s.shots || []).forEach(sh => lines.push(csvRow([
        s.date, clubLabel(sh.clubType), sh.ballSpeed, sh.clubSpeed, sh.smashFactor, sh.launchAngle,
        sh.attackAngle, sh.clubPath, sh.carryDistance, sh.totalDistance, sh.sideCarry,
        spinReal ? sh.spinRate : '', ball.label, surface.label, s.notes,
      ])));
    });
    return lines.join('\n') + '\n';
  }

  function download(text, mime, ext, n) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = Object.assign(document.createElement('a'), {
      href: url, download: `shotlab-${new Date().toISOString().slice(0,10)}.${ext}`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Exported ${n} session${n === 1 ? '' : 's'} as ${ext.toUpperCase()}`);
  }

  function exportAsCSV(sessions) {
    download(toCSV(sessions), 'text/csv', 'csv', (sessions || []).length);
  }

  function createShareLink(session) {
    const snap = SessionSnapshot.create(session);
    const encoded = btoa(JSON.stringify(snap));
    return `${window.location.origin}?shared=${encoded}`;
  }

  return { shareText, copyToClipboard, exportAsJSON, exportAsCSV, createShareLink, toCSV, csvCell };
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
    const shots = recentSessions.flatMap(s => s.shots || []);
    // This used to be `100 - stdDev(carry)`, which is not a score: a standard
    // deviation in yards has no upper bound, so a scattered session produced a
    // negative number and a tight one produced ~99 regardless of the golfer.
    // `consistencyScore()` is the corrected version already used elsewhere —
    // a coefficient of variation, which is unit-free and bounded 0-100. It was
    // fixed in one place and this second copy was missed.
    //
    // Carry is pooled across clubs here, so this describes how varied the
    // SESSION was, not how repeatable the swing is: a bag-wide session is
    // meant to be spread out. Hence "varied", not "inconsistent".
    const consistency = consistencyScore(shots.map(s => s.carryDistance));
    if (consistency === null) return 'Not enough carry data yet to say anything about your spread.';
    if (consistency > 85) return '🌟 Very tight distance grouping across these sessions.';
    if (consistency > 70) return '✅ Reasonably tight grouping. Worth checking club by club.';
    if (consistency > 50) return '📊 A varied set of sessions — expected if you worked through the bag.';
    return '🔧 Widely varied distances. Look club by club before reading anything into it.';
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
      consistency: consistencyScore(carries),
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
// AccessibilityEnhancements — WCAG 2.1 AA compliance
// ════════════════════════════════════════════════════════════════
// This module used to do four things and none of them reached a user.
//
//   * It copied every button's own text into an aria-label. A button's text
//     ALREADY is its accessible name, so at best that changed nothing — and at
//     worst it overrode a better name, because an aria-label wins over content.
//     The buttons that genuinely need one are the icon-only buttons with no
//     text, and the loop skipped exactly those: there was nothing to copy.
//   * It set --contrast and --animation-duration on the root element. Neither
//     token is read by any rule in style.css. Nothing happened.
//   * It toggled a `keyboard-focus` class on the body. No selector uses it.
//
// What was actually missing is the part that decides whether a modal is usable
// without a mouse: the dialog role, a focus that moves into the dialog and
// comes back afterwards, Tab that stays inside it, and Escape.
//
// Modals in this app are opened and closed by setting `.hidden` directly from
// about twenty places, plus six more built at runtime. Rewriting every one of
// those is exactly the repeated-structure edit that has broken this file
// before, so this watches the attribute instead — one hook that covers every
// call site, including the ones that do not exist yet.
const AccessibilityEnhancements = (() => {
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
                    'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const _open = [];               // innermost dialog last
  let _seq = 0;

  const visible = el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  const focusables = el => [...el.querySelectorAll(FOCUSABLE)].filter(visible);

  function opened(el) {
    if (_open.some(s => s.el === el)) return;
    if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    // Name the dialog from its own heading, so a screen reader announces what
    // opened rather than just "dialog".
    if (!el.getAttribute('aria-labelledby') && !el.getAttribute('aria-label')) {
      const title = el.querySelector('.modal-title, h2, h3, .step-heading');
      if (title) {
        if (!title.id) title.id = 'a11y-dlg-' + (++_seq);
        el.setAttribute('aria-labelledby', title.id);
      }
    }
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    _open.push({ el, restore: document.activeElement });
    document.body.classList.add('modal-open');
    focusTop();
  }

  function closed(el) {
    const i = _open.findIndex(s => s.el === el);
    if (i < 0) return;
    const { restore } = _open[i];
    _open.splice(i, 1);
    el.removeAttribute('aria-modal');
    if (!_open.length) document.body.classList.remove('modal-open');
    // Closing the top one hands focus to whatever is still open underneath;
    // only when nothing is left does it go back where it came from. Without
    // that it lands on <body> and the next Tab starts again from the top of
    // the page, which is how a keyboard user loses their place.
    if (_open.length) { focusTop(); return; }
    try { if (restore && document.contains(restore)) restore.focus({ preventScroll: true }); } catch (_) {}
  }

  // Which dialog is actually on top. Open order is not the answer: the consent
  // gate and the sign-in modal are both open at first load, the gate sits above
  // at z-index 400 against 200, and the gate is the one the golfer has to deal
  // with — but it is earlier in the document, so it opened first and an
  // open-order stack handed focus to the modal underneath it. Stacking is a
  // painting question, so ask the paint: highest z-index wins, and among equals
  // the most recently opened.
  const zOf = el => {
    const z = parseInt(getComputedStyle(el).zIndex, 10);
    return Number.isFinite(z) ? z : 0;
  };
  const top = () => {
    if (!_open.length) return null;
    let best = _open[0];
    for (const s of _open) if (zOf(s.el) >= zOf(best.el)) best = s;
    return best.el;
  };

  // Focus belongs to whatever is on top right now, which may not be the dialog
  // that just opened.
  function focusTop() {
    const el = top();
    if (!el || el.contains(document.activeElement)) return;
    const f = focusables(el);
    try { (f[0] || el).focus({ preventScroll: true }); } catch (_) {}
  }

  function onKey(e) {
    const el = top();
    if (!el) return;
    if (e.key === 'Escape') {
      // The consent gate and the sign-in gate are deliberately not dismissible;
      // letting Escape past them would drop someone into the app behind a
      // decision they never made.
      if (el.hasAttribute('data-no-escape')) return;
      e.preventDefault();
      el.hidden = true;
      return;
    }
    if (e.key !== 'Tab') return;
    const f = focusables(el);
    if (!f.length) { e.preventDefault(); el.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    // Tab out of the dialog wraps back into it, rather than walking the page
    // behind an overlay the user cannot see past.
    if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) {
      e.preventDefault(); first.focus();
    }
  }

  function watch(el) {
    if (el.__a11yWatched) return;
    el.__a11yWatched = true;
    new MutationObserver(() => (el.hidden ? closed(el) : opened(el)))
      .observe(el, { attributes: true, attributeFilter: ['hidden'] });
    if (!el.hidden) opened(el);
  }

  function init() {
    document.querySelectorAll('.modal-overlay').forEach(watch);
    // Modals injected at runtime — the analytics, benchmark, club, efficiency,
    // learning and shortcut dialogs are all built with innerHTML on demand.
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.classList?.contains('modal-overlay')) watch(n);
      n.querySelectorAll?.('.modal-overlay').forEach(watch);
    }))).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', onKey, true);
  }

  return { init, openCount: () => _open.length, top };
})();

