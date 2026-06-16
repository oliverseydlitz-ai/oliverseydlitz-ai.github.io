# Supabase Setup Guide for Claude Code

This guide documents the Supabase integration for **ShotLab TOUR** and how to use the Supabase MCP connectors in Claude Code sessions.

## Quick Access

**Project ID:** `jdmahrrxtxqrcpcwmwvx`  
**Project Name:** oliverseydlitz-ai's Project  
**Region:** eu-west-1  
**Status:** ACTIVE_HEALTHY  
**PostgreSQL:** 17.6.1.121

### Credentials (in `app.js`)
```javascript
const SUPABASE_URL = 'https://jdmahrrxtxqrcpcwmwvx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FK_S_xmH5hwC2r8Zm8rT2Q_dT8bLfKH';
```

## Using Supabase MCP Tools in Claude Code

In any Claude Code session, you can interact with Supabase directly using the MCP tools. No authentication needed — the tools use your Supabase organization credentials automatically.

### Available MCP Tools

Load tools via ToolSearch in the session:

```
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__list_projects
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__get_project
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__list_tables
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__execute_sql
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__list_edge_functions
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__deploy_edge_function
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__get_edge_function
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__list_migrations
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__apply_migration
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__get_logs
select:mcp__c493485e-f458-4996-b347-3f21d7662f45__get_advisors
```

### Common Tasks

#### List tables and schema
```
Tool: list_tables
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  schemas: ["public"]
  verbose: true
```

#### Query the database
```
Tool: execute_sql
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  query: "SELECT COUNT(*) FROM public.sessions;"
```

#### Check edge function status
```
Tool: list_edge_functions
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
```

#### View error logs
```
Tool: get_logs
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
```

#### Get advisors (performance tips)
```
Tool: get_advisors
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
```

## Database Schema

### `public.sessions` table

```sql
CREATE TABLE public.sessions (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        TEXT,
  notes       TEXT,
  conditions  JSONB,
  shots       JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Key details:**
- **RLS Enabled:** Each user can only see/modify their own sessions
- **Indexed:** `idx_sessions_user_id` for fast per-user lookups
- **2 Rows:** Currently has 2 sessions stored

**Policies (RLS):**
- `read own sessions` — Users can SELECT their own sessions
- `insert own sessions` — Users can INSERT their own sessions
- `update own sessions` — Users can UPDATE their own sessions
- `delete own sessions` — Users can DELETE their own sessions

## Edge Functions

### `delete-account`

**Status:** Not yet deployed  
**Location:** `supabase/functions/delete-account/index.ts`

**Purpose:** Permanently delete a user's account and all associated data

**How it works:**
1. Client sends request with Bearer token (user's JWT)
2. Function verifies the token using Supabase's service role
3. Deletes all user's sessions from the database
4. Deletes the user from `auth.users`

**Deployment:**
```bash
supabase functions deploy delete-account
```

**Security:**
- Uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never shipped to browser)
- Validates JWT before allowing deletion
- ON DELETE CASCADE ensures data cleanup even if function fails

## Schema Setup (Initial)

If setting up from scratch, run the SQL from `supabase-setup.sql` in the Supabase Dashboard:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a **New query**
3. Paste contents of `supabase-setup.sql`
4. Click **Run**

The script is idempotent — safe to run multiple times. It:
- Creates the `sessions` table if missing
- Adds PRIMARY KEY constraint if needed
- Creates the user_id index
- Enables RLS and creates all policies

## Client-Side Integration (app.js)

**Supabase init:**
```javascript
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: 'implicit',
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Auth flow:**
- Implicit OAuth flow (Google, GitHub)
- Token stored in URL hash `#access_token=...`
- `Auth.init()` extracts and validates token
- `Auth.getUser()` returns current user or null

**Cloud sync:**
- `CloudDB.saveSession(session)` upserts to Supabase
- Always returns local sessions first, merges cloud on top
- Gracefully degrades if cloud is unreachable

## Debugging

### Check database health
```
Tool: get_logs
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
```

### View performance recommendations
```
Tool: get_advisors
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
```

### Query sessions directly
```
Tool: execute_sql
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  query: "SELECT id, user_id, date FROM public.sessions LIMIT 10;"
```

### Check RLS policies
```
Tool: execute_sql
Params:
  project_id: "jdmahrrxtxqrcpcwmwvx"
  query: "SELECT schemaname, tablename, policyname, cmd, qual FROM pg_policies WHERE tablename = 'sessions';"
```

## Troubleshooting

### "no unique or exclusion constraint matching ON CONFLICT"
- **Cause:** `sessions` table lacks PRIMARY KEY on `id`
- **Fix:** Run `supabase-setup.sql` or manually add constraint:
  ```sql
  ALTER TABLE public.sessions ADD PRIMARY KEY (id);
  ```

### User can see other users' sessions
- **Cause:** RLS is disabled or policies are misconfigured
- **Fix:** Verify RLS is enabled and policies exist:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'sessions';
  ```

### Edge function deployment fails
- **Cause:** Function may have syntax errors or missing dependencies
- **Check logs:**
  ```
  Tool: get_logs
  ```
- **Test locally:**
  ```bash
  supabase functions serve
  ```

### OAuth redirect not working
- **Check:** Browser console for auth errors
- **Verify:** Redirect URL is whitelisted in Supabase Dashboard → Authentication → URL Configuration
- **Check URL hash:** Should contain `#access_token=...` after OAuth redirect

## Next Steps

1. **Deploy edge function:**
   ```bash
   supabase functions deploy delete-account
   ```

2. **Test in browser:**
   - Sign in with Google or GitHub
   - Upload a CSV session
   - Verify it appears in both IndexedDB and Supabase
   - Navigate to Settings and test account deletion

3. **Monitor:**
   - Check `get_logs` periodically for errors
   - Review `get_advisors` for performance tips
   - Monitor cloud sync failures in browser console

## References

- **Supabase Docs:** https://supabase.com/docs
- **Local Development:** `supabase start` (requires Docker)
- **MCP Tools:** Available automatically in Claude Code sessions
- **App Code:** See `CLAUDE.md` for architecture overview

---

**Last verified:** 2026-06-16  
**Supabase Project Status:** ACTIVE_HEALTHY  
**Database:** PostgreSQL 17.6.1.121  
**MCP Connectors:** Fully operational ✅
