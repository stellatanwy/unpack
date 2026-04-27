-- ── 1. Student memory column on profiles ─────────────────────────────────────
-- Stores the coach's running model of this student.
-- Shape: {
--   recurring_weaknesses: string[],   -- gap labels that keep coming up
--   current_focus: string,            -- the one skill the coach is drilling now
--   topics_practised: string[],       -- cluster names seen across sessions
--   command_words: string[]           -- question types seen (Explain, Evaluate, etc.)
-- }
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS memory JSONB NOT NULL DEFAULT '{"recurring_weaknesses":[],"current_focus":"","topics_practised":[],"command_words":[]}';


-- ── 2. Per-question attempt log ───────────────────────────────────────────────
-- One row per submission. Survives logout so the coach remembers what it asked.
CREATE TABLE IF NOT EXISTS question_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id      TEXT        NOT NULL,
  attempt_number   INTEGER     NOT NULL CHECK (attempt_number BETWEEN 1 AND 4),
  student_answer   TEXT        NOT NULL,
  diagnosis        JSONB,                  -- raw eval JSON from Call 1
  revision_target  TEXT,                   -- what the coach asked the student to fix
  target_addressed BOOLEAN,               -- did the student address it on this attempt?
  coaching_message TEXT,                   -- the coach's prose shown to the student
  moved_on         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, question_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS question_sessions_user_question
  ON question_sessions (user_id, question_id);


-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE question_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own rows (needed to load attempt history on mount)
CREATE POLICY "Users read own sessions"
  ON question_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own rows (client writes optimistically after each submit)
CREATE POLICY "Users insert own sessions"
  ON question_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own rows (coach updates target_addressed + coaching_message)
CREATE POLICY "Users update own sessions"
  ON question_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);


-- ── 4. feedback_disagreements (from earlier sprint — create if not yet run) ───
CREATE TABLE IF NOT EXISTS feedback_disagreements (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  question_id       TEXT,
  submission_id     UUID        REFERENCES question_sessions(id) ON DELETE SET NULL,
  student_answer    TEXT,
  feedback_received TEXT,
  disagreement_note TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback_disagreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insert"
  ON feedback_disagreements FOR INSERT
  TO authenticated
  WITH CHECK (true);
