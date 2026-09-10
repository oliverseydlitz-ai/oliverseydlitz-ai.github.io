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

console.log('— and it names the right supervisory authority for a Czech controller —');
ok(/Úřad pro ochranu osobních údajů/.test(privacy), 'the Czech DPA is named');
ok(/uoou\.gov\.cz/.test(privacy), 'with its address');
ok(/Act No\. 110\/2019 Coll/.test(privacy), 'and the Czech implementing act');
ok(/No data protection officer has been appointed/.test(privacy),
   'the absence of a DPO is stated, with the Art. 37(1) reasoning');
const NEEDED_TERMS = {
  'a real governing law': /law of the Czech Republic/,
  'the Czech Civil Code by number': /Act No\. 89\/2012 Coll/,
  'consumer carve-out on jurisdiction': /mandatory provisions of the law of your country of habitual residence/,
  'Rome I': /Rome I/,
  'Brussels I recast': /Brussels I recast/,
  'the Czech ADR body': /Česká obchodní inspekce/,
  'liability carve-out for death or personal injury': /death or personal injury caused by negligence/,
  'the s.2898 carve-out for intent and gross negligence': /intentionally or by gross negligence/,
  'GDPR Art. 82 is not limited by the cap': /Art\. 82 of Regulation \(EU\) 2016\/679/,
  'unfair-terms carve-out': /Directive 93\/13\/EEC/,
  'the MIT licence is not overridden': /Nothing in this Section restricts any right granted to you by that licence/,
};
for (const [what, re] of Object.entries(NEEDED_TERMS)) {
  ok(re.test(terms), `terms include ${what}`);
}

console.log('— and the claims that were legally counterproductive are gone —');
ok(!/no warranties regarding its completeness or accuracy/i.test(privacy),
   'the privacy policy no longer disclaims its own accuracy');
// Look for an obligation to arbitrate, not for the word — the terms now say
// explicitly that there is no arbitration clause, and a scan that trips on
// its own denial is the trap this repo keeps falling into.
ok(!/(agree to (resolve|submit)[^.]*arbitrat|binding arbitration)/i.test(terms),
   'no operative obligation to arbitrate');
ok(/no arbitration clause and no waiver of class or representative proceedings/i.test(terms),
   'and the terms say so in terms');
ok(!/cost of a coffee/i.test(terms), 'and the editorialising in the liability cap is gone');
ok(!/Data Protection Officer.*Supabase/i.test(privacy),
   'a processor is no longer named as the Data Protection Officer');

console.log('— the consent mechanism matches what the policy promises —');
ok(/offers acceptance and refusal with equal prominence/.test(privacy),
   'the policy claims an equally prominent refusal');
ok(/id="cookieRejectBtn"/.test(html), 'and a reject control exists');
const acceptCls = (html.match(/id="cookieAcceptBtn" class="([^"]+)"/) || [])[1];
const rejectCls = (html.match(/id="cookieRejectBtn" class="([^"]+)"/) || [])[1];
ok(acceptCls && acceptCls === rejectCls,
   `accept and reject carry the same styling (${acceptCls} / ${rejectCls})`);
ok(/Continued use of the Service is not treated as consent/.test(privacy),
   'consent by continued browsing is disclaimed (CJEU C-673/17)');
ok(/setConsent\(false\)/.test(src) && /removeItem\(k\)/.test(src),
   'refusing actually removes the optional items rather than only blocking new ones');

console.log('— the gate asks two separate questions and takes no for an answer —');
ok(/id="agreementCheckbox"/.test(html) && /id="agreementRiskCheckbox"/.test(html),
   'agreement and risk are two separate boxes, not one tick standing for both');
ok(/acknowledgedRisk: true/.test(src),
   'and the risk acknowledgement is recorded, so it can be evidenced');
ok(/id="agreementDeclineBtn"/.test(html), 'declining is possible');
ok(/Agreement\.decline\(\)/.test(src), 'and wired');
ok(/riskCheckbox\?\.checked/.test(src),
   'accept stays disabled until BOTH boxes are ticked');

// The bundling bug: accepting the contract used to call setConsent(), so
// agreeing to the Terms silently granted the optional storage a user is
// entitled to refuse. Art. 7(4) GDPR — consent bundled into acceptance of a
// contract is not freely given.
const acceptHandler = src.slice(src.indexOf("acceptBtn?.addEventListener"),
                                src.indexOf("declineBtn?.addEventListener"));
ok(!/setConsent\(/.test(acceptHandler),
   'accepting the Terms does NOT grant storage consent (Art. 7(4))');
ok(/CookieConsent\.showBanner\(\)/.test(acceptHandler),
   'it raises the storage question separately instead');

// Declining must not write anything. A record of someone who just refused the
// terms under which anything could be stored is the one write that cannot be
// justified.
const declineFn = src.slice(src.indexOf('function decline()'), src.indexOf('function renderDeclined()'));
ok(!/setItem/.test(declineFn), 'declining stores nothing at all');
ok(/document\.referrer/.test(declineFn),
   'and leaves via referrer rather than history.length, which counts about:blank');

console.log('— no third party is contacted on load —');
ok(!/cdn\.jsdelivr\.net/.test(html) && !/fonts\.googleapis\.com/.test(html),
   'no CDN or webfont host in the markup');
ok(/script-src 'self';/.test(html) && /font-src 'self';/.test(html),
   "and the CSP no longer allows either");
ok(/makes no request to any third-party server while it loads/.test(privacy),
   'which is what the policy says');

console.log('— both are reachable and printable —');
ok(/id="privacyPdfBtn"/.test(html) && /id="termsPdfBtn"/.test(html), 'each document has a PDF control');
ok(/legal-print/.test(src) && /html\.legal-print/.test(fs.readFileSync(path.join(root, 'style.css'), 'utf8')),
   'the print path is wired in both app.js and style.css');
ok(!/href="PRIVACY\.md"/.test(html) && !/href="TERMS\.md"/.test(html),
   'nothing links straight at the raw markdown file');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
