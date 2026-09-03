const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { FeedbackEngine: FE, DrillLibrary: DL, PracticePlan: PP } = R.app;
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');
const htmlRaw = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
// Strip HTML comments before scanning. The comment explaining what the removed
// setting WAS legitimately contains its name, and a check that matches its own
// explanation is a check that can never pass — this codebase has been caught by
// that exact shape twice before.
const html = htmlRaw.replace(/<!--[\s\S]*?-->/g, '');

// This app used to own a setting called "when to show your numbers" that hid
// the figures in its OWN shot table until you tapped each row, citing the
// guidance hypothesis. The finding is real. The placement was not.
//
// The mechanism is about knowledge of results DURING ACQUISITION — while the
// reps are happening. By the time a shot reaches this app it was hit at a
// range in front of a monitor that displayed every number on the spot, and the
// session is over. Hiding it afterwards reduces nothing except the golfer's
// ability to read their own data, which is the only thing this app does.
//
// A real finding wired to the wrong moment is harder to spot than a made-up
// number, because everything about it is true except where it was put.

console.log('— the app no longer hides its own numbers —');
ok(FE.MODES === undefined, 'there are no display modes');
ok(FE.getMode === undefined && FE.setMode === undefined, 'and nothing to get or set');
ok(FE.plan === undefined, 'no per-shot reveal schedule');
ok(FE.fadedReveal === undefined && FE.fadedFrequency === undefined, 'no fading');
ok(FE.calibration === undefined, 'and no predict-before-reveal — you already saw the number at the range');

console.log('— the shot table shows every shot —');
const table = src.slice(src.indexOf('function renderShotTable'), src.indexOf('// ── Shot detail modal'));
ok(!/fb-hidden|fb-row-hidden|fb-ask|fbReveal/.test(table), 'no hidden cells, rows or reveal prompts remain');
ok(!/FeedbackEngine\.(plan|getMode|MODES|explain|calibration)/.test(table),
   'and it consults no schedule');
ok(/Every shot, every number/.test(table), 'the comment says what it does now');
ok(!/_revealed|_predictions|_asking/.test(src),
   'and the state that tracked what had been revealed is gone rather than left dangling');

console.log('— the settings toggle is gone —');
ok(!/When to show your numbers/.test(html), 'the section title is gone from the markup');
ok(!/id="feedbackModes"/.test(html), 'so is the picker host');
ok(!/renderFeedbackModes/.test(src), 'and the code that rendered it');
ok(/id="feedbackNote"/.test(html) && /How you practise/.test(html),
   'replaced by a section about the range session, which is where the finding operates');

console.log('— but the evidence is kept, and moved to where it applies —');
ok(typeof FE.WHY_SHOWN === 'string' && FE.WHY_SHOWN.length > 200, 'the app explains why it shows everything');
ok(/while you are hitting|hitting balls/i.test(FE.WHY_SHOWN),
   'naming the moment the evidence is actually about');
ok(/already saw all of it on the monitor/i.test(FE.WHY_SHOWN),
   'and why that moment has passed by the time you are reading this app');
ok(/drill library/i.test(FE.WHY_SHOWN), 'and where the decision that DOES matter lives');

const hdr = src.slice(0, src.indexOf('const FeedbackEngine'));
ok(/Winstein & Schmidt/.test(hdr) && /35% less error/.test(hdr),
   'the study is still cited — it was never the problem');
ok(/WHERE IT WAS APPLIED/.test(hdr), 'and the header says plainly what was wrong');

console.log('— the session wrappers still exist, as range instructions —');
for (const id of ['i95','i96','i97','i98']) {
  ok(DL.byId(id) !== null, `${id} is still in the library`);
}
ok(FE.DEFAULT_WRAPPER === 'i95', 'the faded session is the default one to run');
const w = PP.wrapperFor();
ok(w && w.id === 'i95', 'and every plan gets it');
ok(/rule for the mat/i.test(w.note),
   'described as a rule for the mat, not for this app\'s display');
ok(!/Your feedback is set to/.test(src),
   'nothing tells the golfer what their display setting is any more, because there is not one');

console.log('— and the parts that were always about the session survive —');
ok(typeof FE.volumeAdvice === 'function', 'volume advice is about the session you had, so it stays');
ok(/240/.test(FE.volumeAdvice(160) || ''), 'and still fires on a marathon');
ok(FE.volumeAdvice(20) === null, 'and stays quiet on a normal one');
ok(typeof R.app.RetentionProbe.openProbes === 'function',
   'the retention probe is untouched — it is the one thing here that can measure whether any of it worked');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
