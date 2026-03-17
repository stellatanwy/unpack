# Unpack

EdTech product for Singapore upper-sec Geography students.
Exam-style answer diagnosis — finds the exact reasoning gap causing mark loss.
Built specifically for the Singapore MOE O-Level and N-Level Geography syllabus.

---

## Product Identity

Unpack is an exam reasoning trainer.

It helps students understand why they lost marks and how to fix their thinking.

It is NOT:

- a chatbot tutor
- a question generator
- an answer key system

Feedback should be structured and diagnostic,
not conversational or chat-like.

Prefer clear sections such as:
Diagnosis
Reasoning Gap
Next Step

---


## Current State

**Main file:** `geomark-v4.jsx` (React prototype, single file)
**Stack:** React, Anthropic API (direct client call — needs to move to backend)
**Branding:** Renamed to Unpack. Display font is Clash Display (Fontshare). Body font is Plus Jakarta Sans (Google Fonts).

---

## Product Overview

Students paste a Geography exam answer → get diagnostic feedback showing:
- Which mark band they are in (L1 / L2 / L3)
- The exact reasoning gap (failure category)
- One concrete next step to fix it
- Improvement tracked across resubmissions

---

## Product Principles

Unpack trains reasoning, not memorisation.

The system should follow these rules:

1. Never reveal the full model answer immediately.
2. Identify one reasoning gap at a time.
3. Guide the student to repair the answer through questions.
4. Prioritise thinking improvement over grading accuracy.
5. Feedback should feel like tutoring, not automated marking.

Unpack is a diagnostic training system, not a question generator.

---

## Tiers

| Tier | Price | Access |
|------|-------|--------|
| Free | $0 | 5 curated questions, full feedback, unlimited resubmissions |
| Basic | $12.90/month | Full question bank, progress dashboard |
| Plus | $15.90/month | Everything in Basic + My Questions (paste any question) |

7-day free trial on Basic and Plus.

---

## Syllabuses

| ID | Label | Code | Status |
|----|-------|------|--------|
| O-Elective | O-Level Elective Geography | 2260 | Live |
| O-Pure | O-Level Pure Geography | 2279 | Live |
| N-Elective | N(A)-Level Elective Geography (Humanities) | 2125 | Live |
| N-Pure | N(A)-Level Pure Geography | 2246 | Live |

**Cluster coverage by syllabus:**
- O-Elective (2260): GEL · Tourism · Climate OR Tectonics (Section B choice)
- O-Pure (2279): GEL · Tourism · Climate · Tectonics · Singapore (5 clusters, 2 papers)
- N-Elective (2125): GEL (Section A) · Climate OR Tectonics (Section B choice) — 1 paper
- N-Pure (2246): GEL · Tourism · Climate (3 clusters, 2 papers)

**LORM:** 9 marks for O-Level, 6 marks for N-Level

---

## Diagnostic Framework

## Failure Category Logic

When multiple issues are present, prioritise the earliest reasoning failure.

Priority order:

B  — Conceptual error (incorrect understanding)
F1 — Missing counterargument
F2 — Missing comparison
E  — Question drift
A  — Incomplete causal chain
G  — No comparison
C  — Point recycling
D  — Generic or unsupported evidence

The system should surface ONE primary reasoning gap at a time to guide improvement.

**Question types:** Explain, Describe, Evaluate, Compare, Fieldwork, Data Response

---

## Technical Debt (priority order)

1. Move Anthropic API call from client to backend (Next.js API route or Supabase Edge Function)
2. Real auth backend (currently mock — Supabase recommended)
3. Stripe integration for paid tier gating (Basic / Plus)
4. Parent account linking + notification pipeline (Phase 2)

---

## Parked Features (to discuss)

1. **Misuse prevention** — pre-submission intent classifier, vulgarity detection, parent flag for school tier
2. **Weekly session model** — 1 hour/week time-box, fixed curated question set per session, weekly completion as habit loop
3. **Scaffolded feedback redesign** — replace teacher language with plain-language diagnosis + micro-questions + resources per failure category
4. **Reward system** — mastery stickers per question type, cluster completion stamps, "Unpacked" badge for L1→L3 on same question
~~5. Font swap — done (Clash Display)~~

