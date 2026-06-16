-- ════════════════════════════════════════════════════════════════════
-- ShotLab TOUR — Supabase setup
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Safe to run multiple times (idempotent).
-- ════════════════════════════════════════════════════════════════════

-- 1. Create the sessions table with id as PRIMARY KEY (this is what was
--    missing and caused "no unique or exclusion constraint matching the
--    ON CONFLICT specification" on sync).
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

-- 1b. Guarantee the PRIMARY KEY is on id ALONE. The app upserts with
--     onConflict:'id' (CloudDB.saveSession), which needs a unique constraint on
--     id by itself. An older table existed with a COMPOSITE PK (user_id, id) —
--     that has no unique constraint on id alone, so upserts silently failed with
--     42P10 and fell back to delete-then-insert. This block makes the script
--     self-healing: add a single-column PK if none exists, or replace a PK that
--     isn't exactly (id).
DO $$
DECLARE
  pk_cols TEXT;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum))
    INTO pk_cols
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = 'public.sessions'::regclass AND c.contype = 'p';

  IF pk_cols IS NULL THEN
    ALTER TABLE public.sessions ADD PRIMARY KEY (id);
  ELSIF pk_cols <> 'id' THEN
    -- Keep user_id NOT NULL so dropping the composite PK can't relax it.
    ALTER TABLE public.sessions ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.sessions DROP CONSTRAINT sessions_pkey;
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 2. Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);

-- 3. Row Level Security: each user can only see/touch their own rows
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Drop old policies first so re-running doesn't error on duplicates
DROP POLICY IF EXISTS "read own sessions"   ON public.sessions;
DROP POLICY IF EXISTS "insert own sessions" ON public.sessions;
DROP POLICY IF EXISTS "update own sessions" ON public.sessions;
DROP POLICY IF EXISTS "delete own sessions" ON public.sessions;

-- auth.uid() is wrapped in (SELECT ...) so Postgres evaluates it once per query
-- instead of once per row (avoids the auth_rls_initplan performance lint).
CREATE POLICY "read own sessions"   ON public.sessions
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert own sessions" ON public.sessions
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update own sessions" ON public.sessions
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "delete own sessions" ON public.sessions
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ════════════════════════════════════════════════════════════════════
-- Done. The app's cloud sync now has a working table to write to.
-- (Even if you skip this, the app has a delete-then-insert failsafe, but
--  running this gives you proper, efficient upserts.)
-- ════════════════════════════════════════════════════════════════════
