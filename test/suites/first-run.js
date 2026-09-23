const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { FirstRun: FR, Metrics, FeedbackEngine: FE, RetentionProbe: RP, ShortGame, Conditions: C } = R.app;
const doc = R.window.document;
const store = R.window.localStorage;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');
const html = fs.readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');

// A new account lands on a home screen with seven empty insight surfaces. The
// thing that distinguishes this app — that it withholds most of what a launch
// monitor appears to offer, and says why — is invisible until there is data,
// and by then the impression is formed.

console.log('— EVERY number is read from the module that owns it —');
// An orientation screen is the easiest place in a codebase to ship a fabricated
// constant: nothing downstream consumes the text, so a wrong figure here would
// never surface anywhere else. That is exactly how three modules shipped made-up
// content, and this is the check that stops it happening again.
const c = FR.content();
ok(c.floor === Metrics.MIN_SHOTS_REPORT, 'the sample floor comes from Metrics');
ok(c.tailFloor === Metrics.MIN_SHOTS_TAIL, 'so does the tail floor');
ok(c.probeDays === RP.MAX_GAP_DAYS, 'the retention window comes from RetentionProbe');
ok(c.shortGame === ShortGame.ALL.length, 'the short-game drill count is counted, not typed');
ok(c.whyShown === FE.WHY_SHOWN,
   'the "why we show everything" text is the module\'s own words, not a paraphrase that can drift from it');
ok(c.balls.every(l => Object.values(C.BALLS).some(b => b.label === l)),
   'the ball list comes from Conditions.BALLS');
ok(!c.balls.includes('Not recorded'), 'minus "not recorded", which is not a ball you can choose to play');

console.log('— and the tiers are read off the tier table —');
ok(c.tier1.includes('ball speed') && c.tier1.includes('carry'), 'tier 1 names what the app prescribes from');
ok(c.tier2.includes('club path') && c.tier2.includes('attack angle'), 'tier 2 names what it shows only');
ok(c.tier3.includes('spin rate') && c.tier3.includes('start direction'), 'tier 3 names what it never advises on');
const total = c.tier1.length + c.tier2.length + c.tier3.length;
ok(total === Object.keys(Metrics.TIER).length,
   `every metric in the table is placed (${total}) — a tier list that quietly omits one is worse than none`);
for (const t of [1, 2, 3]) {
  const listed = c['tier' + t];
  const actual = Object.keys(Metrics.TIER).filter(m => Metrics.TIER[m] === t).length;
  ok(listed.length === actual, `tier ${t} lists all ${actual} of them`);
}
// If a metric moves tier, this screen moves with it and no one has to remember.
ok(!/spin rate.*tier 1|prescribed freely.*spin/i.test(src.slice(src.indexOf('const FirstRun'), src.indexOf('const FirstRun') + 7000)),
   'no tier assignment is hardcoded in the copy');

console.log('— it never opens by itself —');
// It used to open over the home view on a new account's first visit. Oliver
// removed that on 23 Sep: a first visit lands on the app, not on a wall of
// text. The screen stays, reachable from Settings. These pin that nothing
// reopens it at boot by the back door.
ok(!('maybeShow' in FR), 'there is no auto-show entry point left on the module');
const callers = [...src.matchAll(/FirstRun\.show\(/g)].length;
ok(callers === 1 && /getElementById\('introBtn'\)[^\n]*FirstRun\.show\(\)/.test(src),
   `FirstRun.show() has exactly one caller, the Settings row (${callers} found)`);
ok(doc.getElementById('firstRunModal') === null, 'and a fresh whole-file load boots without it on screen');

console.log('— and re-openable, because a one-shot screen is a worse place to keep the method than the docs —');
doc.getElementById('firstRunModal')?.remove();
ok(FR.show() !== null, 'show() opens it regardless of the flag');
ok(doc.getElementById('firstRunModal') !== null, 'it is there');
ok(/id="introBtn"/.test(html), 'and Settings has a row for it');
ok(/getElementById\('introBtn'\)/.test(src), 'which is wired');

console.log('— it says what to do on day one —');
const text = doc.getElementById('firstRunModal').textContent;
ok(/quiet-eye/i.test(text) && /no launch monitor/i.test(text),
   'the off-device work is named — "go get range time" is not a day-one answer');
ok(doc.querySelector('[data-fr="shortgame"]') !== null, 'with a button that goes there');
ok(/retention check/i.test(text) && /within-session numbers cannot/i.test(text),
   'and it explains the retention check before the golfer meets one');
ok(new RegExp(String(Metrics.MIN_SHOTS_REPORT)).test(text), 'the sample floor is on screen');
ok(/already saw all of it on the monitor/i.test(text),
   'and it explains why the app shows every number rather than offering to hide them');
ok(new RegExp(String(RP.MAX_GAP_DAYS)).test(text), 'so is the probe window');
console.log('— v2: it says every number gives advice, and never the opposite —');
ok(!/never prescribed|never used for advice|will not build a drill/i.test(text),
   'the retired "never prescribed from" / "never used for advice" wording is gone');
ok(/Every number gives advice/.test(text), 'it says every number gives advice');
for (const t of [1, 2, 3]) {
  const pct = Math.round(Metrics.tierRates(t).min * 100) + '%';
  ok(text.includes(pct), `the tier-${t} bar (${pct}) is on screen, read from Metrics.tierRates`);
}
ok(/Spin only counts with an RPT ball/.test(text), 'and spin still needs an RPT ball');
FR.show().remove();

console.log('— the empty state stops overselling —');
ok(!/analyzing your swing metrics, faults, and improvement trends/.test(html),
   'the old promise is gone — two thirds of it was gated behind floors nobody had been told about');
ok(/10 shots behind it/.test(html), 'the replacement names the floor');
ok(/need no\s+launch monitor|no\s+launch monitor and work right now/.test(html.replace(/\s+/g, ' ')),
   'and points at what works with no data at all');

store.removeItem('slSeenIntro');
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
