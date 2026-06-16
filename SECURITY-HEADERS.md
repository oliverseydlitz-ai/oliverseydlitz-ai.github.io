# Deployment Hardening Guide — Headers, SRI & Account Deletion

This guide gets ShotLab to a **literal 100/100** on
[securityheaders.com](https://securityheaders.com) and
[Mozilla Observatory](https://observatory.mozilla.org), plus full GDPR/CCPA
account deletion.

> **The honest constraint:** GitHub Pages **cannot send custom HTTP headers**.
> The strongest protections (HSTS, `X-Frame-Options`, `frame-ancestors`,
> `Permissions-Policy`) only work as real response headers. On raw GitHub Pages
> the in-page `<meta>` CSP is the ceiling (~B/C on scanners). To reach 100/100
> you must front the site with a host that sends headers. Steps below.

---

## 1. Get real HTTP headers (required for 100/100)

Pick ONE:

### Option A — Cloudflare in front of GitHub Pages (free, keeps your URL)
1. Add your domain to Cloudflare (free plan).
2. Point DNS at GitHub Pages, proxied (orange cloud).
3. Rules → **Transform Rules → Modify Response Header** → add each header from
   the `/_headers` file in this repo.
   (Or use a Cloudflare Worker / Snippet to inject them in one shot.)

### Option B — Move hosting to Netlify or Cloudflare Pages (free)
These read the repo's **`/_headers`** file automatically. Just connect the repo
and deploy — headers apply with zero extra config.

Either way, verify:
```
curl -sI https://your-domain/ | grep -iE 'strict-transport|content-security|x-frame|x-content-type|referrer|permissions-policy'
```

---

## 2. Subresource Integrity (SRI) for CDN scripts

`crossorigin="anonymous"` is already set on the four CDN `<script>` tags. To pin
them against CDN tampering, add an `integrity` hash. Generate the real hashes
against the live files (do this where you have network access):

```bash
for url in \
  "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js" \
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" \
  "https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/dist/umd.js" \
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js"; do
    printf '%s\n  integrity="sha384-%s"\n' "$url" \
      "$(curl -s "$url" | openssl dgst -sha384 -binary | openssl base64 -A)"
done
```

Then in `index.html`, **pin the exact version in the URL** (must match the
hashed file) and add the printed `integrity="sha384-..."`. Example:
```html
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"
        integrity="sha384-REAL_HASH_HERE" crossorigin="anonymous"></script>
```
> Use the latest exact versions that exist on the CDN. A wrong hash or a
> floating `@5` range will block the script and break the app — always verify
> the page loads after pinning.

---

## 3. Full account deletion (GDPR Art. 17 / CCPA)

The "Delete my account & data" button deletes all of a user's **session data**
client-side. Removing the **auth login/email** needs the service_role key, which
can't ship to the browser — so it's done by the `delete-account` Edge Function
in `supabase/functions/delete-account/`.

Deploy it:
```bash
supabase login
supabase link --project-ref jdmahrrxtxqrcpcwmwvx
supabase functions deploy delete-account
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

After deploy, the button fully deletes the account in one click. **Until it's
deployed**, the app deletes all data and shows the user the email address to
request login removal (set `SUPPORT_EMAIL` in `app.js`).

Also run **`supabase-setup.sql`** once (SQL Editor) — it creates the table with
`ON DELETE CASCADE` and Row-Level Security so users can only touch their own rows.

---

## 4. Things to edit before going live

- [ ] `app.js` → `SUPPORT_EMAIL` = your real support address
- [ ] `PRIVACY.md` → replace `[your-support-email@example.com]`
- [ ] `.well-known/security.txt` → real `Contact:` address
- [ ] Run `supabase-setup.sql` in Supabase
- [ ] Deploy `delete-account` Edge Function
- [ ] Front the site with Cloudflare/Netlify so `/_headers` applies
- [ ] Add SRI hashes (section 2) and verify the app still loads
- [ ] Re-scan on securityheaders.com → confirm A+

---

## 5. What you get at each stage

| Setup | securityheaders.com | Notes |
|-------|--------------------|-------|
| Raw GitHub Pages (today) | B/C | meta-CSP only; no HSTS/XFO possible |
| + Cloudflare/Netlify `_headers` | **A+ / 100** | all real headers active |
| + SRI hashes | A+ | CDN-tamper proof |
| + `delete-account` fn | A+ | one-click full GDPR deletion |
