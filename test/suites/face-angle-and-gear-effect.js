const M=require('../harness.js').load();
let fail=0; const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c)fail++;};
const near=(a,b,t=0.02)=>Math.abs(a-b)<=t;

console.log('— reproduces the document\'s worked example —');
// 7-iron, w=0.75, path +4.0, launch +2.0 -> face +1.33 open
const shot={clubType:'7i',launchDirection:2.0,clubPath:4.0,launchAngle:17.25,attackAngle:-3.0};
const R=M.faceRatio(shot);
const expected=(2.0-(1-R)*4.0)/R;
ok(near(M.faceAngle(shot),expected), `face angle inverts the D-plane (${M.faceAngle(shot).toFixed(2)}° at R=${R.toFixed(3)})`);
const at075={clubType:'7i',launchDirection:2.0,clubPath:4.0};   // no spin loft -> club's own tour spin loft
ok(near(M.faceRatio(at075),0.78,0.005), `without spin loft, uses the 7-iron's OWN tour spin loft (${M.faceRatio(at075).toFixed(4)})`);

console.log('— per-club R covers the whole bag, monotonic with loft —');
const bag=['d','3w','5w','4h','3i','5i','7i','9i','pw','sw','lw'].map(c=>({c,R:M.faceRatio(c)}));
ok(bag.every(x=>Number.isFinite(x.R)), 'every club resolves');
ok(bag.every((x,i)=>i===0||x.R<=bag[i-1].R+1e-9), 'R falls monotonically as loft rises');
ok(bag.every(x=>x.R>=0.71-1e-9 && x.R<=0.84+1e-9), 'and never leaves the measured range [0.71, 0.84]');
ok(Math.abs(M.faceRatio('d')-0.84)<1e-9 && Math.abs(M.faceRatio('pw')-0.71)<1e-9,
   'driver and PW sit exactly on their measured anchors');

console.log('— face angle and face-to-path stay consistent by construction —');
for (const c of ['d','7i','pw']) {
  const t={clubType:c,launchDirection:3.2,clubPath:-1.4,launchAngle:20,attackAngle:-3};
  ok(near(M.faceAngle(t)-t.clubPath, M.facePath(t)), `${c}: faceAngle - path === facePath`);
}

console.log('— R is clamped to the measured anchors —');
const wedge={clubType:'sw',launchDirection:1,clubPath:0,launchAngle:38,attackAngle:-6};
ok(M.faceRatio(wedge)>=0.70, `high-loft R floored at 0.70 (got ${M.faceRatio(wedge).toFixed(3)})`);
const lowLoft={clubType:'d',launchDirection:1,clubPath:0,launchAngle:8,attackAngle:2};
ok(M.faceRatio(lowLoft)<=0.85, `low-loft R capped at 0.85 (got ${M.faceRatio(lowLoft).toFixed(3)})`);

console.log('— gear effect: detectable only when spin axis is measured —');
const base={clubType:'7i',launchDirection:2,clubPath:0,launchAngle:17,attackAngle:-3.5,_ball:'rpt'};
ok(M.gearEffectSuspected({...base,_ball:'premium',spinAxis:-20})===null, 'not flagged without an RPT ball');
ok(M.gearEffectSuspected({...base,spinAxis:M.spinAxisFrom(base)})===null, 'clean strike: axis matches prediction, no flag');
const toe=M.gearEffectSuspected({...base,spinAxis:M.spinAxisFrom(base)-12});
ok(toe && toe.likely==='toe', `excess draw spin flagged as a toe strike (${toe && toe.residual.toFixed(1)}°)`);
const heel=M.gearEffectSuspected({...base,spinAxis:M.spinAxisFrom(base)+12});
ok(heel && heel.likely==='heel', 'excess fade spin flagged as a heel strike');
ok(toe && /face angle derived from this shot will be off/i.test(toe.note), 'and says the derivation is invalid for that shot');
ok(toe.source==='screen', 'with no peer shots it falls back to the loose screen');
ok(/would let this be measured against your own spread/.test(toe.note), 'and says what would replace it');

// The 5-degree screen was an honest guess and it was wrong in both directions
// at once: too tight for a golfer whose derivation runs noisy, so ordinary
// shots read as mis-hits, and too loose for a consistent striker, whose real
// toe strike sat under it and passed as clean.
console.log('— the threshold comes from the golfer\'s own residuals when there are enough —');
// A golfer whose residuals sit wide: a 6-degree deviation is an ordinary shot.
const peers = (spread, n = 14, offset = 0) => Array.from({ length: n }, (_, i) => {
  const sh = { ...base, launchDirection: 2 };
  return { ...sh, spinAxis: M.spinAxisFrom(sh) + offset + spread * ((i % 2 ? 1 : -1) + (i % 3 - 1) * 0.4) };
});
const wide = peers(8);
const ordinaryForThem = { ...base, spinAxis: M.spinAxisFrom(base) + 6 };
ok(M.gearThreshold(wide, '7i').source === 'personal', `14 shots is enough to use their own spread`);
ok(M.gearThreshold(wide, '7i').cut > 5, 'a noisy golfer gets a WIDER bar than the old screen');
ok(M.gearEffectSuspected(ordinaryForThem, wide) === null,
   'so a 6-degree deviation that is ordinary for them is no longer called a mis-hit');

const tight = peers(0.6);
ok(M.gearThreshold(tight, '7i').cut < 5, 'a consistent striker gets a TIGHTER bar than the old screen');
const realMiss = { ...base, spinAxis: M.spinAxisFrom(base) + 4 };
ok(M.gearEffectSuspected(realMiss, tight) !== null,
   'so a 4-degree deviation that is genuinely unusual for them is caught, where the 5-degree screen missed it');
ok(M.gearEffectSuspected(realMiss, []) === null, 'the same shot passes the old screen — that was the bug');
ok(/against your own 14 shots/.test(M.gearEffectSuspected(realMiss, tight).note),
   'and the note says the bar is theirs');

console.log('— it centres on their own median, not on zero —');
// A systematic offset in the derivation is a property of the model and the
// club, not of any one strike. Anchoring at zero flags every shot.
const offsetPeers = peers(0.6, 14, 9);
ok(M.gearThreshold(offsetPeers, '7i').centre > 6, 'a consistent 9-degree offset is read as the centre');
const typicalForOffset = { ...base, spinAxis: M.spinAxisFrom(base) + 9 };
ok(M.gearEffectSuspected(typicalForOffset, offsetPeers) === null,
   'so a shot sitting right on that offset is not flagged, though it is 9 degrees from zero');
ok(M.gearEffectSuspected(typicalForOffset, []) !== null, 'while the old zero-anchored screen flagged it');

console.log('— under the floor it says which bar it used —');
ok(M.gearThreshold(peers(1, 4), '7i').source === 'screen', `under ${M.Metrics.MIN_SHOTS_REPORT} shots it will not use their spread`);
console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
