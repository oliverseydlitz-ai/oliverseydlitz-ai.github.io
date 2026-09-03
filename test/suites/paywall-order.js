const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');

// `applyPaywall` reassigns the block's innerHTML. Every listener already
// attached to that block is thrown away with the old nodes — no error, no log
// line, just controls that quietly stop working for signed-out users only.
//
// Two renders had it the wrong way round: fault cards would not expand for a
// guest, and the practice plan's tick-off buttons recorded nothing. Both looked
// completely live. This is the same class of defect as setting `hidden` on a
// section that gets re-rendered, and it is invisible to every other check here
// because the DOM is well-formed and the code is correct in isolation.
//
// The rule: applyPaywall goes FIRST, and listeners attach only when it returns
// false. The return value exists for exactly this.

const lines = src.split('\n');
const calls = [];
lines.forEach((l, i) => { if (/\bapplyPaywall\s*\(/.test(l) && !/^function applyPaywall/.test(l.trim())) calls.push(i); });

ok(calls.length >= 4, `there are applyPaywall call sites to check (${calls.length})`);

// For each call, look BACK to the start of its enclosing render function — the
// nearest preceding line that declares one — and fail if a listener was
// attached in between. Crude on purpose: a false positive here is a render
// that should be restructured anyway.
const FN_START = /^\s{2,4}(?:async\s+)?function\s+\w+\s*\(|^function\s+\w+\s*\(/;

for (const at of calls) {
  let start = 0;
  for (let i = at - 1; i >= 0; i--) { if (FN_START.test(lines[i])) { start = i; break; } }
  const fnName = (lines[start].match(/function\s+(\w+)/) || [, '(top level)'])[1];
  const before = lines.slice(start, at);
  const listener = before.findIndex(l => /addEventListener\s*\(/.test(l) && !/^\s*\/\//.test(l));
  ok(listener === -1,
     `${fnName}: no listener is attached before its applyPaywall — otherwise a signed-out user gets ` +
     `a control that looks live and does nothing` +
     (listener === -1 ? '' : ` (line ${start + listener + 1})`));
}

console.log('— and the two that were wrong stay fixed —');
const faults = src.slice(src.indexOf('function renderFaultCards'));
const faultBody = faults.slice(0, faults.indexOf('\n  function '));
ok(faultBody.indexOf('applyPaywall') < faultBody.indexOf('addEventListener'),
   'renderFaultCards paywalls before it wires the expanders');
ok(/if \(applyPaywall\([^)]*\)\) return;/.test(faultBody),
   '  …and returns early rather than wiring listeners onto discarded nodes');

const plan = src.slice(src.indexOf('function renderPracticePlan'));
const planBody = plan.slice(0, plan.indexOf('\n  // ── Club filter'));
ok(planBody.indexOf('applyPaywall') < planBody.indexOf('addEventListener'),
   'renderPracticePlan paywalls before it wires the tick-off buttons');
ok(/if \(applyPaywall\([^)]*\)\) return;/.test(planBody),
   '  …and returns early too');

console.log('— and applyPaywall says why it must go first —');
const fn = src.slice(src.indexOf('function applyPaywall') - 1200, src.indexOf('function applyPaywall'));
ok(/destroys every listener/i.test(fn),
   'the hazard is written where the next person will read it, not only in a test');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
