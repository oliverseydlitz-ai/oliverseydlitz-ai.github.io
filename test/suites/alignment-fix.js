const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Store, MemDB, Conditions: C, Dispersion: D, Metrics } = R.app;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');

// The alignment checkbox only exists during import. A golfer who levelled the
// unit and forgot to tick it had no route back, and the app went on withholding
// the absolute miss from data that could support it, forever, with no way to
// say so. The caveat named what was withheld and offered no way to answer it.

const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 150, clubSpeed: 104, smashFactor: 1.44,
  launchAngle: 12, attackAngle: 1, carryDistance: 250, launchDirection: 2, sideCarry: 8, ...o });
const mk = (id, alignment) => ({ id, date: '2026-08-01',
  conditions: { ball: 'premium', surface: 'grass', alignment },
  shots: Array.from({ length: 40 }, (_, i) => shot({ _row: i + 2, launchDirection: 2 + (i % 7) - 3 })) });

(async () => {
  console.log('— the flag can be corrected in both directions —');
  MemDB.saveSession(mk('a', 'unknown'));
  ok(C.aligned(await Store.getSession('a')) === false, 'starts unaligned');
  await Store.setAlignment('a', true);
  ok(C.aligned(await Store.getSession('a')) === true, 'and can be confirmed after the fact');
  await Store.setAlignment('a', false);
  ok(C.aligned(await Store.getSession('a')) === false,
     'and withdrawn again — a falsely-confirmed alignment is the most expensive wrong flag in the file, so it must be reversible');
  ok(await Store.setAlignment('nope', true) === null, 'an unknown id is survivable');

  console.log('— it RE-STAMPS, which is the whole reason it is one function —');
  // Every gate downstream reads `_aligned` off the SHOT, not the session, so
  // changing the session alone would leave the flag right in storage and wrong
  // in every calculation.
  const s = await Store.setAlignment('a', true);
  ok(s.shots.every(x => x._aligned === true), 'every shot carries the new flag');
  ok(C.aligned(s.shots) === true, 'so a shot-level check agrees with the session');
  const off = await Store.setAlignment('a', false);
  ok(off.shots.every(x => x._aligned === false), 'and back again');

  console.log('— and it changes what the app will actually say —');
  await Store.setAlignment('a', false);
  const unaligned = D.tail(Store.stamp(await Store.getSession('a')).shots, 'd');
  ok(unaligned.ok === true, 'the tail computes either way');
  ok(unaligned.bias === null,
     'the absolute miss is withheld while unaligned — the centre is wherever the unit happened to point');
  ok(Number.isFinite(unaligned.sigma), 'but the SPREAD survives, because a constant offset cancels out of it');

  await Store.setAlignment('a', true);
  const alignedT = D.tail(Store.stamp(await Store.getSession('a')).shots, 'd');
  ok(Number.isFinite(alignedT.bias), 'confirming it releases the absolute miss');
  ok(Math.abs(alignedT.sigma - unaligned.sigma) < 1e-9,
     'and does NOT change the spread by a hair — that is the point of the asymmetry, not a coincidence');

  console.log('— the sample floor moves with it —');
  await Store.setAlignment('a', false);
  ok(C.startLineFloor(await Store.getSession('a')) === Metrics.MIN_SHOTS_TAIL,
     `unaligned, a start-line claim needs ${Metrics.MIN_SHOTS_TAIL} shots`);
  await Store.setAlignment('a', true);
  ok(C.startLineFloor(await Store.getSession('a')) === Metrics.MIN_SHOTS_REPORT,
     `confirmed, it needs ${Metrics.MIN_SHOTS_REPORT}`);

  console.log('— it is not a silent toggle —');
  const ui = src.slice(src.indexOf('fixAlignment'), src.indexOf('fixAlignment') + 3000);
  ok(/showConfirm\(/.test(ui), 'it goes through a confirm — this is a claim about what happened on a day');
  ok(/bias/i.test(ui) && /more shots will not remove it/i.test(ui),
     'and the confirm states the cost of getting it wrong: bias is the error more shots cannot remove');
  ok(/10 shots instead of 30|instead of 30/.test(ui), 'and what confirming actually unlocks');

  console.log('— only ONE thing writes this flag —');
  const writes = src.split('alignment:').length - 1;
  ok(writes <= 3, `the alignment field is written in few places (${writes})`);
  ok((src.split('setAlignment').length - 1) >= 2, 'and the correction goes through Store.setAlignment');
  ok(/stamp\(sn\);\n    await saveSession/.test(src),
     'which stamps before it saves — the ordering is the bug this would otherwise have');

  console.log('— the dead end is gone —');
  ok(/you can say so at the top of this page/.test(src),
     'the withheld-bias note points at the control instead of just naming what is missing');

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exit(fail ? 1 : 0);
})();
