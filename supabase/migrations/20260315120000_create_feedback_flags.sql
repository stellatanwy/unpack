CREATE TABLE feedback_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  question_id TEXT,
  question_text TEXT NOT NULL,
  student_answer TEXT NOT NULL,
  ai_band TEXT,
  ai_failures JSONB,
  ai_current_gap TEXT,
  student_reason TEXT NOT NULL,
  syllabus TEXT,
  attempt_number INTEGER
);
