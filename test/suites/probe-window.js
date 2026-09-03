const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { RetentionProbe: RP, SmartRecommendations: SR } = R.app;
const store = R.window.localStorage;
const reset = () => { store.removeItem('slProbes'); store.removeItem('slPracticeLog'); };

// A probe is answerable between MIN_GAP_HOURS and MAX_GAP_DAYS. That window was
// written down correctly in due() and never applied to openProbes(), so a probe
// nothing could settle sat permanently at the top of the app's ONE ranked
// recommendation, telling the golfer to re-test a club in a window that had
// already closed. The usual defect here: a rule with working code that the
// surface a golfer reads never reaches.

const H = 36e5, DAY = 864e5;
const now = Date.now();
const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 118, clubSpeed: 85, smashFactor: 1.38,
  launchAngle: 17, attackAngle: -3, carryDistance: 160, ...o });
// The club matters: RetentionProbe.open filters the session's shots by the
// fault's club and refuses when there are too few, so a driver probe needs a
// session with drivers in it.
const sessAt = (ms, club = '7i') => ({ id: 'S' + ms, date: new Date(ms).toISOString(),
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' },
  shots: Array.from({ length: 12 }, () => shot({ clubType: club })) });
const openAt = ms => RP.open(sessAt(ms), { id: 'low-point', clubType: '7i', name: 'Low point', metric: 'smashFactor' });

console.log('— the window is three-valued, and "early" is not a failure —');
reset();
ok(RP.windowState(openAt(now - 2 * H)) === 'early',
   'two hours old is EARLY — the gap IS the method, and 24 hours is the whole point of the retention literature');
reset();
ok(RP.windowState(openAt(now - 3 * DAY)) === 'open', 'three days old is answerable');
reset();
ok(RP.windowState(openAt(now - 20 * DAY)) === 'expired', 'twenty days old is past the window');
ok(RP.windowState(null) === 'expired', 'a missing probe is not answerable');
ok(RP.windowState({}) === 'expired', 'nor is one with no open time');

console.log('— days left rounds UP —');
reset();
const p30h = openAt(now - (RP.MAX_GAP_DAYS * DAY - 30 * H));
ok(RP.daysLeft(p30h) === 2,
   'with 30 hours to go it says 2 days — the golfer has today and tomorrow, and "1 day" would send them home');
reset();
ok(RP.daysLeft(openAt(now - 20 * DAY)) === 0, 'past the window there are no days left');

console.log('— openProbes() no longer hands back what nothing can settle —');
reset();
openAt(now - 20 * DAY);
openAt(now - 3 * DAY);
ok(RP.allOpen().length >= 1, 'the raw list is still reachable for a caller that wants it');
const live = RP.openProbes();
ok(live.every(p => RP.windowState(p) !== 'expired'),
   'but openProbes returns only what is still answerable');

console.log('— an expired probe is kept, not deleted —');
reset();
openAt(now - 20 * DAY);
ok(RP.expired().length === 0, 'nothing expired until something looks');
RP.openProbes();
ok(RP.expired().length === 1,
   'it is marked expired and KEPT — an efficacy metric that silently drops its own misses reports a better hit rate than it earned');
ok(RP.allOpen().length === 0, 'and is no longer open');
ok(Number.isFinite(RP.expired()[0].expiredAt), 'with the time it lapsed, so a UI can stop mentioning it eventually');
ok(RP.expireStale() === 0, 'expiring twice is a no-op');

console.log('— the deadline is said out loud —');
reset();
ok(/day.s gap/i.test(RP.deadline(openAt(now - 2 * H))), 'an early probe explains the gap rather than nagging');
reset();
ok(/Last day/i.test(RP.deadline(openAt(now - (RP.MAX_GAP_DAYS * DAY - 2 * H)))), 'the last day says so');
reset();
ok(/\d+ days left/.test(RP.deadline(openAt(now - 2 * DAY))), 'otherwise it counts down');
reset();
ok(/expired/i.test(RP.deadline(openAt(now - 20 * DAY))), 'and a closed window says it is closed');

console.log('— the one ranked recommendation stops asking for the impossible —');
reset();
openAt(now - 20 * DAY);
const stale = SR.getNextStep([sessAt(now)]);
ok(stale.type !== 'probe',
   'an expired probe no longer sits at the top of the one card, asking for a re-test nothing could settle');
reset();
openAt(now - 2 * H);
ok(SR.getNextStep([sessAt(now)]).type !== 'probe',
   'nor does one that is not answerable yet — telling someone to go hit balls today is wrong when the method needs a day');
reset();
openAt(now - 3 * DAY);
const live1 = SR.getNextStep([sessAt(now)]);
ok(live1.type === 'probe', 'a live one does rank first');
ok(/days left/i.test(live1.title), 'and the title carries the countdown');
ok(typeof live1.deadline === 'string' && live1.deadline.length > 5, 'with the deadline on the card');

console.log('— the soonest deadline wins —');
reset();
ok(!!RP.open(sessAt(now - 9 * DAY, 'd'), { id: 'a', clubType: 'd',  name: 'A', metric: 'smashFactor' }),
   'a driver probe opens off a driver session');
ok(!!RP.open(sessAt(now - 2 * DAY, '7i'), { id: 'b', clubType: '7i', name: 'B', metric: 'smashFactor' }),
   'and a 7-iron one off a 7-iron session');
const soonest = SR.getNextStep([sessAt(now)]);
ok(/Driver/i.test(soonest.title),
   'the probe closest to expiring is offered first — they expire independently, and the other one will still be there tomorrow');
ok(/Last day/i.test(soonest.title), 'and it is flagged as the last day');

reset();
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
