// ── Confirm buttons say what they do; information is not a decision (V37) ──
//
// Every confirm button read "Confirm", and a drill description was shown in
// the red destructive dialog, ending on a "Confirm" that went somewhere the
// text never mentioned. Now: each showConfirm call passes a verb, only a
// destructive action gets the red button, and showInfo is the plain dialog.
const fs = require('fs'), path = require('path');
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const w = R.window, doc = w.document;

// Balanced-paren scan of every showConfirm( call, comments stripped.
const src = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const calls = [];
for (let i = src.indexOf('showConfirm('); i !== -1; i = src.indexOf('showConfirm(', i + 1)) {
  if (/function\s+$/.test(src.slice(Math.max(0, i - 10), i))) continue;
  let d = 0, j = i + 'showConfirm'.length;
  for (; j < src.length; j++) { if (src[j] === '(') d++; else if (src[j] === ')' && --d === 0) break; }
  calls.push(src.slice(i, j + 1));
}
ok(calls.length >= 7, `found the confirm call sites (${calls.length})`);
const bare = calls.filter(c => !/okLabel\s*:/.test(c));
ok(bare.length === 0, 'every showConfirm call names its action' + (bare.length ? ': ' + bare.map(c => c.slice(0, 60)).join(' | ') : ''));
ok(/showInfo\(`\$\{w\.name\}`/.test(src), 'the range wrapper description goes through showInfo, not the confirm');

const okBtn = doc.getElementById('confirmOk'), cancel = doc.getElementById('confirmCancel');
const modal = doc.getElementById('confirmModal'), body = doc.getElementById('confirmBody');

let went = 0;
R.app.showInfo('Faded feedback', 'First line.\n\nSecond paragraph.', { okLabel: 'Open the drill library', onOk: () => went++ });
ok(!modal.hidden && okBtn.textContent === 'Open the drill library', 'info with an onward action names where it goes');
ok(okBtn.className === 'btn-primary', 'info is not painted as destructive');
ok(cancel.textContent === 'Close' && !cancel.hidden, 'and its dismiss says Close');
ok(body.textContent.includes('\n\n'), 'the paragraph break reaches the dialog');
okBtn.click();
ok(went === 1 && modal.hidden, 'the onward action runs and the dialog closes');

R.app.showInfo('Just so you know', 'Nothing to do.');
ok(okBtn.textContent === 'Close' && cancel.hidden, 'plain info has one button, Close');
okBtn.click();

R.app.showConfirm('Delete session?', 'This cannot be undone.', () => {}, { okLabel: 'Delete session' });
ok(okBtn.className === 'btn-danger' && okBtn.textContent === 'Delete session', 'a deletion keeps the red button, with its verb');
ok(!cancel.hidden && cancel.textContent === 'Cancel', 'the previous info dialog left nothing behind');
cancel.click();
ok(okBtn.textContent === 'Confirm' && okBtn.className === 'btn-danger', 'closing resets label and colour');

const css = fs.readFileSync(path.join(__dirname, '../../style.css'), 'utf8');
ok(/#confirmBody\s*\{[^}]*white-space:\s*pre-line/.test(css), 'the confirm body keeps line breaks (pre-line)');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exitCode = fail ? 1 : 0;
