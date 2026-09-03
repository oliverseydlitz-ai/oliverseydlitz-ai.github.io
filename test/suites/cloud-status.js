const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Store, MemDB, Auth, UI } = R.app;
const doc = R.window.document;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');

// Degrading to local when the cloud is unreachable is right — an outage must
// never break the app. Doing it SILENTLY is not. A signed-in user on a device
// holding three of their twenty sessions saw a normal home screen with three
// sessions on it, and nothing said the view was partial. That is the one thing
// this codebase refuses everywhere else: an incomplete answer presented as a
// complete one. A free-tier project pauses itself after a week idle, so this is
// the normal case, not the edge case.

const shot = () => ({ clubType: '7i', ballSpeed: 118, clubSpeed: 85, smashFactor: 1.38,
  launchAngle: 17, attackAngle: -3, carryDistance: 160 });
const sess = id => ({ id, date: '2026-09-01',
  conditions: { ball: 'premium', surface: 'grass' },
  shots: Array.from({ length: 12 }, shot) });

(async () => {
  console.log('— a guest has no cloud status at all —');
  ok(Store.cloudStatus() === null,
     'null, not "ok" — a guest is not a healthy sync, and rendering it as one would be a lie');

  // Sign in, with a cloud that works.
  const user = { id: '00000000-0000-0000-0000-0000000000aa', email: 't@e.com' };
  Auth.getUser = () => user;
  R.window.supabase = R.window.supabase;

  console.log('— a healthy read reports ok —');
  MemDB.saveSession(sess('local-1'));
  await Store.getSessions();
  const good = Store.cloudStatus();
  ok(good && good.ok === true, 'the read succeeded');
  ok(Number.isFinite(good.at), 'and is timestamped');

  console.log('— a failing read is RECORDED, not swallowed —');
  const { CloudDB } = R.app;
  const realGet = CloudDB.getSessions;
  CloudDB.getSessions = async () => { throw new Error('Project is paused'); };
  const list = await Store.getSessions();
  const bad = Store.cloudStatus();
  ok(bad && bad.ok === false, 'the failure is recorded');
  ok(/paused/i.test(bad.error), 'with the reason, so the banner can say what went wrong');
  ok(list.length === 1, 'and the app still returns the local sessions — an outage must not break it');
  ok(bad.shown === 1, 'and knows how many the golfer is actually looking at');

  console.log('— and it reaches the screen —');
  const el = doc.getElementById('syncBanner');
  ok(el !== null, 'the home view has a host for it');
  UI.renderHome(list);
  ok(el.hidden === false, 'the banner is shown');
  const t = el.textContent;
  ok(/did not load/i.test(t), 'it says the cloud data did not load');
  ok(/not your whole account/i.test(t), 'and that this is not the whole account');
  ok(/1 session/.test(t), 'naming how many are actually on screen');
  ok(/Do not delete anything/i.test(t),
     'and warns against acting on it — the real harm is a golfer "tidying up" a view they think is complete');
  ok(/not gone/i.test(t), 'while saying plainly that the cloud data still exists');
  ok(/paused/i.test(t), 'and shows the underlying error rather than a shrug');
  ok(doc.getElementById('syncRetry') !== null, 'with a way to retry');

  console.log('— and it clears when the cloud comes back —');
  CloudDB.getSessions = realGet;
  await Store.getSessions();
  UI.renderHome(await Store.getSessions());
  ok(Store.cloudStatus().ok === true, 'status recovers');
  ok(el.hidden === true, 'and the banner goes away rather than sticking around');

  console.log('— the warning is above everything it qualifies —');
  ok(src.indexOf('renderSyncBanner()') < src.indexOf('// Render tip of the day'),
     'renderHome calls it first — it changes what every number below it MEANS, not just how the page looks');

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exit(fail ? 1 : 0);
})();
