import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = 'https://judwlaenxahzwwvpozdw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const csv = readFileSync(new URL('../datasets/question bank/question_bank_review.csv', import.meta.url), 'utf8');

const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

const rows = records.map(r => ({
  id: r.id || null,
  syllabus: r.syllabus || null,
  cluster: r.cluster || null,
  topic: r.topic || null,
  skill: r.skill || null,
  marks: r.marks ? parseInt(r.marks, 10) : null,
  tier: r.tier || null,
  question: r.question || null,
  context: r.context || null,
  figure_description: r.figure_description || null,
  figure_caption: r.figure_caption || null,
  notes: r.notes || null,
  figure_required: r.figureRequired?.toLowerCase() === 'true',
  hidden: false,
  figure_type: 'none',
  figures: null,
}));

console.log(`Inserting ${rows.length} rows...`);

const { error } = await supabase.from('questions').upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Insert failed:', error.message);
  process.exit(1);
}

console.log('Done.');
