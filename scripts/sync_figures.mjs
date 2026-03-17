/**
 * sync_figures.mjs
 *
 * Lists all files in the `question-figures` Supabase Storage bucket,
 * parses each filename to extract the question ID, then updates the
 * `figures` JSONB column on the matching question row.
 *
 * Filename conventions supported:
 *   q1.png                   → question id: q1
 *   q1_fig1.png              → question id: q1
 *   prelim_sch1_p1_q1bi.png  → question id: prelim_sch1_p1_q1bi
 *   prelim_sch1_p1_q1bi_2.png → question id: prelim_sch1_p1_q1bi (trailing _N stripped)
 *
 * The figures column is stored as an array of objects:
 *   [{ path: "filename.png", url: "https://..." }, ...]
 *
 * URLs are signed with a 10-year expiry so they don't need rotating.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync_figures.mjs
 *   Add --dry-run to preview without writing.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://judwlaenxahzwwvpozdw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'question-figures';
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365 * 10; // 10 years in seconds
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a storage path like "subdir/q1_fig1.png" → question id "q1".
 * Strategy: strip directory prefix, strip extension, then strip trailing
 * _fig\d+ or _\d+ suffixes that indicate multiple figures for one question.
 */
function parseQuestionId(storagePath) {
  const filename = storagePath.split('/').pop(); // strip any folder prefix
  const noExt = filename.replace(/\.[^.]+$/, ''); // strip extension

  // Strip trailing _fig1, _fig2, _2, _3 etc. (figure index suffixes)
  return noExt.replace(/_(fig)?\d+$/, '');
}

/** List all files in the bucket, paginating if needed. */
async function listAllFiles() {
  const files = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Storage list failed: ${error.message}`);
    if (!data || data.length === 0) break;
    files.push(...data.filter(f => f.id)); // id is null for folders
    if (data.length < limit) break;
    offset += limit;
  }
  return files;
}

/** Generate a signed URL for a file path. */
async function signedUrl(path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);
  if (error) throw new Error(`Signed URL failed for ${path}: ${error.message}`);
  return data.signedUrl;
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log(`Bucket: ${BUCKET}${DRY_RUN ? '  [DRY RUN]' : ''}`);

// 1. List bucket contents
let files;
try {
  files = await listAllFiles();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

if (files.length === 0) {
  console.log('Bucket is empty — nothing to sync.');
  process.exit(0);
}

console.log(`Found ${files.length} file(s) in bucket.`);

// 2. Load all question IDs from DB for validation
const { data: questions, error: qErr } = await supabase
  .from('questions')
  .select('id, figures');
if (qErr) { console.error('Failed to load questions:', qErr.message); process.exit(1); }
const questionMap = new Map(questions.map(q => [q.id, q]));

// 3. Group files by question ID
const grouped = new Map(); // questionId → [{ path, filename }]
for (const file of files) {
  const qId = parseQuestionId(file.name);
  if (!grouped.has(qId)) grouped.set(qId, []);
  grouped.get(qId).push(file.name);
}

// 4. Report unknowns
const unknowns = [...grouped.keys()].filter(id => !questionMap.has(id));
if (unknowns.length > 0) {
  console.warn(`\nNo matching question found for ${unknowns.length} parsed ID(s):`);
  unknowns.forEach(id => console.warn(`  ${id}`));
}

// 5. For each matched question, generate signed URLs and update
const matched = [...grouped.entries()].filter(([id]) => questionMap.has(id));
console.log(`\nMatched ${matched.length} question(s). Generating signed URLs…\n`);

let updated = 0, failed = 0;

for (const [qId, paths] of matched) {
  try {
    const figureEntries = await Promise.all(
      paths.map(async (path) => ({
        path,
        url: await signedUrl(path),
      }))
    );

    console.log(`  ${qId}  (${figureEntries.length} file${figureEntries.length > 1 ? 's' : ''})`);
    figureEntries.forEach(f => console.log(`    → ${f.path}`));

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('questions')
        .update({
          figures: figureEntries,
          figure_type: 'uploaded',
        })
        .eq('id', qId);

      if (error) {
        console.error(`  ✗ Failed to update ${qId}: ${error.message}`);
        failed++;
      } else {
        updated++;
      }
    } else {
      updated++;
    }
  } catch (err) {
    console.error(`  ✗ ${qId}: ${err.message}`);
    failed++;
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] Would update' : 'Updated'} ${updated} question(s).`);
if (failed > 0) console.warn(`${failed} failed — see errors above.`);
