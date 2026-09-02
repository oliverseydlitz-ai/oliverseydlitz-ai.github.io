const M=require('../harness.js').load();
let fail=0; const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c)fail++;};
const sess=n=>({shots:Array.from({length:12},()=>({clubType:'d',clubSpeed:100+Math.random()*2}))});

console.log('— every ± comes from the golfer, never a population figure —');
ok(M.Metrics.DEVICE_ERROR===0, 'device error is zero in the model');
const iv=M.Metrics.interval([0.4,0.6,0.3,0.5,0.4,0.6],'',1);
ok(iv && iv.ci>0, `interval is computed from the supplied shots (± ${iv.ci.toFixed(2)})`);
const tight=M.Metrics.interval([0.4,0.5,0.4,0.5,0.4,0.5],'',1);
const loose=M.Metrics.interval([-2,3,-1.5,2.5,-1,2],'',1);
ok(loose.ci > tight.ci*3, `a scattered golfer gets a wider ± than a tight one (${tight.ci.toFixed(2)} vs ${loose.ci.toFixed(2)})`);

console.log('— change verdicts refuse to borrow someone else\'s variability —');
const thin=M.Metrics.changeIsReal('clubSpeed', 3, 10, [sess(),sess()], 'd');
ok(thin.real===null && thin.source==='insufficient-history',
   'too little history -> "cannot say yet", not a population fallback');
ok(/more session/.test(thin.note||''), `and says what it needs: "${thin.note}"`);
const rich=M.Metrics.changeIsReal('clubSpeed', 3, 10, [sess(),sess(),sess(),sess(),sess()], 'd');
ok(rich.source==='personal' && typeof rich.real==='boolean', 'enough history -> judged on the golfer\'s own error');

console.log('— R is geometry, and survives zeroing measurement error —');
ok(Math.abs(M.faceRatio('7i')-0.78)<0.005 && Math.abs(M.faceRatio('pw')-0.71)<1e-9,
   `face-contribution ratio still applied per club (7i ${M.faceRatio('7i').toFixed(3)}, pw ${M.faceRatio('pw').toFixed(3)})`);
const naive = 4 - (-2), corrected = M.facePath({clubType:'7i',launchDirection:4,clubPath:-2});
ok(corrected > naive, `launch direction is still converted to a face estimate, not used raw (${naive} -> ${corrected.toFixed(2)}°)`);

console.log('— published error rates are reference-only —');
ok(M.Metrics.MDC_N10.clubSpeed===2.0, 'the population table is still there for reference');
const src=require('fs').readFileSync(require('path').join(__dirname,'..','..','app.js'),'utf8');
ok(/REFERENCE ONLY — never used to compute a \+\/- shown to the golfer/.test(src), 'and is labelled as never entering a ±');
ok(/const MeasurementReference/.test(src) && /No error data exists, from any source/.test(src),
   'Settings document exposes them, including which were never measured');
console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
