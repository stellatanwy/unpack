CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  syllabus TEXT,
  cluster TEXT,
  topic TEXT,
  skill TEXT,
  marks INTEGER,
  tier TEXT,
  question TEXT,
  context TEXT,
  figure_description TEXT,
  figure_caption TEXT,
  notes TEXT,
  figure_required BOOLEAN DEFAULT FALSE,
  hidden BOOLEAN DEFAULT FALSE,
  figure_type TEXT DEFAULT 'none',
  figures JSONB DEFAULT NULL
);