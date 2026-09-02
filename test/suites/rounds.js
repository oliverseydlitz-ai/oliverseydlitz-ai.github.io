const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { Rounds: R, Dispersion } = M;
R.clear();

const rd = (o = {}) => ({ holes: 18, par: 72, score: 90, putts: 33, threePutts: 3, penalties: 3,
  fairwaysHit: 6, fairwaysPossible: 14, girHit: 3, upDowns: 3, upDownAttempts: 15, ...o });

console.log('— the norms are the published table, not a guess —');
ok(R.NORMS.length === 6, 'six handicap rows');
ok(R.NORMS[0].hcp === 0 && R.NORMS[5].hcp === 25, 'from scratch to 25');
ok(R.NORMS[0].gir === 61 && R.NORMS[5].gir === 10, 'GIR varies sixfold across them');
ok(R.NORMS[0].penalties === 0.56 && R.NORMS[5].penalties === 4.67, 'penalties eightfold');
ok(Math.abs(R.NORMS[0].fir - R.NORMS[5].fir) <= 4, 'and fairways hit barely moves at all');

console.log('— which is why fairways are logged and never graded —');
ok(!('fir' in R.PLACEABLE), 'FIR is not a placeable stat');
ok(['gir','updown','putts','penalties'].every(k => k in R.PLACEABLE), 'the four that discriminate are');
ok(/does not discriminate/.test(R.FIR_NOTE), 'and the note says why');
ok(/invent a weakness out of noise/.test(R.FIR_NOTE), 'naming what grading it would do');
ok(R.place('fir', 48) === null, 'so placing on it returns nothing rather than a number');

console.log('— placing a stat on the table —');
ok(Math.abs(R.place('gir', 61).hcp - 0) < 0.01, 'a 61% GIR places at scratch');
ok(Math.abs(R.place('gir', 10).hcp - 25) < 0.01, 'and 10% at 25');
const mid = R.place('gir', 30);
ok(mid.hcp > 10 && mid.hcp < 15, `30% GIR interpolates between the 10 and 15 rows (${mid.hcp.toFixed(1)})`);
ok(R.place('penalties', 0.56).hcp === 0 && R.place('penalties', 4.67).hcp === 25,
   'penalties run the other way and still place correctly');
ok(R.place('putts', 29.4).hcp === 0, 'so do putts, where lower is better');
ok(R.place('gir', 80).clamped === true && R.place('gir', 80).better === true,
   'better than the table clamps and says so — a 34-handicap is not a 25');
ok(R.place('penalties', 12).clamped === true && R.place('penalties', 12).better === false,
   'and worse than it clamps the other way');

console.log('— nine-hole rounds are scaled onto the same table —');
const nine = R.per18({ holes: 9, par: 36, score: 50, putts: 17, penalties: 2, girHit: 1,
  fairwaysHit: 3, fairwaysPossible: 7, upDowns: 1, upDownAttempts: 7 });
ok(nine.scaled === true, 'and flagged as scaled');
ok(nine.putts === 34 && nine.penalties === 4, 'counts double');
ok(nine.toPar === 28, 'as does the score to par');
ok(Math.abs(nine.gir - 11.1) < 0.5, 'while rates stay rates — 1 of 9 is still 11%');
ok(R.per18(rd()).scaled === false, 'an 18-hole round is not scaled');

console.log(`— the profile needs ${R.MIN_ROUNDS} rounds —`);
ok(R.profile([]).ok === false, 'nothing from none');
ok(R.profile([rd(), rd()]).ok === false, 'or from two');
ok(/Log 1 more round/.test(R.profile([rd(), rd()]).note), 'and it says how many more');

console.log('— the diagnosis is the SPREAD between categories, not the average —');
// GIR like a 15, penalties like a 25: not a 20 across the board.
const lopsided = [1,2,3,4].map(() => rd({ girHit: 4, penalties: 4.6, putts: 31.2, upDowns: 5, upDownAttempts: 16 }));
const p = R.profile(lopsided);
ok(p.ok === true && p.n === 4, 'four rounds is enough');
ok(p.worst.key === 'penalties', `penalties is named the outlier (implied ${p.worst.implied.toFixed(0)})`);
ok(p.spread > 5 && p.even === false, `and the spread is real (${p.spread.toFixed(0)} points)`);
ok(/where your strokes are/.test(p.note), 'the note says that is where the strokes are');
ok(/not spread evenly across your game/.test(p.note), 'and that they are not spread evenly');

// A golfer level across the board gets told so, rather than handed a fake weakness.
const level = [1,2,3,4].map(() => rd({ girHit: 6, penalties: 1.62, putts: 31.2, upDowns: 5, upDownAttempts: 16 }));
const lp = R.profile(level);
ok(lp.even === true, `categories within 5 points read as level (${lp.spread.toFixed(1)})`);
ok(/no single part of your game is dragging/.test(lp.note), 'and it says so');
ok(/That is a real answer/.test(lp.note), 'framed as an answer rather than a failure to find something');

console.log('— fairways are carried through but never ranked —');
ok(Number.isFinite(p.fir), 'the number is there');
ok(!('fir' in p.stats), 'but it is not among the graded stats');
ok(p.worst.key !== 'fir' && p.best.key !== 'fir', 'so it can never be named best or worst');

console.log('— the link back to the range —');
const noTail = R.rangeLink(lopsided, null);
ok(noTail.ok === false, 'without a measured tail it still reports the penalty rate');
ok(/needs 30 shots of one club/.test(noTail.note), 'and says what the range side needs');
const withTail = R.rangeLink(lopsided, { ok: true, sigma: 8.2, p95: 15.4 });
ok(withTail.ok === true && /same problem measured in two places/.test(withTail.note),
   'with one, it puts the two side by side');
ok(/not correlated/.test(withTail.caveat), 'and refuses to call it a correlation');
ok(/would be invented/.test(withTail.caveat), 'saying plainly what such a number would be');

console.log('— storage —');
R.clear();
ok(R.record({ score: null }) === null, 'a round with no score is not a round');
const saved = R.record(rd({ course: 'Test GC' }));
ok(saved !== null && R.all().length === 1, 'a real one saves');
ok(saved.par === 72 && R.record({ score: 45, holes: 9 }).par === 36, 'par defaults per hole count');
ok(R.all().length === 2, 'both stored');
R.remove(saved.id);
ok(R.all().length === 1 && R.all()[0].id !== saved.id, 'and one can be removed');
R.clear();
ok(R.all().length === 0, 'clear empties it');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
