// ── The Supabase keep-alive: schedule, guards, and the function it calls ──
//
// A free-tier project pauses after a week without "sufficient user database
// activity", and Supabase's own guidance is "a few user requests to the
// database each day". While paused, every cloud read in the app fails. The
// first draft of this job was specified as twice a WEEK — reasonable-sounding,
// and short of the documented threshold by a factor of three or more. So the
// cadence is pinned here as a fact, not left as a comment someone can relax.
//
// The workflow runs on GitHub, not in a browser, so nothing here touches the
// zero-third-party rule. What IS pinned:
//   - it runs every day, at least three times, and can be run by hand;
//   - it reads the project URL and key OUT OF app.js — a second copy in the
//     workflow is the drift this repo refuses everywhere else;
//   - it refuses any key that is not a publishable one, because the file is
//     public and a service_role key must never be one edit from being used;
//   - the function it calls exists in supabase-setup.sql, exposes nothing,
//     runs as the caller, pins search_path, and is granted to anon ALONE.
// Comments are stripped before the SQL is read, so the paragraph explaining
// the grant cannot satisfy the check for the grant.
const fs = require('fs');
const path = require('path');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const wfPath = path.join(root, '.github', 'workflows', 'keepalive.yml');

console.log('— the workflow exists and runs every day —');
ok(fs.existsSync(wfPath), '.github/workflows/keepalive.yml exists');
const wf = fs.existsSync(wfPath) ? fs.readFileSync(wfPath, 'utf8') : '';
const code = wf.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
const crons = [...code.matchAll(/cron:\s*'([^']+)'/g)].map(m => m[1].trim().split(/\s+/));
ok(crons.length >= 1, `${crons.length} schedule(s) declared`);
// Runs per day: sum over schedules that fire every day (day-of-month and
// day-of-week both '*') of the number of hours listed.
const hoursIn = f => f === '*' ? 24 : f.startsWith('*/') ? Math.floor(24 / +f.slice(2)) : f.split(',').length;
const daily = crons.filter(c => c.length === 5 && c[2] === '*' && c[3] === '*' && c[4] === '*');
const perDay = daily.reduce((n, c) => n + hoursIn(c[1]) * (c[0].includes(',') ? c[0].split(',').length : 1), 0);
ok(daily.length > 0, 'at least one schedule fires every single day, not on chosen weekdays');
ok(perDay >= 3, `and it fires ${perDay} times a day — Supabase's guidance is "a few requests each day", and GitHub can skip a scheduled run under load`);
ok(/workflow_dispatch/.test(code), 'and it can be run by hand from the Actions tab');
const trips = (code.match(/for i in ([\d ]+); do/) || [, ''])[1].trim().split(/\s+/).filter(Boolean).length;
ok(trips >= 2, `each run makes ${trips} database round trips`);

console.log('— it reads the project from app.js and refuses a secret key —');
ok(/grep[^\n]*SUPABASE_URL[^\n]*app\.js/.test(code) && /grep[^\n]*SUPABASE_KEY[^\n]*app\.js/.test(code),
   'URL and key are grepped out of app.js');
ok(!/supabase\.co/.test(code) && !/sb_publishable_[A-Za-z0-9_]{8,}/.test(code) && !/eyJhbGci/.test(code),
   'and neither the project URL nor any key is written into the workflow');
ok(/sb_publishable_\*\)\s*;;/.test(code) && /refusing to run/.test(code),
   'a key that is not sb_publishable_* stops the run');
ok(/permissions:\s*\n\s*contents:\s*read/.test(code), 'the job token is read-only');
ok(/::error::[^\n]*section 7 of supabase-setup\.sql/.test(code),
   'a missing function fails with the instruction that fixes it');

console.log('— the function it calls is defined, inert, and anon-only —');
const sql = fs.readFileSync(path.join(root, 'supabase-setup.sql'), 'utf8')
  .replace(/--[^\n]*/g, '');
const rpc = (code.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
ok(rpc === 'keepalive', `the workflow calls rpc/${rpc}`);
const fn = (sql.match(new RegExp('CREATE OR REPLACE FUNCTION public\\.' + rpc + '\\(\\)[^]*?\\$\\$[^]*?\\$\\$', 'i')) || [''])[0];
ok(!!fn, `supabase-setup.sql defines public.${rpc}()`);
ok(/SECURITY INVOKER/i.test(fn), 'it runs as the caller (SECURITY INVOKER), so it bypasses no policy');
ok(/SET search_path\s*=\s*''/i.test(fn), 'with search_path pinned empty');
ok(/\$\$\s*SELECT pg_catalog\.now\(\)\s*\$\$/i.test(fn), 'and its whole body is SELECT now() — it reads no table');
ok(new RegExp('REVOKE ALL ON FUNCTION public\\.' + rpc + '\\(\\) FROM PUBLIC, anon, authenticated', 'i').test(sql),
   'every default EXECUTE grant is revoked first');
const grants = [...sql.matchAll(new RegExp('GRANT EXECUTE ON FUNCTION public\\.' + rpc + '\\(\\) TO ([^;]+);', 'gi'))].map(m => m[1].trim());
ok(grants.length === 1 && grants[0] === 'anon', `then EXECUTE is granted to anon alone (${grants.join(' | ') || 'none'})`);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
