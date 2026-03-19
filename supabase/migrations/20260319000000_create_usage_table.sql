-- Per-user daily API call tracking for rate limiting in the claude-feedback edge function
CREATE TABLE usage (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- Only the service role (edge function) can read/write; users cannot access their own rows
-- to prevent tampering. RLS left off intentionally — table is only touched by service role.
ALTER TABLE usage DISABLE ROW LEVEL SECURITY;

-- Atomic increment function — upserts the row and returns the new call_count.
-- Called by the claude-feedback edge function via supabase.rpc('increment_usage', ...).
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID, p_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO usage (user_id, date, call_count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET call_count = usage.call_count + 1
  RETURNING call_count INTO new_count;

  RETURN new_count;
END;
$$;
