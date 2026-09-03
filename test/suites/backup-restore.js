const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { SessionSharing: SS, Store, MemDB } = M;

// `exportAsJSON` writes `shotlab-backup-2026-09-03.json` and nothing could read
// it back. A backup you cannot restore from is a download, and the filename was
// making a promise the app had no way to keep.
const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 150, clubSpeed: 104, smashFactor: 1.44,
  launchAngle: 12, attackAngle: 2, carryDistance: 250, ...o });
const sess = (id, date = '2026-08-01', n = 12) => ({ id, date,
  conditions: { ball: 'premium', surface: 'grass' },
  shots: Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot() })) });
const json = v => JSON.stringify(v);

console.log('— a file that is not a backup is refused at the door —');
// The same discipline as the CSV parser, which refuses a bank statement rather
// than importing it as a session of nothing.
for (const [text, what] of [
  ['not json at all',                    'plain text'],
  ['{"sessions":[]}',                    'an object rather than a list'],
  ['[]',                                 'an empty list'],
  ['[{"nope":1}]',                       'a list of things that are not sessions'],
  ['[{"id":"a","date":"2026-08-01"}]',   'a session with no shots array'],
  ['[{"id":"a","date":"2026-08-01","shots":[]}]', 'a session with no shots in it'],
  ['[{"id":"a","date":"2026-08-01","shots":[{"ballSpeed":150}]}]', 'shots with no club on any of them'],
]) {
  const r = SS.readBackup(text);
  ok(r.ok === false, `refused: ${what}`);
  ok(typeof r.why === 'string' && r.why.length > 20, '  …with a reason a person can act on');
}

console.log('— a real backup reads back with what is in it —');
const good = SS.readBackup(json([sess('a','2026-07-01'), sess('b','2026-08-01', 20)]));
ok(good.ok === true, 'two sessions parse');
ok(good.sessions.length === 2, 'both come back');
ok(good.shots === 32, `with the shot count (${good.shots})`);
ok(good.from.startsWith('2026-07-01') && good.to.startsWith('2026-08-01'),
   'and the date range, so the golfer can see which backup this is');

console.log('— a partly-broken file keeps what is good and says what it dropped —');
const mixed = SS.readBackup(json([sess('a'), { id: 'b', date: '2026-08-01' }, { nope: 1 }]));
ok(mixed.ok === true, 'it does not throw the whole file away for one bad entry');
ok(mixed.sessions.length === 1, 'the good session survives');
ok(mixed.rejected.length === 2, 'and both bad ones are reported');
ok(mixed.rejected.some(r => /has no shots array/.test(r)), 'each with what was wrong with it');

console.log('— restoring never overwrites what is already here —');
// The copy on the device may have notes or conditions added since the backup
// was taken. A restore that silently replaced them would be a data-loss bug
// wearing the word "restore".
MemDB.clearAll ? MemDB.clearAll() : null;
const onDevice = Store.stamp({ ...sess('a'), notes: 'added after the backup was taken' });
(async () => {
  await Store.saveSession(onDevice);
  const parsed = SS.readBackup(json([sess('a'), sess('c'), sess('d')]));
  const res = await SS.restore(parsed, await Store.getSessions());
  ok(res.saved === 2, `two new sessions written (${res.saved})`);
  ok(res.skipped === 1, 'and the one already here was skipped');
  ok(res.failed === 0, 'nothing failed');

  const after = await Store.getSessions();
  const kept = after.find(s => s.id === 'a');
  ok(kept && kept.notes === 'added after the backup was taken',
     'the note added since the backup survives — the device copy wins');
  ok(after.filter(s => s.id === 'a').length === 1, 'and it was not duplicated');
  ok(!!after.find(s => s.id === 'c'), 'the genuinely new sessions are there');

  console.log('— restoring the same file twice adds nothing the second time —');
  const again = await SS.restore(parsed, await Store.getSessions());
  ok(again.saved === 0 && again.skipped === 3, 'idempotent');

  console.log(fail?`\n${fail} FAILED`:'\nall passed');
  process.exit(fail?1:0);
})();
