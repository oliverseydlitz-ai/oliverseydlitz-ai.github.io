const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { CSVParser } = M;

const csv = rows => rows.map(r => r.join(',')).join('\n');
const HDR = ['Club Type','Ball Speed','Carry Distance','Club Speed','Smash Factor','Club Path','Attack Angle'];
const good = csv([HDR, ['7i','82','150','60','1.36','-1.2','-4.0'], ['7i','80','147','59','1.35','-0.8','-3.6']]);

const threw = fn => { try { fn(); return null; } catch (e) { return e.message; } };

console.log('— a real export parses —');
const shots = CSVParser.parse(good);
ok(shots.length === 2, 'both rows come through');
ok(shots[0].clubType === '7i' && shots[0].ballSpeed === 82, 'columns map onto fields');
ok(shots[0]._row === 2, 'and the row number is kept for tracing a bad cell back');

console.log('— the wrong CSV is refused at the door, not imported as nothing —');
// Papa parses any CSV happily. Without a format check, none of the columns
// matched, every shot came back holding only its row number, and the preview
// cheerfully offered to save "48 shots, 1 club" of dashes.
const wrong = csv([['Date','Amount','Merchant'], ['2026-01-02','12.40','Coffee']]);
const e1 = threw(() => CSVParser.parse(wrong));
ok(e1 !== null, 'a bank statement does not parse as a golf session');
ok(/does not look like a Rapsodo export/.test(e1), 'and is named as the wrong file, not a parse error');
ok(/none of its 3 columns match/.test(e1), 'saying that nothing matched');
ok(/Rapsodo Cloud/.test(e1), 'and where the right file comes from');

console.log('— a partial match says so, because that is the confusing case —');
const partial = csv([['Club Type','Apex','Spin Rate'], ['7i','30','6200']]);
const e2 = threw(() => CSVParser.parse(partial));
ok(/no Ball Speed column/.test(e2), 'it names the column that is missing');
ok(/other columns did match/.test(e2), 'and admits the file was close, rather than calling it unrecognised');

console.log('— right columns, no readings —');
const emptyRows = csv([HDR, ['7i','','','','','',''], ['7i','','','','','','']]);
const e3 = threw(() => CSVParser.parse(emptyRows));
ok(/none of the 2 rows has a ball speed/.test(e3),
   'a session exported before anything was hit is refused rather than saved as an empty session');
ok(/nothing to analyse/.test(e3), 'and says what the consequence would have been');

console.log('— an empty file —');
ok(/no rows in it/.test(threw(() => CSVParser.parse('Club Type,Ball Speed'))), 'headers with no rows is refused');

console.log('— a blank cell is still not a zero —');
const gap = csv([HDR, ['7i','82','150','60','1.36','',''], ['7i','80','147','59','1.35','-0.8','-3.6']]);
const g = CSVParser.parse(gap);
ok(g[0].clubPath === null && g[0].attackAngle === null,
   'missing club data stays null, so nothing downstream scores it as a perfect zero');
ok(g[1].clubPath === -0.8, 'while a recorded value comes through');

console.log('— and the CSV the app writes back out —');
// There were two CSV writers with different column orders, one inline in the
// export button and one in SessionSharing, and NEITHER escaped anything. Notes
// are free text: a comma silently shifted every later column by one, and a
// double quote broke the row outright. An export is the one artefact a golfer
// takes somewhere else, so a corrupt one is worse than none.
const { SessionSharing: SS, Store } = M;
ok(SS.csvCell('plain') === 'plain', 'an ordinary value is not quoted');
ok(SS.csvCell('a,b') === '"a,b"', 'a comma forces quoting');
ok(SS.csvCell('say "hi"') === '"say ""hi"""', 'a double quote is doubled and the cell quoted');
ok(SS.csvCell('two\nlines') === '"two\nlines"', 'so is a newline');
ok(SS.csvCell(null) === '' && SS.csvCell(undefined) === '', 'null and undefined write an empty cell, not "null"');
ok(SS.csvCell(0) === '0', 'and a real zero survives');

const sess = (notes, ball) => Store.stamp({
  id: 'x', date: '2026-05-01', notes, conditions: { ball, surface: 'grass' },
  shots: [{ clubType: '7i', ballSpeed: 80, clubSpeed: 60, smashFactor: 1.33,
            launchAngle: 18, attackAngle: -4, clubPath: -1, carryDistance: 150,
            totalDistance: 158, sideCarry: 3, spinRate: 6200 }],
});
const nasty = SS.toCSV([sess('Windy, gusty — said "keep it low"', 'premium')]);
const lines = nasty.trim().split('\n');
ok(lines.length === 2, 'one header and one row');
ok(/""keep it low""/.test(nasty), 'the embedded quotes are escaped, not passed through');
ok(/"Windy, gusty/.test(nasty), 'and the comma is inside a quoted cell rather than adding a column');

console.log('— spin does not leave the app without an RPT ball —');
ok(!/6200/.test(SS.toCSV([sess('n', 'premium')])),
   'a premium-ball session exports no spin figure: the device never measured it');
ok(/6200/.test(SS.toCSV([sess('n', 'rpt')])), 'an RPT session does');
ok(/Ball,Surface,Notes/.test(SS.toCSV([sess('n','rpt')])),
   'and the conditions travel with the file, since none of the app caveats do');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
