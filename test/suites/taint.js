// ── Nothing a file carries reaches the page as markup (R19) ─────────────
//
// THE DEFECT: a CSV's Club Type, and any field of a restored backup, went
// into about fifteen `innerHTML` sinks raw — the import preview, session
// cards, the gap, bench and shot tables, the yardage book, records, progress
// and the club modals. `clubLabel` returned an unknown code uppercased and
// unescaped. A proof-of-concept file fired beacons at a third-party image host
// (breaking the zero-third-party position) and injected 21 <style> nodes.
// Notes, wind, temp, date, ball and surface were escaped; the one field every
// screen prints was not.
//
// THE FIX IS AT THE DOOR, NOT AT FIFTEEN SINKS. `Sanitize.clubType` turns a
// club into a known code or a short plain token, and it runs in the three
// places data enters: CSVParser.parse, SessionSharing.readBackup and
// Store.stamp (every read, local or cloud). `clubLabel` escapes as well,
// because a door is only as good as the next path somebody adds around it.
//
// This suite renders every view from sessions carrying a marker in each
// string field and asserts the marker never becomes an element.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Store, UI, MemDB, CSVParser, SessionSharing, Sanitize, clubLabel } = R.app;
const doc = R.window.document;

const MARK = 'x<b data-taint="1">T</b><img src="https://evil.example/p.gif" data-taint="2">';
const tainted = () => doc.querySelectorAll('[data-taint]').length;

console.log('— the door —');
ok(Sanitize.clubType('D') === 'd' && Sanitize.clubType(' 7I ') === '7i',
   'a known club in any case or padding becomes its code');
ok(!/[<>"'&]/.test(Sanitize.clubType(MARK)), 'an unknown club keeps no markup character');
ok(Sanitize.clubType(MARK).length <= 24, 'and is short');
ok(Sanitize.clubType(null) === null && Sanitize.clubType('') === '', 'absent stays absent');
ok(clubLabel('constructor') === 'CONSTRUCTOR',
   'clubLabel does not read Object.prototype (a club called "constructor" is not a function)');
ok(!/</.test(clubLabel('<b>')), 'clubLabel escapes whatever reaches it anyway');

// The test Papa splits on commas and does not honour quotes; feed it a mark
// with no comma in it, which is still hostile.
const MARK2 = 'x<b data-taint=1>T</b>';
const csv2 = 'Club Type,Club Brand,Ball Speed,Carry Distance\n' +
  Array.from({ length: 12 }, () => `${MARK2},${MARK2},120,150`).join('\n');
const parsed = CSVParser.parse(csv2);
ok(parsed.every(s => !/[<>]/.test(s.clubType)), 'CSVParser hands on no markup in a club type');

console.log('— a backup —');
const shot = (o = {}) => ({ clubType: MARK, clubBrand: MARK, ballSpeed: 118, clubSpeed: 85, smashFactor: 1.38,
  launchAngle: 17, attackAngle: -3, clubPath: -1, carryDistance: 160, totalDistance: 172, ...o });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));
const bad = SessionSharing.readBackup(JSON.stringify([
  { id: 'ok-1', date: '2026-07-01', shots: many(12) },
  { id: '"><b data-taint=3>', date: '2026-07-02', shots: many(12) },
  { id: 'ok-2', date: 'not a date', shots: many(12) },
  { id: 'ok-3', date: '2026-07-03', shots: many(12, { carryDistance: '<b>' }) },
]));
ok(bad.ok && bad.sessions.map(s => s.id).join() === 'ok-1,ok-3', 'a backup id that is not a plain token, or a date that is not a date, is refused');
ok(bad.sessions.every(s => s.shots.every(x => !/[<>]/.test(x.clubType))), 'and a restored club type carries no markup');
ok(bad.sessions[1].shots.every(x => x.carryDistance === null), 'and a numeric field that is not a number is null, not a string');

console.log('— every view, rendered from hostile sessions —');
// Put the raw, unsanitised sessions straight into memory — the shape a cloud
// row or an old device store can hold — so the read path has to clean them.
['t1', 't2', 't3'].forEach((id, i) => MemDB.saveSession({
  id, date: `2026-07-0${i + 1}`, notes: MARK, conditions: { ball: 'premium', surface: 'grass' },
  shots: many(30, { clubType: i ? MARK : 'd' }).concat(many(15, { clubType: MARK + 'y' })),
}));
(async () => {
  const sessions = await Store.getSessions();
  const renders = {
    home: () => UI.renderHome(sessions),
    detail: () => UI.renderDetail(sessions[0]),
    progress: () => UI.renderProgress(sessions),
    yardages: () => UI.renderYardages(sessions),
    practice: () => UI.renderPractice(sessions),
    drills: () => UI.renderDrills(sessions),
  };
  for (const [name, fn] of Object.entries(renders)) {
    let err = null;
    try { fn(); } catch (e) { err = e; }
    ok(!err && tainted() === 0, `${name}: ${err ? 'threw ' + err.message : tainted() + ' injected element(s)'}`);
  }
  ok(doc.querySelectorAll('img[src*="evil.example"]').length === 0, 'no request to a third party was ever set up');

  // R15: and if something does get in, it cannot phone home. The R19 proof of
  // concept fired its beacons through `img-src … https:`, which allowed an
  // image from any host at all. Nothing in the app loads a remote image.
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');
  const imgSrc = ((html.match(/Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '').split(';')
    .map(d => d.trim()).find(d => d.startsWith('img-src')) || '';
  ok(imgSrc && !/\bhttps?:(?!\/\/)|\*/.test(imgSrc), `the CSP allows no image from an arbitrary host (${imgSrc})`);

  // The positive control: the same marker, put into a sink on purpose, is seen.
  const probe = doc.createElement('div'); probe.innerHTML = MARK; doc.body.appendChild(probe);
  ok(tainted() > 0, 'and the check sees a marker that does get in');
  probe.remove();

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  module.exports = { fail };
  process.exitCode = fail ? 1 : 0;
})();
