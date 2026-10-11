-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  teaching_depth TEXT NOT NULL DEFAULT 'beginner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for profile lookups
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles (updated_at DESC);

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TEACHING SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teaching_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  preferred_language TEXT NOT NULL DEFAULT 'en',
  teaching_depth TEXT NOT NULL DEFAULT 'beginner',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  current_stage_id TEXT,
  board_state JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"texts":[],"highlights":[]}'::jsonb,
  visual_state JSONB NOT NULL DEFAULT '{"objects":[],"tick":0}'::jsonb,
  visual3d_state JSONB,
  lesson_objective JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Indexes for teaching_sessions
CREATE INDEX IF NOT EXISTS teaching_sessions_user_id_idx ON public.teaching_sessions (user_id);
CREATE INDEX IF NOT EXISTS teaching_sessions_updated_at_idx ON public.teaching_sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS teaching_sessions_last_activity_idx ON public.teaching_sessions (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS teaching_sessions_status_idx ON public.teaching_sessions (status);

-- Trigger for updated_at
CREATE TRIGGER teaching_sessions_updated_at
  BEFORE UPDATE ON public.teaching_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- LESSON STEPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.teaching_sessions(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  stage_id TEXT,
  stage_intent TEXT,
  speech TEXT NOT NULL,
  board_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  visual_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  visual3d_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  pedagogy JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on session_id + step_index
CREATE UNIQUE INDEX IF NOT EXISTS lesson_steps_session_step_idx ON public.lesson_steps (session_id, step_index);

-- Index for ordering
CREATE INDEX IF NOT EXISTS lesson_steps_session_created_idx ON public.lesson_steps (session_id, step_index);

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.teaching_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  message_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS messages_session_id_idx ON public.messages (session_id);
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON public.messages (user_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages (created_at DESC);

-- ============================================================
-- SAVED LESSONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.teaching_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for saved_lessons
CREATE INDEX IF NOT EXISTS saved_lessons_user_id_idx ON public.saved_lessons (user_id);
CREATE INDEX IF NOT EXISTS saved_lessons_session_id_idx ON public.saved_lessons (session_id);
CREATE INDEX IF NOT EXISTS saved_lessons_updated_at_idx ON public.saved_lessons (updated_at DESC);

-- Trigger for updated_at
CREATE TRIGGER saved_lessons_updated_at
  BEFORE UPDATE ON public.saved_lessons
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- LEARNING PROGRESS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.teaching_sessions(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  subject TEXT,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Indexes for learning_progress
CREATE INDEX IF NOT EXISTS learning_progress_user_id_idx ON public.learning_progress (user_id);
CREATE INDEX IF NOT EXISTS learning_progress_session_id_idx ON public.learning_progress (session_id);

-- Trigger for updated_at
CREATE TRIGGER learning_progress_updated_at
  BEFORE UPDATE ON public.learning_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- USAGE RECORDS TABLE (for token tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.teaching_sessions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  request_type TEXT NOT NULL DEFAULT 'step' CHECK (request_type IN ('lesson', 'step', 'interruption')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage_records
CREATE INDEX IF NOT EXISTS usage_records_user_id_idx ON public.usage_records (user_id);
CREATE INDEX IF NOT EXISTS usage_records_session_id_idx ON public.usage_records (session_id);
CREATE INDEX IF NOT EXISTS usage_records_created_at_idx ON public.usage_records (created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- TEACHING SESSIONS POLICIES
-- ============================================================
CREATE POLICY "Users can view own teaching sessions"
  ON public.teaching_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own teaching sessions"
  ON public.teaching_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own teaching sessions"
  ON public.teaching_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own teaching sessions"
  ON public.teaching_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- LESSON STEPS POLICIES
-- ============================================================
CREATE POLICY "Users can view lesson steps for own sessions"
  ON public.lesson_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teaching_sessions
      WHERE teaching_sessions.id = lesson_steps.session_id
      AND teaching_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert lesson steps for own sessions"
  ON public.lesson_steps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teaching_sessions
      WHERE teaching_sessions.id = lesson_steps.session_id
      AND teaching_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update lesson steps for own sessions"
  ON public.lesson_steps FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.teaching_sessions
      WHERE teaching_sessions.id = lesson_steps.session_id
      AND teaching_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete lesson steps for own sessions"
  ON public.lesson_steps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.teaching_sessions
      WHERE teaching_sessions.id = lesson_steps.session_id
      AND teaching_sessions.user_id = auth.uid()
    )
  );

-- ============================================================
-- MESSAGES POLICIES
-- ============================================================
CREATE POLICY "Users can view messages for own sessions"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.teaching_sessions
      WHERE teaching_sessions.id = messages.session_id
      AND teaching_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for own sessions"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.teaching_sessions
      WHERE teaching_sessions.id = messages.session_id
      AND teaching_sessions.user_id = auth.uid()
    )
  );

-- ============================================================
-- SAVED LESSONS POLICIES
-- ============================================================
CREATE POLICY "Users can view own saved lessons"
  ON public.saved_lessons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved lessons"
  ON public.saved_lessons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved lessons"
  ON public.saved_lessons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved lessons"
  ON public.saved_lessons FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- LEARNING PROGRESS POLICIES
-- ============================================================
CREATE POLICY "Users can view own learning progress"
  ON public.learning_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning progress"
  ON public.learning_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning progress"
  ON public.learning_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- USAGE RECORDS POLICIES
-- ============================================================
-- Users can view their own usage records but NOT insert/update/delete
-- (usage records are created server-side only)
CREATE POLICY "Users can view own usage records"
  ON public.usage_records FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for users - only service role can write

-- ============================================================
-- HELPER FUNCTION: Create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, preferred_language, teaching_depth)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en'),
    COALESCE(NEW.raw_user_meta_data->>'teaching_depth', 'beginner')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();