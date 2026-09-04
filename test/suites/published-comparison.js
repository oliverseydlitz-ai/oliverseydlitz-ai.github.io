const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { CommunityInsights: CI, Benchmarks: B, Metrics, Store } = M;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');

// This module shipped with `// Simulated benchmark data (would be real in
// production)` and three invented rows — avgCarry 160, consistency 72, form 68
// — rendered as "Avg" beside the golfer's own number with a green "↑ Above
// average" on each. There is no community: sessions live per user behind
// row-level security, nothing aggregates them, and building that would mean
// pooling other people's rounds. The promise at the bottom of the modal that
// "real community data will be available soon" was one the app cannot keep.
console.log('— no invented averages survive anywhere —');
const code = src.split(/\r?\n/).map(l => l.replace(/^\s*\/\/.*/, '')).join('\n');
ok(!/Simulated benchmark data/.test(code), 'the simulated table is gone');
ok(!/bySkill/.test(code), 'and the invented per-skill rows with it');
ok(!/community data will be available/i.test(code), 'as is the promise of data the app cannot collect');
ok(!/compareToommunity/.test(code), 'the misspelled entry point is gone too');

console.log('— what is left is per club, above the floor, as an interval —');
const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 152, clubSpeed: 104, smashFactor: 1.46,
  launchAngle: 12, attackAngle: 2, carryDistance: 235, totalDistance: 258, ...o });
const sess = (id, shots) => Store.stamp({ id, date: '2026-07-01',
  conditions: { ball: 'premium', surface: 'grass' }, shots });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));

const thin = CI.published([sess('a', many(4))]);
ok(thin.ok === false, '4 shots is not a comparison');
ok(thin.need === Metrics.MIN_SHOTS_REPORT - 4, 'and it says how many more are needed');

const full = CI.published([sess('b', many(30))]);
ok(full.ok === true, '30 shots is');
ok(full.club === 'd', 'anchored on the most-hit club');
ok(full.rows.length === 3, 'carry, ball speed and smash');
for (const r of full.rows) {
  ok(typeof r.you.mean === 'number' && typeof r.you.ci === 'number',
     `${r.label} is an interval, not a bare point`);
  ok(Number.isFinite(r.am) && Number.isFinite(r.pga),
     `${r.label} carries both published rows`);
}

console.log('— and the rows are the ones Benchmarks publishes, not new numbers —');
const b = B.get('d');
const carry = full.rows.find(r => r.label === 'Carry');
ok(carry.am === b.am.carry && carry.pga === b.pga.carry,
   `the amateur/tour carry comes straight from Benchmarks (${carry.am} / ${carry.pga})`);
const smash = full.rows.find(r => r.label === 'Smash factor');
ok(smash.am === b.am.sf && smash.pga === b.pga.sf, 'and so does smash');

console.log('— a club with no published row says so rather than inventing one —');
// Benchmarks.get returns nothing for a club it has no data for; the caller must
// not fall back to a neighbouring club's numbers.
const odd = CI.published([sess('c', many(20, { clubType: 'xx' }))]);
ok(odd.ok === false, 'no published row, no comparison');
ok(odd.noBenchmark === true || odd.need >= 0, 'and it says which kind of "no" this is');

console.log('— the skill label is described as this app\'s score, not a handicap —');
ok(['beginner','intermediate','advanced'].includes(CI.estimateSkillLevel([])),
   'it still returns a level for callers that use it');
const mod = src.slice(src.indexOf('const CommunityInsights'), src.indexOf('\n})();', src.indexOf('const CommunityInsights')));
ok(/not a handicap/.test(mod),
   'with the module saying outright that it is not a handicap');
ok(/there is no community/i.test(mod),
   'and stating plainly that there is no community to compare against');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
