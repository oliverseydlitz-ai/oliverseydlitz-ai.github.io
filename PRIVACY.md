# Privacy Policy — ShotLab TOUR

**Effective Date:** June 16, 2026  
**Last Updated:** June 16, 2026

---

## 🗑️ **HOW TO DELETE YOUR DATA (Quick Reference)**

**Want to delete everything? You have 2 options:**

### **Option 1: Delete Yourself (Instant)**
1. Open ShotLab
2. Go to **Settings** → **Account** → **"🗑️ Delete my account & data"**
3. Confirm in popup
4. ✅ Done — all data deleted immediately

### **Option 2: Email a Deletion Request (24-48 hours)**
- **Email:** `[your-support-email@example.com]`
- **Subject:** `Data Deletion Request`
- **Body:** Your email address
- We'll delete everything within 48 hours

### **Also available:**
- **Export your data:** Settings → Data & Export → "Export all data (JSON/CSV)"
- **Clear just local data:** Settings → Data & Export → "Clear all local data"
- **See what we have:** Settings → Data & Export → "View my data & controls"

---

## 1. Overview

ShotLab TOUR ("we," "us," "our," or "Site") is a golf swing analysis web application. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website at **oliverseydlitz-ai.github.io** (the "Site").

Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Site.

## 2. Information We Collect

### 2.1 Information You Provide

**Authentication Data:**
- Email address (when you sign up or log in)
- Password (hashed and encrypted by Supabase, never stored by us)
- Google OAuth account information (if using Google login)

**Session Data:**
- Golf swing metrics from your Rapsodo launch monitor (club type, ball speed, carry distance, launch angle, spin rate, etc.)
- Session notes and metadata (date, wind conditions, temperature)

**User Preferences:**
- Theme preference (light/dark mode)
- Goals and targets you set
- Practice session categories and ratings
- View preferences for dashboard features

### 2.2 Information Collected Automatically

**Storage:**
- Browser localStorage and IndexedDB for offline functionality and preferences
- Service worker caching for offline app performance

**Server Logs:**
- Supabase may collect standard server logs (IP, user-agent, timestamps)

**Cookies & Similar Technologies:**
- Session identification (managed by Supabase Auth)
- Preference cookies (dark mode, UI settings)

See Section 4 (Cookies) below for details.

## 3. How We Use Your Information

We use collected information for:

1. **Authentication & Authorization** — Verify your identity and manage account access
2. **Service Delivery** — Store and sync your golf swing data across devices
3. **Analytics & Improvement** — Analyze swing metrics, detect faults, generate insights
4. **Feature Personalization** — Track streaks, achievements, goals, and progress
5. **Cloud Synchronization** — Sync local data to Supabase for backup and multi-device access
6. **Service Operations** — Maintain, secure, and improve the Site

**We do NOT:**
- Sell, trade, or rent your personal information
- Use your data for marketing or advertising (except in-app tips)
- Share data with third parties except Supabase (as described below)

## 4. Cookies & Local Storage

### 4.1 What We Use

| Item | Type | Purpose | Expires |
|------|------|---------|---------|
| `sb-[...]-auth-token` | HTTP-only Cookie | Supabase authentication | ~1 year |
| `slTheme` | localStorage | Your dark/light mode preference | Manual clear |
| `slGoals` | localStorage | Your goals and targets | Manual clear |
| `slSessionFeedback` | localStorage | Session ratings | Manual clear |
| `slSessionCategories` | localStorage | Session tags | Manual clear |
| `slViewPrefs` | localStorage | Dashboard visibility settings | Manual clear |
| `slDebug` | localStorage | Debug mode (development only) | Manual clear |

### 4.2 Your Control

**Disabling Cookies:**
- Delete cookies in your browser settings
- Use private/incognito mode to avoid persistent storage
- Clear localStorage via DevTools Console: `await DB.clearAll()`

**localStorage Note:**
Browser localStorage is **not encrypted**. We recommend:
- Only access ShotLab on trusted devices
- Do not use on shared computers
- Use HTTPS only (we enforce this via GitHub Pages)

### 4.3 Supabase Cookies

