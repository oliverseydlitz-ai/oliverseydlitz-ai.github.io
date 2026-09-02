const M=require('../harness.js').load();
let fail=0; const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c)fail++;};
const sess=(ball,n=12,spin=3200)=>({conditions:{ball,surface:'grass'},
  shots:Array.from({length:n},()=>({clubType:'d',spinRate:spin+Math.round((Math.random()-0.5)*300),_ball:ball}))});

console.log('— spin is a reading only with an RPT ball —');
ok(M.Spin.measured(sess('rpt'))===true, 'RPT session: spin measured');
ok(M.Spin.measured(sess('range'))===false, 'range balls: NOT measured');
ok(M.Spin.measured(sess('premium'))===false, 'even your own premium ball: NOT measured');
ok(M.Spin.measured({_ball:'rpt'})===true, 'works off a single stamped shot too');
ok(M.Spin.measured(undefined)===false, 'unknown provenance defaults to not measured');

console.log('— summaries suppress rather than invent —');
ok(M.Spin.summary(sess('range'))===null, 'no summary at all for range balls');
ok(M.Spin.summary(sess('premium'))===null, 'no summary for premium either');
const sum=M.Spin.summary(sess('rpt'));
ok(sum && sum.n>=10, `RPT session gives a summary (${sum && sum.n} shots)`);
ok(sum && /±/.test(sum.text), `and reports an interval: "${sum && sum.text}"`);
ok(sum && sum.mdc===undefined, 'carries no population MDC');
ok(sum && sum.spread>0, `carries the spread of THIS session's spin values instead (±${sum && Math.round(sum.spread)} rpm)`);
ok(M.Spin.summary(sess('rpt',2))===null, 'too few shots -> no summary');

console.log('— the two caveats say different things —');
ok(/RPT ball/.test(M.Spin.CHANGE_CAVEAT) && /not a number to track between sessions/.test(M.Spin.CHANGE_CAVEAT),
   'measured case: accurate today, still not a trend');
ok(/only measured with a Rapsodo RPT ball/.test(M.Spin.NOT_MEASURED), 'unmeasured case says why');
ok(/Spin loft/.test(M.Spin.ALTERNATIVE), 'and points at spin loft as the actionable route');

console.log('— still no spin PRESCRIPTION, on any ball —');
const H='Club Type,Ball Speed,Club Speed,Smash Factor,Launch Angle,Launch Direction,Carry Distance,Side Carry,Attack Angle,Club Path,Spin Axis,Spin Rate';
const rows=[H]; for(let i=0;i<20;i++) rows.push('d,150,110,1.30,12,1,225,5,-4.5,-3.0,18,4600');
const noBall=M.CSVParser.parse(rows.join('\n'));                       // unstamped = provenance unknown
const rpt=noBall.map(s=>({...s,_ball:'rpt'}));
const fA=M.FaultEngine.detectFaults(noBall), fB=M.FaultEngine.detectFaults(rpt);
ok(!fA.some(x=>/spin rate|excessive spin/i.test(x.name)), 'no spin-RATE fault on any ball (biology, not device)');
ok(!fB.some(x=>/spin rate|excessive spin/i.test(x.name)), 'not even with an RPT ball');
ok(!fA.some(x=>x.id==='high-spin-axis'), 'spin-AXIS fault suppressed without an RPT ball');
ok(fB.some(x=>x.id==='high-spin-axis'), 'spin-axis fault allowed once the ball makes it a reading');
ok(fA.some(x=>x.id==='high-spin-loft'), 'spin LOFT still fires regardless — derived from tier-2 metrics');
ok(M.Metrics.tier('spinRate')===3, 'spin stays tier 3 even with RPT — between-session ICC 0.02');
// Spin.summary was thoroughly tested above and called by NOTHING. The app told
// RPT users "spin is measured here because you used an RPT ball" and then never
// showed a session figure anywhere — the caveat without the number it
// qualifies. It renders in the caveat block now.
console.log('— and the reading is actually shown when it is one —');
ok(/varies more/.test(M.Spin.CHANGE_CAVEAT),
   'the sentence that must travel with any spin figure says it does not track between sessions');
const shown = M.Spin.summary(sess('rpt'));
ok(shown.enoughForMean === true, `a 12-shot RPT session clears the ${M.Metrics.MIN_SHOTS_REPORT}-shot floor`);
ok(M.Spin.summary(sess('rpt', 5)).enoughForMean === false,
   'five shots gives an interval but is flagged as under the floor for a mean');
ok(/rpm/.test(shown.text), 'and the text carries its unit, so it can be dropped straight into the caveat line');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
