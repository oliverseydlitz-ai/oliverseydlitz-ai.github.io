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

-- 1b. If the table already existed WITHOUT a primary key on id, add it.
--     (Wrapped so it won't error if the constraint is already there.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public.sessions ADD PRIMARY KEY (id);
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

CREATE POLICY "read own sessions"   ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert own sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own sessions" ON public.sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own sessions" ON public.sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════
-- Done. The app's cloud sync now has a working table to write to.
-- (Even if you skip this, the app has a delete-then-insert failsafe, but
--  running this gives you proper, efficient upserts.)
-- ════════════════════════════════════════════════════════════════════
