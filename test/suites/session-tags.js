const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { SessionTags: T, Features: F } = R.app;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');

// Free-text search answers "the one where I wrote about the shaft" only if you
// remember the words you used. A tag is the same note with a handle on it.

const sess = (id, notes, date = '2026-08-01') => ({ id, date, notes,
  conditions: { ball: 'premium', surface: 'grass' },
  shots: [{ clubType: '7i', carryDistance: 160, ballSpeed: 118 }] });

console.log('— parsing —');
ok(JSON.stringify(T.parse('working on low point #newshaft')) === '["newshaft"]', 'one tag');
ok(T.parse('#a-b #c_d').length === 2, 'hyphens and underscores are allowed inside a tag');
ok(T.parse('#NewShaft')[0] === 'newshaft', 'tags are lowercased, so #NewShaft and #newshaft are one tag');
ok(T.parse('#dup #dup').length === 1, 'a tag repeated in one note counts once');
ok(T.parse('#1').length === 0, 'a bare number is not a tag — "#1" is a shot number');
ok(T.parse('#x').length === 0, 'nor is a single character');
ok(T.parse('no tags here').length === 0, 'a plain note has none');
ok(T.parse(null).length === 0 && T.parse(undefined).length === 0, 'and no note at all is survivable');
// An over-long token is not truncated into a tag the golfer never typed — it
// is simply not a tag. A tag that can be a whole sentence is the notes field
// again, and a silently-shortened one would appear as a chip nobody wrote.
ok(T.parse('#' + 'a'.repeat(40)).length === 0,
   'a 40-character token is not a tag at all, rather than being truncated into one the golfer never typed');
ok(T.parse('#' + 'a'.repeat(20)).length === 1, 'a long-but-reasonable one still is');
ok(T.parse(Array.from({length: 20}, (_, i) => `#t${i}`).join(' ')).length === T.MAX_PER_SESSION,
   `and a session is capped at ${T.MAX_PER_SESSION} of them`);

console.log('— they live in the notes, so nothing had to migrate —');
ok(T.of(sess('a', 'grip change #newshaft')).length === 1, 'read straight off the session');
ok(T.of({ id: 'old', date: '2025-01-01' }).length === 0,
   'a session imported before this existed simply has no tags — no schema change, no migration, nothing to sync');
ok(T.stripped('grip change #newshaft today') === 'grip change today',
   'and the prose can be shown without printing the tags twice');

console.log('— counting and filtering —');
const list = [sess('1', '#newshaft #homebay'), sess('2', '#newshaft'), sess('3', 'nothing'), sess('4', '#newshaft')];
const all = T.all(list);
ok(all[0].tag === 'newshaft' && all[0].count === 3, 'most-used first');
ok(all.length === 2, 'each tag once');
// Two-character minimum, so the tie fixture uses real tags rather than #a/#b.
ok(JSON.stringify(T.all([sess('a','#bb'), sess('b','#aa')])) === JSON.stringify([{tag:'aa',count:1},{tag:'bb',count:1}]),
   'ties break alphabetically, so the chip order is stable between renders rather than following insertion');
ok(T.filter(list, 'newshaft').length === 3, 'filtering by tag');
ok(T.filter(list, '#newshaft').length === 3, 'with or without the hash');
ok(T.filter(list, 'NEWSHAFT').length === 3, 'and case-insensitively');
ok(T.filter(list, '').length === 4, 'an empty tag filters nothing rather than everything');
ok(T.filter(list, 'nope').length === 0, 'an unknown tag matches nothing');
ok(T.all([]).length === 0 && T.filter(null, 'x').length === 0, 'and empty input is survivable');

console.log('— the search box finds them without the hash —');
ok(F.searchSessions(list, 'newshaft').length === 3,
   'typing the bare word finds the tagged sessions — the tag is in the haystack, not just the raw note text');

console.log('— THEY ARE A FINDER, NOT A VARIABLE —');
// "Your #newshaft sessions carry 8 yards further" is the uncontrolled
// comparison this app refuses everywhere else: the golfer chose which sessions
// to tag, nothing was randomised, and nothing holds conditions constant.
ok(/not a variable/i.test(T.NOT_A_VARIABLE), 'the rule is stated in the module');
ok(/randomis/i.test(T.NOT_A_VARIABLE) && /conditions|ball/i.test(T.NOT_A_VARIABLE),
   'and says why, in terms a golfer can check');
ok(/NOT_A_VARIABLE/.test(src.slice(src.indexOf('function renderSearchBar'))),
   'and it is rendered, not just written down');

// No module may compute a statistic per tag. If one ever does, this is where
// the argument for it has to be made — and there is no argument.
for (const bad of ['SessionTags.all(', 'SessionTags.filter(']) {
  const uses = (src.split(bad).length - 1);
  ok(uses <= 2, `${bad}…) is used sparingly (${uses}) — a per-tag statistic would show up as a pile of these`);
}
ok(!/avg\([^)]*SessionTags|SessionTags[^\n]*\bmean\(|\bmean\([^)]*SessionTags/.test(src),
   'nothing averages anything across a tag');

console.log('— a tag on a card filters instead of opening the session —');
ok(/stopPropagation/.test(src.slice(src.indexOf("querySelectorAll('.session-tag')"), src.indexOf("querySelectorAll('.session-tag')") + 700)),
   'the click is stopped before the card handler sees it — otherwise the session opens under the filter and the tap looks like it did nothing');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
