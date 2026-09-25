// R31: render local first, merge the cloud copy behind it.
//
// Every tab tap used to await a full cloud read before painting anything, so a
// slow or paused Supabase project made every tab feel dead. Painting first and
// merging later opens four ways to be wrong that the old code could not reach,
// and each is pinned here with a cloud whose timing the test controls:
//   · flicker   — a merge that changes nothing must not paint twice, and an
//                 empty device must not flash "no sessions" at a full account;
//   · lost edit — a note saved while a read is in flight must not be replaced
//                 by the older cloud row;
//   · a stale view winning — the late reply for a tab the golfer has left must
//                 not paint, and an older read must not overwrite a newer one;
//   · a paused cloud — the local paint stays, and the banner still appears.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Store, MemDB, Auth, CloudDB, Router, UI } = R.app;
const w = R.window, doc = w.document;
const tick = (ms = 10) => new Promise(r => setTimeout(r, ms));

const shots = () => Array.from({ length: 12 }, () => ({ clubType: '7i', ballSpeed: 118, clubSpeed: 85,
  smashFactor: 1.38, launchAngle: 17, attackAngle: -3, carryDistance: 160 }));
const sess = (id, date, notes = '') => ({ id, date, notes, conditions: { ball: 'premium', surface: 'grass' }, shots: shots() });
const row = sn => ({ id: sn.id, date: sn.date, notes: sn.notes, conditions: sn.conditions, shots: sn.shots,
  created_at: '2026-09-01T00:00:00Z' });

// A cloud the test answers by hand: every read is parked until released.
const pending = [];
let cloudRows = [];
CloudDB.getSessions = () => new Promise((res, rej) => pending.push({ res: () => res(cloudRows.map(row)), rej }));
CloudDB.saveSession = async () => {};
CloudDB.deleteSession = async () => {};
const answer = async (i = 0) => { const p = pending.splice(i, 1)[0]; p.res(); await tick(); };
const refuse = async (msg) => { const p = pending.shift(); p.rej(new Error(msg)); await tick(); };

let homeRenders = 0;
const realHome = UI.renderHome;
UI.renderHome = ss => { homeRenders++; return realHome(ss); };
const active = id => doc.getElementById(`view-${id}`).classList.contains('active');
const banner = () => (doc.getElementById('syncBanner') || {}).textContent || '';
const ids = list => list.map(s => s.id).sort().join();
// What the app would paint now. The old code had no snapshot, so the check
// falls back to the last list a read returned — that way every assertion runs
// against the old app.js too, rather than the first missing function ending it.
let lastSeen = [];
const realGet = Store.getSessions;
Store.getSessions = async (...a) => (lastSeen = await realGet(...a));
const snap = () => (Store.snapshot ? Store.snapshot() : lastSeen);