Supabase sets authentication cookies automatically. See [Supabase Privacy & Security](https://supabase.com/privacy).

## 5. Third-Party Services

### 5.1 Supabase (Cloud Database & Auth)

**What we share:**
- Email address
- Session data (shots, metrics)
- User preferences
- Account metadata

**Data location:** Supabase servers (US region by default)  
**Privacy:** [Supabase Privacy Policy](https://supabase.com/privacy)

**Your rights:**
- Request data export
- Request account deletion (deletes all data from Supabase)
- View terms: [Supabase Terms](https://supabase.com/terms)

### 5.2 Third-Party Libraries (CDN)

We load libraries from:
- **Chart.js** (charting) — cdn.jsdelivr.net
- **PapaParse** (CSV parsing) — cdn.jsdelivr.net
- **idb-keyval** (IndexedDB wrapper) — cdn.jsdelivr.net
- **Google Fonts** (typography) — fonts.googleapis.com

These are loaded via HTTPS with minimal tracking. See their privacy policies for details.

### 5.3 Google OAuth

If you use Google Sign-In:
- Google receives your email and redirects back to us
- See [Google Privacy Policy](https://policies.google.com/privacy)

## 6. Data Security

### 6.1 How We Protect Data

- **HTTPS only** — All traffic is encrypted in transit
- **Supabase encryption** — Data at rest uses TLS
- **No local transmission** — OAuth tokens never leave your browser
- **Session isolation** — Guest data cleared on page close

### 6.2 What We Cannot Guarantee

- **IndexedDB is not encrypted** — Use trusted devices only
- **localStorage is plain text** — Not suitable for sensitive data
- **Service workers cache assets** — Cache is cleared periodically (v39)

### 6.3 Data Breach Notification

If a breach occurs, we will notify you via email (for authenticated users) within 30 days, as required by law.

## 7. Your Data Rights

### 7.1 Access & Portability

- **View your data:** All data is visible in the app
- **Export:** Use the "Export all data" button in Settings (JSON/CSV)
- **Download:** Supabase backup: Contact support

### 7.2 Deletion

**Permanent deletion:**
1. Sign in to your account
2. Go Settings → Data & Export → "Clear all data"
3. Confirm deletion

This removes data from:
- IndexedDB (local)
- Supabase (cloud)
- All service worker caches

**Guest sessions:**
- Automatically deleted when you close the page

### 7.3 Rectification

- Edit session notes and metadata in the app
- Change theme and preferences anytime

## 8. Children's Privacy

ShotLab is intended for adults (18+). We do not knowingly collect data from children under 13. If we discover such data, we will delete it immediately. Parents may contact us to request deletion.

## 9. International Users

If you are located outside the United States:

- **Data transfers:** Your data may be stored/processed in the US (Supabase)
- **Your rights:** GDPR, CCPA, and similar regulations may apply
- **Contact us:** We will comply with local privacy laws

## 10. Changes to This Policy

We may update this Privacy Policy at any time. **material changes** will be posted on this page with an updated "Last Updated" date. Your continued use of the Site after changes constitutes acceptance.

## 11. Contact Us

### **Data Deletion / GDPR/CCPA Requests**
**Email:** `[your-support-email@example.com]`
- **Subject line:** "Data Deletion Request" or "GDPR Request" or "CCPA Request"
- **Include:** Your email address associated with ShotLab
- **Response time:** Within 48 hours

### **General Privacy Questions**
- Email: `[your-support-email@example.com]`
- GitHub Issues: [oliverseydlitz-ai/oliverseydlitz-ai.github.io](https://github.com/oliverseydlitz-ai/oliverseydlitz-ai.github.io/issues)

### **In-App Deletion**
- **Settings** → **Account** → **"🗑️ Delete my account & data"** (instant, no email needed)

## 12. GDPR Compliance (EU Users)

**Legal basis for processing:**
- Consent (for data beyond authentication)
- Legitimate interest (service improvement)
- Contractual necessity (account management)

**Your GDPR rights:**
1. Right to access — Download your data
2. Right to deletion — Clear all data
3. Right to portability — Export JSON/CSV
4. Right to object — Email to opt out
5. Right to rectification — Edit in app
6. Right to lodge a complaint — Contact your national DPA

**Data Protection Officer:** Supabase (for cloud data)

## 13. CCPA Compliance (California Users)

**Your CCPA rights:**
1. **Right to know** — What data we collect (see Section 2)
2. **Right to delete** — Click Settings → Clear All Data
3. **Right to opt-out of sale** — We do not sell data (this is automatic)
4. **Right to non-discrimination** — We do not discriminate based on privacy choices

**Shine the Light:** You may request once per year:
- Categories of data collected
- Purposes for collection
- Email: [support contact]

## 14. Disclaimer

This Privacy Policy is provided on an "as-is" basis. We make no warranties regarding its completeness or accuracy. By using ShotLab, you acknowledge you have read and understood this policy.

---

**Questions?** Contact us via GitHub Issues or email. We take your privacy seriously. ⛳
