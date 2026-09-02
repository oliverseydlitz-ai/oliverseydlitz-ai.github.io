// LocalDB decides whether a session survives closing the tab. Before it
// existed, everything local went to an in-memory array while the guest button
// said "your data stays on this device" — so these tests are as much about the
// promise the UI makes as about the storage.
const { load } = require('../load.js');
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
// Two scenarios below deliberately break the device store, and LocalDB is
// supposed to log when that happens. Swallow those so the runner's output
// shows results rather than the stack traces the tests asked for.
const quiet = async fn => { const e = console.error; console.error = () => {}; try { await fn(); } finally { console.error = e; } };

// Each scenario needs its own fresh page: LocalDB reads the device store once
// at boot, so "does a session come back" can only be asked by booting again.
function boot(seed = {}) {
  const r = load();
  if (!r.ok) { console.log('  FAIL  app.js did not load: ' + r.errors.join('; ')); process.exit(1); }
  const w = r.window;
  if (seed.keep) w.localStorage.setItem('slKeepLocal', '1'); else w.localStorage.removeItem('slKeepLocal');
  if (seed.rows) seed.rows.forEach(s => w.__idbStore.set(s.id, s));
  if (seed.failWith) w.__idbFail = seed.failWith;
  return { ...r.app, w, idb: w.__idbStore };
}
const mk = (id, n = 3) => ({ id, date: new Date(2026, 0, 1).toISOString(),
  conditions: { ball: 'premium', surface: 'grass' },
  shots: Array.from({ length: n }, (_, i) => ({ clubType: '7i', carryDistance: 160 + i, sideCarry: i })) });

(async () => {

console.log('— off by default: nothing is written without being asked —');
{
  const a = boot();
  ok(a.LocalDB.enabled() === false, 'device storage starts off');
  await a.Store.saveSession(mk('s1'));
  ok(a.idb.size === 0, 'and a saved session reaches memory only, never the device');
  ok(a.MemDB.getSessions().length === 1, 'while staying fully usable in memory');
  ok(/lost when you close the tab/.test(a.LocalDB.describe()),
     'and the app says so in the words the guest button shows');
}

console.log('— turning it on applies to what is ALREADY there, not just what comes next —');
{
  const a = boot();
  await a.Store.saveSession(mk('s1'));
  await a.Store.saveSession(mk('s2'));
  const r = await a.LocalDB.setEnabled(true);
  ok(r.on === true && r.saved === 2, 'the two sessions imported before the switch are written too');
  ok(a.idb.size === 2, 'both are on the device');
  ok(a.w.localStorage.getItem('slKeepLocal') === '1', 'and the choice is remembered');
  ok(/still be here when you come back/.test(a.LocalDB.describe()), 'the note changes to match');
}

console.log('— and they come back on the next visit —');
{
  const first = boot();
  await first.LocalDB.setEnabled(true);
  await first.Store.saveSession(mk('kept', 5));
  const rows = [...first.idb.values()];

  const second = boot({ keep: true, rows });
  const h = await second.LocalDB.hydrate();
  ok(h.restored === 1, 'a fresh page restores what the device held');
  ok(second.MemDB.getSession('kept') !== null, 'into the same store everything else reads from');
  ok((await second.Store.getSessions())[0].shots.length === 5, 'with the shots intact');
}

console.log('— with it off, a fresh page starts empty even if rows are lying there —');
{
  const b = boot({ keep: false, rows: [mk('orphan')] });
  ok((await b.LocalDB.hydrate()).restored === 0, 'hydrate does not read a store the user did not opt into');
  ok(b.MemDB.getSessions().length === 0, 'so the dashboard is empty, as the guest note promises');
}

console.log('— turning it off erases now, not just from here on —');
{
  const a = boot();
  await a.LocalDB.setEnabled(true);
  await a.Store.saveSession(mk('s1'));
  await a.Store.saveSession(mk('s2'));
  const r = await a.LocalDB.setEnabled(false);
  ok(r.erased === 2, 'the device copy is deleted immediately');
  ok(a.idb.size === 0, 'nothing is left behind');
  ok(a.MemDB.getSessions().length === 2, 'while the current page keeps working from memory');
}

console.log('— every local write path reaches the device, not just Store.saveSession —');
// ImportFlow wrote straight to MemDB, bypassing the persistence wired into
// Store.saveSession. A golfer who switched device storage on and THEN imported
// lost every session afterwards; it only looked fine because turning the
// setting on flushes whatever is already in memory, which is the order the
// first test used. Store.saveLocal is now the single local write path.
{
  const a = boot();
  await a.LocalDB.setEnabled(true);
  ok(a.idb.size === 0, 'nothing stored yet');
  await a.Store.saveLocal(mk('imported'));      // the path ImportFlow takes
  ok(a.idb.size === 1, 'a session added the way an import adds one reaches the device');
  ok(a.MemDB.getSession('imported') !== null, 'and memory, so it renders instantly');

  const rows = [...a.idb.values()];
  const next = boot({ keep: true, rows });
  ok((await next.LocalDB.hydrate()).restored === 1,
     'so it is still there on the next visit — which is the whole feature');
}

console.log('— deleting a session removes the device copy too —');
{
  const a = boot();
  await a.LocalDB.setEnabled(true);
  await a.Store.saveSession(mk('s1'));
  await a.Store.deleteSession('s1');
  ok(a.idb.size === 0, 'Store.deleteSession reaches the device store, so Clear Data really clears');
}

console.log('— a browser that refuses to store degrades honestly —');
await quiet(async () => {
  const a = boot({ failWith: 'QuotaExceededError' });
  const r = await a.LocalDB.setEnabled(true);
  ok(r.on === false, 'the switch refuses to turn on rather than lying about it');
  ok(a.LocalDB.enabled() === false, 'and reports itself off');
  ok(a.w.localStorage.getItem('slKeepLocal') !== '1', 'the choice is not remembered as on');
  ok(/will not let the app store data/.test(a.LocalDB.describe()), 'the note names the real reason');
  await a.Store.saveSession(mk('s1'));
  ok(a.MemDB.getSessions().length === 1, 'and the app still imports and works in memory');
});

console.log('— a device store that breaks mid-session never takes an import down —');
await quiet(async () => {
  const a = boot();
  await a.LocalDB.setEnabled(true);
  await a.Store.saveSession(mk('s1'));
  a.w.__idbFail = 'disk full';
  let threw = false;
  try { await a.Store.saveSession(mk('s2')); } catch (_) { threw = true; }
  ok(threw === false, 'a failed write does not throw out of Store.saveSession');
  ok(a.MemDB.getSession('s2') !== null, 'and the session is still there to use');
  ok(a.LocalDB.enabled() === false, 'device storage marks itself unavailable rather than silently dropping writes');
});

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
})();
