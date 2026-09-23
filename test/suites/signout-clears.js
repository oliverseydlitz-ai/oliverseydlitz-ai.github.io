// ── Signing out: the account holder's data does not stay for the next person ──
//
// QC R23. logout() removed only the auth token. IndexedDB sessions (notes
// included), the practice log, retention probes, rounds, putts, short game,
// goals and the remembered conditions all survived — and with slGuestChosen
// set, the reload landed straight in guest mode ON the previous person's data.
// If the next person then signed in, they were offered "Back up 1 session?"
// into their own account.
//
// The fix is a choice, not a wipe, because several of those stores exist ONLY
// on the device: clearing them on a golfer's own phone destroys their own
// practice log. So sign-out asks — keep on this device, or clear it — and this
// suite pins:
//   1. every `sl*` key in app.js is classified as ACCOUNT or DEVICE data, so a
//      new store cannot quietly survive a clearing sign-out;
//   2. wipeAccountData() removes every account key and the sessions, and
//      leaves every device preference alone;
//   3. the button goes through the three-way confirm and a guest cannot reach
//      logout at all (V25).
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const fs = require('fs'), path = require('path');
const { LocalDB } = R.app;
const w = R.window;
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');
const code = src.replace(/\/\*[^]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');

(async () => {
  console.log('— every storage key is classified —');
  const used = new Set([...code.matchAll(/'(sl[A-Z][A-Za-z]+)'/g)].map(m => m[1]));
  // Element ids that happen to start with "sl" are not storage keys.
  for (const id of ['slFatal', 'slReload', 'slReset']) used.delete(id);
  const classified = new Set([...LocalDB.ACCOUNT_KEYS, ...LocalDB.DEVICE_KEYS]);
  const unclassified = [...used].filter(k => !classified.has(k));
  ok(used.size >= 15, `${used.size} sl* storage keys found in app.js`);
  ok(unclassified.length === 0,
     `each is ACCOUNT or DEVICE data${unclassified.length ? ' — unclassified: ' + unclassified.join(', ') : ''}`);
  const both = LocalDB.ACCOUNT_KEYS.filter(k => LocalDB.DEVICE_KEYS.includes(k));
  ok(both.length === 0, 'and none is both');
  ok(LocalDB.ACCOUNT_KEYS.includes('slPracticeLog') && LocalDB.ACCOUNT_KEYS.includes('slProbes') &&
     LocalDB.ACCOUNT_KEYS.includes('slGuestChosen'),
     'the practice log, the probes and the guest flag are account data');

  console.log('— clearing removes the account, keeps the device —');
  for (const k of [...LocalDB.ACCOUNT_KEYS, ...LocalDB.DEVICE_KEYS]) w.localStorage.setItem(k, 'x');
  w.__idbStore.set('s1', { id: 's1', notes: 'shaft fitting at ACME' });
  const r = await LocalDB.wipeAccountData();
  ok(r.ok, 'the wipe reports success');
  const left = LocalDB.ACCOUNT_KEYS.filter(k => w.localStorage.getItem(k) !== null);
  ok(left.length === 0, `no account key survives${left.length ? ' — ' + left.join(', ') : ''}`);
  ok(w.__idbStore.size === 0, 'and no session (with its notes) survives in IndexedDB');
  const lost = LocalDB.DEVICE_KEYS.filter(k => w.localStorage.getItem(k) === null);
  ok(lost.length === 0, `every device preference is kept${lost.length ? ' — lost: ' + lost.join(', ') : ''}`);

  w.__idbFail = 'blocked'; w.__idbStore.set('s2', {});
  const r2 = await LocalDB.wipeAccountData();
  w.__idbFail = null;
  ok(!r2.ok && r2.failed.includes('sessions'), 'a store that refuses is reported, not swallowed');

  console.log('— the button asks, and a guest cannot reach it —');
  const handler = code.slice(code.indexOf("getElementById('accountSignOutBtn').addEventListener"));
  const body = handler.slice(0, handler.indexOf('\n  });') + 6);
  ok(/if \(!Auth\.getUser\(\)\) return;/.test(body), 'a guest returns before logout (V25)');
  ok(/showConfirm\(/.test(body) && /clearDevice:\s*true/.test(body) && /clearDevice:\s*false/.test(body),
     'sign-out goes through a confirm offering both clear and keep');
  ok(/onAlt:/.test(body) && /okLabel:/.test(body), 'each choice is a labelled button, not "Confirm"');
  const logout = code.slice(code.indexOf('async function logout('), code.indexOf('window.location.replace', code.indexOf('async function logout(')));
  ok(/if \(clearDevice\) await LocalDB\.wipeAccountData\(\)/.test(logout), 'logout wipes BEFORE it reloads');
  const doc = w.document;
  ok(doc.getElementById('confirmAlt') && doc.getElementById('confirmAlt').hidden,
     'the middle choice exists and is hidden unless a caller asks for it');

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exit(fail ? 1 : 0);
})();
