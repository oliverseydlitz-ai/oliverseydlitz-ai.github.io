# Incident response

**ShotLab TOUR** · last reviewed 12 September 2026

This is the procedure to follow when something goes wrong with security or
personal data. It exists so that decisions are made from a checklist rather
than under pressure. It is not legal advice, and several steps say to get
some.

Everything below assumes a single operator. There is no on-call rota and no
security team; the point of writing it down is that one person under stress
forgets the order.

## Scope

Use this for any of:

- unauthorised access to the database, or evidence of it;
- an exposed credential (service-role key, OAuth client secret, database
  password, personal access token) in a repository, a log, a screenshot, or a
  message;
- a compromised user account;
- personal data disclosed to the wrong person or made publicly accessible;
- a defect that shows one user another user's data;
- loss or destruction of user data.

A bug that does not touch personal data or credentials is not an incident.
Fix it normally.

## Order of operations

The order matters. Containing before preserving destroys the evidence needed
for step 4; notifying before containing tells an attacker they have been seen.

### 1. Contain

- Revoke the exposed credential at its source. Do not wait to understand the
  full scope first: rotating is cheap and reversible, a live key is not.
- If an account is compromised, sign out all its sessions.
- If a defect is exposing data, take the affected feature or the whole site
  down. A static site reverts by pushing the previous commit.
- Do not delete anything. Do not "clean up" logs, rows or files.

### 2. Rotate

Rotate every credential in the blast radius, not only the one that leaked.
For this project that means, as applicable:

- Supabase service-role key and publishable key (Supabase dashboard → API);
- database password;
- Google OAuth client secret (Google Cloud console);
- any GitHub personal access token or deploy key.

Then confirm the replacement is not itself exposed: re-run the repository and
history scan in `SECURITY.md` before considering this step done.

**Removing a secret from a file is not rotation.** Anything ever pushed to a
public repository must be treated as public forever, regardless of later
commits, force-pushes or repository deletion.

### 3. Preserve

Before changing anything further, capture and store outside the affected
system:

- Supabase logs for the relevant window (they rotate — export early);
- the current database state, or the affected rows;
- the deployed commit SHA at the time of the incident;
- the versions of the Terms and Privacy Policy then in force;
- screenshots or copies of the exposure itself;
- timestamps, in UTC, for everything above.

### 4. Assess

Establish, and write down:

- what data was affected, by category, using the table in `PRIVACY.md` §3;
- how many data subjects;
- whether the data was actually accessed or merely accessible;
- whether it included authentication credentials;
- when it started and when it stopped;
- whether it is still ongoing.

Be precise about the difference between "exposed" and "accessed". They lead
to different obligations and different notifications.

### 5. Notify

**The 72-hour clock starts when you become aware, not when you finish
investigating.** An incomplete notification on time beats a complete one late;
supervisory authorities accept a follow-up.

- **Supervisory authority.** Where the breach is likely to result in a risk to
  the rights and freedoms of data subjects, notify the Czech Office for
  Personal Data Protection (Úřad pro ochranu osobních údajů, https://uoou.gov.cz)
  within 72 hours of becoming aware. Art. 33 GDPR.
- **Affected users.** Where the breach is likely to result in a *high* risk to
  them, notify them directly and without undue delay, in plain language: what
  happened, what data, what you are doing, what they should do. Art. 34 GDPR.
- **Processors.** Supabase and GitHub have their own notification duties to
  you, and their own security contacts if the incident is on their side.
- If uncertain whether the threshold is met, obtain legal advice. Do not
  resolve the uncertainty by assuming it is not.

Do not conceal a breach you know about. That is a separate and worse problem
than the breach.

### 6. Record

Art. 33(5) requires a record of every personal data breach, including ones not
notified, and the reasoning for not notifying. Keep it with this file. Include
the facts, the effects, and the remedial action taken.

### 7. Fix and verify

- Fix the root cause, not the symptom.
- Add a test that fails against the original defect. This repository's
  convention is that a guard is not trusted until it has been shown to catch
  the real bug.
- Re-run the cross-account isolation checks in `SECURITY.md` against the live
  database.
- Update `PRIVACY.md` if the incident revealed that it described something the
  system does not actually do.

## If a user reports that the Service injured them

Handle this as an incident too, but a different one. The instinct to be
reassuring is the thing to resist.

**Do not:**

- accept responsibility, or say or imply that the Service caused the injury;
- offer compensation, a refund or a settlement;
- delete, edit or "tidy" any log, recommendation, session or record;
- change the drill library, the Terms or the Privacy Policy in a way that
  obscures what the user was shown — fix a genuine safety defect, and keep the
  previous version;
- argue, or engage at length;
- treat an AI assistant as legal representation.

**Do:**

1. Preserve the exact recommendation the user was shown, and the session data
   it was generated from.
2. Preserve the versions of the Terms and Privacy Policy in force at that
   time, and the user's acceptance record (`terms_acceptances`).
3. Preserve timestamps and any relevant logs.
4. Record the communication, factually and in full.
5. Respond briefly, factually and without admission: acknowledge receipt, say
   the matter is being looked into, give no assessment.
6. Notify an insurer immediately if cover exists.
7. Obtain qualified legal advice before any substantive response.
8. Separately, and without reference to the claim, review whether the
   recommendation was in fact unsafe. If it was, fix it for everyone.

Steps 7 and 8 are separate on purpose. Fixing a defect is the right thing to
do; doing it *as a response to a claim* is a different act with different
consequences, and the sequencing is a question for a lawyer.

## Contacts

- Operator: shotlab_legal@oliverseydlitz.com
- Czech supervisory authority: https://uoou.gov.cz
- Supabase security: https://supabase.com/.well-known/security.txt
- GitHub security: https://github.com/security

`[REQUIRES LEGAL REVIEW]` — the notification thresholds above restate Art. 33
and 34 GDPR in summary form. Whether a specific incident crosses them is a
judgement, and for anything beyond a trivial exposure it should be made with a
Czech data-protection lawyer rather than from this file.

`[REQUIRES LEGAL REVIEW]` — no insurer is named because no cover is known to
exist. If cover is taken out, add the policy number, the notification deadline
under that policy, and the 24-hour contact here. Insurance notification
deadlines are often shorter than regulatory ones and are frequently missed.
