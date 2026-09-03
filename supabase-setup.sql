-- ════════════════════════════════════════════════════════════════════
-- ShotLab TOUR — Supabase setup
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Idempotent: safe to run on a fresh project or over an existing one.
--
-- This file mirrors the migrations applied to the live project. If you change
-- one, change the other — a setup script that has drifted from the database it
-- claims to describe is worse than no script, because it is trusted.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. The table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        TEXT,
  notes       TEXT,
  conditions  JSONB,
  shots       JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 1b. The PRIMARY KEY must be on id ALONE ─────────────────────────
-- The app upserts with onConflict:'id' (CloudDB.saveSession), which needs a
-- unique constraint on id by itself. An older table existed with a COMPOSITE
-- PK (user_id, id) — no unique constraint on id alone — so upserts failed with
-- 42P10 and fell back to delete-then-insert. Self-healing either way.
DO $$
DECLARE pk_cols TEXT;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum))
    INTO pk_cols
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = 'public.sessions'::regclass AND c.contype = 'p';

  IF pk_cols IS NULL THEN
    ALTER TABLE public.sessions ADD PRIMARY KEY (id);
  ELSIF pk_cols <> 'id' THEN
    ALTER TABLE public.sessions ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.sessions DROP CONSTRAINT sessions_pkey;
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- ── 2. Payload limits ───────────────────────────────────────────────
-- `shots` is unbounded user-supplied JSON on a shared database. RLS stops one
-- user READING another's data; it does nothing to stop one user filling the
-- disk for everyone. The ceilings are ~40x the largest real Rapsodo session,
-- so no golfer can reach them — only a client bug or an attack can.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.sessions'::regclass AND conname='sessions_shots_sane') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_shots_sane CHECK (
      jsonb_typeof(shots) = 'array'
      AND jsonb_array_length(shots) BETWEEN 1 AND 5000
      AND length(shots::text) <= 4000000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.sessions'::regclass AND conname='sessions_notes_len') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_notes_len
      CHECK (notes IS NULL OR length(notes) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.sessions'::regclass AND conname='sessions_conditions_object') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_conditions_object
      CHECK (conditions IS NULL OR jsonb_typeof(conditions) = 'object');
  END IF;
  -- id is the PRIMARY KEY, so it is a GLOBAL namespace shared by every user.
  -- The client only ever writes crypto.randomUUID(); this keeps that namespace
  -- sane without rejecting an older id from a restored backup.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.sessions'::regclass AND conname='sessions_id_format') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_id_format
      CHECK (id ~ '^[0-9a-zA-Z_-]{8,64}$');
  END IF;
END $$;

-- user_id defaults from the JWT so a caller cannot OMIT it; RLS still checks it
-- so a caller cannot FORGE it. The two together are what make it safe.
ALTER TABLE public.sessions ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ── 3. The index the app's only query needs ─────────────────────────
-- CloudDB.getSessions does .eq('user_id', id).order('date', desc). An index on
-- user_id alone covers the filter and leaves the sort to be done in memory.
CREATE INDEX IF NOT EXISTS sessions_user_date_idx ON public.sessions (user_id, date DESC);
DROP INDEX IF EXISTS public.idx_sessions_user_id;   -- strict prefix of the above

-- ── 4. updated_at must be true or absent, never stale ───────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS sessions_touch_updated_at ON public.sessions;
CREATE TRIGGER sessions_touch_updated_at
  BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 5. Row cap ──────────────────────────────────────────────────────
-- The payload limits bound one row; this bounds how many. The realistic way it
-- gets hit is a client-side import loop, not malice — and either way it should
-- stop at the database rather than at the billing page. 2000 sessions is one a
-- day for five and a half years.
CREATE OR REPLACE FUNCTION public.enforce_session_cap()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.sessions WHERE user_id = NEW.user_id;
  IF n >= 2000 THEN
    RAISE EXCEPTION 'Session limit reached (2000). Delete old sessions before adding more.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sessions_cap ON public.sessions;
CREATE TRIGGER sessions_cap
  BEFORE INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_session_cap();

-- ── 6. Row Level Security ───────────────────────────────────────────
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
-- RLS does not apply to the table OWNER unless forced. service_role has
-- BYPASSRLS and is unaffected (the delete-account function still works); what
-- this closes is a future SECURITY DEFINER function owned by postgres silently
-- seeing every user's rows.
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own sessions"   ON public.sessions;
DROP POLICY IF EXISTS "insert own sessions" ON public.sessions;
DROP POLICY IF EXISTS "update own sessions" ON public.sessions;
DROP POLICY IF EXISTS "delete own sessions" ON public.sessions;

-- auth.uid() wrapped in (SELECT ...) so Postgres evaluates it once per query
-- rather than once per row (the auth_rls_initplan lint).
-- Granted TO authenticated, not to public: naming the role means these are not
-- even evaluated for an anonymous caller.
CREATE POLICY "read own sessions"   ON public.sessions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "insert own sessions" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "update own sessions" ON public.sessions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "delete own sessions" ON public.sessions
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- ── 7. Least privilege ──────────────────────────────────────────────
-- anon held INSERT/UPDATE/DELETE/SELECT here by default. RLS blocked it (an
-- anonymous caller has no auth.uid() to match), so nothing was ever exposed —
-- but a guest never touches this table, and a grant that exists only to be
-- refused later is one policy edit away from being a hole.
REVOKE ALL ON public.sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- Two things this script CANNOT do, both dashboard settings:
--
--   1. Enable leaked-password protection (Auth → Providers → Email).
--      Supabase checks new passwords against HaveIBeenPwned. Off by default.
--
--   2. Stop a free-tier project pausing itself after ~7 days idle. While
--      paused, every cloud read fails and signed-in users silently fall back
--      to whatever is cached on their device. The app now SAYS so (see
--      Store.cloudStatus and the sync banner) rather than showing a partial
--      account as if it were whole — but the fix is a paid plan or regular use.
-- ════════════════════════════════════════════════════════════════════
