const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// A yardage card lives in a golf bag and outlives the screen it came from.
// Anything not printed is gone — on screen a caveat is a paragraph you can
// scroll back to, on paper it either printed or it did not.

const print = css.slice(css.indexOf('@media print'));
ok(print.length > 200, 'there is a print stylesheet');

console.log('— the caveats travel with the card —');
ok(/id="yardagePrintHead"/.test(html), 'the printed card has a header block');
ok(/class="print-only"/.test(html), 'which is hidden on screen');
ok(/\.print-only\s*\{\s*display:\s*none/.test(css), '  …by default');
ok(/\.print-only\s*\{\s*display:\s*block/.test(print), '  …and shown only when printing');

const head = src.slice(src.indexOf("const printHead = document.getElementById('yardagePrintHead')"),
                       src.indexOf("document.getElementById('printYardages')"));
ok(/main\.ball\.label/.test(head) && /main\.surface\.label/.test(head),
   'the card names the ball and surface it was built on — "230 · 7i" with no ball on it is the artefact this app refuses everywhere else');
ok(/modelled by the monitor/.test(head),
   'and says carry is modelled, not measured');
ok(/MIN_SHOTS_REPORT/.test(head), 'and states the sample floor');
ok(/dispersionValid/.test(head) && /ORDER of the clubs as real/.test(head),
   'and off range balls says the order is real and the distances are not');
ok(/Printed \$\{Sanitize\.escape\(formatDate/.test(head),
   'it is dated, because a card in a bag is read months after it was printed');
ok(/session\$\{used\.length > 1/.test(head) && /totalShots/.test(head),
   'and carries how much data is behind it');

console.log('— nothing but the book goes on the paper —');
for (const sel of ['.bottom-nav', '.no-print', '#drillFinderHost', '#recordsGrid', '.modal-overlay']) {
  ok(print.includes(sel), `${sel} is hidden when printing`);
}
ok(/\.view:not\(#view-yardages\)\s*\{\s*display:\s*none/.test(print),
   'and every other view — a print of a single-page app prints all of it otherwise');
ok(/id="printYardages"[^>]*class|class="[^"]*no-print[^"]*"[^>]*id="printYardages"/.test(html) ||
   /class="btn-secondary no-print" id="printYardages"/.test(html),
   'the print button itself does not print');

console.log('— it prints in ink, whatever the screen theme was —');
ok(/background:\s*#fff\s*!important/.test(print) && /color:\s*#000\s*!important/.test(print),
   'a dark theme sent to a printer is a solid black page, so the card forces ink on paper');

console.log('— what is meaningless in one colour is dropped —');
ok(/\.yard-spark\s*\{\s*display:\s*none/.test(print),
   'the sparkline goes — a trend line has no scale on a card and the verdict text already says it');
ok(/\.club-dot\s*\{\s*display:\s*none/.test(print), 'so does the colour key');

console.log('— clubs under the floor KEEP their row —');
// On paper a missing row reads as "you do not have that club". The row saying
// what it needs is the more useful artefact, and it is already what the table
// renders, so the print path must not filter.
ok(!/yard-thin[^\n]*display:\s*none/.test(print),
   'the under-floor rows are not hidden when printing — a missing row on paper reads as a club you do not own');

console.log('— and it is actually reachable —');
ok(/window\.print\(\)/.test(src), 'the button calls the browser print dialog');
ok(/getElementById\('printYardages'\)/.test(src), 'and is wired');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
