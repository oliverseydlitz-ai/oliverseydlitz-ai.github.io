// The two legal documents, checked against the code they describe.
//
// A privacy policy is a statement of fact about a system. The previous one
// drifted from the system on every point that mattered: it said the auth
// token was an HttpOnly cookie when it is in localStorage, it said the
// database was in the US when it is in eu-west-1, it listed two storage keys
// that do not exist and omitted nine that do, and it told users to run a
// command that clears a different store from the one it named. None of that
// is visible from inside the document, which is why it survived.
const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'PRIVACY.md'), 'utf8');
const terms = fs.readFileSync(path.join(root, 'TERMS.md'), 'utf8');

console.log('— the documents and the consent gate agree on the version —');
// If a document is materially rewritten and this is not bumped, every existing
// user stays bound to a version they can no longer read. The gate re-prompts
// on a version change, so the two must move together.
const gateVersion = M.Agreement.VERSION;
for (const [name, doc] of [['PRIVACY.md', privacy], ['TERMS.md', terms]]) {
  const v = (doc.match(/\*\*Version:\*\*\s*([0-9-]+)/) || [])[1];
  ok(v === gateVersion, `${name} is version ${v || 'MISSING'}, gate re-prompts at ${gateVersion}`);
}

console.log('— no placeholders, no unfilled fields —');
for (const [name, doc] of [['PRIVACY.md', privacy], ['TERMS.md', terms]]) {
  const holes = doc.match(/\[(support contact|TBD|TODO|your [^\]]+)\]|\bTBD\b|\bTODO\b|XXX/gi) || [];
  ok(holes.length === 0, `${name} has no placeholder text${holes.length ? `: ${holes.join(', ')}` : ''}`);
}

console.log('— the storage table matches the storage the app actually uses —');
// Every sl* key app.js reads or writes must appear in the policy's table, and
// the table must not invent keys. Both directions, because the old table got
// both wrong at once.
const NOT_STORAGE = new Set(['slFatal', 'slReload', 'slReset', 'slice']);
const used = new Set([...src.matchAll(/'(sl[A-Z][A-Za-z]*)'/g)].map(m => m[1])
  .filter(k => !NOT_STORAGE.has(k)));
ok(used.size >= 12, `${used.size} storage keys found in app.js`);
const listed = new Set([...privacy.matchAll(/`(sl[A-Za-z]+)`/g)].map(m => m[1]));
const undocumented = [...used].filter(k => !listed.has(k)).sort();
const invented = [...listed].filter(k => !used.has(k)).sort();
ok(undocumented.length === 0,
   `every key the app uses is in the policy${undocumented.length ? ` — missing: ${undocumented.join(', ')}` : ''}`);
ok(invented.length === 0,
   `and the policy invents none${invented.length ? ` — not in app.js: ${invented.join(', ')}` : ''}`);

console.log('— the security-relevant facts match the code —');
// The auth token's storage medium is the single most consequential claim in
// the document, and the old one stated the opposite of the truth.
ok(/purgeAuthStorage[^]*?Object\.keys\(localStorage\)/.test(src),
   'app.js does hold the Supabase auth token in localStorage');
ok(/authentication token is held in `localStorage`, not in an `HttpOnly` cookie/i.test(privacy),
   'and the policy says so, rather than claiming an HttpOnly cookie');
ok(!/HTTP-only Cookie \| Supabase authentication/i.test(privacy),
   'the old cookie claim is gone');

// Region. CLAUDE.md and the project ref both put the database in eu-west-1.
ok(/eu-west-1/.test(privacy) && /European Union/.test(privacy),
   'the policy names the real database region (EU, eu-west-1)');
ok(!/US region by default/i.test(privacy), 'and not the old US claim');

console.log('— the controls it points at exist —');
for (const label of ['Delete my account & data', 'Clear all local data (keep account)']) {
  ok(privacy.includes(label), `the policy names the real control "${label}"`);
  ok(html.includes(label.replace(/&/g, '&amp;')), `and "${label}" exists in the markup`);
}

console.log('— required content is present —');
const NEEDED_PRIVACY = {
  'legal basis per purpose': /Art\. 6\(1\)\(b\)/,
  'retention periods': /## 8\. Retention/,
  'international transfer mechanism': /Standard Contractual Clauses/,
  'right to restriction': /Restriction and objection/,
  'right to withdraw consent': /Withdrawal of consent/,
  'right to complain to a supervisory authority': /supervisory authority/,
  'automated decision-making position': /Art\. 22/,
  'CCPA right to correct': /right to correct/i,
  'breach notification timeline': /seventy-two hours/,
};
for (const [what, re] of Object.entries(NEEDED_PRIVACY)) {
  ok(re.test(privacy), `privacy policy covers ${what}`);
}
const NEEDED_TERMS = {
  'a real governing law': /law of England and Wales/,
  'consumer carve-out on jurisdiction': /mandatory law of your country of habitual residence/,
  'liability carve-out for death or personal injury': /death or personal injury caused by negligence/,
  'the MIT licence is not overridden': /Nothing in this Section restricts any right granted to you by that licence/,
};
for (const [what, re] of Object.entries(NEEDED_TERMS)) {
  ok(re.test(terms), `terms include ${what}`);
}

console.log('— and the claims that were legally counterproductive are gone —');
ok(!/no warranties regarding its completeness or accuracy/i.test(privacy),
   'the privacy policy no longer disclaims its own accuracy');
ok(!/arbitration/i.test(terms.replace(/no arbitration clause[^.]*\./gi, '')
     .replace(/requires you to arbitrate[^.]*\./gi, '')),
   'the unspecified binding-arbitration clause is gone');
ok(!/cost of a coffee/i.test(terms), 'and the editorialising in the liability cap is gone');
ok(!/Data Protection Officer.*Supabase/i.test(privacy),
   'a processor is no longer named as the Data Protection Officer');

console.log('— both are reachable and printable —');
ok(/id="privacyPdfBtn"/.test(html) && /id="termsPdfBtn"/.test(html), 'each document has a PDF control');
ok(/legal-print/.test(src) && /html\.legal-print/.test(fs.readFileSync(path.join(root, 'style.css'), 'utf8')),
   'the print path is wired in both app.js and style.css');
ok(!/href="PRIVACY\.md"/.test(html) && !/href="TERMS\.md"/.test(html),
   'nothing links straight at the raw markdown file');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
