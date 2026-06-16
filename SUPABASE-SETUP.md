# Supabase Setup for ShotLab TOUR

**For Claude Code sessions with Supabase connector approval enabled.**

This guide uses the Supabase MCP connector tools to set up the database and deploy the account-deletion function. All steps are automated once the connector tools are approved.

## Prerequisites

- Supabase project already created: `jdmahrrxtxqrcpcwmwvx`
- Claude Code session with Supabase connector tools approved (list_tables, apply_migration, deploy_edge_function, get_advisors)

## Step 1: Check Current Schema

**Tool:** `list_tables`  
**Purpose:** Verify the current state before making changes.

```
Call: mcp__c493485e-f458-4996-b347-3f21d7662f45__list_tables
Parameters:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  schemas: ["public"]
  verbose: true
```

**Expected output:** Either empty (no tables) or list of existing tables. If `sessions` table exists, check for:
- Primary key constraint on `id`
- Row-Level Security policies (should see `select`, `insert`, `update`, `delete` policies for user_id matching)

If RLS is missing, proceed to Step 2.

---

## Step 2: Create Sessions Table + Row-Level Security

**Tool:** `apply_migration`  
**Purpose:** Create the `sessions` table with proper schema and RLS policies.

The migration runs the SQL from `supabase-setup.sql`. This creates:
- `sessions` table (id, user_id, date, shots, notes)
- Primary key on (id)
- On-delete cascade for user_id
- RLS policies so users only see/edit their own sessions

```
Call: mcp__c493485e-f458-4996-b347-3f21d7662f45__apply_migration
Parameters:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  migration_sql: [contents of supabase-setup.sql]
```

**Expected result:**
- `sessions` table created
- RLS enabled with four policies: SELECT, INSERT, UPDATE, DELETE (all checking `auth.uid() = user_id`)
- Schema verified by re-running Step 1 (list_tables) to confirm

---

## Step 3: Deploy the Delete-Account Edge Function

**Tool:** `deploy_edge_function`  
**Purpose:** Deploy the Supabase Edge Function that deletes auth users (requires service_role key, only callable server-side).

The function code is in `supabase/functions/delete-account/index.ts`. It:
1. Validates the caller's JWT token
2. Deletes all the user's `sessions` rows
3. Deletes the auth.users record itself
4. Returns `{success: true}` or error

```
Call: mcp__c493485e-f458-4996-b347-3f21d7662f45__deploy_edge_function
Parameters:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  function_name: "delete-account"
  source_code: [contents of supabase/functions/delete-account/index.ts]
```

**Expected result:**
- Function deployed to `https://jdmahrrxtxqrcpcwmwvx.supabase.co/functions/v1/delete-account`
- Available immediately; can be invoked by app with `sb.functions.invoke('delete-account')`

---

## Step 4: Run Security Advisors

**Tool:** `get_advisors`  
**Purpose:** Check for security warnings (missing RLS, exposed keys, etc.).

```
Call (Security advisors):
mcp__c493485e-f458-4996-b347-3f21d7662f45__get_advisors
Parameters:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  type: "security"

Call (Performance advisors):
mcp__c493485e-f458-4996-b347-3f21d7662f45__get_advisors
Parameters:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  type: "performance"
```

**Expected result:** No high-severity warnings. Common non-issues:
- "RLS not enabled on public schema" — OK, RLS is per-table
- "Columns could use indexes" — OK for v1; optimize later if needed

---

## Verification Checklist

After all steps, confirm:

- [ ] `sessions` table exists in public schema
- [ ] `sessions.id` is primary key (uuid)
- [ ] `sessions.user_id` is indexed and has foreign key to auth.users
- [ ] RLS is enabled on `sessions` table
- [ ] Four RLS policies exist (SELECT, INSERT, UPDATE, DELETE) all checking `auth.uid() = user_id`
- [ ] `delete-account` Edge Function is deployed and callable
- [ ] No critical security advisors flagged

Once confirmed, users can:
1. Sign in with email/OAuth
2. Sessions auto-sync to Supabase
3. Click "Delete my account" → instant one-click deletion (auth user + all sessions)

---

## Manual Fallback (if connector unavailable)

If the connector tools aren't approved, use the Supabase CLI directly:

```bash
# Log in
supabase login

# Link to the project
supabase link --project-ref jdmahrrxtxqrcpcwmwvx

# Apply the migration (creates sessions table + RLS)
supabase db push

# Deploy the function
supabase functions deploy delete-account
```

Then verify via the Supabase dashboard:
- SQL Editor → run `SELECT * FROM information_schema.tables WHERE table_name='sessions'`
- Edge Functions → confirm `delete-account` is listed and active

---

## Support

For issues:
- Email: shotlab_legal@oliverseydlitz.com
- GitHub: https://github.com/oliverseydlitz-ai/oliverseydlitz-ai.github.io/issues