---

## Expansion Plan

**Subjects (same diagnostic approach, subject-specific frameworks):**
- Geography — Live
- Social Studies — Next
- History — Planned
- Literature — Planned

**Pricing on expansion:** Same price, more subjects bundled in. No per-subject charge.

**School tier (Phase 2):** Class licence, teacher dashboard, bulk student accounts, PDPA compliant.

---

## MOE Context

- Target syllabuses: 2260 (O-Level Elective), 2279 (O-Level Pure), 2125 (N(A)-Level Elective), 2246 (N(A)-Level Pure)
- Long-term goal: MOE acquisition or SLS integration
- Window: ~18-24 months before MOE expands internally
- Built PDPA-compliant from day one
- Avoid "AI-powered" in all marketing copy


## Project Rules

Claude should follow these principles when working in this repository:

1. Do not read files inside `/datasets` unless explicitly instructed.
2. Prefer summaries in `/docs` instead of full datasets.
3. When modifying code, output minimal changes or diffs rather than full file rewrites.
4. Do not regenerate large files unless necessary.
5. Return concise outputs unless explanation is explicitly requested.

## Dataset Access Rules

Large reference materials are stored in `/datasets`.

Structure:

/datasets
  /exam_papers
  /syllabus
  /question_bank

These may include large PDFs and CSV files.

Claude must NEVER automatically load files from `/datasets`.

If information is needed:
1. Check summaries in `/docs`
2. Only access `/datasets` when explicitly instructed

This prevents large context usage.

## Project Architecture

Frontend: React (Vite)
Main entry: `src/main.jsx`
App root: `src/App.jsx`

## AI Evaluation Pipeline

The system must NOT grade answers in a single step.

Evaluation must follow this sequence:

Student answer
↓
Extract claims / reasoning steps
↓
Evaluate causal or argumentative structure
↓
Detect failure category (from taxonomy)
↓
Predict mark band (L1 / L2 / L3)
↓
Generate Socratic feedback

Single-step grading should not be used as it produces unreliable results.

## AI Feedback Rules

The system should not reveal full answers.

Feedback should:

1. Identify the failure category.
2. Explain the reasoning gap in simple language.
3. Provide one next step to improve the answer.
4. Surface only ONE reasoning gap per response.

If multiple issues exist, select the earliest failure in the reasoning chain.
The goal is iterative improvement across resubmissions.

Feedback must remain supportive and avoid exam jargon where possible.

## Code Editing Rules

When modifying code:

1. Return minimal patches instead of rewriting full files.
2. Preserve existing structure unless refactoring is explicitly requested.
3. Avoid generating large files.
4. Only modify the necessary lines.

This repository prioritises incremental development.

--

## Known Bugs Fixed

**Storage** — Do not use `window.storage`. This is a Capacitor native API, unavailable in the browser. Use `localStorage` directly via the `sg`/`ss` helper functions in `App.jsx`.

**Supabase Auth** — Do not use both `getSession()` and `onAuthStateChange()` together. Supabase v2 fires `INITIAL_SESSION` on page load, which causes `loadProfile` to execute twice. Use `onAuthStateChange` only, listening for `INITIAL_SESSION | SIGNED_IN` events. A `profileLoadedRef` guard (`useRef(false)`) prevents duplicate `loadProfile` calls within the same session; reset it to `false` on `SIGNED_OUT`.

--

## Prompt Design Guidelines

AI evaluation prompts should be structured in stages:

1. Extract reasoning steps
2. Evaluate logical structure
3. Detect failure category
4. Assign mark band
5. Generate feedback

Prompts should prefer structured outputs (JSON or clearly separated fields).

Avoid combining evaluation and feedback generation in a single step when possible.

Band assignment should reflect the student's current reasoning state,
not the potential quality of a fully corrected answer.

Example:
If the answer stops midway in a causal chain,
the band reflects the incomplete reasoning (typically L2),
even if the idea itself is correct.