(async () => {
  const user = { id: '00000000-0000-0000-0000-0000000000cc', email: 'x@y.z' };
  Auth.getUser = () => user;
  // Boot runs its own reads (the goals panel); let it settle and answer them
  // so every read parked from here on belongs to the step that made it.
  await tick(50);
  while (pending.length) await answer();
  await tick(20);
  while (pending.length) await answer();

  console.log('— signed in, empty device, first read: it waits rather than flash "no sessions" —');
  {
    const L = require('../load.js').load({});
    const A = L.app;
    await tick(50);
    A.Auth.getUser = () => user;
    const park = [];
    A.CloudDB.getSessions = () => new Promise(res => park.push(res));
    let n = 0; const real = A.UI.renderHome; A.UI.renderHome = ss => { n++; return real(ss); };
    const cold = A.Router.showSessions();
    await tick();
    ok(n === 0, 'nothing is painted while an empty device waits on its first cloud read');
    park.forEach(r => r([row(sess('c1', '2026-09-01'))])); await cold;
    ok(n === 1 && L.window.document.getElementById('view-sessions').classList.contains('active'),
       'and the account paints once, when it arrives');
  }
  cloudRows = [sess('c1', '2026-09-01'), sess('c2', '2026-09-02'), sess('c3', '2026-09-03')];
  { const first = Store.getSessions(); await tick(1); await answer(); await first; }

  console.log('— the slow cloud: the device copy paints at once —');
  MemDB.saveSession(Store.stamp(sess('local-1', '2026-09-04')));
  homeRenders = 0;
  const slow = Router.showProgress();
  await tick();
  ok(active('progress') && pending.length === 1,
     'Progress is on screen while its cloud read is still in flight (it used to wait for the read)');
  cloudRows = [...cloudRows, sess('c4', '2026-09-05')];
  await answer(); await slow;
  const after = snap();
  ok(ids(after) === 'c1,c2,c3,c4,local-1', 'the merge lands behind it with the new cloud session and the local one');

  console.log('— a merge that changes nothing does not paint twice —');
  homeRenders = 0;
  const same = Router.showSessions();
  await tick();
  ok(homeRenders === 1, 'the home view paints from the snapshot straight away');
  await answer(); await same;
  ok(homeRenders === 1, 'and the identical cloud reply does not paint it again — no flicker');

  console.log('— a note saved while a read is in flight is not lost —');
  const read = Store.getSessions();                     // read starts: cloud row c2 has notes ''
  await tick(1);
  const edited = { ...snap().find(s => s.id === 'c2'), notes: 'new shaft' };
  await Store.saveSession(edited);                      // saved after the read began
  await answer();
  const merged = await read;
  ok(merged.find(s => s.id === 'c2').notes === 'new shaft',
     'the older cloud row does not overwrite a local save made after its read began');
  // A write whose cloud save failed is also kept, whenever the next read starts.
  CloudDB.saveSession = async () => { throw new Error('offline'); };
  await Store.saveSession({ ...edited, notes: 'offline note' }).catch(() => {});
  CloudDB.saveSession = async () => {};
  const next = Store.getSessions(); await tick(1); await answer();
  ok((await next).find(s => s.id === 'c2').notes === 'offline note',
     'and a local save the cloud never confirmed is not reverted by the next read');
  // Once the cloud has confirmed it and a later read returns it, the cloud copy is trusted again.
  cloudRows = cloudRows.map(s => s.id === 'c2' ? { ...s, notes: 'synced note' } : s);
  await Store.saveSession({ ...edited, notes: 'synced note' });
  const later = Store.getSessions(); await tick(1);
  cloudRows = cloudRows.map(s => s.id === 'c2' ? { ...s, notes: 'edited on the laptop' } : s);
  await answer();
  ok((await later).find(s => s.id === 'c2').notes === 'edited on the laptop',
     'a confirmed save does not pin the local copy forever — an edit made elsewhere still comes through');

  console.log('— a session deleted during a read does not come back —');
  const r2 = Store.getSessions(); await tick(1);
  await Store.deleteSession('c3');
  await answer();
  ok(!(await r2).some(s => s.id === 'c3') && !snap().some(s => s.id === 'c3'),
     'the read that started before the delete does not resurrect it');

  console.log('— out of order: an older read cannot overwrite a newer one —');
  const older = Store.getSessions(); await tick(1);    // pending[0]
  cloudRows = [...cloudRows, sess('c5', '2026-09-06')];
  const newer = Store.getSessions(); await tick(1);    // pending[1]
  await answer(1); await newer;                         // the newer read lands first, with c5
  cloudRows = cloudRows.filter(s => s.id !== 'c5');
  await answer(0); await older;                         // the older one lands late, without it
  ok(snap().some(s => s.id === 'c5'), 'the late, older read does not roll the cached copy back');

  console.log('— the golfer has moved on: the merge for the tab they left does not paint —');
  const leftBehind = Router.showProgress();
  await tick();
  const moved = Router.showYardages();
  await tick();
  cloudRows = [...cloudRows, sess('c6', '2026-09-07')];
  await answer(1); await moved;                         // Yardages' read
  await answer(0); await leftBehind;                    // Progress' read, late
  ok(active('yardages') && !active('progress'), 'Yardages stays on screen when the Progress reply lands late');

  console.log('— a search being typed is not wiped by the merge —');
  const home = Router.showSessions();
  await tick();
  const search = doc.getElementById('sessionSearch');
  homeRenders = 0;
  if (search) { search.focus(); search.value = 'shaf'; }
  cloudRows = [...cloudRows, sess('c7', '2026-09-08')];
  await answer(); await home;
  ok(!!search && homeRenders === 0, 'the repaint waits while the search box has focus');
  search && search.blur();
  await tick();
  ok(homeRenders === 1, 'and runs when it loses focus');

  console.log('— the paused cloud: the local paint stands and the banner still appears —');
  const paused = Router.showSessions();
  await tick();
  const before = homeRenders;
  await refuse('Project is paused'); await paused;
  ok(homeRenders === before + 1, 'the failed read repaints once, because the sync state changed');
  ok(/did not load/i.test(banner()), 'and the home view says the cloud sessions did not load');
  const afterFail = snap();
  ok(ids(afterFail) === ids(MemDB.getSessions()), 'after a failed read the next paint is exactly this device\'s sessions, as the banner says');

  console.log('— before the first read, the partial view is named —');
  {
    const L = require('../load.js').load({});
    const A = L.app;
    A.Auth.getUser = () => user;
    const park = [];
    A.CloudDB.getSessions = () => new Promise(res => park.push(res));
    A.MemDB.saveSession(A.Store.stamp(sess('only-here', '2026-09-09')));
    const p = A.Router.showSessions();
    await tick();
    const t = (L.window.document.getElementById('syncBanner') || {}).textContent || '';
    ok(/Loading your account/.test(t) && /1 session on this device/.test(t),
       'the device-only paint says it is the device copy while the account loads');
    park.forEach(r => r([])); await p; await tick();
    ok(!/Loading your account/.test((L.window.document.getElementById('syncBanner') || {}).textContent || ''),
       'and the note goes once the read is back');
  }

  console.log('— a guest is unchanged: one paint, no cloud —');
  {
    const L = require('../load.js').load({});
    const A = L.app;
    let reads = 0;
    A.CloudDB.getSessions = async () => { reads++; return []; };
    await A.Router.showSessions();
    ok(reads === 0 && (A.Store.syncing ? A.Store.syncing() : false) === false, 'a guest never waits on, or mentions, a cloud');
  }

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exit(fail ? 1 : 0);
})();
