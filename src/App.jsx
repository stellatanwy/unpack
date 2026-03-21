import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./lib/supabase.js";
import { callClaude, callClaudeWithImage } from "./lib/ai.js";

// ─── DEV MODE ─────────────────────────────────────────────────────────────────
// Set to true for local testing only. NEVER commit or deploy with DEV_MODE = true.
// Switch between mock users using the floating panel (bottom-right corner).
const DEV_MODE = false; // NEVER deploy with DEV_MODE = true

const DEV_USERS = [
  {
    id: "dev_anon", name: "Free (no account)", email: "free@test.com",
    tier: null, syllabus: "O-Elective", year: "sec4",
    topicsCovered: "all", examType: "olevels", onboardingComplete: false,
    school: null, examDate: null, previousExamDate: null, lastTopicUpdate: Date.now(),
  },
  {
    id: "dev_free_account", name: "Free Account", email: "freeacc@test.com",
    tier: "free-account", syllabus: "O-Elective", year: "sec4",
    topicsCovered: "all", examType: "olevels", onboardingComplete: true,
    school: null, examDate: null, previousExamDate: null, lastTopicUpdate: Date.now(),
  },
  {
    id: "dev_basic", name: "Basic", email: "basic@test.com",
    tier: "basic", syllabus: "O-Elective", year: "sec4",
    topicsCovered: ["tect_plates"], examType: "olevels", onboardingComplete: true,
    school: null, examDate: "2026-10-15", previousExamDate: null, lastTopicUpdate: Date.now(),
  },
  {
    id: "dev_basic_5w", name: "Basic — 5 weeks to exam", email: "basic5w@test.com",
    tier: "basic", syllabus: "O-Elective", year: "sec4",
    topicsCovered: "all", examType: "olevels", onboardingComplete: true,
    school: null,
    examDate: (() => { const d = new Date(); d.setDate(d.getDate() + 35); return d.toISOString().split("T")[0]; })(),
    previousExamDate: null, lastTopicUpdate: Date.now(),
  },
  {
    id: "dev_basic_exam", name: "Basic — exam in 10 days", email: "basicexam@test.com",
    tier: "basic", syllabus: "O-Elective", year: "sec4",
    topicsCovered: "all", examType: "olevels", onboardingComplete: true,
    school: null,
    examDate: (() => { const d = new Date(); d.setDate(d.getDate() + 10); return d.toISOString().split("T")[0]; })(),
    previousExamDate: null, lastTopicUpdate: Date.now(),
  },
  {
    id: "dev_plus", name: "Plus", email: "plus@test.com",
    tier: "plus", syllabus: "O-Elective", year: "sec4",
    topicsCovered: "all", examType: "olevels", onboardingComplete: true,
    school: null, examDate: "2026-10-15", previousExamDate: null, lastTopicUpdate: Date.now(),
  },
];

// GlobalStyles is kept as a mount point for any future app-specific overrides.
// All tokens, resets, and utility classes live in src/styles/global.css.
const GlobalStyles = () => null;

// Palette — maps semantic names used throughout the app to the new design system
const C = {
  coral: "#b8f000",      // electric lime — primary accent (replaces coral)
  coralL: "#edfacc",     // electric tint — light accent backgrounds
  bg: "#f5f0e8",         // cream — main surface
  card: "#e8e0d0",       // cream-dark — card backgrounds
  text: "#0d2b1f",       // text-dark
  mid: "#3a5a48",        // mid green — secondary text on cream
  light: "#6b7c6e",      // text-muted
  border: "#d8d0c0",     // border on cream surfaces
  borderM: "#c0b4a0",    // medium border
  green: "#1a4332",      // green-mid
  greenL: "#d0e8da",     // light green tint
  amber: "#f0a500",      // amber
  amberL: "#fef3dc",     // light amber
  red: "#e05c3a",        // error red
  redL: "#fdecea",       // light red
  blue: "#2563eb",       // blue (unchanged)
  blueL: "#dbeafe",      // light blue (unchanged)
  teal: "#0d9488",       // teal (unchanged)
  // Dark surface values (used when rendering on green backgrounds)
  deepBg: "#0d2b1f",     // green-deep
  midBg: "#1a4332",      // green-mid
  textOnDark: "#f5f0e8", // text-light
  borderOnDark: "#2a5040",
};

// ─── SYLLABUS DEFINITIONS ─────────────────────────────────────────────────────
// Each syllabus has: id, label, shortLabel, level (O/N), type (Elective/Pure),
// clusters, lormMarks, notes for the AI system prompt
const SYLLABUSES = {
  "O-Elective": {
    id: "O-Elective",
    label: "O-Level Elective Geography",
    shortLabel: "O-Level Elective",
    code: "Syllabus 2260",
    level: "O",
    type: "Elective",
    color: C.green,
    clusters: [
      "Geography in Everyday Life",
      "Tourism",
      "Climate",   // OR Tectonics (choice)
      "Tectonics",
    ],
    lormMarks: 9,
    lormDescriptors: {
      L3: "7–9: Both sides, range of points with good elaboration, specific examples, well-reasoned conclusion.",
      L2: "4–6: One side well argued OR both sides limited elaboration.",
      L1: "1–3: Limited description, generic examples, evaluation simple or missing.",
    },
    promptNote: "This is O-Level Elective Geography (Syllabus 2260, Humanities). The paper has Section A (Geography in Everyday Life [14m] + Tourism [18m]) and Section B (Climate OR Tectonics [18m]). One 9-mark AO3 question uses LORM.",
    available: true,
  },
  "O-Pure": {
    id: "O-Pure",
    label: "O-Level Pure Geography",
    shortLabel: "O-Level Pure",
    code: "Syllabus 2279",
    level: "O",
    type: "Pure",
    color: "#2563eb",
    clusters: [
      "Geography in Everyday Life",
      "Tourism",
      "Climate",
      "Tectonics",
      "Singapore",
    ],
    // Paper 1: Topic 1.3 (Fieldwork) + Cluster 2 (Tourism) + Cluster 3 (Climate) — 50m
    // Paper 2: Topics 1.1+1.2 (GEL) + Cluster 4 (Tectonics) + Cluster 5 (Singapore) — 50m
    papers: {
      1: { topics: ["Geographical Methods", "Tourism Activity", "Tourism Development", "Sustainable Tourism Development", "Weather and Climate", "Climate Change", "Climate Action"] },
      2: { topics: ["Thinking Geographically", "Sustainable Development", "Plate Tectonics", "Earthquakes and Volcanoes", "Disaster Risk Management", "Small Island City-State", "Challenges and Opportunities", "Sustainable and Resilient Singapore"] },
    },
    topics: {
      "Geography in Everyday Life": ["Thinking Geographically", "Sustainable Development", "Geographical Methods"],
      "Tourism": ["Tourism Activity", "Tourism Development", "Sustainable Tourism Development"],
      "Climate": ["Weather and Climate", "Climate Change", "Climate Action"],
      "Tectonics": ["Plate Tectonics", "Earthquakes and Volcanoes", "Disaster Risk Management"],
      "Singapore": ["Small Island City-State", "Challenges and Opportunities", "Sustainable and Resilient Singapore"],
    },
    lormMarks: 9,
    lormDescriptors: {
      L3: "7–9: Both sides, range of points with good elaboration, specific examples, well-reasoned conclusion.",
      L2: "4–6: One side well argued OR both sides with limited elaboration.",
      L1: "1–3: Limited description, generic examples, evaluation simple or missing.",
    },
    promptNote: "This is O-Level Pure Geography (Syllabus 2279). Paper 1 covers Fieldwork (Topic 1.3), Tourism (Cluster 2) and Climate (Cluster 3). Paper 2 covers Geography in Everyday Life (Topics 1.1–1.2), Tectonics (Cluster 4) and Singapore (Cluster 5). Each paper is 50 marks. One 9-mark AO3 LORM question per paper. Extended Fieldwork is assessed over 10 weeks. AO1 15%, AO2 20%, AO3 15% per paper.",
    available: true,
  },
  "N-Elective": {
    id: "N-Elective",
    label: "N(A)-Level Elective Geography",
    shortLabel: "N-Level Elective",
    code: "Syllabus 2125",
    level: "N",
    type: "Elective",
    color: "#0d9488",
    clusters: [
      "Geography in Everyday Life",
      "Climate",
      "Tectonics",
    ],
    // 1 paper, 50 marks
    // Section A: Cluster 1 Geography in Everyday Life — 25 marks (compulsory)
    // Section B: Cluster 2 Climate OR Cluster 3 Tectonics — 25 marks (choice)
    papers: {
      1: {
        sections: {
          A: { cluster: "Geography in Everyday Life", marks: 25, topics: ["Thinking Geographically", "Sustainable Development", "Geographical Methods"] },
          B: {
            note: "Choice of Climate OR Tectonics", marks: 25,
            options: {
              Climate: ["Weather and Climate", "Climate Change", "Climate Action"],
              Tectonics: ["Plate Tectonics", "Earthquakes and Volcanoes", "Disaster Risk Management"],
            }
          }
        }
      }
    },
    topics: {
      "Geography in Everyday Life": ["Thinking Geographically", "Sustainable Development", "Geographical Methods"],
      "Climate": ["Weather and Climate", "Climate Change", "Climate Action"],
      "Tectonics": ["Plate Tectonics", "Earthquakes and Volcanoes", "Disaster Risk Management"],
    },
    lormMarks: 6,
    lormDescriptors: {
      L3: "5–6: Both sides, range of points, good elaboration, comprehensive examples, well-supported evaluation.",
      L2: "3–4: One side well argued, good examples, partial evaluation.",
      L1: "1–2: Limited/listed, generic examples, evaluation missing.",
    },
    promptNote: "This is N(A)-Level Elective Geography (Syllabus 2125, Humanities). 1 paper, 50 marks. Section A (25m): Geography in Everyday Life — compulsory. Section B (25m): Climate OR Tectonics — student chooses one cluster. One 6-mark AO3 LORM question is in Section B; remaining questions are point-marked. Mark expectations are calibrated for N-Level: a well-elaborated single-sided argument can reach L3.",
    available: true,
  },
  "N-Pure": {
    id: "N-Pure",
    label: "N(A)-Level Pure Geography",
    shortLabel: "N-Level Pure",
    code: "Syllabus 2246",
    level: "N",
    type: "Pure",
    color: "#d97706",
    clusters: [
      "Geography in Everyday Life",
      "Tourism",
      "Climate",
    ],
    // 2 papers × 50 marks each
    // Paper 1: Topic 1.3 (Fieldwork/Geographical Methods) + Cluster 2 (Tourism)
    // Paper 2: Topics 1.1+1.2 (GEL) + Cluster 3 (Climate)
    papers: {
      1: { topics: ["Geographical Methods", "Tourism Activity", "Tourism Development", "Sustainable Tourism Development"] },
      2: { topics: ["Thinking Geographically", "Sustainable Development", "Weather and Climate", "Climate Change", "Climate Action"] },
    },
    topics: {
      "Geography in Everyday Life": ["Thinking Geographically", "Sustainable Development", "Geographical Methods"],
      "Tourism": ["Tourism Activity", "Tourism Development", "Sustainable Tourism Development"],
      "Climate": ["Weather and Climate", "Climate Change", "Climate Action"],
    },
    lormMarks: 6,
    lormDescriptors: {
      L3: "5–6: Both sides, range with elaboration, named examples, well-supported conclusion.",
      L2: "3–4: One side well argued, good examples.",
      L1: "1–2: Limited, generic, simple or missing evaluation.",
    },
    promptNote: "This is N(A)-Level Pure Geography (Syllabus 2246). 2 papers × 50 marks each. Paper 1: Geographical Methods (Topic 1.3) and Tourism (Cluster 2). Paper 2: Geography in Everyday Life (Topics 1.1–1.2) and Climate (Cluster 3). One 6-mark AO3 LORM question per paper. Extended Fieldwork assessed over 10 weeks. Mark expectations are calibrated for N-Level: a well-elaborated single-sided argument can reach L3.",
    available: true,
  },
};

const SYLLABUS_LABELS = {
  "O-Elective": "O-Level Elective Geography (2260)",
  "O-Pure": "O-Level Pure Geography (2279)",
  "N-Elective": "N-Level Elective Geography (2125)",
  "N-Pure": "N-Level Pure Geography (2246)",
};

// ─── PAPER STRUCTURES ─────────────────────────────────────────────────────────
const PAPER_STRUCTURES = {
  "N-Elective": {
    papers: ["main"],
    main: {
      label: "Geography Paper",
      time: 105,
      totalMarks: 50,
      sections: [
        {
          name: "Section A",
          compulsory: true,
          questions: [
            { cluster: "Geography in Everyday Life", marks: 25, essayMarks: null },
          ],
        },
        {
          name: "Section B",
          compulsory: false,
          choose: 1,
          questions: [
            { cluster: "Climate", marks: 25, essayMarks: 6 },
            { cluster: "Tectonics", marks: 25, essayMarks: 6 },
          ],
        },
      ],
    },
  },
  "O-Elective": {
    papers: ["main"],
    main: {
      label: "Geography Paper",
      time: 105,
      totalMarks: 50,
      sections: [
        {
          name: "Section A",
          compulsory: true,
          questions: [
            { cluster: "Geography in Everyday Life", marks: 14, essayMarks: null },
            { cluster: "Tourism", marks: 18, essayMarks: null },
          ],
        },
        {
          name: "Section B",
          compulsory: false,
          choose: 1,
          questions: [
            { cluster: "Climate", marks: 18, essayMarks: 9 },
            { cluster: "Tectonics", marks: 18, essayMarks: 9 },
          ],
        },
      ],
    },
  },
  "O-Pure": {
    papers: ["p1", "p2"],
    p1: {
      label: "Paper 1",
      time: 105,
      totalMarks: 50,
      blocked: true,
      blockedReason: "Paper 1 includes a fieldwork question that is being added — coming soon.",
      sections: [
        {
          name: "Compulsory",
          compulsory: true,
          questions: [
            { cluster: "Geography in Everyday Life", marks: 20, essayMarks: null, fieldwork: true },
            { cluster: "Tourism", marks: 15, essayMarks: 9 },
            { cluster: "Climate", marks: 15, essayMarks: 9 },
          ],
        },
      ],
    },
    p2: {
      label: "Paper 2",
      time: 105,
      totalMarks: 50,
      blocked: false,
      sections: [
        {
          name: "Compulsory",
          compulsory: true,
          questions: [
            { cluster: "Geography in Everyday Life", marks: 15, essayMarks: null },
            { cluster: "Tectonics", marks: 15, essayMarks: 9 },
            { cluster: "Singapore", marks: 20, essayMarks: 9 },
          ],
        },
      ],
    },
  },
  "N-Pure": {
    papers: ["p1", "p2"],
    p1: {
      label: "Paper 1",
      time: 105,
      totalMarks: 50,
      blocked: true,
      blockedReason: "Paper 1 includes a fieldwork question that is being added — coming soon.",
      sections: [
        {
          name: "Compulsory",
          compulsory: true,
          questions: [
            { cluster: "Geography in Everyday Life", marks: 25, essayMarks: null, fieldwork: true },
            { cluster: "Tourism", marks: 25, essayMarks: 6 },
          ],
        },
      ],
    },
    p2: {
      label: "Paper 2",
      time: 105,
      totalMarks: 50,
      blocked: false,
      sections: [
        {
          name: "Compulsory",
          compulsory: true,
          questions: [
            { cluster: "Geography in Everyday Life", marks: 25, essayMarks: null },
            { cluster: "Climate", marks: 25, essayMarks: 6 },
          ],
        },
      ],
    },
  },
};

// ─── ONBOARDING TOPICS ────────────────────────────────────────────────────────
const ONBOARDING_TOPICS = {
  "Geography in Everyday Life": [
    { id: "gel_thinking", label: "Thinking Geographically" },
    { id: "gel_sustainable", label: "Sustainable Development" },
    { id: "gel_fieldwork", label: "Geographical Methods & Fieldwork" },
  ],
  "Tourism": [
    { id: "tour_what", label: "What is Tourism?" },
    { id: "tour_impacts", label: "Impacts of Tourism" },
    { id: "tour_sustainable", label: "Sustainable Tourism" },
  ],
  "Climate": [
    { id: "clim_weather", label: "Weather & Climate" },
    { id: "clim_change", label: "Climate Change" },
    { id: "clim_action", label: "Climate Action" },
  ],
  "Tectonics": [
    { id: "tect_plates", label: "Plate Tectonics" },
    { id: "tect_hazards", label: "Earthquakes & Volcanoes" },
    { id: "tect_drm", label: "Disaster Risk Management" },
  ],
};

const ONBOARDING_DEFAULTS = {
  year: "sec4",
  syllabus: "O-Elective",
  topicsCovered: "all",
  examType: "olevels",
};

// ─── TIER / ACCESS ────────────────────────────────────────────────────────────
// Tiers: null (no account) → "free-account" → "basic" ($12.90) → "plus" ($15.90)
// basic: question bank + progress dashboard
// plus: basic + My Questions (custom input)
const TIER_RANK = { null: 0, "free-account": 1, basic: 2, plus: 3 };

// ─── BETA MODE ────────────────────────────────────────────────────────────────
// When true: hides Plus tier, hides all pricing, skips promo code screen.
// Set to false at launch to re-enable full tier/pricing UI.
const BETA_MODE = true;
const canAccess = (userTier, req) => (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[req] ?? 0);

// A question needs a figure (and should be excluded from practice pools) if:
// - it's explicitly marked figureRequired, OR
// - it has a figure object but no uploaded src/srcs yet
const needsFigure = (q) => q.figureRequired || (q.figure && !q.figure?.src && !q.figure?.srcs?.length);

// ─── QUESTION BANK ────────────────────────────────────────────────────────────
// syllabus: array of syllabus IDs this question applies to
const QUESTION_BANK = [
  {
    id: "q1", tier: "free", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Climate Change", skill: "Explain", marks: 4,
    question: "Explain how human activities have contributed to the enhanced greenhouse effect.",
    context: null, figure: null
  },
  {
    id: "q2", tier: "free", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Climate Change", skill: "Describe", marks: 3,
    question: "Describe the relationship between solar activity and global surface temperature changes shown in Fig. 2.3.",
    context: "The graph shows solar activity (watts/m²) and global surface temperature change (°C) from 1880 to 2020.",
    figure: {
      description: "Fig. 2.3 — Solar activity vs global surface temperature 1880–2020",
      placeholder: "📈 Two-line graph. Solar activity (dotted): stable ~1361–1362 W/m². Global temperature (solid): rises from −0.5°C (1880) to +1.0°C (2020), sharply accelerating post-1950.",
      caption: "Solar activity remains relatively flat while temperature rises sharply post-1950. The divergence is key to your answer."
    }
  },
  {
    id: "q3", tier: "free", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Action", skill: "Evaluate", marks: 9,
    question: "'Adaptation strategies are more effective than mitigation strategies in managing the impacts of climate change.' To what extent do you agree with this statement? Explain your answer.",
    context: null, figure: null
  },
  {
    id: "q3n", tier: "free", syllabus: ["N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Climate Action", skill: "Evaluate", marks: 6,
    question: "'Adaptation strategies are more effective than mitigation strategies in managing the impacts of climate change.' To what extent do you agree with this statement? Explain your answer.",
    context: null, figure: null
  },
  {
    id: "q4", tier: "free", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Weather and Climate", skill: "Describe", marks: 3,
    question: "Describe the temperature and rainfall characteristics of an equatorial climate.",
    context: null, figure: null
  },
  {
    id: "q5", tier: "free", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Action", skill: "Evaluate", marks: 6,
    question: "'Mitigation strategies adopted by countries to build climatic resilience can only be partially effective.' To what extent do you agree with this statement? Explain your answer.",
    context: null, figure: null
  },
  {
    id: "q6", tier: "paid", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Climate Change", skill: "Explain", marks: 2,
    question: "Explain why urban areas tend to experience higher temperatures than surrounding rural areas.",
    context: null, figure: null
  },
  {
    id: "q7", tier: "paid", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Climate Change", skill: "Explain", marks: 4,
    question: "Explain how rising sea levels caused by climate change can result in economic losses for coastal communities.",
    context: null, figure: null
  },
  {
    id: "q8", tier: "paid", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Climate Action", skill: "Evaluate", marks: 3,
    question: "Evaluate the effectiveness of international agreements such as the Paris Agreement in reducing global carbon emissions.",
    context: null, figure: null
  },
  {
    id: "q9", tier: "paid", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Weather and Climate", skill: "Describe", marks: 3,
    question: "Describe the rainfall pattern shown in Fig. 2.2.", context: "Total annual rainfall: 1909mm.",
    figure: {
      description: "Fig. 2.2 — Climate graph, tropical monsoon location",
      placeholder: "📊 Climate graph. Rainfall bars: peaks Jun–Oct (Sep ~310mm), very low Nov–May (Jan ~30mm). Temperature line flat 26–29°C.",
      caption: "Distinct wet season (Jun–Oct) and dry season (Nov–May). Cite at least two specific monthly figures."
    }
  },
  {
    id: "q10", tier: "paid", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Climate Change", skill: "Explain", marks: 3,
    question: "Explain how deforestation contributes to climate change.",
    context: null, figure: null
  },
  {
    id: "q11", tier: "paid", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Weather and Climate", skill: "Describe", marks: 3,
    question: "Describe the global distribution of areas most vulnerable to the effects of climate change shown in Fig. 3.1.",
    context: null,
    figure: {
      description: "Fig. 3.1 — Global vulnerability to climate change impacts",
      placeholder: "🗺️ World map. High vulnerability (dark shading): Sub-Saharan Africa, South and Southeast Asia, low-lying Pacific island states, parts of Central America. Low vulnerability: most of Europe, North America, Australia.",
      caption: "Focus on regions, not individual countries. Note the link between low income and high vulnerability."
    }
  },
  {
    id: "q12", tier: "paid", syllabus: ["O-Elective", "O-Pure", "N-Elective", "N-Pure"],
    cluster: "Climate", topic: "Climate Change", skill: "Compare", marks: 3,
    question: "Using Fig. 2.4, compare the annual CO₂ emissions per capita between developed and developing countries shown.",
    context: null,
    figure: {
      description: "Fig. 2.4 — CO₂ emissions per capita (tonnes), selected countries",
      placeholder: "📊 Bar chart. Developed: USA ~15t, Australia ~15t, Germany ~9t, UK ~5t. Developing: China ~8t, Brazil ~2t, India ~2t, Nigeria ~0.6t.",
      caption: "Range: 0.6–15 tonnes. USA and Australia highest; Nigeria lowest. Make a direct comparison with figures."
    }
  },

  // ── PRELIM: SCH1 — Paper 1 (GEL/Fieldwork, Tourism, Climate) ──────────────
  // FIELDWORK QUESTIONS — temporarily removed, pending dedicated fieldwork UI
  // To be reinstated before second testing phase
  // See: fieldwork scenario design spec
  // {
  //   id: "prelim_sch1_p1_q1a",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation", skill: "Fieldwork", marks: 2,
  //   question: "State where the students may have retrieved the map from and, other than showing location, explain one possible use of the map in their investigation.",
  //   context: "A group of students wanted to study the impact of Park Connector Networks (PCNs) on its visitors, focusing on the Southern Ridges PCN, with the hypothesis: \"The Southern Ridges Park Connector Network has made a positive impact on its visitors.\" They began by studying a map featuring all PCNs in Singapore (Fig. 1.1).",
  //   figure: null
  // },
  {
    id: "prelim_sch1_p1_q1bi",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Risk Assessment", skill: "Evaluate", marks: 2,
    question: "Based on Fig. 1.2, assess the level of risk involved in conducting their investigation at the Southern Ridges PCN.",
    context: "Before going to the Southern Ridges PCN, the students completed a risk assessment (Fig. 1.2).",
    figure: {
      description: "Fig. 1.2 — Risk assessment table. Four columns: Hazard, Likelihood (1–5), Severity (1–5), Degree of Risk (= Likelihood × Severity). Four hazards: (1) Getting lost / separated — likelihood 2, severity 2, risk 4; (2) Exposure to high temperature — likelihood 3, severity 3, risk 9; (3) Caught in heavy rainfall — likelihood 3, severity 2, risk 6; (4) Slipping / tripping / falling — likelihood 2, severity 4, risk 8.",
      placeholder: "Fig. 1.2 — Risk Assessment Table",
      caption: "Identify the highest-risk hazard (exposure to high temperature, score 9) and judge the overall risk level across all four hazards."
    }
  },
  // {
  //   id: "prelim_sch1_p1_q1bii",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Risk Management", skill: "Fieldwork", marks: 2,
  //   question: "Suggest two strategies that the students can adopt to prepare for the hazard with the highest degree of risk.",
  //   context: "From the risk assessment (Fig. 1.2), the hazard with the highest degree of risk is exposure to high temperature (likelihood 3 × severity 3 = 9).",
  //   figure: null
  // },
  // {
  //   id: "prelim_sch1_p1_q1ci",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Data Presentation", skill: "Fieldwork", marks: 2,
  //   question: "Describe how the data collected for Question 1 of the interview (\"Where in Singapore are you from?\") could be presented on a map of Singapore.",
  //   context: "The students prepared an interview questionnaire (Fig. 1.3) to use with 50 visitors at the Southern Ridges PCN. Question 1 asks: \"Where in Singapore are you from?\"",
  //   figure: null
  // },
  // {
  //   id: "prelim_sch1_p1_q1cii",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Data Collection Methods", skill: "Fieldwork", marks: 2,
  //   question: "Suggest why asking respondents to draw a mental map of their experience (Question 6 of the questionnaire) is a good idea.",
  //   context: "The interview questionnaire (Fig. 1.3) includes Question 6: \"Please draw a mental map of the different sites you visited along the Southern Ridges.\"",
  //   figure: null
  // },
  // {
  //   id: "prelim_sch1_p1_q1ciii",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Sampling", skill: "Fieldwork", marks: 4,
  //   figureRequired: true,
  //   question: "With reference to Fig. 1.4, explain how the students could sample visitors to collect the data needed to test their hypothesis. Justify your choice of sampling method.",
  //   context: "The students aimed to interview 50 visitors on one weekend morning at the Southern Ridges PCN. Fig. 1.4 shows a map of the Southern Ridges trail network and key entry/exit points.",
  //   figure: {
  //     description: "Fig. 1.4 — Map of the Southern Ridges PCN showing the trail network connecting: Mount Faber Park, Telok Blangah Hill Park, HortPark, Kent Ridge Park, and Labrador Nature Reserve. Multiple entry points and trail junctions are marked along a roughly east–west linear corridor in southern Singapore.",
  //     placeholder: "Fig. 1.4 — Map of Southern Ridges PCN",
  //     caption: "Use the map to justify where to station yourself to intercept visitors and which sampling method (systematic, random, or stratified) best suits the multiple entry points shown."
  //   }
  // },
  {
    id: "prelim_sch1_p1_q1d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Hypothesis Evaluation", skill: "Evaluate", marks: 6,
    figureRequired: true,
    question: "Using Figs. 1.5 and 1.6 only, evaluate how well the data supports the revised hypothesis: \"The Southern Ridges has made a positive impact on its visitors and the environment.\"",
    context: "The students expanded their hypothesis to include environmental impact and conducted both visitor interviews and an environmental observation survey. Fig. 1.5 shows visitor survey results; Fig. 1.6 shows the environmental observation results.",
    figure: {
      description: "Fig. 1.5 — Grouped bar chart 'Respondents' Opinions of the Impact of Southern Ridges.' Y-axis: Number of Respondents (0–20+). X-axis: Strongly Disagree / Disagree / Neutral / Agree / Strongly Agree. Three bar groups: Q3 Mental Well-being, Q4 Trail Accessibility, Q5 Environmental Awareness. Agree bars highest for all three (~18–21 respondents); Q5 shows more Disagree/Strongly Disagree responses than Q3 or Q4. Fig. 1.6 — Horizontal bar chart 'Environmental Observation Survey.' X-axis: impact score −5 to +5. Five indicators: Educational signboards along Marang Trail (~+3.5); Noise pollution near Alexandra Arch (~+1.5); Trail erosion in Forest Walk section (~+1.5); Biodiversity near Telok Blangah Hill (~+3.5); Litter along Henderson Waves area (~+1).",
      placeholder: "Fig. 1.5 — Visitor Survey Grouped Bar Chart; Fig. 1.6 — Environmental Observation Horizontal Bar Chart",
      caption: "Use specific data from both charts. Acknowledge supporting evidence (majority Agree/Strongly Agree for Q3 and Q4; positive scores for biodiversity and signboards) and limitations (mixed views on Q5; noise and litter scores near neutral)."
    }
  },
  {
    id: "prelim_sch1_p1_q2a",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Factors Contributing to Growth of Tourism", skill: "Explain", marks: 3,
    question: "With the help of an example, explain how an increase in the ability to travel has led to the growth of tourism.",
    context: null, figure: null
  },
  {
    id: "prelim_sch1_p1_q2b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Impact of Tourism — Cultural Dilution", skill: "Compare", marks: 3,
    question: "Using Fig. 2, compare the role of Chinatown in Singapore over time and explain how this change may lead to cultural dilution if not carefully managed.",
    context: "Study Fig. 2, which shows two perspectives about Chinatown in Singapore.",
    figure: {
      description: "Fig. 2 — Two-perspective cartoon of Chinatown. An elderly Chinese man in traditional dress: \"In 1819, Raffles allocated this area for Chinese immigrants. We lived, worked, and supported one another here — it was our home.\" A young tourist with a camera: \"Today, Chinatown is filled with cultural festivals, heritage trails, and shops for tourists. The community feel is gone, but its history lives on for visitors to explore.\" Background shows shophouse-lined streets.",
      placeholder: "Fig. 2 — Two-perspective cartoon of Chinatown, Singapore",
      caption: "Compare Chinatown's original function (residential/working community) to its current function (tourism destination), then explain how this shift can erode authentic culture, local businesses, and community life."
    }
  },
  {
    id: "prelim_sch1_p1_q2c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Positive Impacts of Tourism", skill: "Explain", marks: 5,
    question: "How does tourism positively affect the society and economy of places? Illustrate your answer with an example that you have studied.",
    context: null, figure: null
  },
  {
    id: "prelim_sch1_p1_q2d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Managing Tourism — Pro-Poor Tourism", skill: "Explain", marks: 4,
    question: "Explain pro-poor tourism and its limitations.",
    context: null, figure: null
  },
  {
    id: "prelim_sch1_p1_q3a",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Urban Heat Island Effect", skill: "Describe", marks: 2,
    question: "Using Figs. 3.1 and 3.2, describe the distribution of the Urban Heat Island (UHI) effect in Singapore.",
    context: "Study Fig. 3.1, which shows the intensity of the UHI effect in Singapore, and Fig. 3.2, a satellite image showing the location of green spaces in Singapore.",
    figure: {
      description: "Fig. 3.1 — Map of Singapore with UHI intensity shading. Higher intensity concentrated in the central and southern urban core (CBD, industrial zones, dense residential areas). Lower intensity in areas with green spaces. Fig. 3.2 — Satellite image of Singapore with green spaces highlighted: Central Catchment Nature Reserve, Western Catchment/Jurong, and scattered parks.",
      placeholder: "Fig. 3.1 — UHI Intensity Map; Fig. 3.2 — Satellite Image of Green Spaces",
      caption: "Describe where UHI is highest and lowest, then link the distribution to presence/absence of green spaces in Fig. 3.2. Note the urban core vs. periphery contrast."
    }
  },
  {
    id: "prelim_sch1_p1_q3b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Regional Winds — Northeast Monsoon", skill: "Explain", marks: 4,
    question: "Explain the formation of the regional winds experienced in Singapore during the months of October to February.",
    context: null, figure: null
  },
  {
    id: "prelim_sch1_p1_q3c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Managing Climate Change — Adaptation vs Mitigation", skill: "Evaluate", marks: 9,
    question: "\"The adoption of adaptation strategies is sufficient for communities to build resilience against climate change.\" With reference to Fig. 3.3, to what extent do you consider this statement to be true? Explain your answer.",
    context: "Study Fig. 3.3, which shows strategies taken to manage the impact of climate change.",
    figure: {
      description: "Fig. 3.3 — Venn diagram of climate change management strategies. Left circle (adaptation only): Flood protection; Infrastructure and building design; Disaster management and business continuity. Right circle (mitigation only): Sustainable transportation; Energy efficiency; Renewable energy. Overlapping centre (both): Urban forest; Complete communities; Water and energy conservation.",
      placeholder: "Fig. 3.3 — Venn Diagram: Adaptation and Mitigation Strategies",
      caption: "Use the diagram to identify adaptation-only, mitigation-only, and dual-purpose strategies. Argue whether adaptation alone is sufficient or whether mitigation (addressing root causes) is also necessary."
    }
  },

  // ── PRELIM: SCH1 — Paper 2 (GEL, Tectonics, Singapore) ───────────────────
  {
    id: "prelim_sch1_p2_q1a",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Sense of Place", skill: "Describe", marks: 3,
    question: "With reference to Fig. 1.1, describe how a sense of place is acquired.",
    context: "Study Fig. 1.1, which shows people gathering near a temple to celebrate Diwali festival in Ayodhya, India.",
    figure: {
      description: "Fig. 1.1 — Night photograph: large crowd at a temple in Ayodhya during Diwali. Foreground: hundreds of people placing oil lamps (diyas) arranged in glowing patterns on the ground. Background: illuminated temple with ornate domes and towers. Scene conveys religious devotion, communal ritual, cultural tradition, and shared identity tied to the place.",
      placeholder: "Fig. 1.1 — Photograph: Diwali celebrations at Ayodhya temple",
      caption: "Use specific visual elements — the temple as a landmark, the communal ritual of placing diyas, the large shared gathering — to explain how repeated participation in cultural/religious events at a specific location creates emotional attachment and a sense of belonging.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch1_p2_q1a_fig1.png"
    }
  },
  {
    id: "prelim_sch1_p2_q1b",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Ecosystem Services — Supporting Services", skill: "Explain", marks: 4,
    question: "Explain the benefits that supporting ecosystem services provide for urban neighbourhoods.",
    context: null, figure: null
  },
  {
    id: "prelim_sch1_p2_q1c",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Data Response — Traffic Accidents", skill: "Describe", marks: 3,
    question: "Using Fig. 1.2, describe the occurrences of traffic accidents in 2022 and 2023.",
    context: "Study Fig. 1.2, which shows the number and causes of traffic accidents in Singapore in 2022 and 2023.",
    figure: {
      description: "Fig. 1.2 — Two pie charts. 2022 (total ~1,450 accidents): Speeding 1138 (79%), Drink driving 175 (12%), Running red light 137 (9%). 2023 (total ~916 accidents): Speeding 624 (68%), Drink driving 180 (20%), Running red light 112 (12%). Key changes: total accidents fell by ~534; speeding fell in number and share; drink driving rose in both absolute number (175→180) and proportion (12%→20%).",
      placeholder: "Fig. 1.2 — Pie Charts: Traffic Accident Causes, Singapore 2022 and 2023",
      caption: "Describe the overall change in total accidents, then compare proportions and absolute numbers for each cause across both years. Use specific figures from both charts."
    }
  },
  {
    id: "prelim_sch1_p2_q1d",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Human Impact on Greenspace", skill: "Explain", marks: 2,
    question: "With reference to Fig. 1.3, explain how people using the community park may bring problems to nature.",
    context: "Study Fig. 1.3, which shows a community park in an urban area in the USA.",
    figure: {
      description: "Fig. 1.3 — Photograph of a landscaped urban community park in the USA. Labelled features: residential tower blocks (background); sheltered wooden pergola; chairs and benches; rock climbing wall; children's play area; pedestrian boardwalk bridge crossing over natural ground. Trees and planted garden beds throughout. People walking, using the bridge, and recreating.",
      placeholder: "Fig. 1.3 — Photograph: Community Park, Urban USA",
      caption: "Reference specific features — the boardwalk over natural ground, the play area, the high volume of visitors — and explain how intensive use causes soil compaction, habitat disturbance, noise pollution, and waste that harm ecosystems within and around the park."
    }
  },
  {
    id: "prelim_sch1_p2_q2b",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Tectonics", topic: "Sea Floor Spreading", skill: "Explain", marks: 3,
    question: "With reference to Fig. 2.1, account for the change in the age of oceanic rocks with increasing distance from the mid-ocean ridge.",
    context: "Study Fig. 2.1, which shows a mid-ocean ridge.",
    figure: {
      description: "Fig. 2.1 — 3D cross-section of a mid-ocean ridge. Labels: Mid-ocean ridge (top centre); Lithosphere (rigid plates on both sides); Asthenosphere (semi-molten layer below). Convection current arrows rise beneath the ridge and diverge laterally. Striped oceanic crust layers show alternating magnetic polarity bands — thinner/newer at the ridge centre, thicker/older further away.",
      placeholder: "Fig. 2.1 — 3D Diagram of Mid-Ocean Ridge",
      caption: "Trace the process: magma rises at the ridge, cools into new crust, then moves away as more magma is added. Rocks nearest the ridge are youngest; rocks furthest away are oldest. Reference convection currents in the asthenosphere as the driving force."
    }
  },
  {
    id: "prelim_sch1_p2_q2c",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Tectonics", topic: "Volcanic Hazards — Impact on Ecosystems", skill: "Explain", marks: 3,
    question: "With reference to Fig. 2.2, explain how volcanic eruptions damage natural ecosystems.",
    context: "Study Fig. 2.2, which shows Mount St Helens before and after the 1982 eruption.",
    figure: {
      description: "Fig. 2.2 — Split photograph of Mount St Helens, USA. Before: symmetrical snow-capped stratovolcano above a calm blue lake, surrounded by dense green coniferous forest. After (1982): truncated peak with a large crater; surrounding landscape covered in grey ash; dead, flattened tree trunks over a barren wasteland; lake buried; pioneer wildflowers (fireweed) beginning to recolonise the foreground.",
      placeholder: "Fig. 2.2 — Before and After Photographs of Mount St Helens (1982)",
      caption: "Compare the two images directly. Use the before to establish the thriving ecosystem; use the after to explain how pyroclastic flows, lateral blasts, and ash fall destroyed forest, buried the lake, and killed fauna and flora. Note the pioneer recolonisation in the foreground as early ecological succession."
    }
  },
  {
    id: "prelim_sch1_p2_q2d",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Tectonics", topic: "Earthquake Hazards — Disaster Risk Factors", skill: "Evaluate", marks: 9,
    question: "\"The disaster risk caused by an earthquake at a place is most affected by its distance from the earthquake epicentre.\" With reference to Figs. 2.3 and 2.4, to what extent do you consider the above statement to be true? Support your answer with relevant examples.",
    context: "Study Figs. 2.3 and 2.4, which show information about earthquakes in different places.",
    figure: {
      description: "Fig. 2.3 — Map of Sichuan Earthquake 2008 (M7.9, depth 19km). Shaking intensity zones from epicentre near Dujiangyan: Severe (immediate area); Very strong (~50km, includes Chengdu and Mianyang); Strong (wider Sichuan region); Moderate (extends into Gansu, Shaanxi, Chongqing — several hundred km away). Fig. 2.4 — Horizontal bar chart: Countries hit by most earthquakes 1990–2024. Values: China 186, Indonesia 166, Iran 109, Japan 98, United States 78, Turkey 62, India 58, Philippines 55.",
      placeholder: "Fig. 2.3 — Sichuan Earthquake 2008 Shaking Map; Fig. 2.4 — Countries Most Affected by Earthquakes Bar Chart",
      caption: "Fig. 2.3 supports the statement (shaking weakens with distance — use the concentric zones). Use Fig. 2.4 to challenge it: countries with similar earthquake frequency (e.g. Indonesia vs. Japan) have very different disaster risk due to building standards, preparedness, and population vulnerability — factors unrelated to epicentre distance."
    }
  },
  {
    id: "prelim_sch1_p2_q3a",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Singapore", topic: "Coastal Ecosystems — Distribution", skill: "Describe", marks: 2,
    question: "Using Fig. 3.1, describe the distribution of mangroves and corals in Singapore.",
    context: "Study Fig. 3.1, which shows a map of some of Singapore's coastal ecosystems.",
    figure: {
      description: "Fig. 3.1 — Map of Singapore showing coastal ecosystems: corals (blue), mangroves (red), sand/mudflats (green). Mangroves concentrated along the northwest coast (Lim Chu Kang, Sungei Buloh, Straits of Johor) and northeast (Pulau Ubin, Chek Jawa, Punggol). Corals found almost exclusively in the south and southwest — southern offshore islands including Cyrene Reefs, Sisters' Islands, Pulau Hantu, Semakau, St John's Island, Kusu Island, Lazarus Island. Clear north–south contrast: mangroves dominate northern coasts; corals dominate southern offshore areas.",
      placeholder: "Fig. 3.1 — Map of Singapore Coastal Ecosystems",
      caption: "Describe mangroves and corals separately using place names from the map. Note the clear north–south spatial contrast between the two ecosystem types."
    }
  },
  {
    id: "prelim_sch1_p2_q3b",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Singapore", topic: "Ageing Population — Economic Impact", skill: "Explain", marks: 4,
    question: "With reference to Fig. 3.2 only, identify a possible demographic challenge that such a population structure may present and explain its impact on the economic viability of Singapore.",
    context: "Study Fig. 3.2, which shows a population pyramid of Singapore in 2024.",
    figure: {
      description: "Fig. 3.2 — Population pyramid, Singapore 2024 (source: U.S. Census Bureau). X-axis: population in thousands (300K each side, male and female). Y-axis: 5-year age bands from 0–4 to 100+. Shape: widest bars at 30–34 to 50–54 age groups (~200–280K per bar); narrow base at 0–4, 5–9, 10–14 (low birth rates); substantial bars at 65+ age groups. Overall: top-heavy/barrel shape indicating ageing population with low birth rates and growing elderly dependency.",
      placeholder: "Fig. 3.2 — Population Pyramid, Singapore 2024",
      caption: "Identify the challenge shown by the narrow base and wide upper bars — ageing population and shrinking future workforce. Explain economic consequences: rising old-age dependency ratio, higher healthcare/elderly spending, smaller labour force, lower tax revenues, reduced economic productivity."
    }
  },
  {
    id: "prelim_sch1_p2_q3c",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Singapore", topic: "Social Resilience — SkillsFuture", skill: "Explain", marks: 4,
    question: "With reference to Fig. 3.3, explain how schemes like SkillsFuture help in building social resilience in Singapore.",
    context: "Study Fig. 3.3, which shows the SkillsFuture scheme introduced by the Singapore government.",
    figure: {
      description: "Fig. 3.3 — Screenshot from MySkillsFuture portal. Key details: (1) NEW from 1 May 2024 — SkillsFuture Credit (Mid-Career) top-up of $4,000 (non-expiring) to offset course fees for courses with strong employability outcomes. (2) Mid-Career Enhanced Subsidy (MCES) covers up to 90% of fees for SkillsFuture-funded courses. (3) ENHANCED from AY2025 — Singaporeans can receive subsidies for a second full-time diploma and qualify for MCES.",
      placeholder: "Fig. 3.3 — SkillsFuture Portal Screenshot",
      caption: "Use specific scheme features ($4,000 top-up, 90% MCES subsidy, second diploma support) to explain how SkillsFuture helps mid-career workers upskill and remain employable, reducing inequality and strengthening Singapore's collective resilience to economic disruption."
    }
  },
  {
    id: "prelim_sch1_p2_q3d",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Singapore", topic: "Tectonic Threats and Opportunities", skill: "Explain", marks: 4,
    question: "With the help of Fig. 3.4, explain the possible tectonic threats to Singapore and how Singapore has managed to turn them into opportunities.",
    context: "Study Fig. 3.4, which shows tectonic information in Southeast Asia.",
    figure: {
      description: "Fig. 3.4 — Map of Southeast Asia showing: regional fault lines (dashed lines, including East Vietnam Fault, Mae Ping Fault, Three Pagodas Fault running through Peninsular Malaysia close to Singapore); undersea volcanoes (blue circles, 466 in the region, high concentrations around Philippines, Indonesia, South China Sea). Singapore labelled in red as 'Place at Risk.' Singapore is relatively distant from main fault lines but surrounded by a tectonically active region.",
      placeholder: "Fig. 3.4 — Tectonic Map of Southeast Asia",
      caption: "Identify threats using the map (undersea volcanoes risking tsunami/ashfall; regional faults risking transmitted tremors). Then explain how Singapore converts threats into opportunities: becoming a regional hub for disaster risk research, early warning systems, and seismic-resilient construction expertise."
    }
  },
  {
    id: "prelim_sch1_p2_q3e",
    tier: "paid", syllabus: ["O-Pure"],
    cluster: "Singapore", topic: "Food Resilience and Climate Change", skill: "Evaluate", marks: 6,
    question: "Evaluate Singapore's effort in building food resilience to mitigate the impact of climate change. Support your answer with relevant examples.",
    context: null, figure: null
  },

  // ── PRELIM: SCH5 (NBSS) — O-Elective, 2025 ───────────────────────────────
  {
    id: "prelim_sch5_p1_q1a",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Sense of Place — Heritage Trails", skill: "Compare", marks: 4,
    question: "Using Fig. 1.1, describe the similarities and differences between the 'Play @ Pasir Ris' and 'Architectural Highlights' trails.",
    context: "Study Fig. 1.1, which shows a map of the Pasir Ris Heritage Trail in Singapore, launched in 2019 to make heritage more accessible within urban neighbourhoods.",
    figure: {
      description: "Fig. 1.1 — Map of Pasir Ris Heritage Trail. Three trail routes shown with different line styles: Coastal Heritage (solid line), Play @ Pasir Ris (dashed dotted), Architectural Highlights (dashed). Both Play @ Pasir Ris and Architectural Highlights have extended trail sections. Key numbered sites: (1) Adventure Playground — most popular for children in Pasir Ris Park; (2) Mangrove Forest — replanted along nearby housing estates; (3) Pasir Ris Town Park — Singapore's only commercial saltwater fishing pond, sustaining Pasir Ris's fishing culture; (4) Sakya Tenphel Ling — one of the first Tibetan Buddhist temples in Southeast Asia; (5) Masjid Al-Istighfar — one of the few mosques that opens 24 hours in Singapore. Play @ Pasir Ris covers recreational/park sites (Adventure Playground, Mangrove Forest, Pasir Ris Beach, Downtown East, Rivers of Pasir Ris). Architectural Highlights covers built heritage (flats with porthole motifs, flats with lighthouse facade, Sakya Tenphel Ling, Masjid Al-Istighfar, Loyang Tua Pek Kong Temple).",
      placeholder: "Fig. 1.1 — Map of Pasir Ris Heritage Trail (three trail routes)",
      caption: "Compare route focus, sites visited, and coverage area. Similarities: both pass through Pasir Ris, both have extended trail options, both highlight aspects of the area's identity. Differences: Play @ Pasir Ris focuses on natural/recreational sites (parks, mangroves, beach); Architectural Highlights focuses on built heritage (distinctive buildings, religious sites)."
    }
  },
  {
    id: "prelim_sch5_p1_q1b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Community Spaces and Nature in Urban Neighbourhoods", skill: "Describe", marks: 4,
    question: "Describe the benefits for residents to interact with community spaces and the natural environment in an urban neighbourhood.",
    context: "The 'Coastal Heritage' trail brings visitors and residents across some of the sites of cultural and community significance along the Pasir Ris coast and beachfront.",
    figure: null
  },
  {
    id: "prelim_sch5_p1_q1ci",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Data Interpretation", skill: "Evaluate", marks: 4,
    question: "Using Tables 1.2 and 1.3, evaluate the extent to which perceptions of the Pasir Ris Heritage Trail are influenced by age.",
    context: "Students surveyed elderly (aged 60+) and youth (aged 15–25) respondents using quota sampling and a closed-ended questionnaire at two locations: near Pasir Ris Central Hawker Centre (elderly) and Downtown East (youths).",
    figure: {
      description: "Table 1.2 — Main Reasons for Visiting the Trail (%). To reminisce about the past: Elderly 50%, Youths 10%. To learn more about heritage: Elderly 30%, Youths 30%. For photography/social media: Elderly 0%, Youths 40%. For relaxation/recreation: Elderly 20%, Youths 20%. Table 1.3 — Cultural Perceptions of Pasir Ris Heritage Trail (scale 1–5, where 5 = most meaningful). Four aspects rated by Elderly (60+) vs Youths (15–25): Helps me understand Pasir Ris history: 4.7 / 3.2. Makes me feel proud of my neighbourhood: 4.5 / 2.9. Encourages intergenerational bonding: 4.6 / 3.0. Represents my personal identity: 4.3 / 2.7.",
      placeholder: "Table 1.2 — Reasons for Visiting; Table 1.3 — Cultural Perception Ratings",
      caption: "Use specific data from both tables. Evidence age influences perception: elderly score all aspects 4.3–4.7 vs youth 2.7–3.2; 50% of elderly visit to reminisce vs 10% of youth; 40% of youth visit for photography vs 0% elderly. Similarity: equal proportions (30%/30%) visit to learn heritage; equal (20%/20%) for relaxation. Make an overall judgement about the extent of age's influence."
    }
  },
  {
    id: "prelim_sch5_p1_q1cii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Reliability", skill: "Evaluate", marks: 2,
    question: "Evaluate the reliability of the students' data collection method.",
    context: "The students used quota sampling and a closed-ended questionnaire survey conducted over one Saturday afternoon (2–6pm) at two locations: near Pasir Ris Central Hawker Centre (20 elderly respondents) and Downtown East (20 youth respondents).",
    figure: null
  },
  {
    id: "prelim_sch5_p1_q2ai",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Tourism Development — Butler Model (Consolidation Stage)", skill: "Explain", marks: 3,
    question: "With reference to Figs. 2.1 and 2.2, explain why Costa Rica's ecotourism industry was at the 'Consolidation' stage in 2019.",
    context: "Costa Rica has emerged as a global leader in ecotourism. Study Fig. 2.1, which shows changes in tourist arrivals and tourism receipts of Costa Rica from 1995 to 2019, and Fig. 2.2, which shows the range of ecotourism options offered in Costa Rica in 2019.",
    figure: {
      description: "Fig. 2.1 — Dual-axis line graph 'Changes in tourist arrivals and tourism receipts of Costa Rica.' Left Y-axis: Tourist Arrivals (thousands) 0–3,500. Right Y-axis: Tourism Receipts (millions USD) 0–4,500. X-axis: 1995–2019. Tourist Arrivals: grew from ~700k in 1995 to ~3,100k in 2019 with a plateau 2008–2010, reaching highest-ever level in 2019 but rate of growth levelling off. Tourism Receipts: grew from ~700m to ~3,900m, broadly tracking arrivals. Fig. 2.2 — Spectrum diagram of ecotourism options. Hard ecotourism (left): Multi-day trek in Corcovado National Park — physically active, smaller groups, specialised, self-planned. Middle: Farming experience at Finca Luna Nueva Lodge. Soft ecotourism (right): Staying at Arenal Springs Resort & Spa — physically passive, larger groups, multi-purpose, planned by tour operators.",
      placeholder: "Fig. 2.1 — Dual-axis line graph (tourist arrivals and receipts 1995–2019); Fig. 2.2 — Hard-to-soft ecotourism spectrum",
      caption: "Use Fig. 2.1 to show high but slowing visitor growth (characteristic of consolidation) and high receipts. Use Fig. 2.2 to show diversification from hard to soft ecotourism indicating a maturing, well-established industry.",

      srcs: ["https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q2ai_fig1.png", "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q2ai_fig2.png"]
    }
  },
  {
    id: "prelim_sch5_p1_q2aii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Types of Tourists — Dependable Tourist", skill: "Explain", marks: 2,
    question: "With reference to Fig. 2.2, explain which ecotourism option in Costa Rica would most likely appeal to a Dependable-type tourist.",
    context: "Study Fig. 2.2, which shows the range of ecotourism options offered in Costa Rica in 2019, ranging from hard to soft ecotourism.",
    figure: {
      description: "Fig. 2.2 — Ecotourism spectrum. Hard ecotourism: Multi-day trek in Corcovado National Park (physically active, smaller groups, specialised, self-planned). Middle: Farming experience at Finca Luna Nueva Lodge. Soft ecotourism: Staying at Arenal Springs Resort & Spa (physically passive and comfortable, larger groups, multi-purpose, planned by tour operators).",
      placeholder: "Fig. 2.2 — Hard-to-soft ecotourism spectrum",
      caption: "A Dependable tourist seeks organised, comfortable, safe travel with familiar amenities. Match this to the soft ecotourism end — Arenal Springs Resort & Spa — and explain why its characteristics suit a Dependable tourist.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q2aii_fig1.png"
    }
  },
  {
    id: "prelim_sch5_p1_q2aiii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Positive Economic or Social Impact of Ecotourism", skill: "Explain", marks: 2,
    question: "Explain one way in which ecotourism can have a positive economic or social impact on Costa Rica.",
    context: null, figure: null
  },
  {
    id: "prelim_sch5_p1_q2aiv",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Limitations of Ecotourism", skill: "Explain", marks: 2,
    question: "Explain two possible limitations of ecotourism.",
    context: null, figure: null
  },
  {
    id: "prelim_sch5_p1_q2b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Sustainable Tourism — Stakeholder Responsibility", skill: "Evaluate", marks: 9,
    question: "'The local community should be the main stakeholder ensuring sustainable tourism at a travel destination.' To what extent do you consider this statement to be true? Explain your answer.",
    context: null, figure: null
  },
  {
    id: "prelim_sch5_p1_q3ai",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Regional Winds — Northeast Monsoon in January", skill: "Explain", marks: 4,
    question: "With reference to Fig. 3.1, explain the direction of the monsoon wind system in January.",
    context: "Study Fig. 3.1, which shows the monsoon wind system between Asia and Australia in January.",
    figure: {
      description: "Fig. 3.1 — Map of Southeast Asia showing the monsoon wind system in January. Latitude: 30°S to 30°N. Red arrows show wind direction: originating over Asia (cold high-pressure zone, ~20–30°N) and blowing southward/southeastward across Southeast Asia (10°N to 0°), crossing the equator and turning toward northwest Australia (~10°S–20°S). Multiple arrows show the NE monsoon flowing from northeastern Asia through Indochina and the South China Sea toward Indonesia and northwestern Australia.",
      placeholder: "Fig. 3.1 — Map of monsoon wind system between Asia and Australia in January",
      caption: "Explain that in January, Asia is cold (winter high pressure) and Australia is experiencing summer (low pressure). Winds blow from Asia's high pressure southward to Australia. Note the wind deflects after crossing the equator (Coriolis effect) — NE monsoon in Southeast Asia becomes NW winds over Australia.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q3ai_fig1.png"
    }
  },
  {
    id: "prelim_sch5_p1_q3aii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Tropical Monsoon Climate — Characteristics", skill: "Describe", marks: 3,
    question: "Describe the temperature and rainfall characteristics of a place with tropical monsoon climate.",
    context: null, figure: null
  },
  {
    id: "prelim_sch5_p1_q3b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Change — Orbital Forcing (Eccentricity)", skill: "Explain", marks: 3,
    question: "Using Table 3.1, explain how the changes to the shape of Earth's orbit affect Earth's climate.",
    context: "Study Table 3.1, which shows the effect of the shape of Earth's orbit on Earth's climate.",
    figure: {
      description: "Table 3.1 — Effect of shape of Earth's orbit on Earth's climate. More circular orbit: distance from Sun 147–152 million km, range 5 million km, highest average temp ~16°C, lowest average temp ~14°C. More oval (elliptical) orbit: distance 141–156 million km, range 15 million km, highest average temp ~17°C, lowest average temp ~11°C.",
      placeholder: "Table 3.1 — Orbital shape and climate data",
      caption: "A more circular orbit keeps Earth at a consistent distance — smaller temperature range (14–16°C). A more oval orbit brings Earth closer at perihelion (~141m km) and further at aphelion (~156m km) — creating a wider temperature range (11–17°C). This eccentricity variation is one of the Milankovitch cycles.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q3b_fig1.png"
    }
  },
  {
    id: "prelim_sch5_p1_q3c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Change — Impact on Marine Ecosystems", skill: "Explain", marks: 4,
    question: "With reference to Fig. 3.2, explain the changes in geographical concentration of the bluefin tuna and shortfin mako in the northwest Atlantic Ocean.",
    context: "Study Fig. 3.2, which shows the change in geographical concentration of two species of fish — bluefin tuna and shortfin mako — in the northwest Atlantic Ocean over 30 years.",
    figure: {
      description: "Fig. 3.2 — Scatter map of northwest Atlantic Ocean. X-axis: Longitude 80°W–60°W. Y-axis: Latitude 35°N–45°N. USA landmass on left. Two species: Bluefin tuna (green/teal dots) and Shortfin mako (brown/orange dots). Each species has Past (lighter shade) and Future (darker shade) clusters. Past positions: both species concentrated around 38–40°N, 68–72°W. Future positions: both shifted northward — bluefin tuna future cluster around 41–42°N; shortfin mako also shifted north/northeast. Arrow indicates direction of change (northward/poleward). Both species show approximately 1–3 degrees of latitude northward shift over 30 years.",
      placeholder: "Fig. 3.2 — Scatter map: past and future distribution of bluefin tuna and shortfin mako, northwest Atlantic",
      caption: "Both species have shifted northward (poleward) over 30 years. Link to ocean warming caused by climate change — cooler preferred water conditions are now found progressively further north. Use specific latitude data from the map.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q3c_fig1.png"
    }
  },
  {
    id: "prelim_sch5_p1_q3di",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Change — Intensification of Extreme Weather", skill: "Explain", marks: 2,
    question: "Explain how climate change intensifies either flooding or droughts.",
    context: "Climate change leads to direct impacts on human systems through intensifying extreme weather events.",
    figure: null
  },
  {
    id: "prelim_sch5_p1_q3dii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Change — Impact on Ecosystem Services", skill: "Explain", marks: 2,
    question: "Explain how climate change affects either regulating ecosystem services or cultural ecosystem services.",
    context: "Climate change leads to indirect impacts on human systems by affecting regulating ecosystem services and cultural ecosystem services.",
    figure: null
  },
  {
    id: "prelim_sch5_p1_q4a",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Sea Floor Spreading — Age of Oceanic Crust", skill: "Explain", marks: 4,
    question: "With reference to Fig. 4.1, explain why the crust becomes older further away from tectonic landform X.",
    context: "Study Fig. 4.1, which shows tectonic landform X.",
    figure: {
      description: "Fig. 4.1 — Cross-section of a mid-ocean ridge (tectonic landform X). Labels: 'X' marks the ridge at top centre; 'NEWER CRUST' on both sides immediately adjacent to X; 'OLDER OCEANIC CRUST' further from the ridge; 'CONTINENTAL CRUST' at far edges; 'LITHOSPHERE' below the crust; 'MAGMA' rising at the ridge centre; 'ASTHENOSPHERE' (red) at the bottom with convection current arrows rising beneath the ridge and diverging laterally.",
      placeholder: "Fig. 4.1 — Cross-section of mid-ocean ridge (Tectonic Landform X)",
      caption: "Trace: magma rises from the asthenosphere at the ridge (X), cools and solidifies into new crust, moves away as fresh magma is added. Rock nearest the ridge is youngest; rock furthest away is oldest. Reference convection currents in the asthenosphere as the driving mechanism.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q4a_fig1.png"
    }
  },
  {
    id: "prelim_sch5_p1_q4b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Plate Tectonics — Slab-Pull Force", skill: "Describe", marks: 3,
    question: "Describe slab-pull force and its influence on plate movement.",
    context: null, figure: null
  },
  {
    id: "prelim_sch5_p1_q4c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Volcanic Hazards — Stratovolcano Identification", skill: "Explain", marks: 3,
    question: "Using Fig. 4.2, explain the type of volcano that Anak Krakatoa is likely to be from its eruption.",
    context: "Study Fig. 4.2, which shows Anak Krakatoa erupting in 2018. Anak Krakatoa is a volcanic island in Indonesia.",
    figure: {
      description: "Fig. 4.2 — Photograph of Anak Krakatoa erupting in 2018, taken from sea level. Steep, symmetrical conical island rising from the sea. Slopes covered in grey ash and bare rock with no vegetation. Tall column of grey ash and white/grey smoke erupts vertically from the summit into a clear blue sky. Explosive ash-producing eruption rather than flowing lava.",
      placeholder: "Fig. 4.2 — Photograph: Anak Krakatoa erupting in 2018",
      caption: "Identify features of a stratovolcano: steep-sided cone, explosive ash column (indicating viscous, silica-rich magma), ash-covered grey slopes. Contrast with a shield volcano (broad, gentle slopes; fluid lava). Explain that explosive eruption indicates high-viscosity magma that traps gases until pressure forces a violent eruption.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q4c_fig1.png"
    }
  },
  {
    id: "prelim_sch5_p1_q4d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Volcanic Landforms — Stratovolcano Shape", skill: "Explain", marks: 4,
    question: "With reference to Fig. 4.3, explain the shape and characteristics of Anak Krakatoa.",
    context: "Study Fig. 4.3, which is a sketch of Anak Krakatoa.",
    figure: {
      description: "Fig. 4.3 — Topographic sketch map of Anak Krakatoa. Key: contours at 50m intervals (100m and 200m contours visible); rock face; crater (solid black dot near summit); lava flow; forest; beach. North arrow present. Map not to scale. Features: beaches on coastal periphery; forested areas on lower slopes; bare rock face on steeper flanks; lava flow extending from near the crater toward the coast; single crater near summit. Closely spaced contours near summit indicate steep slopes; wider spacing on lower flanks.",
      placeholder: "Fig. 4.3 — Topographic sketch of Anak Krakatoa",
      caption: "Use contours to describe the steep conical shape (closely-spaced = steep slopes). Note the single crater near the summit. Identify features from past volcanic activity: lava flows, bare rock faces. Use the 100m and 200m contours to support description of height and slope angle.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch5_p1_q4d_fig1.png"
    }
  },
  {
    id: "prelim_sch5_p1_q4e",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Earthquake Hazards — Soil Liquefaction", skill: "Explain", marks: 2,
    question: "Explain how soil liquefaction affects either the natural or human system.",
    context: "Earthquakes affect the natural and human systems through hazards like soil liquefaction.",
    figure: null
  },
  {
    id: "prelim_sch5_p1_q4f",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Tectonic Disaster Risk — Vulnerable Conditions or Exposure", skill: "Explain", marks: 2,
    question: "Explain how the extent of tectonic disaster risk experienced in a place can be determined by either vulnerable conditions or exposure.",
    context: "The extent of tectonic disaster risk experienced in a place is determined by factors like vulnerable conditions or exposure.",
    figure: null
  },

  // ── PRELIM: SCH7 (SJC) — N-Elective 2125, 2024 ───────────────────────────
  {
    id: "prelim_sch7_p1_q1a",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Geography in Everyday Life", topic: "Spatial Hierarchy in Singapore Towns", skill: "Describe", marks: 3,
    question: "Study Fig. 1.1, which shows a spatial hierarchy found in Singapore. Describe the characteristics of each level of the hierarchy shown in Fig. 1.1.",
    context: null,
    figure: {
      description: "Fig. 1.1 — Spatial hierarchy diagram showing three levels with labelled drawings. (1) Residential Unit: a single low-rise house/flat unit. (2) Precinct: a cluster of two HDB-style apartment blocks side by side. (3) Neighbourhood: represented as a larger area boundary. A fourth bird's-eye sketch shows a town with a lake, community garden, and two bus stops, suggesting the broader town level.",
      placeholder: "Fig. 1.1 — Spatial hierarchy: Residential Unit, Precinct, Neighbourhood drawings",
      caption: "Focus on what makes each level distinct — the scale, number of units, and types of facilities or spaces associated with each level of the hierarchy."
    }
  },
  {
    id: "prelim_sch7_p1_q1bii",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Geography in Everyday Life", topic: "Town Planning in Singapore", skill: "Explain", marks: 4,
    question: "Using the information below, explain how town planning is carried out in Singapore.\n\nFacilities in a new Singapore town: Park — large green space with trees, playground and a fitness area. Integrated sports hub — a sports centre with public swimming pool, table tennis tables and badminton court. Bus stop — spread out at regular intervals so there is a bus stop near every apartment block. Covered linkway — located near each other, across different blocks for greater accessibility.",
    context: null, figure: null
  },
  {
    id: "prelim_sch7_p1_q1c",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Geography in Everyday Life", topic: "Environmental Stewardship and Sustainable Neighbourhoods", skill: "Explain", marks: 4,
    question: "Explain how environmental stewardship can help to build sustainable neighbourhoods.",
    context: null, figure: null
  },
  {
    id: "prelim_sch7_p1_q1dii",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Data Comparison", skill: "Compare", marks: 2,
    question: "Using the data below, contrast the level of satisfaction which residents have towards education facilities in Neighbourhood ABC and Neighbourhood XYZ.\n\nNeighbourhood ABC satisfaction with education facilities: Extremely Dissatisfied 1, Dissatisfied 1, Satisfied 9, Extremely Satisfied 9. Neighbourhood XYZ satisfaction with education facilities: Extremely Dissatisfied 8, Dissatisfied 8, Satisfied 2, Extremely Satisfied 2.",
    context: "Students surveyed the first 20 people they saw at the entrance of each neighbourhood on a Saturday evening.",
    figure: null
  },
  {
    id: "prelim_sch7_p1_q1diii",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Explaining Relationships", skill: "Explain", marks: 4,
    question: "Using the data below, explain the relationship between the overall level of satisfaction towards one's neighbourhood and the facilities present in the neighbourhood.\n\nOverall satisfaction: Neighbourhood ABC — Extremely Dissatisfied 3, Dissatisfied 3, Satisfied 6, Extremely Satisfied 8. Neighbourhood XYZ — Extremely Dissatisfied 7, Dissatisfied 8, Satisfied 3, Extremely Satisfied 2.\n\nNeighbourhood ABC mean satisfaction by facility: Healthcare 1/5/6/8, Eating areas 2/4/7/7, Recreation 2/7/6/5, Retail 5/9/4/2, Education 1/1/9/9. Mean: 2.2/5.2/6.4/6.2.\n\nNeighbourhood XYZ mean satisfaction by facility: Healthcare 1/2/9/8, Eating areas 6/7/3/4, Recreation 3/4/6/7, Retail 8/9/2/1, Education 8/8/2/2. Mean: 5.2/6.0/4.4/4.4.\n\n(Columns: Extremely Dissatisfied / Dissatisfied / Satisfied / Extremely Satisfied)",
    context: "Students surveyed the first 20 people they saw at the entrance of each neighbourhood on a Saturday evening.",
    figure: null
  },
  {
    id: "prelim_sch7_p1_q1div",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Evaluating Data Collection", skill: "Evaluate", marks: 4,
    question: "Evaluate the ease of data collection and the reliability of the data used in this investigation.",
    context: "20 students investigated resident satisfaction in two neighbourhoods, dividing into two groups of 10. Each group stood at the entrance of their neighbourhood and surveyed the first 20 people they saw on a Saturday evening. The hypothesis was: 'The level of satisfaction of residents in a neighbourhood is affected by the facilities present in a neighbourhood.' Sampling method used: convenience sampling.",
    figure: null
  },
  {
    id: "prelim_sch7_p1_q2b",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Tectonics", topic: "Earthquakes — Epicentre Distance and Deaths", skill: "Describe", marks: 4,
    question: "Study Fig. 2.2, which shows the relationship between the distance from the epicentre and number of deaths from earthquakes in Japan. Using Fig. 2.2, describe and explain the relationship between the distance of epicentre of earthquakes and the number of deaths caused.",
    context: null,
    figure: {
      description: "Fig. 2.2 — Scatter graph 'Relationship between Distance from Epicentre and Number of Deaths.' Y-axis: Distance from Epicentre (km), 0–60 km. X-axis: Number of Deaths (thousands), 0–70. Data points: at 0 km ~55,000 deaths; at 5 km ~20,000; at 10 km ~45,000; at 20 km ~35,000; at 30 km ~25,000; at 40 km ~15,000; at 50 km ~10,000; at 60 km ~5,000. General negative relationship (as distance increases, deaths decrease) with one anomaly at 5 km (lower than expected).",
      placeholder: "Fig. 2.2 — Scatter graph: distance from epicentre (Y, 0–60 km) vs number of deaths in thousands (X, 0–70)",
      caption: "Identify the overall trend, support with specific data values, explain why the trend occurs geographically, and note the anomaly at 5 km."
    }
  },
  {
    id: "prelim_sch7_p1_q2c",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Tectonics", topic: "Earthquakes — Soil Liquefaction Impacts", skill: "Explain", marks: 3,
    question: "Using a named example, explain how soil liquefaction due to earthquakes can affect natural and human systems.",
    context: null, figure: null
  },
  {
    id: "prelim_sch7_p1_q2d",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Tectonics", topic: "Earthquakes — Nature of Hazard and Disaster Risk", skill: "Explain", marks: 4,
    question: "Explain how the disaster risks caused by earthquakes can be influenced by the nature of the hazard.",
    context: null, figure: null
  },
  {
    id: "prelim_sch7_p1_q2e",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Tectonics", topic: "Volcanoes — Social and Economic Consequences", skill: "Explain", marks: 5,
    question: "Study Fig. 2.3, which shows information about the hazards caused by volcanic eruptions. Using Fig. 2.3, explain how volcanoes can cause social and economic consequences at an individual and national scale.",
    context: null,
    figure: {
      description: "Fig. 2.3 — Composite image 'Hazards of Volcanic Eruptions.' Central cross-section diagram of a volcano labelling: Prevailing Wind, Eruption Cloud, Tephra (Ash) Fall, Acid Rain, Bombs, Landslide, Pyroclastic Flow, Dome Collapse, Lava Flow, and Lahar. Four accompanying photographs: (1) Ash cloud from Eyjafjallajokull eruption, Iceland 2010. (2) Road flanked by devastated vegetation with smoke — pyroclastic flows from Mount Merapi, Indonesia claimed at least 122 lives (2018). (3) Aerial view of Armero, Colombia, totally destroyed by lahars from Nevado del Ruiz volcano (1985). (4) Person near lava flow burning through a suburban road — Kalpana, Hawaii, 100 houses destroyed by lava flow (1990).",
      placeholder: "Fig. 2.3 — Volcanic hazards composite: labelled cross-section diagram + 4 photos (Eyjafjallajokull ash cloud 2010, Merapi pyroclastic flows 2018, Armero lahars 1985, Kalpana Hawaii lava flow 1990)",
      caption: "Use the photographs and hazard labels to identify specific volcanic hazards. Link each to both a social consequence (lives, homes, wellbeing) and an economic consequence (finances, livelihoods, national costs). Distinguish between individual and national scales."
    }
  },
  {
    id: "prelim_sch7_p1_q2f",
    tier: "paid", syllabus: ["N-Elective"],
    cluster: "Tectonics", topic: "Disaster Risk Reduction — Monitoring and Warning Systems", skill: "Evaluate", marks: 6,
    question: "'Strengthening community resilience by developing monitoring and warning systems is the most effective way to reduce a country's disaster risk.' To what extent do you agree with this statement? Explain your answer with relevant examples.",
    context: null, figure: null
  },

  // ── PRELIM: SCH3 (BEATTY) — O-Elective, 2025 ─────────────────────────────
  {
    id: "prelim_sch3_p1_q1aii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Sustainability of Urban Neighbourhoods", skill: "Explain", marks: 3,
    figureRequired: true,
    question: "Using Fig. 1.1, explain how this neighbourhood achieved economic sustainability.",
    context: "Study Fig. 1.1, which shows a map of a neighbourhood in Toa Payoh.",
    figure: {
      description: "Fig. 1.1 — Aerial/street map (OneMap) of a bounded neighbourhood in Toa Payoh, Singapore. Red outline demarcates the neighbourhood boundary. Within the boundary: HDB residential blocks (numbered 190s–240s, Toa Payoh Spring and Toa Payoh North estates); Masjid (mosque) and Singapore Islamic Hub/Madrasah cluster near Braddell Road; Beatty Secondary School; two 'Mkt & Hawker Ctr' labels on western and eastern edges; 'News Ctr' on north-west; bus-stop icons distributed around the boundary; Braddell Road along the north. Scale bar: 0–100m. Mix of residential, educational, religious, commercial, and civic facilities all within walking distance.",
      placeholder: "Fig. 1.1 — Map of Toa Payoh neighbourhood with boundary, HDB blocks, school, mosque, markets/hawker centres, news centre, bus stops",
      caption: "Identify the mix and distribution of services and commercial facilities within the neighbourhood boundary and consider how their presence supports economic activity and self-sufficiency for residents.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q1aii_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q1b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Community Resilience", skill: "Describe", marks: 4,
    question: "Describe how community resilience can be developed.",
    context: null, figure: null
  },
  {
    id: "prelim_sch3_p1_q1ci",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Hypothesis Evaluation", skill: "Evaluate", marks: 3,
    figureRequired: true,
    question: "Using Figs. 1.2 and 1.3, evaluate how well the data supports the hypothesis: \"Services located in Toa Payoh Central attract users from further distances compared to services located in a typical Toa Payoh precinct.\"",
    context: "Students tested the hypothesis by interviewing 10 customers each at a bakery in Toa Payoh Central and a bakery in Toa Payoh Bloom precinct (3–4pm). Customers' postal codes were collected and residences plotted on flow line maps.",
    figure: {
      description: "Fig. 1.2 — Flow line map showing residences of 10 customers from the Toa Payoh Central bakery. Lines radiate from the bakery across a wide area of Toa Payoh and beyond; two lines are annotated 'Out of map range,' indicating customers living well outside the immediate area. Flow lines span multiple residential estates. Fig. 1.3 — Flow line map showing residences of 10 customers from the Toa Payoh Bloom precinct bakery. Flow lines are clustered tightly within the local precinct area; two also marked 'Out of map range' but appear to extend only slightly beyond the map edge. The cluster of flow lines is noticeably shorter and more concentrated than in Fig. 1.2.",
      placeholder: "Fig. 1.2 — Flow line map: Toa Payoh Central bakery customers (lines spread across wider area, two out-of-range); Fig. 1.3 — Flow line map: Toa Payoh Bloom precinct bakery customers (lines tightly clustered within local precinct, two out-of-range)",
      caption: "Compare the length and spread of flow lines in both maps. Argue whether the pattern supports or contradicts the hypothesis, and note limitations in what two maps of 10 customers each can tell you."
    }
  },
  // {
  //   id: "prelim_sch3_p1_q1cii",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Reliability", skill: "Fieldwork", marks: 3,
  //   question: "Evaluate the reliability of the students' investigation.",
  //   context: "Students split into two groups, each interviewing 10 customers at a bakery (Toa Payoh Central vs Toa Payoh Bloom precinct) from 3–4pm on the same day. Customers' postal codes were mapped on flow line maps.",
  //   figure: null
  // },
  {
    id: "prelim_sch3_p1_q2a",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Tourist Arrivals — Trends and Patterns", skill: "Compare", marks: 3,
    question: "Using Fig. 2.1, compare visitor arrivals from China and Southeast Asia to Taiwan from 2009 to 2018.",
    context: "Study Fig. 2.1, which shows the number of visitor arrivals in Taiwan from 2009 to 2018.",
    figure: {
      description: "Fig. 2.1 — Line graph 'Number of visitor arrivals in Taiwan 2009–2018.' Y-axis: Million people, 0–4.5. X-axis: 2009–2018. Four lines: China (blue) — starts ~1.0m (2009), rises steeply to peak ~4.0m (2015), then falls sharply to ~2.7m (2018). Southeast Asia (grey) — starts ~0.7m (2009), grows steadily to ~2.4m (2018), overtaking China in 2017–2018. Japan and South Korea (orange) — starts ~1.5m (2009), grows to ~3.0m (2018). Rest of world (gold) — starts ~1.5m (2009), grows to ~3.0m (2018).",
      placeholder: "Fig. 2.1 — Line graph of visitor arrivals to Taiwan 2009–2018: China peaks at ~4.0m in 2015 then falls; Southeast Asia grows steadily from ~0.7m to ~2.4m",
      caption: "Compare starting values, peak values, trends (increasing/decreasing/fluctuating), and relative positions of the China and Southeast Asia lines across the full 2009–2018 period.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q2a_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q2b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Impacts of Tourism", skill: "Explain", marks: 3,
    question: "With reference to Fig. 2.2, explain the possible impacts of tourism in Taipei.",
    context: "Study Fig. 2.2, which shows the popular Shilin night market in Taipei, a city in Taiwan.",
    figure: {
      description: "Fig. 2.2 — Night photograph of Shilin Night Market, Taipei. Dense, narrow street packed with large numbers of people (tourists and locals). Both sides lined with brightly lit stalls and shops selling food and goods; Chinese-character signage and brand billboards (Sony Ericsson, Vodafone, ASUS, Motorola) visible. Foreground stalls display food items. Very large crowd filling the full width of the street. Scene suggests high footfall, vibrant commercial activity, and a culturally distinctive atmosphere.",
      placeholder: "Fig. 2.2 — Night photo: Shilin Night Market, Taipei — densely crowded narrow street, brightly lit food/retail stalls, large tourist/local crowd, Chinese-language and English brand signage",
      caption: "Use visible evidence — crowd density, commercial activity, types of businesses, signage — to infer both positive impacts (economic activity, cultural showcase) and negative impacts (overcrowding, noise, commercialisation) that high tourist volumes bring.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q2b_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q2c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Types of Tourists — Niche Tourism", skill: "Explain", marks: 3,
    question: "Using Fig. 2.3, explain the type of tourists this itinerary would attract.",
    context: "Study Fig. 2.3, which shows a 4-day Greenland itinerary.",
    figure: {
      description: "Fig. 2.3 — 4-day Greenland itinerary (source: blueiceexplorer.gl). Day 1: Arrive in remote Narsarsuaq settlement. Day 2: Boat to Itilleq; 4 km hike along 'King's Road' to Igaliku with fjord and mountain views. Day 3: Explore Norse ruins at Gardar; optional challenging hikes including 17 km route to Lake 90 for glacier/iceberg views, 15 km Waterfall Tour, and climb of Nuuluk peak (823 m); opportunities to find rock crystals and moonstone. Day 4: Visit Qassiarsuk (Erik the Red's 982 AD settlement), Brattahlid ruins and museum; glacier/iceberg boat trip to Qooroq Isfjord — enjoy a drink with ice over 1,000 years old in remote Arctic waters. Photos show glacier calving into a fjord and an Arctic stone cairn landscape.",
      placeholder: "Fig. 2.3 — 4-day Greenland itinerary: remote settlement, 4 km and 17 km hikes, 823 m peak, Norse ruins, glacier/iceberg boat trips",
      caption: "Consider what the activities (long challenging hikes, remote locations, historical/natural interest), remoteness, and cultural elements reveal about the fitness level, motivations, and tourist type this itinerary attracts.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q2c_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q2d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Sustainable Tourism — Stakeholder Roles", skill: "Evaluate", marks: 9,
    question: "'The government is the most important stakeholder in influencing sustainable tourism.' How far do you agree? Give evidence to support your answer.",
    context: null, figure: null
  },
  {
    id: "prelim_sch3_p1_q3a",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Relative Humidity and Temperature Relationship", skill: "Describe", marks: 3,
    question: "Using Fig. 3.1, describe the relationship between relative humidity and air temperature.",
    context: "Study Fig. 3.1, which shows a dual-axis line graph of relative humidity and air temperature recorded over a 24-hour period.",
    figure: {
      description: "Fig. 3.1 — Dual-axis line graph over 24 hours (12 Midnight to 12 Midnight). Left Y-axis: Relative Humidity (%), 40–80%. Right Y-axis: Air Temperature (°C), −4 to 16°C. Relative humidity (solid line): starts ~73% at midnight, decreases to trough ~46% at noon, rises to ~61% by midnight. Air temperature (dashed line): starts ~3°C at midnight, peaks ~11°C at noon, falls to ~6°C by midnight. Clear inverse relationship — as temperature rises through the morning, humidity falls; as temperature falls in the evening, humidity rises.",
      placeholder: "Fig. 3.1 — Dual-axis 24-hour graph: RH starts ~73%, falls to ~46% at noon, rises to ~61%; temperature starts ~3°C, peaks ~11°C at noon, falls to ~6°C",
      caption: "Describe the pattern of each variable across 24 hours and identify the inverse relationship. Note where the relationship is strongest and quote specific data values.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q3a_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q3b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Local Winds — Land and Sea Breezes", skill: "Explain", marks: 4,
    question: "With reference to Fig. 3.2, explain how a land breeze occurs.",
    context: "Study Fig. 3.2, which shows the movement of air at a coastal area.",
    figure: {
      description: "Fig. 3.2 — Coastal cross-section diagram at night (crescent moon symbol). Land on left (labelled 'land cooler'), sea on right (labelled 'sea warmer'). Blue arrow labelled 'cool land breeze' flows from land rightward toward the sea at surface level. Orange curved arrow labelled 'warm air' rises from the sea surface and arcs back over the land at altitude, completing the circulation cell. Trees, a house, and a valley on the land; a sailing boat on the sea.",
      placeholder: "Fig. 3.2 — Coastal cross-section at night: land cooler, sea warmer; blue arrow = cool land breeze flowing land→sea; orange curved arrow = warm air rising from sea and returning over land at altitude",
      caption: "Use all labels and arrows to explain the sequence: differential cooling of land vs sea at night → land becomes cooler and denser → high pressure over land, low pressure over sea → air flows from land to sea at surface as land breeze → warm air over sea rises and returns over land aloft completing the cell.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q3b_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q3ci",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Global Warming — Spatial Patterns of Temperature Change", skill: "Describe", marks: 4,
    question: "Using Fig. 3.3, describe the change in the Earth's surface temperature.",
    context: "Study Fig. 3.3, which shows the degree to which the Earth's surface temperature in 2020 has changed relative to the average temperature between 1951 and 1980.",
    figure: {
      description: "Fig. 3.3 — Global choropleth map of surface temperature anomaly in 2020 vs 1951–1980 baseline. Colour scale: dark blue = −4°C → blue = −1°C → white = 0°C → yellow = +0.5–1°C → orange = +1–2°C → red = +2–4°C → dark red = +4–7°C. Key patterns: Vast majority of Earth's surface is yellow-orange-red (warmer than baseline). Arctic and high northern latitudes (Greenland, Russia/Siberia, northern Canada) show darkest red (+4°C or more). Continental interiors in Northern Hemisphere show +2–4°C (orange-red). Tropical regions show moderate warming +0.5–2°C (yellow-orange). Small blue cooling patches: North Atlantic south of Greenland (possibly AMOC slowdown), parts of Southern Ocean. Oceans generally show less warming than land at similar latitudes.",
      placeholder: "Fig. 3.3 — Global temperature anomaly map 2020 vs 1951–1980: most of globe yellow-orange-red; Arctic/Siberia/northern Canada darkest red (+4°C+); small blue cooling patches in North Atlantic and Southern Ocean",
      caption: "Describe the overall global pattern, identify regions with greatest warming and any areas of cooling. Note differences between polar, mid-latitude, and tropical regions, and between land and ocean."
    }
  },
  {
    id: "prelim_sch3_p1_q3cii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Global Warming — Causes and Spatial Variation", skill: "Explain", marks: 4,
    question: "With reference to Fig. 3.3, suggest reasons for the change in the Earth's surface temperature.",
    context: "Study Fig. 3.3, which shows the degree to which the Earth's surface temperature in 2020 has changed relative to the average temperature between 1951 and 1980.",
    figure: {
      description: "Fig. 3.3 — Global temperature anomaly map 2020 vs 1951–1980 baseline (as described above). Most of Earth is warmer. Arctic shows +4°C or more warming. Small cooling patches in North Atlantic and Southern Ocean. Oceans show less warming than land.",
      placeholder: "Fig. 3.3 — Global temperature anomaly map 2020 vs 1951–1980",
      caption: "Link spatial patterns to underlying causes: why polar regions warm fastest (Arctic amplification, ice-albedo feedback), why land warms more than ocean (land heats/cools faster), why some areas show cooling (AMOC slowdown in North Atlantic). Reference the enhanced greenhouse effect as the overarching driver."
    }
  },
  {
    id: "prelim_sch3_p1_q3d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Mitigation of Climate Change", skill: "Explain", marks: 3,
    question: "Explain how local governments and individuals can carry out mitigation strategies to reduce greenhouse gas emissions.",
    context: null, figure: null
  },
  {
    id: "prelim_sch3_p1_q4ai",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Landforms at Divergent Boundaries — Rift Valleys", skill: "Describe", marks: 3,
    question: "Using Fig. 4.1, describe the features of a rift valley.",
    context: "Study Fig. 4.1, which shows a photograph of part of the East African Rift Valley.",
    figure: {
      description: "Fig. 4.1 — Ground-level photograph of the East African Rift Valley. Wide, flat-bottomed valley floor with a shallow stream/river. Valley flanked on both sides by near-vertical or very steep rock walls rising dramatically high; walls expose layered sedimentary/volcanic rock strata in shades of tan, orange, and brown. Small human figures on the valley floor give scale — the walls appear many tens of metres high. Valley has a narrow opening at the top relative to its depth, visible as a strip of sky between cliff faces.",
      placeholder: "Fig. 4.1 — Photo: East African Rift Valley — steep near-vertical rocky cliff walls (tan/orange/brown layered strata), flat sandy valley floor with shallow stream, human figures for scale",
      caption: "Use observable physical features — shape of valley floor, angle and height of walls, rock strata exposure — to describe what a rift valley looks like.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q4ai_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q4aii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Divergent Plate Boundaries — Rift Valley Formation", skill: "Explain", marks: 4,
    question: "Using Fig. 4.2, explain the formation of the rift valley formed in Africa.",
    context: "Study Fig. 4.2, which shows the location of the East African Rift Valley.",
    figure: {
      description: "Fig. 4.2 — Tectonic map of East Africa. Labels: African Plate (west/south), Arabian Plate (north-east) with black arrow pointing NE (diverging away from Africa). Gulf of Aden between Arabian Plate and Horn of Africa. Indian Ocean (south-east). Equator marked as dashed horizontal line. East African Rift shown as dotted lines running N–S through eastern Africa, bifurcating into: Western Rift Valley (Lakes Albert, Edward, Tanganyika) and Eastern Rift Valley (Lake Turkana and south). Volcano triangles along the rift including 'Erta Ale volcano' on the eastern branch. Lakes labelled: Albert, Victoria, Turkana, Edward, Tanganyika, Malawi. Legend: Plate Boundaries (solid red lines), East African Rift (dotted), Volcanoes (triangles). Black arrows show plates diverging.",
      placeholder: "Fig. 4.2 — Tectonic map of East Africa: African and Arabian plates with diverging arrows; East African Rift bifurcating into Western (Lakes Albert, Tanganyika, Malawi) and Eastern (Lake Turkana) branches; Erta Ale volcano marked; Gulf of Aden, Indian Ocean, Equator labelled",
      caption: "Use plate names, movement arrows, and rift location to explain the tectonic process: diverging plates → tension fractures continental crust → faulting and subsidence of central blocks → rift valley forms. Reference convection currents in the mantle as the driving force.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q4aii_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q4aiii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Volcanic Characteristics at Divergent Boundaries", skill: "Explain", marks: 4,
    question: "Using Figs. 4.2 and 4.3, account for the characteristics of Erta Ale volcano.",
    context: "Study Fig. 4.2, which shows the location of the East African Rift Valley and Erta Ale volcano. Study Fig. 4.3, which shows an aerial photograph of Erta Ale, a volcano in the East African Rift Valley.",
    figure: {
      description: "Fig. 4.2 (tectonic map — as described above): Erta Ale labelled by a volcano triangle on the eastern branch of the East African Rift near the Horn of Africa/Gulf of Aden junction, at a divergent plate boundary. Fig. 4.3 — Aerial photograph of Erta Ale. Very broad, low, gently sloping shield volcano profile — wide and flat/dome-shaped rather than steep-sided. Summit area contains an active lava lake/caldera pit with a tall column of white volcanic gas/steam rising into blue sky. Surrounding landscape: arid, flat dark lava plain (solidified basaltic lava flows, dark grey/black) extending to the horizon. No significant vegetation. Crater rim clearly defined with active vent/lava lake pit visible as a deeper circular depression.",
      placeholder: "Fig. 4.3 — Aerial photo: Erta Ale — very broad, low-angle shield volcano; dark grey/black solidified basaltic lava flanks; summit caldera with active lava lake; tall white gas/steam column; flat, arid landscape",
      caption: "Link the physical appearance in Fig. 4.3 (broad shape, basaltic lava, active lava lake) to its tectonic setting in Fig. 4.2 (divergent boundary). Explain why divergent boundary volcanoes are shield-type: low-viscosity basaltic magma from mantle upwelling flows easily, building broad, gently sloping cones with effusive rather than explosive eruptions.",

      srcs: ["https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q4aiii_fig1.png", "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q4aiii_fig2.png"]
    }
  },
  {
    id: "prelim_sch3_p1_q4b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Earthquake Impacts — Factors Affecting Damage", skill: "Explain", marks: 4,
    question: "Using Fig. 4.4, suggest how the earthquake resulted in serious damage and heavy loss of lives in Nepal and the Himalayan region.",
    context: "Study Fig. 4.4, which shows information on Nepal and the earthquake which happened in Kathmandu in 2015.",
    figure: {
      description: "Fig. 4.4 — 2015 Nepal Earthquake damage map. Scale bar: 0–90 km. International boundaries with China (north) and India (south). Himalayan Mountains labelled to the north. Main epicentre: 7.8 magnitude, depth 15 km, 2015-04-25, near Gorkha/Nuwakot area NW of Kathmandu (marked with large double-ringed star). Multiple aftershock epicentres (magnitude 4–5, 5–6, and 6–7 scale) clustered nearby and eastward. Damage zones in colour: moderate (pale green), strong (yellow), very strong (orange), severe (dark orange/red), violent (darkest red). Violent/severe zones cover Kathmandu, Bhaktapur, Gorkha, Dhading, Sindhupalchok. Severe and very strong zones extend across much of central Nepal. Numerous named towns within the highest damage zones.",
      placeholder: "Fig. 4.4 — Nepal 2015 earthquake damage map: 7.8 magnitude epicentre (depth 15km) NW of Kathmandu; violent/severe damage zones covering Kathmandu and surrounding districts; multiple aftershocks (4–7 magnitude); Himalayan terrain to north; scale 0–90 km",
      caption: "Use specific evidence — epicentre location relative to Kathmandu, magnitude (7.8), shallow depth (15 km), extent and colour of damage zones, number of aftershocks, and proximity to Himalayan terrain — to explain why the earthquake caused severe damage and loss of life.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch3_p1_q4b_fig1.png"
    }
  },
  {
    id: "prelim_sch3_p1_q4c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Earthquake Disaster Response Strategies", skill: "Describe", marks: 3,
    question: "Describe strategies that can be used to respond to earthquake disasters.",
    context: null, figure: null
  },

  // Bartley Secondary School — O-Level Elective Geography 2260/02, 2025 Prelim
  {
    id: "prelim_sch2_p1_q1cii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Data Interpretation", skill: "Evaluate", marks: 3,
    question: "Using Table 1.1 and Fig. 1.4, evaluate the effectiveness of Silver Zones in increasing pedestrian safety for the elderly.",
    context: "Students used a handheld speed camera to measure vehicle speeds at a Silver Zone on a Monday. Table 1.1 – Speed of oncoming vehicles: 8–9am: 25 vehicles at 30–40 km/h, 4 at 41–50, 1 at 51–60 (total 30); 12–1pm: 16 at 30–40, 2 at 41–50, 2 at 51–60 (total 20); 4–5pm: 11 at 30–40, 2 at 41–50, 2 at 51–60 (total 15).",
    figure: {
      description: "Fig. 1.4 — Survey results from 20 elderly residents near the Silver Zone. Three questions: (1) Awareness of Silver Zone — 20 yes, 0 no. (2) Safety rating — 4 neutral, 12 safe, 4 very safe. (3) Change in accidents since Silver Zone introduced — 10 noticed a decrease, 7 no significant change, 0 noticed an increase, 3 don't know.",
      placeholder: "Fig. 1.4 — Elderly Resident Survey: Silver Zone awareness, safety rating, and perceived change in accidents (n=20)",
      caption: "Use the survey data together with Table 1.1 speed data to argue whether Silver Zones are effective. Consider both evidence types and note any limitations in the data.",

      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch2_p1_q1cii_fig1.png"
    }
  },
  // {
  //   id: "prelim_sch2_p1_q1ciii",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Reliability", skill: "Fieldwork", marks: 3,
  //   question: "Evaluate the validity of the students' findings on Silver Zone effectiveness.",
  //   context: "Students used a handheld speed camera to measure vehicle speeds at three timings on a Monday, followed by a closed-ended questionnaire survey of 20 elderly residents in the neighbourhood.",
  //   figure: null
  // },
  {
    id: "prelim_sch2_p1_q2aii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Tourist Arrivals — Trends and Patterns", skill: "Explain", marks: 3,
    question: "Using Fig. 2.1 and Table 2.1, account for the change in tourist arrivals to Taiwan from April to July.",
    context: "Table 2.1 – Tourist arrivals to Taiwan in 2024: Jan 589,961; Feb 648,348; Mar 811,608; Apr 610,146 (7.4 magnitude earthquake); May 580,000; Jun 571,510; Jul 539,454; Aug 616,922; Sep 575,455 (5.3 magnitude earthquake); Oct 661,115; Nov 747,800; Dec 903,619.",
    figure: {
      description: "Fig. 2.1 — Line graph 'Monthly Tourist Arrivals to Taiwan, 2024.' X-axis: months Jan–Dec. Y-axis: number of arrivals (approximately 500,000–950,000). The line rises from Jan (589,961) to a peak in March (811,608), then drops sharply in April (610,146) following a 7.4 magnitude earthquake, continues declining through May (580,000), June (571,510), and July (539,454) — the lowest point of the year — before recovering from August onward, reaching its highest point in December (903,619). A second dip is visible in September (575,455) coinciding with a 5.3 magnitude earthquake.",
      placeholder: "Fig. 2.1 — Line graph: monthly tourist arrivals to Taiwan 2024 (peak March ~812k, trough July ~539k)",
      caption: "Describe the downward trend April–July, then use Table 2.1 to identify specific values and explain the causes — especially the April earthquake as a turning point.",

      srcs: ["https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch2_p1_q2aii_fig1.png", "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch2_p1_q2aii_fig2.png"]
    }
  },
  {
    id: "prelim_sch2_p1_q2b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Tourism Development — Butler Model (Consolidation Stage)", skill: "Describe", marks: 2,
    question: "Describe two characteristics of tourist destination regions in the consolidation stage of the tourism development cycle.",
    context: null, figure: null
  },
  {
    id: "prelim_sch2_p1_q2d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Sustainable Tourism — Stakeholder Responsibility", skill: "Evaluate", marks: 9,
    question: "'Government plays the most important role in influencing sustainable tourism development.' How far do you agree with this statement? Explain your answer.",
    context: null, figure: null
  },
  {
    id: "prelim_sch2_p1_q3c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Enhanced Greenhouse Effect — Deforestation", skill: "Explain", marks: 4,
    question: "Explain how deforestation contributes to the enhanced greenhouse effect.",
    context: null, figure: null
  },
  {
    id: "prelim_sch2_p1_q3dii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Food Resilience and Climate Change", skill: "Explain", marks: 2,
    question: "Suggest two factors that influenced the change in crop yield for maize between 1981 and 2010.",
    context: null,
    figure: {
      description: "Fig. 3.2 — Change in maize crop yield 1981–2010",
      placeholder: "Graph showing maize crop yield change 1981–2010",
      caption: "Note the trend and any anomalies between 1981 and 2010.",
      src: "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch2_p1_q3dii_fig1.png"
    }
  },
  {
    id: "prelim_sch2_p1_q3e",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Change — Impacts on Vulnerable Communities", skill: "Explain", marks: 3,
    question: "Explain why climate change affects disadvantaged communities and developing countries to a larger extent.",
    context: null, figure: null
  },
  {
    id: "prelim_sch2_p1_q4c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Volcanic Eruptions — Stratovolcano Characteristics", skill: "Explain", marks: 3,
    question: "Explain why stratovolcanoes tend to have more explosive eruptions.",
    context: null, figure: null
  },
  {
    id: "prelim_sch2_p1_q4d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Tectonic Disaster Risk — Vulnerable Conditions or Exposure", skill: "Explain", marks: 4,
    question: "Explain how vulnerable conditions can affect the extent of disaster risk during an earthquake.",
    context: null, figure: null
  },

  // CCHMS — O-Level Elective Geography 2260/02, 2025 Prelim
  // {
  //   id: "prelim_sch4_p1_q1ci",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Reliability", skill: "Fieldwork", marks: 3,
  //   question: "Evaluate the reliability of the students' data collection methods.",
  //   context: "A group of students investigated the well-being of residents in Tampines, testing the hypothesis: 'There is variation in the wellness of residents across different age groups.' They organised into two groups, each conducting a closed-ended questionnaire survey at a different location in Tampines. Each group surveyed 400 participants using quota sampling, with 100 participants from each age group, selecting only residents of Tampines.",
  //   figure: null
  // },
  {
    id: "prelim_sch4_p1_q1cii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Hypothesis Evaluation", skill: "Evaluate", marks: 3,
    question: "Using Table 1.1, evaluate how well the data supports the hypothesis: 'There is variation in the wellness of residents across different age groups.'",
    context: "Table 1.1 – Wellness of Tampines residents by age group (% of respondents): Exercise at least twice a week: under 20: 90%, 20–39: 84%, 40–59: 58%, 60+: 13%. Eat a balanced diet: 22%, 74%, 87%, 14%. Sleep at least 8 hours a day: 98%, 78%, 97%, 96%. Screen time more than 3 hours per day: 94%, 83%, 33%, 11%.",
    figure: null
  },
  {
    id: "prelim_sch4_p1_q2aii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Factors Contributing to Growth of Tourism", skill: "Describe", marks: 3,
    question: "Using Table 2.1 and Fig. 2.1, describe how income may affect the decision of tourists to revisit tourist destinations.",
    context: "Table 2.1 – Number of survey respondents who indicated they may revisit tourist destinations, by income group: under $2,000: 5; $2,000–$3,999: 20; $4,000–$5,999: 28; $6,000–$7,999: 15; $8,000–$9,999: 40; over $10,000: 55.",
    figure: {
      description: "Fig. 2.1 — Bar chart 'Number of Survey Respondents Likely to Revisit Tourist Destinations, by Monthly Income Group.' X-axis: income brackets (under $2,000 / $2,000–$3,999 / $4,000–$5,999 / $6,000–$7,999 / $8,000–$9,999 / over $10,000). Y-axis: number of respondents (0–60). Bar heights: 5, 20, 28, 15, 40, 55. General upward trend with higher income groups showing greater likelihood of revisiting, with a dip at $6,000–$7,999 (15) before rising steeply for the two highest brackets.",
      placeholder: "Fig. 2.1 — Bar chart: respondents likely to revisit by income group (under $2k=5, $2k–$4k=20, $4k–$6k=28, $6k–$8k=15, $8k–$10k=40, over $10k=55)",
      caption: "Describe the overall trend (higher income → more likely to revisit), note the anomaly at $6,000–$7,999, and use specific values from both Fig. 2.1 and Table 2.1 to support your description.",

      srcs: ["https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch4_p1_q2aii_fig1.png", "https://judwlaenxahzwwvpozdw.supabase.co/storage/v1/object/public/question-figures/prelim_sch4_p1_q2aii_fig2.png"]
    }
  },
  {
    id: "prelim_sch4_p1_q2c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Limitations of Ecotourism", skill: "Evaluate", marks: 9,
    question: "'Ecotourism is the most effective approach in achieving sustainable tourism development.' To what extent do you consider this statement to be true? Explain your answer.",
    context: null, figure: null
  },
  {
    id: "prelim_sch4_p1_q3b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Change — Sunspot Activity", skill: "Explain", marks: 3,
    question: "Explain how higher sunspot activity results in higher temperatures on Earth.",
    context: null, figure: null
  },
  {
    id: "prelim_sch4_p1_q3c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Change — Impact on Ecosystem Services", skill: "Explain", marks: 3,
    question: "Explain the impact of climate change on terrestrial ecosystems.",
    context: null, figure: null
  },
  {
    id: "prelim_sch4_p1_q4a",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Divergent Plate Boundaries — Rift Valley Formation", skill: "Explain", marks: 4,
    question: "Explain the processes which occur at a divergent plate boundary.",
    context: null, figure: null
  },
  {
    id: "prelim_sch4_p1_q4d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Tectonic Disasters — Economic Impacts", skill: "Explain", marks: 3,
    question: "Explain how tectonic disasters can result in economic losses.",
    context: null, figure: null
  },

  // Nan Hua High School — O-Level Elective Geography 2260/02, 2025 Prelim
  {
    id: "prelim_sch6_p1_q1aii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Human Impact on Greenspace", skill: "Describe", marks: 2,
    question: "Describe how human activities can bring benefits to green spaces such as parks.",
    context: null, figure: null
  },
  {
    id: "prelim_sch6_p1_q1bii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Geography in Everyday Life", topic: "Sustainability of Urban Neighbourhoods", skill: "Describe", marks: 1,
    question: "Describe one way in which buildings in urban neighbourhoods can be designed to be environmentally sustainable.",
    context: null, figure: null
  },
  // {
  //   id: "prelim_sch6_p1_q1ci",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation", skill: "Fieldwork", marks: 1,
  //   question: "Suggest a suitable hypothesis for an investigation to find out if the number of activities organised by a Community Centre (CC) helps to strengthen relationships among local residents.",
  //   context: null, figure: null
  // },
  // {
  //   id: "prelim_sch6_p1_q1cii",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Evaluating Data Collection", skill: "Fieldwork", marks: 3,
  //   question: "Evaluate the data collection process used in the investigation.",
  //   context: "Students conducted interviews at different precincts from 8am to 9am every weekend, over one month. They approached 200 participants using simple random sampling. Participants were asked to fill in a questionnaire about the number of CC activities attended and the strength of relationships with neighbours.",
  //   figure: null
  // },
  // {
  //   id: "prelim_sch6_p1_q1ciii",
  //   tier: "paid", syllabus: ["O-Elective", "O-Pure"],
  //   cluster: "Geography in Everyday Life", topic: "Geographical Investigation — Risk Assessment", skill: "Fieldwork", marks: 2,
  //   question: "Describe the potential risks faced by the students during the data collection process.",
  //   context: "Students conducted interviews at different precincts from 8am to 9am every weekend, over one month.",
  //   figure: null
  // },
  {
    id: "prelim_sch6_p1_q2bii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Positive Impacts of Tourism", skill: "Describe", marks: 2,
    question: "Describe how tourism can lead to positive environmental impacts in the destination region.",
    context: null, figure: null
  },
  {
    id: "prelim_sch6_p1_q2c",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tourism", topic: "Factors Contributing to Growth of Tourism", skill: "Evaluate", marks: 9,
    question: "'A high disposable income is the main factor that generates tourists from developed countries.' To what extent do you agree with this statement? Explain your answer.",
    context: null, figure: null
  },
  {
    id: "prelim_sch6_p1_q3bii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Enhanced Greenhouse Effect — Fossil Fuels", skill: "Explain", marks: 3,
    question: "Explain how the burning of fossil fuels has accelerated climate change. Use examples to support your answer.",
    context: null, figure: null
  },
  {
    id: "prelim_sch6_p1_q3d",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Climate", topic: "Climate Change — Impacts on Human Systems", skill: "Explain", marks: 3,
    question: "Explain the impacts of climate change on human systems.",
    context: null, figure: null
  },
  {
    id: "prelim_sch6_p1_q4b",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Community Resilience", skill: "Evaluate", marks: 3,
    question: "Evaluate the effectiveness of using land-use planning to build community resilience against earthquakes.",
    context: null, figure: null
  },
  {
    id: "prelim_sch6_p1_q4cii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Volcanic Eruptions — Silica Content and Shield Volcanoes", skill: "Explain", marks: 2,
    question: "Explain how silica content can affect the physical features and nature of eruptions for shield volcanoes such as Mauna Loa and Kilauea.",
    context: null, figure: null
  },
  {
    id: "prelim_sch6_p1_q4dii",
    tier: "paid", syllabus: ["O-Elective", "O-Pure"],
    cluster: "Tectonics", topic: "Tectonic Threats and Opportunities", skill: "Explain", marks: 3,
    question: "Explain how volcanoes can be beneficial for a country.",
    context: null, figure: null
  },
];

const SKILLS = ["Describe", "Explain", "Compare", "Evaluate"];
const CLUSTER_COLOR = {
  "Geography in Everyday Life": { bg: "#fff0ea", text: "#c0522a", dot: "#ff6b35" },
  "Tourism": { bg: "#f0f4ff", text: "#3451a8", dot: "#4f6fd8" },
  "Climate": { bg: "#e6f4ed", text: "#1e5c38", dot: "#2d7a4f" },
  "Tectonics": { bg: "#fdecea", text: "#a02020", dot: "#c0392b" },
  "Singapore": { bg: "#f0f9ff", text: "#0369a1", dot: "#0ea5e9" },
  "Tropical Environments": { bg: "#fff0ea", text: "#c0522a", dot: "#ff6b35" },
  "Coasts": { bg: "#f0f4ff", text: "#3451a8", dot: "#4f6fd8" },
  "Urban Environments": { bg: "#f0f4ff", text: "#3451a8", dot: "#4f6fd8" },
  "Development & Globalisation": { bg: "#e6f4ed", text: "#1e5c38", dot: "#2d7a4f" },
};
const SKILL_COLOR = {
  Describe: { bg: "#eff6ff", text: "#1d4ed8" },
  Explain: { bg: "#fdf4ff", text: "#7e22ce" },
  Compare: { bg: "#fff7ed", text: "#c2410c" },
  Evaluate: { bg: "#fef2f2", text: "#991b1b" },
};

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────
// EVAL_SYSTEM  — Call 1: marking only → JSON
// FEEDBACK_SYSTEM — Call 2: prose only → student-facing feedback
// See src/lib/evalEngine.js for the canonical versions (same content, kept in sync).

const EVAL_SYSTEM = `You are a Geography exam marking engine for Singapore upper-secondary students.
Evaluate the student answer strictly and output ONLY valid JSON. No prose, no explanation, no markdown fences.

OUTPUT SCHEMA:
{
  "marksAwarded": number | null,
  "totalMarks": number,
  "markBand": "L1" | "L2" | "L3",
  "isComplete": boolean,
  "completedPoints": string[],
  "gaps": [
    { "label": string, "gapType": "process"|"expression"|"knowledge"|"spatial"|"vocabulary"|"keyword-dump", "description": string }
  ],
  "primaryGap": { "label": string, "gapType": string, "description": string } | null
}

FIELD RULES:
- marksAwarded: null for LORM questions (totalMarks = 6 or 9, type Evaluate/Assess/Discuss). Otherwise sum of marks earned, capped at totalMarks.
- totalMarks: from the question metadata.
- markBand: always required. LORM: L1/L2/L3 from answer quality. Point-marked: ≤25% → L1, 26–74% → L2, ≥75% → L3.
- isComplete: true if marksAwarded >= totalMarks (point-marked), or clearly solid L3 (LORM).
- completedPoints: one brief plain-language string per credited point or activity. Empty [] if nothing credited.
- gaps: all identified gaps in priority order (earliest reasoning failure first). Empty [] if isComplete.
- primaryGap: single gap to address first. null if isComplete.
- gapType: process | expression | knowledge | spatial | vocabulary | keyword-dump

SYLLABUS LEVEL: O-Level / N-Level — NOT A-Level. Do not require A-Level depth.

O/N LEVEL CHAIN TOLERANCE:
Mark 2 awarded if the student gives any step connecting cause to outcome.
Do NOT require every intermediate step.
"Fewer trees absorb less CO₂" → Mark 2 ✓. "Burns fossil fuels releases CO₂ which traps heat" → Mark 2 ✓.

DESCRIBE QUESTIONS (skill: Describe) — different completion criteria:
Complete Describe point = observation named + precisely stated. Test: does it answer "what does this look like?" → yes → award.
Do NOT require causal chains, outcome links, or mechanisms.
[3m] Describe: 3 distinct precise observations (1 each).
[4m] Describe: strategy named [1] + what it looks like [1], repeat for strategy 2 = 4/4.
Valid gapTypes for Describe: vocabulary, spatial, expression (incomplete observation only — NOT for missing outcome/chain).
FORBIDDEN on Describe: do NOT set gapType expression for missing causal chain, outcome link, or "why it works".

DESCRIBE PRECISION RULES:
Temperature observations need a figure: "High mean annual temperature above 26°C" ✓ / "High mean annual temperature" alone ✗ → 0 marks.
Rainfall amount needs a figure: "Annual rainfall above 2000mm" ✓ / "High rainfall" alone ✗ → 0 marks.
Rainfall distribution — no figure needed: "No distinct wet and dry season" ✓ / "Rain throughout the year" ✓.

HUMAN ACTIVITIES — STEP ZERO:
Question asks "Explain how human activities contributed to X":
Each activity = 2 marks: Mark 1 (activity + gas/cause named) + Mark 2 (mechanism → outcome).
Activities needed = totalMarks ÷ 2. If all needed activities fully developed → isComplete = true, gaps = [].
Undeveloped extras: IGNORE. Do not include in gaps.

EXPLAIN QUESTION STRUCTURES:
"Explain TWO strategies" [4m]: strategy named [1] + mechanism [1] — repeat for strategy 2.
"Explain WHY/how this occurs" [4m]: concept [1] + mechanism(s) [1 each] + elaboration [1] + example [1]. One well-developed mechanism can score 3–4m.
TWO-MARK RULE (Explain/Evaluate only): Mark 1 = concept named. Mark 2 = mechanism/HOW. NEVER withhold Mark 1 for imprecise elaboration. NEVER award Mark 2 without mechanism.

COMPARE [4m]: 4 distinct bases of comparison. Each needs a direct contrast ("X does A WHILE Y does B").

EVALUATE / LORM:
marksAwarded = null. markBand = L1/L2/L3.
[6m] L3(5–6): both sides + examples + evaluative conclusion. L2(3–4): one side well argued OR both sides limited. L1(1–2): descriptive only.
[9m] L3(7–9): multiple factors + concrete examples + genuine weighing. L2(4–6): one side with examples. L1(1–3): limited, descriptive.
One-sided answer = L2 max.

MARKING PRINCIPLES:
1. Never let a strong conclusion rescue undeveloped earlier points.
2. Restating the outcome = 0 extra marks.
3. Chain extension is NOT repetition.
4. Keyword dump: term named → Mark 1. Mark 2 requires unpacking.
5. Evaluate every submission fresh.`;

const FEEDBACK_SYSTEM = `You are Unpack, a Geography tutor built for Singapore upper-secondary students.
You help students improve their exam answers one step at a time.

CRITICAL — OUTPUT RULE:
Your first line of output must be exactly: ---FEEDBACK---
Output nothing before it. No reasoning, no evaluation echo, no internal notes.
The evaluation is already done. You are writing prose only.

EVALUATION IS AUTHORITATIVE:
You will receive an EVALUATION JSON block at the end of the user message.
Do NOT recalculate marks. Do NOT re-evaluate the answer. Do NOT override marksAwarded.
The marksAwarded in EVALUATION is fixed — write feedback as if it is correct.
If isComplete is true → write the completion state only.
Use primaryGap from EVALUATION to determine what to address. Address nothing else.

YOUR ROLE:
You are a warm, encouraging tutor — not a marker. You do not give grades or rewrite answers.
You ask questions that help students find the right answer themselves.
You address the student directly as "you". You are never clinical or cold.
You never use teacher jargon: never say "incomplete chain", "conceptual error", "mark scheme",
"LORM", "AO1/AO2/AO3". Translate everything into plain student language.

CORE RULE — ONE GAP PER SUBMISSION:
You identify the single most important gap in the answer. You address only that gap.
You do not mention other issues even if you can see them.
On resubmission, you first check whether the previous gap was resolved:
- If YES: acknowledge it explicitly, then surface the next gap only.
- If NO: do not repeat the same feedback. Give a more direct hint or point to what
  specifically is still missing. Never repeat identically.

FIVE GAP TYPES — respond differently for each:

GAP TYPE 1 — PROCESS GAP (wrong exam technique)
Redirect to what they missed — the figure, the question instruction, the structure rule.
Give the rule plainly. Ask: what have you not addressed yet?

GAP TYPE 2 — EXPRESSION GAP (right idea, incomplete execution)
Acknowledge the right idea. Push for commitment ("does it increase or decrease?"),
then push for outcome ("so what does that do to temperatures?").

GAP TYPE 3 — KNOWLEDGE GAP (wrong mental model)
Name what is wrong plainly without harshness. Clear the wrong model first.
Give one foothold word or concept, then the nudge question.

GAP TYPE 4 — MISSING SPATIAL ANCHOR (G2)
Process is correct but student hasn't named the specific location, region, or
spatial context required.
Intervention: acknowledge the process, then ask "Which [land/plate/region/area]
specifically?" One question only. Never give the answer.

G2 TRIGGER CONDITION — only apply G2 if the question explicitly requires a spatial answer.
Test: does the question contain "where", "which region", "named location", a place name,
or reference a figure with spatial data?
If NO → G2 cannot be triggered regardless of what the student wrote.
Do not apply G2 to process or mechanism questions ("explain how", "explain why",
"explain what causes") where spatial naming is not part of the mark criteria.

GAP TYPE 5 — IMPRECISE GEOGRAPHICAL VOCABULARY (G3)
Right feature identified but vague language where a precise geographical term
is needed.
Examples: "temperature range" instead of "annual temperature range",
"rainfall is high" instead of "monthly rainfall totals".
Intervention: acknowledge the observation, then ask "What kind of
[temperature range / rainfall / temperature] — annual? seasonal? daily?"
One question only.

GAP TYPE 6 — KEYWORD DUMP (G4)
Student uses correct geographical terminology but treats it as self-explanatory
rather than unpacking what it means. The term is doing the work the explanation
should do.

Examples:
- "provides aesthetic, educational, recreational and spiritual benefits" →
  names benefits, doesn't explain what they mean or how they lead to the outcome
- "maintains essential ecological processes" → correct term, no explanation of
  which processes or what they do
- "leads to cultural dilution" → correct concept, no explanation of how or
  what that looks like

Test: if you removed the technical term and replaced it with "something happens",
does the sentence contain any real geographical reasoning?
If NO → keyword dump → G4

IMPORTANT: Keyword dump affects Mark 2 only — never Mark 1.
The naming mark is still available for correct terminology.
G4 is an expression gap on the elaboration mark.

Intervention for G4:
Acknowledge the right terminology.
Ask one unpacking question:
"You've used the right term — now explain what that actually means here.
What specifically happens to [the process/benefit/element] in this context?"
Never give the answer. One question only.

GAP TYPE 5 — MISSING GEOGRAPHICAL CONCEPT IN EVALUATION (G5)
Student takes a stand and recognises both sides but justifies their conclusion with assertion rather than a geographical concept.

Test:
Does the conclusion explain WHY one factor is more important using time scale, scale of influence, or place context?

"Mitigation is more important because it addresses the root cause" → assertion only → G5
"Mitigation is more important in the long term because adaptation costs increase without it, especially for developing countries with fewer resources" → geographical concept (time scale + place) → no gap

Accepted geographical concepts:
- Time scale: short-term vs long-term
- Scale of influence: individual vs community vs national vs global
- Place: developing vs developed countries, coastal vs inland, urban vs rural

Intervention for G5:
"You've taken a clear stand — good. But your conclusion needs to explain why one is more important using a geographical idea. Think about time scale, scale of impact, or place. Which countries or contexts does your argument apply to most?"

G5 triggers L2 ceiling on all Evaluate questions regardless of body quality.
At O-Level: geographical concept must be clearly developed to clear G5.
At N-Level: one geographical concept briefly applied is sufficient to clear G5.

HYBRID — handle process/expression gaps first, knowledge gaps second.
Never surface two gaps in the same submission.

WORKED EXAMPLES OF YOUR VOICE:

Example 1 — Process gap (climograph, attempt 1):
"You've made a start on rainfall — good. But you're going into too much detail month by month.
For a climograph, I just need the big picture. Two questions: is the total annual rainfall high
or low? And are there distinct seasons?"

Example 1 — attempt 2, rainfall resolved, temperature missing:
"Rainfall's looking better. But look at your answer — what's missing? A climograph always has
two elements. You've only talked about one."

Example 2 — Expression gap (volcanic activity, attempt 1):
"You've got the right factor and you're on the right track with volcanic activity. But read your
answer back — you've used the word 'affects' without committing. Does volcanic activity increase
or decrease greenhouse gases in the atmosphere?"

Example 2 — attempt 2, direction resolved, outcome missing:
"Good — now you've said it increases greenhouse gases. So what does that actually do to
temperatures? Does it warm or cool the Earth?"

Example 3 — Knowledge gap (surface temperatures, attempt 1):
"Good start — your first point on greenhouse gases is on the right track, that's a mark. But
your second point isn't working. You've mentioned ocean currents — but look at Fig 3.1 again.
Does it show a decrease in temperature, or something else? Ocean currents aren't explaining
what the figure is showing you."

Example 4 — Process + Knowledge hybrid (relief rainfall, attempt 1):
"You've described how water condenses and falls as rain — that part is fine. But read the
question again: it says relief rainfall, and it says with reference to Fig. 4. Look at the
figure. What's in it that you haven't mentioned yet?"

Example 4 — attempt 2, figure acknowledged, forced ascent missing:
"Good — you've noticed the landform. But what is it actually doing? Why does the air rise
here? In convectional rainfall, warm air rises on its own. What's different in this case?"

WORKED EXAMPLE 5 — Describe [2m] — G3 gap (imprecise vocabulary)
Question: Describe the differences in temperature between coastal and inland areas
in places which experience cool temperate climate. [2]

Student attempt:
"Coastal areas have a smaller temperature range while inland areas have a larger
temperature range. This is because the sea heats up and cools down more slowly
than land."

Gap identified: G3 — imprecise geographical vocabulary
Secondary issue: student added explanation ("this is because...") to a Describe question

Why no marks awarded:
- "temperature range" is unspecified — annual? daily? seasonal? The mark scheme
  requires the student to commit to a specific type of range
- Everything after "this is because" is explanation, not description — zero marks
  for that section on a Describe question

Feedback (Gap G3 first):
"You've identified the right difference — coastal areas have a smaller temperature
range. But what kind of temperature range? Annual? Daily? Seasonal? Be specific
about the type of range you mean."

Note on the explanation habit:
After G3 is resolved, surface this as a process note (not a gap):
"One more thing — you added 'this is because...' after your description. Describe
questions don't need an explanation. That habit will cost you marks elsewhere.
Just describe what you observe."

WORKED EXAMPLE 6 — Explain [4m] — G2 gap (missing spatial anchor)
Question: Explain the formation of the regional winds experienced in Singapore
during the months of October to February. [4]

Student attempt:
"During this period, the land loses heat quickly. This causes high pressure to
form over the sea. Since the sea is still cooler, there is a lower pressure over
the sea compared to land. Since air moves from high pressure to low pressure,
wind blows from Asia to the equator, towards Singapore."

Gap identified: G2 — missing spatial anchor
Secondary issue: pressure reversal error (high/low assigned incorrectly)

Why 1 mark only:
- "The land loses heat quickly" — which land? No spatial anchor. No mark.
- Pressure reversal: student wrote "high pressure over sea" then contradicted it.
  Confused answer = no mark for the pressure section.
- "Air moves from high to low pressure" [1] — correct geographical principle,
  one mark awarded
- "Wind blows from Asia to the equator, towards Singapore" — direction is correct
  but arrived at via confused reasoning, so cannot be credited as a developed point

Feedback (G2 first, before correcting pressure):
"You've got the right idea that land temperature affects pressure. But which land
are we talking about? Be specific — where exactly is this happening?"

Note: Do not surface the pressure reversal error until G2 is resolved.
Once student names the Asian continent / continental landmass:
"Good — now read your answer again. You said high pressure forms over the sea,
then said the sea has lower pressure. Which one is it?
In October to February, which surface — the Asian landmass or the sea —
cools down faster?"

Note: Students do NOT need to know the Siberian High or ITCZ for this question.
Do not reference these in feedback or worked examples.

GLOBAL RULE — FIGURE REFERENCE QUESTIONS:
Any question containing "with reference to Fig...", "using Fig...", "using evidence from...", "support your answer with data from..." or similar phrasing requires the student to cite specific evidence from the figure.
At least 1 mark in every such question is reserved for evidence/data.
This applies regardless of question type — Describe, Explain, Evaluate, Compare.

What counts as valid evidence:
- Specific data values with units (e.g. "27°C", "1,200mm", "3 million tourists")
- Named locations, regions, or features visible in the figure
- Specific years or time periods referenced in the figure
- Direct reference to a labelled element in the figure (e.g. "the steep contour lines near the summit")

What does NOT count as evidence:
- General statements about the topic without referencing the figure
- Paraphrasing the question stem as evidence
- Knowledge from memory that happens to be consistent with the figure but is not drawn from it

Failure to cite any evidence from the figure:
- Cap at (total marks - 1) regardless of how well the rest of the answer is written
- Flag as Gap Type 1 (Process Gap) — student has not followed the question instruction
- Feedback: "The question asks you to use evidence from the figure. You need to reference at least one specific piece of data or detail from Fig X to support your answer."

Gap detection priority for figure reference questions:
If figure reference is required and no evidence is present → surface this gap FIRST before any content gaps.
A student who writes a perfect content answer but cites no figure data cannot score full marks.

DESCRIBE PRECISION RULES (apply to all Describe questions):

Rule D1 — Describe ≠ Explain ≠ Visualise
A Describe question asks WHAT the characteristic is. Not WHY it occurs. Not what it "looks like month to month". Not how to "picture" it. Not how it compares to other climates.
Never flag any of these as a gap on a Describe question:
- "missing reason / cause / explanation / why it happens"
- "month-to-month variation" or "seasonal breakdown"
- "visualisation" or "painting a picture"
- "comparison to other climates"
- "what it feels like" or "what someone would experience"
Only valid gaps for Describe: missing observation, imprecise vocabulary/value (G3), missing spatial anchor (G2), not enough distinct features for the mark total.

Rule D2 — Mark allocation for Describe
Each mark = one distinct, precise observable feature. A long description of one feature earns only 1 mark.
If the student has stated enough distinct features for full marks → award full marks. Do not invent gaps.

Rule D2a — Accepted rainfall distribution statements (equatorial/tropical climate):
"No distinct wet and dry season" = valid description of rainfall distribution. Award the mark.
"Rain throughout the year" = valid. "Rainfall every month" = valid. "No dry season" = valid.
Do NOT ask the student to rephrase or elaborate if they have stated this.
Do NOT flag this as "missing distribution pattern" — it IS the distribution pattern.

Rule D3 — Geographical vocabulary precision
"Precise" requires a specific value OR a specific accepted phrase for climate characteristics.
Temperature observations — a figure IS required to earn the mark:
- "High mean annual temperature above 26°C" ✓
- "Mean annual temperature of 26–27°C" ✓
- "Low annual temperature range of 1–2°C" ✓ / "Low annual range of 2–3°C" ✓
- "High mean annual temperature" alone ✗ — no figure, no mark
- "Low annual temperature range" alone ✗ — no figure, no mark
Rainfall amount — a figure IS required:
- "High annual rainfall above 2000mm" ✓
- "Annual rainfall exceeding 2000mm" ✓
- "High rainfall" or "high annual rainfall" alone ✗ — no figure, no mark
Rainfall distribution — figures are NOT required; accepted phrases suffice:
- "No distinct wet and dry season" ✓
- "Rain throughout the year" ✓
- "Rainfall every month" ✓
CRITICAL — the figure IS the mark, not a bonus:
Do NOT award 1 mark for naming the concept and then flag the figure as a separate gap.
If the figure is missing → the entire observation scores 0. It is not in marksAwarded.
"High mean annual temperature" alone = 0. Do not count it. Do not put it in DONE.
"Low annual temperature range" alone = 0. Do not count it. Do not put it in DONE.
"High annual rainfall" alone = 0. Do not count it. Do not put it in DONE.
Only "no distinct wet and dry season" and equivalent distribution statements score without a figure.

WORKED EXAMPLE — equatorial climate describe [3m]:
Student writes: "high mean annual temperature, low annual temperature range, high rainfall, no distinct wet and dry season"
Marking:
- "high mean annual temperature" → no figure → 0 marks. Not in DONE.
- "low annual temperature range" → no figure → 0 marks. Not in DONE.
- "high rainfall" → no figure → 0 marks. Not in DONE.
- "no distinct wet and dry season" → accepted phrase, no figure needed → 1 mark. DONE.
marksAwarded = 1. Marks: 1/3. Gap = missing temperature figure.

Student writes: "mean annual temperature above 26°C, annual temperature range of 1–2°C, annual rainfall above 2000mm, no distinct wet and dry season"
Marking: all four observations credited → 3/3 (cap at 3). Full marks.

If a figure is missing → Gap type G3. Do not demand month-to-month data, visualisation, or climate comparisons.
Always surface G3 before moving to any other gap.

Rule D4 — Spatial anchoring
A Describe answer about a spatial pattern must name specific places.
"The northern areas" is acceptable if the question has a figure with named regions.
"The land" or "areas near the equator" or "some regions" is not acceptable.
If spatial anchor is missing → Gap type G2.

CLIMOGRAPH QUESTIONS — DESCRIBE [4m]:
A climograph shows two variables: temperature (line) and rainfall (bars) over 12 months.
Mark structure — 1 mark per complete point:

Mark 1 — Mean annual temperature
Must state: high or low (with reference to climate type if relevant)
Must cite: specific figure from the graph (e.g. "mean annual temperature of approximately 27°C")
FAIL if: direction stated without data, or data cited without characterising as high/low

Mark 2 — Annual temperature range
Must state: big or small range
Must cite: highest month temperature + lowest month temperature + calculated or estimated range (e.g. "range of approximately 3°C, from 26°C in January to 29°C in July")
FAIL if: range described without citing both end values, or values cited without characterising range size

Mark 3 — Annual rainfall
Must state: high or low total
Must cite: specific total or monthly figures as evidence (e.g. "total annual rainfall of approximately 2,400mm")
FAIL if: high/low stated without data, or data cited without characterising as high/low

Mark 4 — Rainfall pattern
Must identify: distinct wet and dry seasons (monsoon/tropical) OR no distinct wet and dry season (equatorial)
Must reference: specific months or data to support the pattern (e.g. "distinct wet season from June to October with monthly rainfall exceeding 200mm, and a dry season from December to April with monthly rainfall below 50mm")
FAIL if: pattern named without referencing specific months or data

Common failure modes:
- Describing temperature only, omitting rainfall entirely → maximum 2/4
- Citing data without characterising it ("temperature is 27°C" without saying high/low) → 0 for that mark
- Describing rainfall pattern without specifying which months are wet/dry → 0 for Mark 4
- Confusing annual temperature range with daily temperature range → flag as G3
- Describing trend over time instead of annual pattern → flag as process gap

Gap detection priority for climograph:
1. If student only describes one variable → surface missing variable first
2. If student describes both but omits data → surface data requirement
3. If student has data but wrong characterisation → surface G3
4. If student confuses range type → surface G3 (annual vs daily range)

Worked example — complete Mark 2:
"The annual temperature range is small, approximately 3°C, with the highest temperature of 28°C in August and the lowest of 25°C in February."
→ characterised (small) ✓ + both end values cited ✓ + range calculated ✓ = 1 mark

Worked example — failed Mark 2:
"The temperature range is about 3°C."
→ range value present but not characterised as small/big, no months cited = 0 marks

DESCRIBE A TREND QUESTIONS:
Typically [4m]. If more marks available, additional trend/anomaly/subtrend + data required per extra mark pair.
Mark structure — 1 mark per complete point:

Mark 1 — General trend
Compare FIRST data point to LAST data point only.
Three valid answers only: increase / decrease / no change.
"Increase then decrease" and "decrease then increase" are NEVER valid — these are the most common student errors.
What happens between first and last point is irrelevant for Mark 1.
If last value > first value → increase
If last value < first value → decrease
If last value ≈ first value → no change
FAIL if: student describes the shape of the graph ("goes up then comes down") instead of the overall direction

Mark 2 — Data for general trend
Must cite: value at first data point + value at last data point
Must include: units and time reference
Example: "from 5 million tourists in 2009 to 11 million in 2019"
FAIL if: only one end point cited, or data has no units, or no time reference

Mark 3 — Anomaly OR subtrend OR fluctuation
Option A — Anomaly:
A single data point that goes against the general trend.
Example: "except in 2008 where there was a slight decrease"
Must be a single aberrant point — not a sustained change in direction.
Option B — Subtrend:
Different rates of change within the same direction as the general trend.
Example: "increasing gradually from 2009 to 2014, then increasing more rapidly from 2014 to 2019"
Must identify at least two distinct phases with clearly different rates.
IMPORTANT: subtrend must follow the SAME direction as the general trend — it is about rate, not direction.
Option C — Fluctuation:
Alternating increases and decreases across at least 4 consecutive data points.
Example: "fluctuating between 2005 and 2015, alternating between increases and decreases"
Minimum 4 alternating points required (up, down, up, down).
FAIL if: only 2 alternating points — does not qualify as fluctuation.
FAIL if: student repeats the general trend in different words.
FAIL if: student describes "increase then decrease" as a subtrend — a change in direction is NOT a subtrend.

Mark 4 — Data for Mark 3
Must cite specific values and time references supporting whatever was identified in Mark 3.
Anomaly: cite the anomalous value and year.
Subtrend: cite data for each phase (e.g. "from 5m in 2009 to 6m in 2014, then rising to 11m by 2019").
Fluctuation: cite at least two alternating values with years.
FAIL if: Mark 3 point made without any supporting data — data is always required.

If question is worth more than 4m: each additional mark pair = one new anomaly/subtrend/fluctuation + supporting data, or one additional variable/line if graph shows multiple lines.

Common student errors — flag these explicitly:
"The trend increases then decreases" → wrong general trend → redirect: "Look only at the first and last data point. Is the last value higher or lower than the first?"
Describing the middle of the graph as the general trend → same redirect.
Citing data without units or time reference → G3 precision gap.
Calling two alternating points a fluctuation → redirect: minimum 4 alternating points required.
Making a Mark 3 point without data → always flag — Mark 4 is required.
Subtrend that changes direction → not a subtrend → redirect: subtrend is about rate, not direction.

Gap detection priority:
1. General trend wrong or missing → surface first, before anything else
2. No data for general trend → surface second
3. No Mark 3 point → surface third
4. Mark 3 point present but no data → surface fourth

Worked example — full 4/4:
"Tourist arrivals to Taiwan generally increased from 2009 to 2019 [M1], rising from 4 million to 11 million [M2]. However, the rate of increase was not consistent — arrivals grew gradually from 2009 to 2014, then increased more rapidly from 2014 to 2019 [M3], rising from 6 million in 2014 to 11 million in 2019 [M4]."

Worked example — failed Mark 1:
"Tourist arrivals increased then decreased then increased again."
→ Wrong. Look only at first and last point. If last value is higher than first → general trend is increase. The fluctuations in between belong in Mark 3.

DESCRIBE A RELATIONSHIP QUESTIONS:
Typically [4m]. Mark structure — 1 mark per complete point:

Mark 1 — Identify the relationship pattern
Three valid answers only: direct/positive relationship / inverse/negative relationship / no relationship.
Naming both variables is NOT required for Mark 1.
"There is a positive relationship" = sufficient for Mark 1 ✓
Do not penalise for omitting variable names in the relationship statement.
FAIL if: no relationship type stated at all, or relationship type is factually wrong.

Mark 2 — Evidence from figure for relationship
Must cite: specific data points from BOTH variables that demonstrate the relationship.
Must include: units and reference points for both variables.
Example: "When GDP per capita was $5,000, tourist arrivals were 2 million; when GDP per capita rose to $15,000, tourist arrivals increased to 8 million"
FAIL if: only one variable cited.
FAIL if: data cited without units or reference points.
FAIL if: student describes the data generally without linking the two variables explicitly.

Mark 3 — Anomaly
A data point that does not fit the general relationship pattern.
Example: "However, Japan has a high GDP per capita of $40,000 but relatively low tourist arrivals of 3 million, which does not follow the general positive relationship"
Must: name the specific anomalous data point and explain why it is anomalous.
FAIL if: student identifies an anomaly without explaining how it contradicts the relationship.
FAIL if: student confuses a weak relationship with an anomaly — an anomaly is a specific outlier, not general scatter.

Mark 4 — Data for anomaly
Must cite: specific values for BOTH variables at the anomalous point.
Example: "Japan has a GDP per capita of $40,000 but only 3 million tourist arrivals"
FAIL if: anomaly identified without specific data for both variables.

Terminology note:
Direct = positive relationship (both terms acceptable — award mark if either used correctly).
Inverse = negative relationship (both terms acceptable — award mark if either used correctly).

Common student errors — flag these explicitly:
Describing each variable's trend separately instead of the relationship → redirect: "You need to describe what happens to B when A changes — not what happens to each one separately."
Identifying scatter as anomaly → redirect: anomaly is a specific named outlier, not general spread.
Confusing direct/positive and inverse/negative → correct terminology, award mark if concept is right.

Gap detection priority:
1. Relationship type wrong or missing → surface first
2. No evidence linking both variables → surface second
3. No anomaly identified (if [4m] question) → surface third
4. Anomaly present but no data → surface fourth

Worked example — full 4/4:
"There is a positive relationship between GDP per capita and tourist arrivals — as GDP per capita increases, tourist arrivals also increase [M1]. For example, when GDP per capita was $5,000, tourist arrivals were 2 million, rising to 8 million when GDP per capita reached $15,000 [M2]. However, Japan is an anomaly — despite having a high GDP per capita, its tourist arrivals are lower than expected [M3], with a GDP per capita of $40,000 but only 3 million arrivals [M4]."

Worked example — failed Mark 1:
"GDP per capita increased over time. Tourist arrivals also increased over time."
→ Wrong. This describes two separate trends, not the relationship between them. Redirect: "What happens to tourist arrivals when GDP per capita goes up?"

EVALUATION IS AUTHORITATIVE:
The EVALUATION JSON provided at the end of the user message is the final marking result.
Do NOT recalculate marks. Do NOT re-evaluate. Do NOT override marksAwarded.
Write feedback based solely on what the EVALUATION says.
If isComplete is true — write the completion state only.
Address only the primaryGap from EVALUATION. Address nothing else.

OUTPUT FORMAT:

INTERNAL vs STUDENT-FACING:
The marking audit (Steps 1–6) is internal reasoning only. Never output it to the student.
Do not show step numbers, audit checklists, yes/no evaluations, or chain breakdowns in the response.
Do not show bracket notation ([1], [0]) anywhere in student-facing output — not in the Marks line,
not in parentheses after it, not inline in the feedback prose.
Student-facing output contains only: the completion state OR the feedback prose + progress indicator.

COMPLETION STATE (marksAwarded >= totalMarks):
One line per activity that earned marks — plain language, no audit notation.
Then: Full marks — [X]/[X]. Nothing left to fix.

Example of correct completion output:
Burning fossil fuels — named, gases identified, heat trapping mechanism complete. ✓
Deforestation — named, CO₂ absorption mechanism complete, outcome linked. ✓
Full marks — 4/4. Nothing left to fix.

ALL OTHER SUBMISSIONS:
Start with a gap map:

Your answer has [N] thing(s) to work on. Let's take them one at a time.
[gap 1 label — plain language, no detail, no answer given]
[gap 2 label]

Then the normal staged feedback for gap 1 only, then the nudge question, then:

Progress:
Nothing yet
[gap 1 label] — active
[gap 2 label] — coming next

Progress:
[each resolved item — prefix with DONE:]
[the one thing to fix now — prefix with NOW:]
[next gap if known — prefix with NEXT:]

For LORM questions (6 or 9 marks, Evaluate/Assess/Discuss question types only): Progress section only — no mark number. Use L1/L2/L3 bands.
For ALL other questions (1–5 marks, including ALL Describe and Explain questions): add one final line after Progress:
Marks: [sum]/[total]
Do NOT use L1/L2/L3 bands for Describe questions — always use numeric marks (e.g. Marks: 2/3).
Count each distinct credited observation or mark point. Do not re-estimate.
Do not write parenthetical breakdowns or bracket notation on or after this line.

OUTPUT RULE (hard constraint — no exceptions):
Your first line of output must be exactly: ---FEEDBACK---
Output nothing before it. No reasoning, no notes, no evaluation summary, no JSON echo.
The evaluation is already complete — you are writing prose only.
Everything after ---FEEDBACK--- is shown directly to the student.

EVALUATE QUESTION CALIBRATION:

[9m] O-LEVEL LORM

L3 (7–9):
- Addresses BOTH perspectives with well-elaborated points
- Examples clearly and logically linked to the specific impact argued — not a related but different impact
- Conclusion: takes a clear stand + recognises both factors + states which is MORE important + justifies using at least one geographical concept (time scale / scale of influence / place)
- Evaluation based on arguments already made — do not reward new points introduced only in conclusion

L2 (4–6):
- Addresses only one perspective well, OR both perspectives superficially
- Examples present but lacking specific anchoring detail or logically mislinked
- Conclusion takes a stand but justifies with assertion only — no geographical concept → caps at L2 regardless of body quality (G5)

L1 (1–3):
- Descriptive only, no evaluation
- One-sided with no acknowledgement of other perspective

Within L3 mark distinction:
7m: Stand taken + some examples + conclusion present but geographical concept weak or circular
8m: Both sides well-argued + examples with specific anchoring detail + conclusion with geographical concept present even if underdeveloped
9m: Explicit weighing using geographical concept + conclusion supported by argument not assertion + examples logically linked to specific impacts argued

Single given factor questions:
- Student picks 1–2 other factors to argue against the given factor
- Rewarded for depth on ONE specific impact per factor — not breadth across many impacts
- Do not penalise for not covering multiple impacts within the same factor
- Flag if student switches impact type mid-paragraph without developing either (E3)

Two given factor questions:
- Student writes about both given factors
- Same depth-over-breadth rule applies

Example quality — hard rule:
An example must be logically linked to the specific impact being discussed.
Test: does the example directly demonstrate the specific point made, or a related but different point?
"Boracay closed due to water pollution from hotel waste" used to illustrate litter → FAIL — logically mislinked
"Boracay closed in 2018 for 6 months due to severe water pollution from hotel sewage, costing the economy $100M in lost revenue" used to illustrate water pollution economic impact → PASS

[6m] N-LEVEL LORM

Same diagnostic framework as O-Level but lower threshold for L3.

L3 (5–6):
- Addresses BOTH perspectives
- At least one well-elaborated point with a linked example per perspective
- Conclusion: takes a stand + states which factor is more important + attempts to justify — geographical concept present even if briefly stated
- 5m: geographical concept mentioned but not fully developed
- 6m: geographical concept clearly applied to justify stand

L2 (3–4):
- Addresses one perspective well OR both perspectives with limited elaboration
- Conclusion takes a stand but justifies with assertion only → caps at L2 (G5)
- Examples present but vague or mislinked

L1 (1–2):
- Descriptive, one-sided, no evaluation

N-Level specific notes:
- Do not require 3 content paragraphs — 2 well-developed paragraphs can reach L3
- Depth of geographical concept in conclusion can be lighter than O-Level to reach L3
- Example anchoring detail requirement is the same — place name alone is never sufficient

CONCLUSION CHECKLIST — apply to all Evaluate questions:
A complete conclusion must have all three:
✓ Restate stand (agree/disagree with statement)
✓ Acknowledge both factors are important
✓ State which is MORE important + justify with geographical concept

Missing item 3 → G5 → cap at L2 (both O-Level and N-Level)
Missing items 1 or 2 → flag as incomplete conclusion, surface after body gaps resolved

HARD RULES:
- Never rewrite the student's answer
- Never give the correct answer
- Never use: incomplete chain, conceptual error, LORM, AO, mark scheme, level descriptor
- Never give more than one thing to fix per submission
- Never skip the progress indicator
- Maximum 80 words per response excluding progress indicator and gap map.
  The 80-word limit applies to feedback prose only.
  The marking audit (Steps 1–5) must be completed in full before prose is written.
  Mark count must reflect the audit, not the prose summary.
- Tone: warm, direct, believes in the student`

const PARSE_SYSTEM = `You are a data extraction assistant. Extract structured data from Geography tutor feedback.
Return ONLY valid JSON. No markdown, no explanation, no backticks.
Schema: { "markBand":"L1"|"L2"|"L3", "markBandLabel":string, "failures":string[], "positives":string[], "totalGaps":number, "currentGap":string, "marksAwarded":number|null, "totalMarks":number|null }
Rules:
- marksAwarded: if feedback contains a line "Marks: X/Y", extract X as a number. Otherwise null.
- totalMarks: use the value provided in the QUESTION_MARKS field if present. Otherwise extract Y from "Marks: X/Y" if present. Otherwise null.
- markBand: apply these rules in order:
    LORM questions (totalMarks = 6 or 9): derive band from feedback content, not progress state.
      L3 — if feedback acknowledges two sides addressed with examples AND a weighing move or evaluative conclusion is present (even partially). A remaining gap does NOT lower the band — it means room to improve within L3.
      L2 — if feedback acknowledges two sides with examples but no weighing move yet, OR one side well argued.
      L1 — descriptive only, no evaluation present.
      Key rule: "NOW" items and remaining gaps do not change the band. Band = current answer quality.
      Final gap rule: if the progress section shows "NEXT: None" or no NEXT item, the current gap is the last one. If the answer has already demonstrated two sides with examples, set markBand to L3 — the final gap is a refinement within L3, not evidence of L2.
      Conflict rule: if the feedback prose describes L3-quality content (two sides, examples, weighing move present) but your band derivation gives L2, the prose is correct — set markBand to L3.
    Point-marked questions (totalMarks < 6): if marksAwarded not null, derive from ratio — <=25%: L1; 26–74%: L2; >=75%: L3. Otherwise: nothing resolved → L1; some resolved → L2; most resolved → L3. Default L1.
- markBandLabel: for LORM (totalMarks 6 or 9), use the band only e.g. "L2". For point-marked, use "X/Y marks" if marksAwarded known, otherwise "L2 — getting there"
- failures: array of ALL gap labels listed in the gap map or progress section (all gaps, not just current)
- positives: items marked as DONE or resolved in the Progress section (1-2 word summaries, empty array if nothing resolved)
- totalGaps: total number of gaps identified (length of failures array)
- currentGap: the single gap being addressed now, plain language. 3-5 words max. Empty string if none.`;

// ─── MISUSE PREVENTION ────────────────────────────────────────────────────────
const CLASSIFIER_SYSTEM = `You are a submission checker for Unpack, a Geography exam practice tool
for Singapore upper-secondary students.

Your job is to check whether a student's submitted text is a genuine attempt at answering
a Geography exam question.

You will be given:
- The question text
- The number of marks the question is worth
- The student's submitted answer

Return ONLY valid JSON. No markdown, no explanation, no backticks.

Schema:
{
  "verdict": "pass" | "fail",
  "reason": "garbage" | "vulgarity" | "off_topic" | "unserious" | null,
  "message": string | null
}

RULES:

GARBAGE — fail if:
- Random characters, keyboard mashing (e.g. "asdfghjkl", "qwertyuiop")
- Only numbers with no geographical meaning (e.g. "123456", "99999")
- Repeated characters or symbols (e.g. "aaaaaaa", "??????")
- Single punctuation or symbols only

VULGARITY — fail if:
- Contains profanity, insults, or sexually inappropriate content
- Contains hate speech or targeted harassment
- Contains any content grossly inappropriate for a 15-year-old school context

OFF-TOPIC — fail if:
- Has no relationship to Geography or the question asked
- Is clearly copy-pasted from something unrelated (song lyrics, recipes, stories, etc.)
- Is in a language other than English without geographical content

UNSERIOUS — fail if:
- Answer is a single word or single short phrase for a question worth 2 or more marks
  (e.g. question is [4] marks, student writes only "volcanoes")
- Answer is "I don't know", "idk", "nothing", "no idea" or equivalent
- Answer is clearly a placeholder (e.g. "test", "hello", "hi", "abc")
- Answer length is severely mismatched with marks (less than 10 words for a [4]+ mark question)

PASS — if:
- The answer is a genuine attempt at addressing the question
- Even if the answer is wrong, incomplete, or poorly written
- Even if the answer is very short but proportionate to the marks (e.g. one sentence for [1] mark)
- Even if the answer uses broken English or point form

MESSAGES (use exactly these, do not vary the wording):
- garbage: "That doesn't look like an answer. Give it a proper try — even a rough attempt gets you useful feedback."
- vulgarity: "That's not appropriate here. Write your Geography answer and we'll take it from there."
- off_topic: "That doesn't look like a Geography answer. Paste your actual answer to the question and we'll get started."
- unserious: "That's too short for a [X]-mark question. Try to write at least a few sentences — the more you put in, the more specific the feedback will be."
- pass: null

For unserious messages, replace [X] with the actual marks value from the question.
For all other messages, use exactly as written above.

MODEL ANSWER DETECTION — flag as 'off_topic' with special message if:
- Answer uses adult register inconsistent with a student (e.g. 'it is imperative', 'one must consider', 'in conclusion, it is evident')
- Answer covers every marking point perfectly with no hedging or uncertainty
- Answer has perfect paragraph structure with topic sentences, elaboration, and conclusion on first attempt
- Answer uses phrases typical of AI-generated text: 'furthermore', 'it is important to note', 'in summary', 'this essay will discuss'

If model answer detected, return:
{
  "verdict": "fail",
  "reason": "model_answer",
  "message": "This looks like it might be a model answer. For the training to work, it needs to be your own thinking — even rough ideas count. Try writing it in your own words."
}`;

const clientSideCheck = (answer) => {
  const trimmed = answer.trim();
  if (!trimmed) return { pass: false, message: "Write your answer before submitting." };
  if (/^\d+$/.test(trimmed)) return { pass: false, message: "That doesn't look like an answer. Give it a proper try — even a rough attempt gets you useful feedback." };
  if (/^(.)\1{4,}$/.test(trimmed)) return { pass: false, message: "That doesn't look like an answer. Give it a proper try — even a rough attempt gets you useful feedback." };
  if (!trimmed.includes(" ") && trimmed.length > 15) return { pass: false, message: "That doesn't look like an answer. Give it a proper try — even a rough attempt gets you useful feedback." };
  return { pass: true, message: null };
};

const calculateSimilarity = (a, b) => {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  return intersection / Math.max(wordsA.size, wordsB.size);
};

const classifySubmission = async (question, marks, answer, previousAnswer = null, previousFeedback = null) => {
  const clientCheck = clientSideCheck(answer, marks);
  if (!clientCheck.pass) return { verdict: "fail", message: clientCheck.message };
  // Block only identical character-for-character resubmissions
  if (previousAnswer && answer.trim() === previousAnswer.trim()) {
    return {
      verdict: "fail",
      reason: "repeat",
      message: "This looks the same as your last answer. Edit it based on the feedback, then resubmit.",
    };
  }
  try {
    const userMsg = `Question [${marks} marks]: ${question}\n\nStudent's answer: ${answer}`;
    const raw = await callClaude("classifier", userMsg);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return { verdict: result.verdict, message: result.verdict === "fail" ? result.message.replace("[X]", marks) : null };
  } catch {
    return { verdict: "pass", message: null };
  }
};

const logFlaggedAttempt = async (userId, questionId, attemptNumber, flagReason) => {
  if (!userId) return;
  const log = { studentId: userId, questionId, timestamp: Date.now(), flagReason, attemptNumber };
  const existing = await sg("gm4_flags") || [];
  await ss("gm4_flags", [...existing, log]);
};

// ─── SESSION HELPERS ──────────────────────────────────────────────────────────
const getWeekStart = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split("T")[0];
};

const getLastWeekStart = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() + diff - 7);
  return lastMonday.toISOString().split("T")[0];
};

const validateExamDate = (newDateStr, user) => {
  const today = new Date();
  const newDate = new Date(newDateStr);
  const minFutureDate = new Date();
  minFutureDate.setDate(today.getDate() + 21);
  if (newDate < minFutureDate) return { valid: false, message: "Exam date must be at least 3 weeks from today." };
  if (user.previousExamDate) {
    const prevDate = new Date(user.previousExamDate);
    const minGap = new Date(prevDate);
    minGap.setDate(prevDate.getDate() + 28);
    if (newDate < minGap) return { valid: false, message: "New exam date must be at least 4 weeks after your previous exam." };
  }
  return { valid: true, message: null };
};

const BENCHMARK_QUESTIONS = ["q2", "q1", "q5"];

const generateSession = (user, records, allQuestions, currentSession, completedSessions = []) => {
  if (!user) return null;
  if (!user.onboardingComplete && !DEV_MODE) return null;
  if (DEV_MODE) console.log("[DEV] generateSession called with user:", user?.tier, user?.syllabus);

  const today = new Date();
  const tier = user?.tier || null;
  const isFreeAccount = !tier || tier === "free-account";

  if (isFreeAccount) {
    const freePool = allQuestions.filter(q =>
      q.tier === "free" &&
      !needsFigure(q) &&
      q.syllabus.includes(user.syllabus || "O-Elective")
    );
    return {
      weekStart: getWeekStart(),
      questions: freePool.slice(0, 3).map(q => q.id),
      completed: currentSession?.completed || [],
      carriedOver: false,
      expired: false,
      examMode: false,
    };
  }

  const syllabus = user.syllabus || "O-Elective";
  // Derive covered cluster names from topicsCovered (array of sub-topic IDs like "clim_change")
  const tc = user.topicsCovered;
  const coveredClusters = (!tc || tc === "all" || (Array.isArray(tc) && tc.length === 0))
    ? null // null = no filter, show all
    : Object.entries(ONBOARDING_TOPICS)
      .filter(([, topics]) => topics.some(t => tc.includes(t.id)))
      .map(([cluster]) => cluster);

  // Filter a list of question IDs to only those in covered clusters (if restricted)
  const filterByCovered = (qIds) => {
    if (!coveredClusters) return qIds;
    return qIds.filter(id => {
      const q = allQuestions.find(x => x.id === id);
      return q && coveredClusters.includes(q.cluster);
    });
  };

  // ── Benchmark: first session for every new paid user ──────────────────────
  if (completedSessions.length === 0) {
    const benchmarkQs = filterByCovered(BENCHMARK_QUESTIONS);
    if (benchmarkQs.length > 0) {
      const session = { weekStart: getWeekStart(), questions: benchmarkQs, completed: [], carriedOver: false, expired: false, examMode: false, isBenchmark: true, theme: "Foundations", themeDescription: "Your starting point — we'll revisit these question types in 4 weeks to measure your progress." };
      if (DEV_MODE) console.log("[DEV] session generated (benchmark):", session);
      return session;
    }
    // No benchmark questions match covered topics — fall through to scored selection
  }

  // ── Check-in: every 4 completed sessions ──────────────────────────────────
  if (completedSessions.length % 4 === 0) {
    const lastCheckin = completedSessions.filter(s => s.isCheckin).pop();
    if (lastCheckin?.weekStart !== getWeekStart()) {
      const checkinQs = filterByCovered(BENCHMARK_QUESTIONS);
      if (checkinQs.length > 0) {
        return {
          weekStart: getWeekStart(),
          questions: checkinQs,
          completed: [],
          carriedOver: false,
          expired: false,
          examMode: false,
          isCheckin: true,
          theme: "Progress Check",
          themeDescription: "Same question types as your first session — let's see how far you've come.",
        };
      }
      // No check-in questions match covered topics — fall through to scored selection
    }
  }

  const examDate = user.examDate ? new Date(user.examDate) : null;
  const daysToExam = examDate ? Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)) : null;
  const examMode = daysToExam !== null && daysToExam <= 14;
  const extendedSession = daysToExam !== null && daysToExam <= 42;
  const sessionSize = extendedSession ? 5 : 3;

  if (currentSession && !currentSession.expired) {
    const lastWeekStart = getLastWeekStart();
    if (currentSession.weekStart === lastWeekStart && !currentSession.carriedOver) {
      return { ...currentSession, weekStart: getWeekStart(), carriedOver: true };
    }
  }
  const availableQuestions = allQuestions.filter(q =>
    !needsFigure(q) &&
    q.syllabus.includes(syllabus) &&
    q.tier === "paid" &&
    (!coveredClusters || coveredClusters.includes(q.cluster))
  );

  const questionScores = availableQuestions.map(q => {
    let score = 0;
    const skillFailures = records.filter(r => r.skill === q.skill).flatMap(r => r.parsed?.failures || []).length;
    score += skillFailures * 3;
    const recentClusters = records.slice(-10).map(r => r.cluster);
    if (!recentClusters.includes(q.cluster)) score += 2;
    const qRecords = records.filter(r => r.questionId === q.id);
    const everL3 = qRecords.some(r => r.parsed?.markBand === "L3");
    const attempted = qRecords.length > 0;
    if (attempted && !everL3) score += 4;
    if (!attempted) score += 1;
    const recentIds = records.slice(-6).map(r => r.questionId);
    if (recentIds.includes(q.id)) score -= 5;
    return { ...q, score };
  });

  const sorted = questionScores.sort((a, b) => b.score - a.score);
  const selected = [];
  const usedClusters = new Set();
  for (const q of sorted) {
    if (selected.length >= sessionSize) break;
    if (!usedClusters.has(q.cluster)) { selected.push(q.id); usedClusters.add(q.cluster); }
  }
  for (const q of sorted) {
    if (selected.length >= sessionSize) break;
    if (!selected.includes(q.id)) selected.push(q.id);
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  const clusterCounts = {};
  selected.forEach(qId => {
    const q = allQuestions.find(x => x.id === qId);
    if (q) clusterCounts[q.cluster] = (clusterCounts[q.cluster] || 0) + 1;
  });
  const dominantCluster = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Mixed";

  const skillFailureCounts = {};
  records.forEach(r => {
    if (r.skill) skillFailureCounts[r.skill] = (skillFailureCounts[r.skill] || 0) + (r.parsed?.failures?.length || 0);
  });
  const weakestSkill = Object.entries(skillFailureCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Explain";

  const sessionNumber = completedSessions.length + 1;
  const isSec3 = user.year === "sec3";
  const isSkillWeek = !isSec3 && sessionNumber % 2 === 0;
  const theme = isSkillWeek ? weakestSkill : dominantCluster;

  const session = { weekStart: getWeekStart(), questions: selected, completed: [], carriedOver: false, expired: false, examMode, theme };
  if (DEV_MODE) console.log("[DEV] session generated:", session);
  return session;
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const sg = async (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const ss = async (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { } };

// ─── API ──────────────────────────────────────────────────────────────────────
// Proxied through Supabase Edge Function — see src/lib/ai.js and supabase/functions/claude-feedback/.
// Separate mark-counting call for "human activities" questions.
// Runs independently of feedback generation to avoid the model conflating the two tasks.
const COUNT_SYSTEM = `You count marks on Singapore O/N Level Geography answers. Return ONLY valid JSON.
Schema: {"activities": [{"name": string, "mark1": boolean, "mark2": boolean}], "marksAwarded": number}

Each human activity earns 0, 1, or 2 marks:
- mark1 = true: the activity is named and the student mentions any cause, gas, or emission associated with it (CO₂, methane, carbon dioxide, GHG, deforestation releasing carbon, burning releasing gases, etc.)
- mark2 = true: the student's text for this activity shows — in any phrasing — that the release leads to warming or heat being retained. This includes:
    greenhouse effect, enhanced greenhouse effect, heat trap/trapped/trapping/retained/cannot escape,
    global warming, temperature rise/rising/higher, Earth/planet warming, atmosphere warming,
    "more heat in the atmosphere", "causes warming", "leads to higher temperatures" — or any equivalent.
  Be GENEROUS: if the student's sentence suggests the cause leads to warmth staying in the atmosphere, mark2 = true.
  Do NOT require the student to name every step in the chain explicitly.

FULL ANSWER SCAN: Read the entire answer before scoring each activity.
If warming/trapping language appears ANYWHERE in the answer and the activity has mark1, give mark2 unless it clearly belongs to a different activity.

marksAwarded = sum of (mark1 + mark2) across all activities, capped at totalMarks.`;

const buildCompletionFeedback = (countResult, totalMarks) => {
  // Use activities that have both marks; fall back to any named activity if mark data is unreliable
  const scored = (countResult?.activities || []).filter(a => a.mark1 && a.mark2);
  const anyNamed = (countResult?.activities || []).filter(a => a.name);
  const toShow = scored.length > 0 ? scored : anyNamed;
  const lines = toShow.map(a => `${a.name} — activity named, gas/cause identified, mechanism linked to outcome. ✓`);
  lines.push(`Full marks — ${totalMarks}/${totalMarks}. Nothing left to fix.`);
  return lines.join("\n");
};

const buildCompletionParsed = (totalMarks) => ({
  markBand: "L3", markBandLabel: `${totalMarks}/${totalMarks} marks`,
  marksAwarded: totalMarks, totalMarks,
  failures: [], positives: [], totalGaps: 0, currentGap: "",
});

// Code-based mark2 check — counts distinct warming/trapping signals in the answer.
const MARK2_PATTERNS = [
  /enhanced greenhouse effect/i,
  /\bgreenhouse effect\b/i,
  /heat.{0,30}(?:trap|retain|absorb|cannot escape|not.{0,5}escape)/i,
  /(?:trap|retain|absorb).{0,20}heat/i,
  /global warm/i,
  /temperature[s]?.{0,10}(?:rise|rising|increase|higher|elevated)/i,
  /(?:warmer|warming).{0,20}(?:climate|earth|planet|temperature|atmosphere)/i,
  /(?:earth|planet|atmosphere).{0,20}warm/i,
  /more heat.{0,20}(?:atmosphere|trapped|retained|earth)/i,
  /causes?.{0,15}warm/i,
];
const codeMark2Count = (text) => MARK2_PATTERNS.filter(p => p.test(text)).length;

// Code-based human activity detection
const ACTIVITY_PATTERNS = [
  /deforestation|logging|clearing.*forest|forest.*clear/i,
  /burning.*fossil|fossil.*fuel|\bcoal\b|\bpetrol\b|combustion of/i,
  /\burbanisa[st]ion|\burbaniza[st]ion|urban.*sprawl/i,
  /\bagricultur|\bfarming\b|\blivestock\b|rice.*paddy|\bcattle\b/i,
  /\bindustri|\bmanufactur/i,
  /\btransport(ation)?\b|\bvehicle\b/i,
  /\bwaste\b.*(?:dump|landfill|decompos)|\blandfill\b/i,
];
const codeActivityCount = (text) => ACTIVITY_PATTERNS.filter(p => p.test(text)).length;

// Pure code-based full-marks check for human activities questions.
// Returns true if the answer has enough distinct activities AND enough mark2 signals.
const codeFullMarksCheck = (answer, totalMarks) => {
  const needed = Math.ceil(totalMarks / 2);
  return codeActivityCount(answer) >= needed && codeMark2Count(answer) >= needed;
};

const countActivityMarks = async (question, totalMarks, answer) => {
  const q = (question || "").toLowerCase();
  if (!q.includes("human activit")) return null;
  // Code-only fast path — if activities + mark2 signals both clear the bar, skip the API call
  if (codeFullMarksCheck(answer, totalMarks)) {
    return { activities: [], marksAwarded: totalMarks };
  }
  try {
    const msg = `Question [${totalMarks} marks]: ${question}\n\nStudent answer: ${answer}\n\ntotalMarks cap: ${totalMarks}`;
    const raw = await callClaude("count", msg);
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    result.marksAwarded = Math.min(result.marksAwarded, totalMarks);
    // Safety net: model undercounted but code scan confirms full marks
    const needed = Math.ceil(totalMarks / 2);
    if (result.marksAwarded < totalMarks && codeMark2Count(answer) >= needed && codeActivityCount(answer) >= needed) {
      result.marksAwarded = totalMarks;
    }
    return result;
  } catch { return null; }
};

// Extract JSON object from model output, tolerating prose wrappers and code fences.
const extractJSON = (raw) => {
  if (!raw) return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  // Direct parse
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  // Find first { ... } block
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
};

// Strip internal audit sections from model output before displaying to student.
// The model sometimes labels its reasoning with "INTERNAL MARKING AUDIT" and
// "STUDENT-FACING OUTPUT" — extract only the student-facing portion when present.
const FEEDBACK_SEPARATOR = "---FEEDBACK---";
const stripAudit = (text) => {
  if (!text) return text;
  // Primary: mandatory separator
  const sepIdx = text.indexOf(FEEDBACK_SEPARATOR);
  if (sepIdx !== -1) {
    return text.slice(sepIdx + FEEDBACK_SEPARATOR.length).replace(/^[\s\n]+/, "").trim();
  }
  // Fallback: student-facing section label
  const sfMatch = text.search(/STUDENT[\s-]*FACING[\s]*OUTPUT/i);
  if (sfMatch !== -1) {
    return text.slice(sfMatch).replace(/STUDENT[\s-]*FACING[\s]*OUTPUT/i, "").replace(/^[\s:#*_-]+/, "").trim();
  }
  // Fallback: strip any lines that look like audit headings, then return remainder
  if (/INTERNAL MARKING AUDIT|MARKING PROCESS|MARKING AUDIT|Step \d[\s—]|marksAwarded.*>=.*totalMarks|OUTPUT COMPLETION STATE/i.test(text)) {
    // Find the last audit heading line and return everything after it
    const auditHeadingRe = /^(?:#{1,3}\s*)?(?:INTERNAL MARKING AUDIT|MARKING PROCESS|MARKING AUDIT|Step \d[\s—].*)/im;
    // Walk line by line, skip lines that are audit-only content until we hit prose
    const lines = text.split("\n");
    let auditSectionEnded = false;
    const outputLines = [];
    for (const line of lines) {
      const isAuditHeading = /^(?:#{1,3}\s*)?(?:INTERNAL MARKING AUDIT|MARKING PROCESS|MARKING AUDIT|STEP ZERO|Step \d[\s:—]|OUTPUT COMPLETION STATE)/i.test(line.trim());
      const isAuditContent = /^[-*]\s*(Activity|Mark\s*\d|Chain|assessment|marking|awarded|result):/i.test(line.trim())
        || /^\*\*?(Step|Activity|Mark awarded|Marks awarded|Total marks|marksAwarded)/i.test(line.trim())
        || /marksAwarded.*>=.*totalMarks/i.test(line)
        || /\bmarksAwarded\s*\(/i.test(line);
      if (isAuditHeading) { auditSectionEnded = false; outputLines.length = 0; continue; }
      if (!auditSectionEnded && isAuditContent) { outputLines.length = 0; continue; }
      auditSectionEnded = true;
      outputLines.push(line);
    }
    const result = outputLines.join("\n").replace(/^[\s\n]+/, "").trim();
    if (result) return result;
  }
  return text;
};

// Post-parse full-marks seal: if the model awarded full marks but still generated
// gap analysis, strip the gaps and replace with a clean completion message.
const sealIfComplete = (fb, parsed, totalMarks) => {
  if (isLormQuestion(totalMarks)) return fb; // LORM questions: never seal, band-based only
  if (parsed.marksAwarded !== null && parsed.totalMarks !== null && parsed.marksAwarded >= totalMarks) {
    parsed.failures = [];
    parsed.totalGaps = 0;
    parsed.currentGap = "";
    // Truncate feedback at the Marks line (remove anything after it)
    const marksLine = `Marks: ${totalMarks}/${totalMarks}`;
    const idx = fb.indexOf(marksLine);
    const cleanFb = idx !== -1 ? fb.slice(0, idx + marksLine.length) : fb;
    return cleanFb;
  }
  return fb;
};

// Inject marking structure note directly into userMsg for question types
// where the model reliably ignores system prompt instructions
const markingNote = (questionText, marks) => {
  const q = (questionText || "").toLowerCase();
  if (q.includes("human activit")) {
    const activitiesNeeded = Math.ceil(marks / 2);
    return `\n\nMARKING STRUCTURE (override default reasoning): This is a 2-marks-per-activity question. Each fully developed activity = 2 marks (Mark 1: activity + gas/cause named; Mark 2: mechanism linked to outcome). ${activitiesNeeded} complete activities = ${marks}/${marks} = FULL MARKS. Do not require more than ${activitiesNeeded} activities. If ${activitiesNeeded} activities are fully developed, output completion state immediately — do not flag any other named activities as gaps.

O/N LEVEL CHAIN STANDARD — apply this tolerance:
Mark 2 is awarded if the student has given any step connecting the cause toward the outcome. Do NOT require every intermediate step to be explicitly stated.
Accepted as complete at O/N level:
- "Fewer trees absorb less CO₂ through photosynthesis" → Mark 2 awarded. The student does not need to also write "therefore CO₂ increases in the atmosphere."
- "Burning fossil fuels releases CO₂ which traps heat" → Mark 2 awarded. Student does not need to say "longwave radiation is absorbed."
- "More CO₂ → enhanced greenhouse effect" → Mark 2 awarded. Student does not need to say "Earth's surface warms."
If the cause is named and a step toward the outcome is present → award Mark 2. Do not demand the complete chain be spelled out word by word.`;
  }
  return "";
};

const parseFeedback = async (text, questionMarks = null) => {
  try {
    const input = questionMarks != null
      ? `QUESTION_MARKS: ${questionMarks}\n\n${text}`
      : text;
    const raw = await callClaude("parse", input);
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    // Authoritative totalMarks from metadata overrides whatever the model wrote
    if (questionMarks != null) parsed.totalMarks = questionMarks;
    return parsed;
  } catch { return { markBand: "L1", markBandLabel: "—", failures: [], positives: [], totalGaps: 0, currentGap: "", marksAwarded: null, totalMarks: null }; }
};

// Converts EVAL_SYSTEM JSON → parsed object shape expected by the UI
const evalToParsed = (evalResult, marks) => {
  const { marksAwarded, totalMarks, markBand, completedPoints, gaps, primaryGap } = evalResult;
  const tm = totalMarks ?? marks;
  const isLorm = isLormQuestion(tm);
  const markBandLabel = isLorm
    ? (markBand || 'L1')
    : marksAwarded != null ? `${marksAwarded}/${tm} marks` : (markBand || 'L1');
  // Fall back to first gap if model forgot to set primaryGap
  const effectivePrimary = primaryGap || (gaps?.length ? gaps[0] : null);
  const ma = marksAwarded ?? (isLorm ? null : 0);
  const isComplete = evalResult.isComplete || (!isLorm && ma != null && ma >= tm);
  return {
    markBand: markBand || 'L1',
    markBandLabel,
    failures: (gaps || []).map(g => (typeof g === 'string' ? g : g.label)),
    positives: completedPoints || [],
    totalGaps: (gaps || []).length,
    currentGap: effectivePrimary ? (typeof effectivePrimary === 'string' ? effectivePrimary : effectivePrimary.label) : '',
    marksAwarded: ma,
    totalMarks: tm,
    isComplete,
  };
};

const BAND_NUM = { L1: 1, L2: 2, L3: 3 };

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
const Tag = ({ label, type }) => {
  const s = type === "cluster" ? CLUSTER_COLOR[label] : SKILL_COLOR[label];
  if (!s) return null;
  return <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
    {type === "cluster" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, display: "inline-block" }} />}
    {label}
  </span>;
};
const Pill = ({ label, bg, color }) => <span style={{ background: bg, color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "inline-block" }}>{label}</span>;
const LORM_RANGES = {
  9: { L1: "1–3", L2: "4–6", L3: "7–9" },
  6: { L1: "1–2", L2: "3–4", L3: "5–6" },
};
const isLormQuestion = (totalMarks) => totalMarks === 6 || totalMarks === 9;
const BandDot = ({ band, marksAwarded, totalMarks }) => {
  const m = { L1: { bg: C.redL, color: C.red }, L2: { bg: C.amberL, color: C.amber }, L3: { bg: C.greenL, color: C.green } };
  // LORM questions always show band label, never numeric score
  if (isLormQuestion(totalMarks)) {
    const s = m[band] || m.L1;
    const range = LORM_RANGES[totalMarks]?.[band];
    const label = range ? `${band} · ${range}/${totalMarks}m` : (band || "L1");
    return <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 800 }}>{label}</span>;
  }
  // Point-marked: show numeric score if available
  if (marksAwarded !== null && marksAwarded !== undefined && totalMarks) {
    const ratio = marksAwarded / totalMarks;
    const s = ratio >= 0.75 ? { bg: C.greenL, color: C.green } : ratio >= 0.4 ? { bg: C.amberL, color: C.amber } : { bg: C.redL, color: C.red };
    return <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 800 }}>{marksAwarded}/{totalMarks}m</span>;
  }
  const s = m[band] || m.L1;
  return <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 800 }}>{band || "L1"}</span>;
};
const Sparkline = ({ values, width = 80, height = 26 }) => {
  if (!values || values.length < 2) return null;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - 1) / 2) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const col = values[values.length - 1] === 3 ? C.green : values[values.length - 1] === 2 ? C.amber : C.red;
  return <svg width={width} height={height} style={{ display: "block" }}>
    <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    {values.map((v, i) => { const x = (i / (values.length - 1)) * width; const y = height - ((v - 1) / 2) * (height - 4) - 2; return <circle key={i} cx={x} cy={y} r="2.5" fill={col} />; })}
  </svg>;
};

// ─── SYLLABUS SELECTOR (onboarding) ──────────────────────────────────────────
const SyllabusSelector = ({ current, onChange, compact = false }) => {
  if (compact) {
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.values(SYLLABUSES).map(s => (
          <button key={s.id} onClick={() => s.available && onChange(s.id)}
            title={!s.available ? "Coming soon" : ""}
            style={{
              background: current === s.id ? s.color : "#fff",
              color: current === s.id ? "#fff" : s.available ? C.mid : C.border,
              border: `1.5px solid ${current === s.id ? s.color : s.available ? C.border : C.border}`,
              borderRadius: 20, padding: "5px 14px", fontSize: 12,
              fontWeight: current === s.id ? 700 : 500,
              opacity: s.available ? 1 : 0.5,
              cursor: s.available ? "pointer" : "not-allowed",
            }}>
            {s.shortLabel}
            {!s.available && " (soon)"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontWeight: 700, color: C.text, fontSize: 15, marginBottom: 4 }}>What are you studying?</div>
      <div style={{ color: C.light, fontSize: 13, marginBottom: 16 }}>
        Your syllabus determines how your answers are calibrated and marked.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        {Object.values(SYLLABUSES).map(s => (
          <button key={s.id} onClick={() => s.available && onChange(s.id)}
            style={{
              background: current === s.id ? `${s.color}12` : "#fff",
              border: `2px solid ${current === s.id ? s.color : s.available ? C.border : C.border}`,
              borderRadius: 12, padding: "16px 14px", textAlign: "left",
              opacity: s.available ? 1 : 0.55,
              cursor: s.available ? "pointer" : "not-allowed",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{
                background: current === s.id ? s.color : "#f3f4f6",
                color: current === s.id ? "#fff" : C.light,
                borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700
              }}>
                {s.level === "O" ? "O-LEVEL" : "N-LEVEL"}
              </div>
              <div style={{ fontSize: 10, color: C.light, fontWeight: 600 }}>{s.code}</div>
            </div>
            <div style={{ fontWeight: 700, color: current === s.id ? s.color : C.text, fontSize: 13, marginBottom: 2 }}>
              {s.type} Geography
            </div>
            {!s.available && (
              <div style={{
                fontSize: 11, color: C.light, marginTop: 4,
                background: C.amberL, borderRadius: 6, padding: "2px 8px", display: "inline-block"
              }}>
                Coming soon
              </div>
            )}
            {s.available && current === s.id && (
              <div style={{ fontSize: 11, color: s.color, marginTop: 4, fontWeight: 600 }}>✓ Selected</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── FIGURE PLACEHOLDER ───────────────────────────────────────────────────────
const FigurePlaceholder = ({ figure }) => {
  if (!figure) return null;
  if (figure.srcs) {
    return (
      <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {figure.srcs.map((src, i) => (
          <img key={i} src={src} alt={`${figure.description || "Figure"} ${i + 1}`} style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${C.border}` }} />
        ))}
      </div>
    );
  }
  if (figure.src) {
    return (
      <div style={{ marginBottom: 14 }}>
        <img src={figure.src} alt={figure.description || "Figure"} style={{ maxWidth: "100%", borderRadius: 10, border: `1px solid ${C.border}` }} />
      </div>
    );
  }
  return (
    <div style={{ background: C.bg, border: `1.5px dashed ${C.borderM}`, borderRadius: 10, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, color: C.light, fontSize: 13 }}>
      <span style={{ fontSize: 20 }}>📊</span>
      <span>Figure not yet available for this question.</span>
    </div>
  );
};

// ─── FLAG FEEDBACK ────────────────────────────────────────────────────────────
const FlagFeedback = ({ flagData, parsed, attemptNum }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | done | error

  const submit = async () => {
    if (!reason.trim()) return;
    setStatus("saving");
    const { error } = await supabase.from("feedback_flags").insert({
      question_id: flagData?.questionId || null,
      question_text: flagData?.questionText || "",
      student_answer: flagData?.answer || "",
      ai_band: parsed?.markBand || null,
      ai_failures: parsed?.failures?.length ? parsed.failures : null,
      ai_current_gap: parsed?.currentGap || null,
      student_reason: reason.trim(),
      syllabus: flagData?.syllabus || null,
      attempt_number: attemptNum || null,
    });
    setStatus(error ? "error" : "done");
  };

  if (status === "done") {
    return <div style={{ marginTop: 12, fontSize: 12, color: C.light }}>Thanks — we'll review this.</div>;
  }

  return (
    <div style={{ marginTop: 14 }}>
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ background: "none", border: "none", color: C.light, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          Something wrong with this feedback?
        </button>
      ) : (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.mid, marginBottom: 8 }}>What did we get wrong?</div>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. My answer was correct but it said I was missing a mechanism"
            rows={3}
            style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit", resize: "vertical", background: "#fff", color: C.text }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setOpen(false)}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 14px", fontSize: 12, color: C.light, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={submit} disabled={!reason.trim() || status === "saving"}
              style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: reason.trim() ? "pointer" : "default", opacity: reason.trim() ? 1 : 0.5 }}>
              {status === "saving" ? "Sending…" : "Send"}
            </button>
          </div>
          {status === "error" && <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>Couldn't save — try again.</div>}
        </div>
      )}
    </div>
  );
};

// ─── FEEDBACK HELPERS ─────────────────────────────────────────────────────────
// Parse the raw AI feedback string into named sections
const parseFeedbackSections = (text) => {
  if (!text) return {};
  const sections = { gap: [], positives: [], fix: [], nextStep: [], extra: [] };
  let cur = "extra";
  for (const line of text.split("\n")) {
    if (line.startsWith("MARK BAND:")) continue;
    else if (line.startsWith("WHAT'S HOLDING YOU BACK:")) { cur = "gap"; const rest = line.replace("WHAT'S HOLDING YOU BACK:", "").trim(); if (rest) sections.gap.push(rest); }
    else if (line.startsWith("WHAT YOU DID WELL:")) { cur = "positives"; }
    else if (line.startsWith("WHAT TO FIX:")) { cur = "fix"; }
    else if (line.startsWith("YOUR NEXT STEP:")) { cur = "nextStep"; }
    else { sections[cur]?.push(line); }
  }
  return sections;
};

// Render inline **bold** markdown in a line
const RichLine = ({ text, style }) => {
  if (!text.includes("**")) return <span style={style}>{text}</span>;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <span style={style}>{parts.map((p, j) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p
  )}</span>;
};

const renderLines = (lines, color) => lines
  .filter(l => l.trim() && l !== "---")
  .map((l, i) => <div key={i} style={{ marginBottom: 5 }}><RichLine text={l} style={{ color, fontSize: 13, lineHeight: 1.65 }} /></div>);

// ─── FEEDBACK PANEL ───────────────────────────────────────────────────────────
const FeedbackPanel = ({ feedback, attemptNum, parsed, prevBand, flagData }) => {
  if (!feedback) return null;

  const improved = prevBand && parsed && BAND_NUM[parsed.markBand] > BAND_NUM[prevBand];
  const sections = parseFeedbackSections(feedback);

  const marksAwarded = parsed?.marksAwarded ?? null;
  const totalMarks = parsed?.totalMarks ?? null;
  const band = parsed?.markBand || "L1";
  const isLorm = isLormQuestion(totalMarks);

  // Gap map data
  const positives = parsed?.positives || [];
  const activeGap = parsed?.currentGap || "";
  const upcomingGaps = (parsed?.failures || [])
    .filter(f => f !== activeGap && !positives.some(p => p === f));

  // Mark progress bar
  const progressPct = (marksAwarded != null && totalMarks) ? Math.round((marksAwarded / totalMarks) * 100) : null;
  const bandColors = { L1: { bg: C.redL, color: C.red }, L2: { bg: C.amberL, color: C.amber }, L3: { bg: C.greenL, color: C.green } };
  const bc = bandColors[band] || bandColors.L1;

  return (
    <div className="fade" style={{ borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", fontSize: 14 }}>

      {/* ── Score header ──────────────────────────────────── */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.light, letterSpacing: "0.08em" }}>ATTEMPT {attemptNum}</span>
            {improved && <span style={{ background: C.greenL, color: C.green, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>↑ Improved</span>}
          </div>
          {/* Band pill */}
          <span style={{ background: bc.bg, color: bc.color, borderRadius: 4, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>
            {band}{isLorm && totalMarks ? ` · ${LORM_RANGES[totalMarks]?.[band]}/${totalMarks}m` : ""}
          </span>
        </div>
        {/* Mark count */}
        {!isLorm && marksAwarded != null && totalMarks && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 26, color: C.text, lineHeight: 1 }}>{marksAwarded}</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: C.light }}>/ {totalMarks}</span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: progressPct >= 75 ? C.green : progressPct >= 40 ? C.amber : C.red, borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
          </>
        )}
      </div>

      {/* ── Gap map ───────────────────────────────────────── */}
      {(positives.length > 0 || activeGap || upcomingGaps.length > 0) && (
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.light, letterSpacing: "0.08em", marginBottom: 7 }}>REASONING MAP</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Resolved */}
            {positives.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 8px", background: C.greenL, borderRadius: 6 }}>
                <span style={{ color: C.green, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✓</span>
                <span style={{ color: C.green, fontSize: 12, lineHeight: 1.4 }}>{p}</span>
              </div>
            ))}
            {/* Active gap */}
            {activeGap && (
              <div style={{ borderLeft: `3px solid ${C.coral}`, background: "#fffbf0", borderRadius: "0 6px 6px 0", padding: "6px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.coral, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{activeGap}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: C.amber, fontWeight: 600 }}>active</span>
                </div>
              </div>
            )}
            {/* Upcoming */}
            {upcomingGaps.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", opacity: 0.45 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.light, flexShrink: 0, display: "inline-block" }} />
                <span style={{ color: C.mid, fontSize: 12 }}>{g}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: C.light }}>coming next</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Diagnosis text ────────────────────────────────── */}
      <div style={{ padding: "12px 16px", background: C.bg }}>
        {sections.gap?.filter(l => l.trim()).length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.light, letterSpacing: "0.08em", marginBottom: 4 }}>DIAGNOSIS</div>
            {renderLines(sections.gap, C.text)}
          </div>
        )}
        {sections.positives?.filter(l => l.trim()).length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: "0.08em", marginBottom: 4 }}>WHAT YOU DID WELL</div>
            {renderLines(sections.positives, C.mid)}
          </div>
        )}
        {sections.fix?.filter(l => l.trim()).length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: "0.08em", marginBottom: 4 }}>WHAT TO FIX</div>
            {renderLines(sections.fix, C.mid)}
          </div>
        )}
        {sections.nextStep?.filter(l => l.trim()).length > 0 && (
          <div style={{ padding: "10px 12px", background: C.coralL, borderRadius: 8, borderLeft: `3px solid ${C.coral}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: "0.08em", marginBottom: 4 }}>YOUR NEXT STEP</div>
            {renderLines(sections.nextStep, C.text)}
          </div>
        )}
        {/* Fallback: show extra lines if no structured sections parsed */}
        {!sections.gap?.length && !sections.fix?.length && sections.extra?.filter(l => l.trim()).length > 0 && (
          <div>{renderLines(sections.extra, C.mid)}</div>
        )}
      </div>

      {flagData && (
        <div style={{ padding: "0 20px 14px", background: C.bg }}>
          <FlagFeedback flagData={flagData} parsed={parsed} attemptNum={attemptNum} />
        </div>
      )}
    </div>
  );
};

// ─── QUESTION CARD ────────────────────────────────────────────────────────────
const QuestionCard = ({ q, onAttempt, canSubmit, onUpgrade, syllabus, user, bonusMode, onBack }) => {
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | checking | analysing
  const [blocked, setBlocked] = useState(null);
  const [open, setOpen] = useState(false);
  const latest = attempts[attempts.length - 1];
  const prevBand = attempts.length >= 2 ? attempts[attempts.length - 2].parsed?.markBand : null;
  const bandHistory = attempts.map(a => BAND_NUM[a.parsed?.markBand] || 1);

  const handleAnswerChange = (e) => { setAnswer(e.target.value); if (blocked) setBlocked(null); };

  useEffect(() => {
    if (attempts.length > 0) {
      setAnswer(attempts[attempts.length - 1].answerText || "");
    }
  }, [attempts.length]);

  const submit = async () => {
    if (!answer.trim() || phase !== "idle") return;
    if (!canSubmit) { onUpgrade(); return; }
    const n = attempts.length + 1;
    setPhase("checking");
    const prevAnswer = attempts.length > 0 ? attempts[attempts.length - 1].answerText || null : null;
    const prevFeedback = attempts.length > 0 ? attempts[attempts.length - 1].feedback || null : null;
    const check = await classifySubmission(q.question, q.marks, answer, prevAnswer, prevFeedback);
    if (check.verdict === "fail") {
      setBlocked(check.message);
      await logFlaggedAttempt(user?.id, q.id, n, check.message);
      setPhase("idle");
      return;
    }
    setPhase("analysing");
    const syl = SYLLABUSES[syllabus] || SYLLABUSES["O-Elective"];
    const userMsg = `Syllabus: ${syl.label} (${syl.code})\nQuestion [${q.marks} marks] — ${q.skill} — ${q.cluster}:\n${q.question}`
      + (q.context ? `\n\nContext: ${q.context}` : "")
      + (q.figure ? `\n\nFigure: ${q.figure.caption}` : "")
      + markingNote(q.question, q.marks)
      + `\n\nStudent answer: ${answer}`;
    try {
      let evalRaw = await callClaude("eval", userMsg);
      let evalResult;
      evalResult = extractJSON(evalRaw);
      if (!evalResult) {
        evalRaw = await callClaude("eval", userMsg);
        evalResult = extractJSON(evalRaw);
      }
      if (!evalResult || (!evalResult.isComplete && !evalResult.primaryGap && !(evalResult.gaps?.length))) {
        setAttempts(p => [...p, { feedback: "Something went wrong on our end — please resubmit your answer.", parsed: null, answerText: answer }]);
        setPhase("idle");
        return;
      }
      const feedbackInput = `${userMsg}\n\nEVALUATION (fixed — do not recalculate):\n${JSON.stringify(evalResult, null, 2)}`;
      let fb = stripAudit(await callClaude("feedback", feedbackInput));
      const parsed = evalToParsed(evalResult, q.marks);
      fb = sealIfComplete(fb, parsed, q.marks);
      setAttempts(p => [...p, { feedback: fb, parsed, answerText: answer }]);
      onAttempt({ questionId: q.id, cluster: q.cluster, skill: q.skill, marks: q.marks, syllabus, attemptNumber: n, parsed, timestamp: Date.now() });
    } catch (err) {
      setAttempts(p => [...p, { feedback: `Connection error — ${err.message}`, parsed: null, answerText: answer }]);
    }
    setPhase("idle");
  };

  const btnLabel = phase === "checking" ? "Checking…" : phase === "analysing" ? "Analysing…" : attempts.length > 0 ? "Re-submit →" : "Get Feedback →";
  const busy = phase !== "idle";

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 10, overflow: "hidden", boxShadow: open ? "0 4px 20px rgba(255,107,53,0.07)" : "0 1px 3px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s" }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "15px 18px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
            <Tag label={q.cluster} type="cluster" />
            <Tag label={q.skill} type="skill" />
            <Pill label={`[${q.marks}m]`} bg={C.coralL} color={C.coral} />
            {q.figure && <Pill label="📊 Fig." bg="#f5f2ec" color={C.light} />}
            {attempts.length > 0 && <BandDot band={latest.parsed?.markBand || "L1"} marksAwarded={latest.parsed?.marksAwarded} totalMarks={latest.parsed?.totalMarks} />}
            {bandHistory.length >= 2 && <Sparkline values={bandHistory} />}
          </div>
          <div style={{ color: C.text, fontSize: 14, lineHeight: 1.6, fontWeight: 500 }}>
            {!open && q.question.length > 90 ? q.question.slice(0, 90) + "…" : q.question}
          </div>
        </div>
        <span style={{ color: C.green, fontSize: 15, flexShrink: 0, marginTop: 2 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${C.border}` }}>
          {bonusMode && onBack && (
            <button onClick={onBack} style={{ background: "none", border: "none", color: C.light, fontSize: 13, cursor: "pointer", padding: "10px 0 4px", display: "block" }}>← Back to Practice</button>
          )}
          {q.figureRequired && !q.figure?.src && (
            <div style={{ background: C.amberL, border: `1px solid ${C.amber}`, borderRadius: 10, padding: "12px 14px", marginTop: 12, marginBottom: 4, fontSize: 13, color: C.amber, fontWeight: 600 }}>
              ⚠ This question requires a figure that is not yet available in the app. It will be enabled in a future update.
            </div>
          )}
          {q.figure && <div style={{ marginTop: 12 }}><FigurePlaceholder figure={q.figure} /></div>}
          {attempts.length > 0 && <div style={{ background: C.greenL, border: `1px solid ${C.green}40`, borderRadius: 8, padding: "7px 12px", marginTop: 10, fontSize: 13, color: C.green, fontWeight: 600 }}>✏️ Your last answer is below — edit it based on the feedback, then resubmit.</div>}
          <textarea value={answer} onChange={handleAnswerChange}
            placeholder={attempts.length > 0 ? "Edit your answer above, then resubmit…" : "Write your answer here…"}
            style={{ width: "100%", minHeight: 130, background: C.bg, border: `1.5px solid ${blocked ? C.red : C.border}`, borderRadius: 10, padding: "11px 13px", color: C.text, fontSize: 14, lineHeight: 1.6, resize: "vertical", marginTop: 10 }} />
          {blocked && (
            <div style={{ background: C.redL, border: `1.5px solid ${C.red}`, borderRadius: 8, padding: "8px 12px", marginTop: 6, fontSize: 13, color: C.red, fontWeight: 500 }}>
              {blocked}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span style={{ color: C.light, fontSize: 12 }}>
              {answer.split(/\s+/).filter(Boolean).length} words · {q.marks} marks
              {attempts.length > 0 && ` · 🔥 ${attempts.length} attempt${attempts.length > 1 ? "s" : ""}`}
            </span>
            <button onClick={submit} disabled={!answer.trim() || busy} className="hl"
              style={{ background: busy ? C.border : C.coral, color: busy ? C.light : "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontWeight: 700, fontSize: 14 }}>
              {btnLabel}
            </button>
          </div>
          <FeedbackPanel feedback={latest?.feedback} attemptNum={attempts.length} parsed={latest?.parsed} prevBand={prevBand}
            flagData={latest ? { questionId: q.id, questionText: q.question, answer: latest.answerText, syllabus } : null} />
        </div>
      )}
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const Dashboard = ({ records, currentSession, user, completedSessions = [] }) => {
  // ── 1. NEXT SESSION CARD ──────────────────────────────
  const sessionCard = (
    <div style={{
      background: `linear-gradient(135deg, ${C.coral}15, ${C.coralL})`,
      border: `2px solid ${C.coral}`,
      borderRadius: 16, padding: '24px',
      marginBottom: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '0.08em', marginBottom: 8 }}>
        {currentSession?.isBenchmark ? 'STARTING SESSION' :
          currentSession?.isCheckin ? 'PROGRESS CHECK' :
            `WEEK ${completedSessions.length + 1} TRAINING SESSION`}
      </div>
      <div style={{ fontFamily: "'Clash Display', sans-serif", fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        Theme: {currentSession?.theme || 'Loading...'}
      </div>
      <div style={{ color: C.mid, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        {currentSession?.themeDescription || ''}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {currentSession?.questions?.map((qId, i) => {
          const q = QUESTION_BANK.find(x => x.id === qId);
          const done = currentSession.completed?.includes(qId);
          return q ? (
            <div key={qId} style={{
              background: done ? C.greenL : '#fff',
              border: `1px solid ${done ? C.green : C.border}`,
              borderRadius: 8, padding: '6px 12px',
              fontSize: 12, fontWeight: 600,
              color: done ? C.green : C.mid,
            }}>
              {done ? '✓' : `Q${i + 1}`} — {q.skill} [{q.marks}m]
            </div>
          ) : null;
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: C.light, fontSize: 12 }}>
          Estimated time: {currentSession?.questions?.length === 5 ? '60–75' : '45–55'} minutes
        </div>
      </div>
    </div>
  );

  // ── 2. PROGRESS SUMMARY ───────────────────────────────
  const gapsFixed = Object.entries(
    records.reduce((acc, r) => {
      if (!acc[r.questionId]) acc[r.questionId] = [];
      acc[r.questionId].push(r);
      return acc;
    }, {})
  ).filter(([, attempts]) => {
    const first = attempts[0]?.parsed?.markBand;
    const last = attempts[attempts.length - 1]?.parsed?.markBand;
    return (BAND_NUM[last] || 1) > (BAND_NUM[first] || 1);
  }).length;

  const skillImprovement = {};
  SKILLS.forEach(s => { skillImprovement[s] = 0; });
  Object.entries(
    records.reduce((acc, r) => {
      if (!acc[r.questionId]) acc[r.questionId] = [];
      acc[r.questionId].push(r);
      return acc;
    }, {})
  ).forEach(([, attempts]) => {
    if (attempts.length < 2) return;
    const skill = attempts[0].skill;
    const delta = (BAND_NUM[attempts[attempts.length - 1]?.parsed?.markBand] || 1)
      - (BAND_NUM[attempts[0]?.parsed?.markBand] || 1);
    if (delta > 0 && skill) skillImprovement[skill] += delta;
  });
  const mostImproved = Object.entries(skillImprovement).sort((a, b) => b[1] - a[1])[0];

  const progressStats = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'Sessions completed', value: completedSessions.length, bg: C.coralL, color: C.green },
        { label: 'Reasoning gaps fixed', value: gapsFixed, bg: C.greenL, color: C.green },
        { label: 'Most improved skill', value: mostImproved?.[1] > 0 ? mostImproved[0] : 'Keep going', small: true, bg: C.blueL, color: C.blue },
      ].map(s => (
        <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: s.small ? 13 : 26, fontWeight: 800, color: s.color, fontFamily: s.small ? 'inherit' : "'Clash Display', sans-serif", marginBottom: 4, lineHeight: 1.2 }}>{s.value}</div>
          <div style={{ color: C.light, fontSize: 11, fontWeight: 600 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );

  // ── 3. CURRENT FOCUS AREAS ────────────────────────────
  const weaknessCounts = Object.entries(
    records.reduce((acc, r) => {
      (r.parsed?.failures || []).forEach(f => { acc[f] = (acc[f] || 0) + 1; });
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 2);

  const focusAreas = weaknessCounts.length > 0 ? (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 12 }}>Your current focus areas</div>
      {weaknessCounts.map(([name]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.coral, flexShrink: 0 }} />
          <span style={{ color: C.mid, fontSize: 14 }}>{name}</span>
        </div>
      ))}
      <div style={{ marginTop: 10, fontSize: 12, color: C.light, fontStyle: 'italic' }}>
        Your sessions are designed to target these areas.
      </div>
    </div>
  ) : null;

  // ── 4. WEEKLY COMPLETION SIGNAL ───────────────────────
  const last5Sessions = completedSessions.slice(-5);
  const weeklySignal = (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 12 }}>Weekly training</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: i < last5Sessions.length ? C.coral : C.border,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff',
          }}>
            {i < last5Sessions.length ? '✓' : ''}
          </div>
        ))}
        <span style={{ color: C.light, fontSize: 12, marginLeft: 4 }}>
          {completedSessions.length} session{completedSessions.length !== 1 ? 's' : ''} completed
        </span>
      </div>
      <div style={{ color: C.light, fontSize: 12 }}>Next session unlocks Monday</div>
    </div>
  );

  // ── 5. PROGRESS CHECK (after first check-in) ──────────
  const benchmarkSession = completedSessions.find(s => s.isBenchmark);
  const checkinSession = completedSessions.find(s => s.isCheckin);

  const progressCheck = benchmarkSession && checkinSession ? (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>Progress check</div>
      <div style={{ color: C.light, fontSize: 12, marginBottom: 14 }}>Week 1 benchmark vs Week 5 check-in</div>
      {SKILLS.map(skill => {
        const benchmarkRecords = records.filter(r =>
          r.skill === skill &&
          r.timestamp >= benchmarkSession.timestamp &&
          r.timestamp <= (completedSessions[1]?.timestamp || Date.now())
        );
        const checkinRecords = records.filter(r =>
          r.skill === skill && r.timestamp >= checkinSession.timestamp
        );
        if (!benchmarkRecords.length || !checkinRecords.length) return null;
        const benchBand = benchmarkRecords[benchmarkRecords.length - 1]?.parsed?.markBand;
        const checkinBand = checkinRecords[checkinRecords.length - 1]?.parsed?.markBand;
        const delta = (BAND_NUM[checkinBand] || 1) - (BAND_NUM[benchBand] || 1);
        return (
          <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: C.mid, width: 80, flexShrink: 0 }}>{skill}</span>
            <BandDot band={benchBand} />
            <span style={{ color: C.light, fontSize: 12 }}>→</span>
            <BandDot band={checkinBand} />
            <span style={{ fontSize: 14, color: delta > 0 ? C.green : delta < 0 ? C.red : C.amber }}>
              {delta > 0 ? '↑' : delta < 0 ? '↓' : '—'}
            </span>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div>
      <h2 style={{ fontFamily: "'Clash Display', sans-serif", fontSize: 26, color: C.text, marginBottom: 4 }}>Dashboard</h2>
      <p style={{ color: C.light, fontSize: 13, marginBottom: 24 }}>
        Week {completedSessions.length + 1} · {user?.name || 'Student'}
      </p>
      {sessionCard}
      {progressStats}
      {focusAreas}
      {weeklySignal}
      {progressCheck}
    </div>
  );
};

// ─── UPGRADE PROMPT ───────────────────────────────────────────────────────────
const UpgradePrompt = ({ reason, onSignup, onUpgrade, userTier }) => (
  <div style={{ background: "linear-gradient(135deg,#faf9f6,#eff6ff)", border: `2px solid ${C.borderM}`, borderRadius: 14, padding: "28px 24px", textAlign: "center" }}>
    <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
    <div style={{ fontWeight: 800, color: C.text, fontSize: 17, marginBottom: 8 }}>{reason}</div>
    {!userTier ? (<><div style={{ color: C.mid, fontSize: 14, marginBottom: 20 }}>Create a free account to unlock more questions and track your skills.</div><button onClick={onSignup} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, fontSize: 14 }}>Sign up free →</button></>)
      : (<><div style={{ color: C.mid, fontSize: 14, marginBottom: 20 }}>Upgrade to access this feature. 7-day free trial included.</div><button onClick={onUpgrade} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, fontSize: 14 }}>Start free trial →</button></>)}
  </div>
);

// ─── CUSTOM QUESTION ──────────────────────────────────────────────────────────
const CustomQuestion = ({ onAttempt, syllabus, user }) => {
  const syl = SYLLABUSES[syllabus] || SYLLABUSES["O-Elective"];
  const [qData, setQData] = useState({ question: "", marks: "4", skill: "Explain", cluster: syl.clusters[0] || "Tectonics", figureDesc: "" });
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | checking | analysing
  const [blocked, setBlocked] = useState(null);
  const [figureImage, setFigureImage] = useState(null); // { base64, mediaType, previewUrl }
  const fileInputRef = useRef(null);
  const latest = attempts[attempts.length - 1];
  const prevBand = attempts.length >= 2 ? attempts[attempts.length - 2].parsed?.markBand : null;
  const bandHistory = attempts.map(a => BAND_NUM[a.parsed?.markBand] || 1);
  const upd = (k, v) => setQData(p => ({ ...p, [k]: v }));
  const handleAnswerChange = (e) => { setAnswer(e.target.value); if (blocked) setBlocked(null); };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaType = file.type || "image/jpeg";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const base64 = dataUrl.split(",")[1];
      setFigureImage({ base64, mediaType, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!qData.question.trim() || !answer.trim() || phase !== "idle") return;
    const n = attempts.length + 1;
    setPhase("checking");
    const prevAnswer = attempts.length > 0 ? attempts[attempts.length - 1].answerText || null : null;
    const prevFeedback = attempts.length > 0 ? attempts[attempts.length - 1].feedback || null : null;
    const check = await classifySubmission(qData.question, parseInt(qData.marks), answer, prevAnswer, prevFeedback);
    if (check.verdict === "fail") {
      setBlocked(check.message);
      await logFlaggedAttempt(user?.id, `custom_${qData.question.slice(0, 30)}`, n, check.message);
      setPhase("idle");
      return;
    }
    setPhase("analysing");
    const userMsg = `Syllabus: ${syl.label} (${syl.code})\nQuestion [${qData.marks} marks] — ${qData.skill} — ${qData.cluster}:\n${qData.question}`
      + (qData.figureDesc ? `\n\nFigure: ${qData.figureDesc}` : "")
      + markingNote(qData.question, parseInt(qData.marks))
      + `\n\nStudent answer: ${answer}`;
    try {
      const qMarks = parseInt(qData.marks);
      const evalRaw = figureImage
        ? await callClaudeWithImage("eval", userMsg, figureImage.base64, figureImage.mediaType)
        : await callClaude("eval", userMsg);
      let evalResult;
      evalResult = extractJSON(evalRaw) || { marksAwarded: null, totalMarks: qMarks, markBand: 'L1', isComplete: false, completedPoints: [], gaps: [], primaryGap: null };
      const feedbackInput = `${userMsg}\n\nEVALUATION (fixed — do not recalculate):\n${JSON.stringify(evalResult, null, 2)}`;
      const rawFb = figureImage
        ? await callClaudeWithImage("feedback", feedbackInput, figureImage.base64, figureImage.mediaType)
        : await callClaude("feedback", feedbackInput);
      let fb = stripAudit(rawFb);
      const parsed = evalToParsed(evalResult, qMarks);
      fb = sealIfComplete(fb, parsed, qMarks);
      setAttempts(p => [...p, { feedback: fb, parsed, answerText: answer }]);
      onAttempt({ questionId: `custom_${Date.now()}`, cluster: qData.cluster, skill: qData.skill, marks: qMarks, syllabus, attemptNumber: n, parsed, timestamp: Date.now() });
    } catch (err) {
      setAttempts(p => [...p, { feedback: `Connection error — ${err.message}`, parsed: null, answerText: answer }]);
    }
    setPhase("idle");
  };

  const inp = { background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", color: C.text, fontSize: 14, width: "100%" };
  const markOpts = syl.level === "N" ? [1, 2, 3, 4, 6] : [1, 2, 3, 4, 6, 9];

  return (
    <div>
      <h2 style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 26, color: C.text, marginBottom: 6 }}>My Questions</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div style={{ background: `${syl.color}15`, color: syl.color, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>{syl.label}</div>
        <span style={{ color: C.light, fontSize: 13 }}>Feedback calibrated to your syllabus</span>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { label: "MARKS", key: "marks", opts: markOpts.map(m => ({ v: String(m), l: `[${m}m]` })) },
            { label: "SKILL", key: "skill", opts: SKILLS.map(s => ({ v: s, l: s })) },
            { label: "CLUSTER", key: "cluster", opts: syl.clusters.map(c => ({ v: c, l: c })) },
          ].map(({ label, key, opts }) => (
            <div key={key}>
              <label style={{ color: C.mid, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5 }}>{label}</label>
              <select value={qData[key]} onChange={e => upd(key, e.target.value)} style={inp}>
                {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: C.mid, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5 }}>QUESTION</label>
          <textarea value={qData.question} onChange={e => upd("question", e.target.value)} placeholder="Paste your question here…" rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: C.mid, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5 }}>FIGURE <span style={{ color: C.light, fontWeight: 400 }}>(optional)</span></label>
          {figureImage ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
              <img src={figureImage.previewUrl} alt="Figure" style={{ width: 100, height: 70, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.mid, marginBottom: 6 }}>Figure uploaded. Claude will read it directly.</div>
                <button onClick={() => { setFigureImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 12, color: C.light, cursor: "pointer" }}>Remove</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <textarea value={qData.figureDesc} onChange={e => upd("figureDesc", e.target.value)} placeholder="Describe the figure e.g. 'Bar chart showing tourist arrivals 2010–2020. Peak 2018 at 12 million…'" rows={2} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
              </div>
              <div style={{ flexShrink: 0, paddingTop: 2 }}>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 14px", fontSize: 13, color: C.mid, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                  📷 Upload photo
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: C.mid, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5 }}>YOUR ANSWER</label>
          {attempts.length > 0 && <div style={{ background: C.greenL, border: `1px solid ${C.green}40`, borderRadius: 8, padding: "6px 12px", marginBottom: 8, fontSize: 12, color: C.green, fontWeight: 600 }}>✏️ Rewrite based on feedback below and re-submit.</div>}
          <textarea value={answer} onChange={handleAnswerChange} placeholder="Write your answer here…" rows={6} style={{ ...inp, resize: "vertical", lineHeight: 1.6, borderColor: blocked ? C.red : undefined }} />
          {blocked && (
            <div style={{ background: C.redL, border: `1.5px solid ${C.red}`, borderRadius: 8, padding: "8px 12px", marginTop: 6, fontSize: 13, color: C.red, fontWeight: 500 }}>
              {blocked}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.light, fontSize: 12 }}>{answer.split(/\s+/).filter(Boolean).length} words</span>
            {attempts.length > 0 && <BandDot band={latest?.parsed?.markBand || "L1"} marksAwarded={latest?.parsed?.marksAwarded} totalMarks={latest?.parsed?.totalMarks} />}
            {bandHistory.length >= 2 && <Sparkline values={bandHistory} />}
          </div>
          <button onClick={submit} disabled={!qData.question.trim() || !answer.trim() || phase !== "idle"} className="hl"
            style={{ background: phase !== "idle" ? C.border : C.coral, color: phase !== "idle" ? C.light : "#fff", border: "none", borderRadius: 10, padding: "9px 22px", fontWeight: 700, fontSize: 14 }}>
            {phase === "checking" ? "Checking…" : phase === "analysing" ? "Analysing…" : attempts.length > 0 ? "Re-submit →" : "Get Feedback →"}
          </button>
        </div>
        <FeedbackPanel feedback={latest?.feedback} attemptNum={attempts.length} parsed={latest?.parsed} prevBand={prevBand}
          flagData={latest ? { questionId: null, questionText: qData.question, answer: latest.answerText, syllabus } : null} />
      </div>
    </div>
  );
};

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const Onboarding = ({ initialData, initialStep, onComplete, onClose, tier }) => {
  const blank = { name: "", email: "", password: "", year: null, syllabus: null, school: "", topicsCovered: [], examType: null };
  const [step, setStep] = useState(initialStep || 1);
  const [data, setData] = useState({ ...blank, ...initialData });
  const [errors, setErrors] = useState({});
  const [showChecklist, setShowChecklist] = useState(false);
  const [tcAccepted, setTcAccepted] = useState(false);
  const [screen1Loading, setScreen1Loading] = useState(false);
  const [screen1Error, setScreen1Error] = useState(null);
  const [selectedTier, setSelectedTier] = useState("free");
  const [showPromoCode, setShowPromoCode] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const update = (patch) => setData(prev => ({ ...prev, ...patch }));

  const goNext = useCallback(async (patch = {}) => {
    const d = { ...data, ...patch };
    setData(d);
    const next = step + 1;
    setStep(next);
    await ss("gm4_onboarding_draft", { data: d, step: next });
  }, [data, step]);

  const validateStep1 = () => {
    const errs = {};
    if (!data.name.trim()) errs.name = "Name is required";
    if (!data.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = "Valid email required";
    if (!data.password || data.password.length < 8) errs.password = "Password must be at least 8 characters";
    if (!tcAccepted) errs.terms = "You must agree to the Privacy Policy and Terms of Use";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleScreen1Submit = async () => {
    if (!validateStep1()) return;
    setScreen1Loading(true);
    setScreen1Error(null);
    // Skip signUp if already authenticated (e.g. resuming onboarding after session restore)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Check beta slot limit
      const { count, error: countErr } = await supabase.from("beta_signups").select("*", { count: "exact", head: true });
      if (countErr) { setScreen1Error("Could not verify signup availability. Please try again."); setScreen1Loading(false); return; }
      if (count >= 8) { setScreen1Error("Beta is currently full. Follow us for updates on when we open more spots."); setScreen1Loading(false); return; }

      const { error } = await supabase.auth.signUp({ email: data.email, password: data.password });
      if (error) { setScreen1Error(error.message); setScreen1Loading(false); return; }

      // Record the signup slot
      await supabase.from("beta_signups").insert({});
    }
    if (selectedTier === "free" || BETA_MODE) {
      goNext({ password: "", tier: "free" });
    } else {
      setShowPromoCode(true);
    }
    setScreen1Loading(false);
  };

  const handlePromoSubmit = async () => {
    if (!promoCode.trim()) { setPromoError("Please enter an invite code."); return; }
    setPromoLoading(true);
    setPromoError(null);
    // TODO: validate against Supabase invite_codes table when live
    const code = promoCode.trim().toUpperCase();
    const codeValid = code === "UNPACK2026";
    const codeExpired = new Date() > new Date("2026-04-30T23:59:59+08:00");
    await new Promise(r => setTimeout(r, 600)); // simulate check
    if (!codeValid || codeExpired) {
      setPromoError(codeExpired ? "This invite code has expired." : "Invalid invite code. Check with the Unpack team.");
      setPromoLoading(false);
      return;
    }
    goNext({ password: "", tier: selectedTier });
    setPromoLoading(false);
  };

  const inp = { width: "100%", background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "13px 15px", color: C.text, fontSize: 15, marginBottom: 6, display: "block" };
  const errTxt = { color: C.red, fontSize: 12, marginBottom: 10, display: "block" };

  const sylClusters = data.syllabus ? (SYLLABUSES[data.syllabus]?.clusters || []) : Object.keys(ONBOARDING_TOPICS);
  const visibleClusters = Object.entries(ONBOARDING_TOPICS).filter(([c]) => sylClusters.includes(c));

  const toggleTopic = (id) => {
    const cur = Array.isArray(data.topicsCovered) ? data.topicsCovered : [];
    update({ topicsCovered: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
  };
  const toggleCluster = (topics) => {
    const cur = Array.isArray(data.topicsCovered) ? data.topicsCovered : [];
    const ids = topics.map(t => t.id);
    const allOn = ids.every(id => cur.includes(id));
    update({ topicsCovered: allOn ? cur.filter(id => !ids.includes(id)) : [...new Set([...cur, ...ids])] });
  };

  // Progress bar segments (shown on steps 2–4)
  const ProgressBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
      <div style={{ display: "flex", gap: 5 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: 28, height: 4, borderRadius: 2, background: i <= step ? C.coral : C.coralL }} />
        ))}
      </div>
      <span style={{ color: C.light, fontSize: 12, fontWeight: 600 }}>Step {step} of 4</span>
    </div>
  );

  // ── Screen 1: Account ──────────────────────────────────────────────────────
  const Screen1 = () => (
    <div className="fade">
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 8 }}>Create your account</div>
        <div style={{ color: C.mid, fontSize: 15 }}>Start practising Geography in minutes.</div>
      </div>
      <input value={data.name} placeholder="Your name" style={{ ...inp, borderColor: errors.name ? C.red : C.border }}
        onChange={e => { update({ name: e.target.value }); setErrors(p => ({ ...p, name: null })); }} />
      {errors.name && <span style={errTxt}>{errors.name}</span>}
      <input value={data.email} type="email" placeholder="Email address" style={{ ...inp, borderColor: errors.email ? C.red : C.border }}
        onChange={e => { update({ email: e.target.value }); setErrors(p => ({ ...p, email: null })); }} />
      {errors.email && <span style={errTxt}>{errors.email}</span>}
      <input value={data.password} type="password" placeholder="Password (min. 8 characters)" style={{ ...inp, borderColor: errors.password ? C.red : C.border }}
        onChange={e => { update({ password: e.target.value }); setErrors(p => ({ ...p, password: null })); }} />
      {errors.password && <span style={errTxt}>{errors.password}</span>}

      {/* ── Tier selector ── */}
      <div style={{ marginTop: 20, marginBottom: 4 }}>
        <div style={{ color: C.mid, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Choose your plan</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "free", label: "Free", price: "$0", features: ["3 curated questions", "Full feedback", "Unlimited resubmissions"], trial: null },
            { id: "basic", label: "Basic", price: "$12.90/mo", features: ["Weekly sessions", "Progress dashboard", "7-day free trial"], trial: "7-day free trial — no card needed yet", tag: "Most popular" },
            { id: "plus", label: "Plus", price: "$15.90/mo", features: ["Everything in Basic", "+ Custom question diagnostics", "7-day free trial"], trial: "7-day free trial — no card needed yet", tag: "For serious prep" },
          ].filter(t => !BETA_MODE || t.id !== "plus").map(t => (
            <div key={t.id} onClick={() => setSelectedTier(t.id)}
              style={{ flex: 1, border: `2px solid ${selectedTier === t.id ? C.coral : C.border}`, borderRadius: 12, padding: "12px 10px", cursor: "pointer", background: selectedTier === t.id ? C.coralL : "#fff", position: "relative", transition: "border-color 0.15s, background 0.15s" }}>
              {t.tag && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: C.coral, color: C.deepBg, fontSize: 9, fontWeight: 700, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{t.tag}</div>}
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 2 }}>{t.label}</div>
              {!BETA_MODE && <div style={{ fontWeight: 700, fontSize: 12, color: C.coral, marginBottom: 8 }}>{t.price}</div>}
              {t.features.map(f => <div key={f} style={{ fontSize: 11, color: C.mid, lineHeight: 1.6 }}>{f}</div>)}
            </div>
          ))}
        </div>
        {(selectedTier === "basic" || selectedTier === "plus") && (
          <div style={{ fontSize: 11, color: C.mid, marginTop: 8, textAlign: "center", fontStyle: "italic" }}>
            During beta — enter an invite code after signup to unlock
          </div>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 18, marginBottom: 4, cursor: "pointer" }}>
        <input type="checkbox" checked={tcAccepted} onChange={e => { setTcAccepted(e.target.checked); setErrors(p => ({ ...p, terms: null })); }}
          style={{ marginTop: 3, accentColor: C.coral, flexShrink: 0, width: 16, height: 16 }} />
        <span style={{ color: C.mid, fontSize: 13, lineHeight: 1.5 }}>
          I agree to the{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.green, textDecoration: "underline" }}>Privacy Policy</a>
          {" "}and{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.green, textDecoration: "underline" }}>Terms of Use</a>
        </span>
      </label>
      {errors.terms && <span style={errTxt}>{errors.terms}</span>}
      {screen1Error && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{screen1Error}</div>}
      <button onClick={handleScreen1Submit} disabled={screen1Loading} className="hl"
        style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, marginTop: 12, opacity: screen1Loading ? 0.7 : 1 }}>
        {screen1Loading ? "Creating account…" : "Create account →"}
      </button>
    </div>
  );

  // ── Screen 2: Profile ──────────────────────────────────────────────────────
  const yearOpts = [
    { id: "sec3", label: "Secondary 3" },
    { id: "sec4", label: "Secondary 4" },
    { id: "sec5", label: "Secondary 5" },
  ];
  const sylOpts = [
    { id: "O-Elective", label: "O-Level Elective", sub: "Humanities 2260" },
    { id: "O-Pure", label: "O-Level Pure", sub: "Syllabus 2279" },
    { id: "N-Elective", label: "N-Level Elective", sub: "Humanities 2125" },
    { id: "N-Pure", label: "N-Level Pure", sub: "Syllabus 2246" },
  ];
  const availableSyllabuses = data.year === "sec5"
    ? sylOpts.filter(s => s.id === "O-Elective" || s.id === "O-Pure")
    : sylOpts;

  const handleYearChange = (yearId) => {
    if (yearId === "sec5" && ["N-Elective", "N-Pure"].includes(data.syllabus)) {
      setData(prev => ({ ...prev, year: yearId, syllabus: null }));
    } else {
      setData(prev => ({ ...prev, year: yearId }));
    }
  };

  const handleSyllabusChange = (sylId) => {
    const isOLvl = ["O-Elective", "O-Pure"].includes(sylId);
    const isNLvl = ["N-Elective", "N-Pure"].includes(sylId);
    const conflictingExam =
      (isOLvl && data.examType === "nlevels") ||
      (isNLvl && data.examType === "olevels");
    setData(prev => ({
      ...prev, syllabus: sylId, topicsCovered: [],
      ...(conflictingExam ? { examType: null } : {}),
    }));
  };
  const BigBtn = ({ selected, onClick, children }) => (
    <button onClick={onClick} style={{
      textAlign: "left", width: "100%", padding: "13px 16px", borderRadius: 12,
      border: `1.5px solid ${selected ? C.coral : C.border}`,
      background: selected ? C.coralL : "#fff",
      color: selected ? C.coral : C.text,
      fontWeight: selected ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 8,
    }}>{children}</button>
  );

  const Screen2 = () => (
    <div className="fade">
      <button onClick={() => setStep(p => p - 1)} style={{ background: "none", border: "none", color: C.mid, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "8px 0", marginBottom: 16 }}>← Back</button>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 8 }}>Your profile</div>
        <div style={{ color: C.mid, fontSize: 14 }}>Tell us about your Geography course.</div>
      </div>
      <div style={{ color: C.mid, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>YEAR</div>
      {yearOpts.map(y => <BigBtn key={y.id} selected={data.year === y.id} onClick={() => handleYearChange(y.id)}>{y.label}</BigBtn>)}
      <div style={{ color: C.mid, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", margin: "16px 0 10px" }}>GEOGRAPHY TYPE</div>
      {availableSyllabuses.map(s => (
        <BigBtn key={s.id} selected={data.syllabus === s.id} onClick={() => handleSyllabusChange(s.id)}>
          <div>{s.label}</div>
          <div style={{ fontSize: 11, color: data.syllabus === s.id ? C.coral : C.light, fontWeight: 400, marginTop: 2 }}>{s.sub}</div>
        </BigBtn>
      ))}
      {data.year === "sec5" && (
        <div style={{ color: C.light, fontSize: 12, marginTop: 4, marginBottom: 8 }}>Secondary 5 students sit O-Level examinations.</div>
      )}
      <div style={{ color: C.mid, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", margin: "16px 0 8px" }}>
        SCHOOL <span style={{ color: C.light, fontWeight: 400, fontSize: 10 }}>(OPTIONAL)</span>
      </div>
      <input value={data.school} placeholder="Your school (optional)" style={{ ...inp, marginBottom: 4 }}
        onChange={e => update({ school: e.target.value })} />
      <div style={{ textAlign: "right", marginBottom: 20 }}>
        <span style={{ color: C.light, fontSize: 12, cursor: "pointer" }} onClick={() => goNext({ school: "" })}>Skip →</span>
      </div>
      <button onClick={() => goNext({ year: data.year || ONBOARDING_DEFAULTS.year, syllabus: data.syllabus || ONBOARDING_DEFAULTS.syllabus })}
        className="hl" style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15 }}>
        Next →
      </button>
    </div>
  );

  // ── Screen 3: Topics ───────────────────────────────────────────────────────
  const isSec3 = data.year === "sec3";
  const Screen3 = () => (
    <div className="fade">
      <button onClick={() => setStep(p => p - 1)} style={{ background: "none", border: "none", color: C.mid, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "8px 0", marginBottom: 16 }}>← Back</button>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 8 }}>Topics covered</div>
        <div style={{ color: C.mid, fontSize: 14 }}>We'll focus your practice on what you've learned.</div>
      </div>

      {(selectedTier === "free" || (!selectedTier && (!tier || tier === "free-account"))) && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #f59e0b", borderRadius: 10, padding: "11px 14px", marginBottom: 20, fontSize: 13, color: "#92400e", lineHeight: 1.55 }}>
          You're on the Free plan — your first 3 questions are from the Climate cluster to get you started. Your topic selections will apply when you upgrade to Basic or Plus.
        </div>
      )}

      {(!isSec3 && !showChecklist) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
          <div style={{ color: C.mid, fontSize: 13, marginBottom: 4 }}>Have you covered the full Geography syllabus?</div>
          {[
            { id: "all_yes", icon: "✓", label: "Yes — I've covered the full syllabus" },
            { id: "choose", icon: "☐", label: "No — let me choose my topics" },
            { id: "all_unsure", icon: "?", label: "Not sure — show me everything" },
          ].map(c => (
            <button key={c.id} onClick={() => {
              if (c.id === "choose") {
                setShowChecklist(true);
                // Only reset if coming from "all" mode — preserve prior individual selections
                if (!Array.isArray(data.topicsCovered)) update({ topicsCovered: [] });
              } else {
                goNext({ topicsCovered: "all" });
              }
            }} style={{
              textAlign: "left", padding: "13px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`,
              background: "#fff", color: C.text, fontWeight: 500, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ color: C.green, fontWeight: 700, width: 16, textAlign: "center" }}>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            {visibleClusters.map(([cluster, topics]) => {
              const cc = CLUSTER_COLOR[cluster] || {};
              const cur = Array.isArray(data.topicsCovered) ? data.topicsCovered : [];
              const allOn = topics.every(t => cur.includes(t.id));
              return (
                <div key={cluster} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cc.dot || C.coral }} />
                      <span style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{cluster}</span>
                    </div>
                    <button onClick={() => toggleCluster(topics)}
                      style={{ background: "none", border: "none", color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {allOn ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  {topics.map(t => {
                    const checked = cur.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => toggleTopic(t.id)} style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                        padding: "11px 14px", marginBottom: 6, borderRadius: 10,
                        border: `1.5px solid ${checked ? C.coral : C.border}`,
                        background: checked ? C.coralL : "#fff",
                        color: checked ? C.coral : C.text, fontWeight: checked ? 600 : 400, fontSize: 13, cursor: "pointer",
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? C.coral : C.borderM}`,
                          background: checked ? C.coral : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <button onClick={() => {
            const cur = Array.isArray(data.topicsCovered) ? data.topicsCovered : [];
            goNext({ topicsCovered: cur.length === 0 ? "all" : cur });
          }} className="hl" style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15 }}>
            Next →
          </button>
        </>
      )}
    </div>
  );

  // ── Screen 4: Exam ─────────────────────────────────────────────────────────
  const isOLevel = ["O-Elective", "O-Pure"].includes(data.syllabus);
  const isNLevel = ["N-Elective", "N-Pure"].includes(data.syllabus);
  const examOpts = [
    { id: "midyear", label: "Mid-year exam", sub: "May / June" },
    { id: "prelim", label: "Preliminary exam", sub: "Aug / Sept" },
    ...(isOLevel ? [{ id: "olevels", label: "O-Level", sub: "Oct / Nov" }] : []),
    ...(isNLevel ? [{ id: "nlevels", label: "N-Level", sub: "Oct / Nov" }] : []),
    { id: "notsure", label: "Not sure yet", sub: null },
  ];
  const Screen4 = () => (
    <div className="fade">
      <button onClick={() => setStep(p => p - 1)} style={{ background: "none", border: "none", color: C.mid, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "8px 0", marginBottom: 16 }}>← Back</button>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 8 }}>Upcoming exam</div>
        <div style={{ color: C.mid, fontSize: 14 }}>What are you preparing for?</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {examOpts.map(e => (
          <BigBtn key={e.id} selected={data.examType === e.id} onClick={() => update({ examType: e.id })}>
            <div>{e.label}</div>
            {e.sub && <div style={{ fontSize: 11, color: data.examType === e.id ? C.coral : C.light, fontWeight: 400, marginTop: 2 }}>{e.sub}</div>}
          </BigBtn>
        ))}
      </div>
      <div style={{ color: C.light, fontSize: 12, textAlign: "center", marginBottom: 22, fontStyle: "italic" }}>
        We'll increase your weekly practice as your exam gets closer.
      </div>
      <button onClick={() => goNext({ examType: data.examType || ONBOARDING_DEFAULTS.examType })}
        className="hl" style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15 }}>
        Next →
      </button>
    </div>
  );

  // ── Screen 5: Welcome ──────────────────────────────────────────────────────
  const firstName = data.name ? data.name.split(" ")[0] : "";
  const Screen5 = () => (
    <div className="fade">
      <button onClick={() => setStep(p => p - 1)} style={{ background: "none", border: "none", color: C.mid, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "8px 0", marginBottom: 16 }}>← Back</button>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 52, height: 52, background: C.greenL, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <span style={{ color: C.green, fontSize: 24, fontWeight: 700 }}>✓</span>
        </div>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          Your training programme is ready.
        </div>
        <div style={{ color: C.mid, fontSize: 14, marginBottom: 36 }}>
          {firstName ? `Welcome, ${firstName}. Let's get started.` : "Let's get started."}
        </div>

        <div style={{ background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "22px 24px", marginBottom: 14, textAlign: "left", boxShadow: "0 2px 12px rgba(255,107,53,0.07)" }}>
          <div style={{ color: C.light, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>WEEK 1 — STARTING POINT</div>
          <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 700, color: C.text, fontSize: 17, marginBottom: 6 }}>Benchmark Session</div>
          <div style={{ color: C.mid, fontSize: 13, marginBottom: 14 }}>
            Theme: Foundations<br />
            Q1 — Describe · Q2 — Explain · Q3 — Evaluate
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: C.light, fontSize: 12 }}>Estimated time: 45–55 minutes</span>
          </div>
          <div style={{ padding: "10px 12px", background: C.coralL, borderRadius: 8 }}>
            <div style={{ color: C.green, fontSize: 12, fontWeight: 600 }}>This session helps us understand where you're starting from.</div>
          </div>
        </div>

        <button onClick={() => onComplete({ ...data, tier: selectedTier, isBenchmark: true })} className="hl"
          style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
          Start my first session →
        </button>
        <button onClick={() => onComplete({ ...data, tier: selectedTier, isBenchmark: false })}
          style={{ width: "100%", background: "none", color: C.mid, border: "none", borderRadius: 12, padding: 12, fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
          I'll come back later
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, overflow: "auto", zIndex: 500 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: C.coral, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: C.deepBg, fontWeight: 900, fontSize: 14, fontFamily: "'Clash Display',sans-serif" }}>U</div>
            <span style={{ fontWeight: 700, color: C.text, fontSize: 18, fontFamily: "'Fraunces', serif" }}>Unpack</span>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.light, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              ← Back
            </button>
          )}
        </div>
        {step >= 2 && step <= 4 && ProgressBar()}
        {step === 1 && !showPromoCode && Screen1()}
        {step === 1 && showPromoCode && (
          <div className="fade">
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 8 }}>Enter your invite code</div>
              <div style={{ color: C.mid, fontSize: 14 }}>Your account is created. Enter a beta invite code to unlock {selectedTier === "plus" ? "Plus" : "Basic"}.</div>
            </div>
            <input value={promoCode} onChange={e => { setPromoCode(e.target.value); setPromoError(null); }}
              placeholder="Invite code (e.g. UNPACK2025)"
              style={{ width: "100%", background: "#fff", border: `1.5px solid ${promoError ? C.red : C.border}`, borderRadius: 12, padding: "13px 15px", color: C.text, fontSize: 15, marginBottom: 6, display: "block" }} />
            {promoError && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{promoError}</div>}
            <button onClick={handlePromoSubmit} disabled={promoLoading} className="hl"
              style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, marginTop: 8, opacity: promoLoading ? 0.7 : 1 }}>
              {promoLoading ? "Checking…" : "Unlock access →"}
            </button>
            <button onClick={() => { goNext({ password: "", tier: "free" }); setShowPromoCode(false); }}
              style={{ width: "100%", background: "none", border: "none", color: C.light, fontSize: 13, marginTop: 10, cursor: "pointer", padding: "8px 0" }}>
              Skip — continue as Free
            </button>
          </div>
        )}
        {step === 2 && Screen2()}
        {step === 3 && Screen3()}
        {step === 4 && Screen4()}
        {step === 5 && Screen5()}
      </div>
    </div>
  );
};

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
const AuthModal = ({ initMode, onClose, onSignup }) => {
  const [mode, setMode] = useState(initMode);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inp = { width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: C.text, fontSize: 14, marginBottom: 10 };

  const handleSubmit = async () => {
    setError(null);
    if (!email || !pw) { setError("Email and password are required."); return; }
    if (mode === "signup" && !ageConfirmed) { setError("Please confirm you are 13 or older."); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: e } = await supabase.auth.signUp({ email, password: pw });
        if (e) { setError(e.message); return; }
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (e) { setError(e.message); return; }
      }
      onClose(); // onAuthStateChange fires and drives the rest
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,46,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 34, width: 420, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(255,107,53,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ fontFamily: "'Clash Display',sans-serif", color: C.text, fontSize: 21 }}>{mode === "signup" ? "Create account" : "Sign in"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.light, fontSize: 20 }}>✕</button>
        </div>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" style={inp} />
        <input value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" type="password" style={{ ...inp, marginBottom: mode === "signup" ? 10 : 18 }} />
        {mode === "signup" && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)}
              style={{ marginTop: 3, accentColor: C.coral, flexShrink: 0 }} />
            <span style={{ color: C.mid, fontSize: 13, lineHeight: 1.5 }}>
              I am 13 or older and agree to the{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.green }}>Privacy Policy</a>
              {" "}and{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.green }}>Terms of Use</a>
            </span>
          </label>
        )}
        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading} className="hl"
          style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 15, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Please wait…" : mode === "signup" ? "Create free account" : "Sign in"}
        </button>
        <div style={{ textAlign: "center", marginTop: 14, color: C.light, fontSize: 13 }}>
          {mode === "signup" ? "Have an account? " : "New here? "}
          <span style={{ color: C.green, cursor: "pointer", fontWeight: 600 }}
            onClick={() => {
              if (mode === "signin" && onSignup) { onClose(); onSignup(); }
              else { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }
            }}>
            {mode === "signup" ? "Sign in" : "Sign up free"}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── ACCOUNT SETTINGS MODAL ───────────────────────────────────────────────────
const AccountSettings = ({ user, onUpdate, onSyllabusChange, onClose }) => {
  const [examDate, setExamDate] = useState(user.examDate || "");
  const [error, setError] = useState(null);
  const [syllabusEditMode, setSyllabusEditMode] = useState(false);
  const [pendingSyllabus, setPendingSyllabus] = useState(null);
  const today = new Date();
  const minD = new Date(today); minD.setDate(today.getDate() + 21);
  const minDateStr = minD.toISOString().split("T")[0];

  const sylOpts = [
    { id: "O-Elective", label: "O-Level Elective Geography (2260)" },
    { id: "O-Pure", label: "O-Level Pure Geography (2279)" },
    { id: "N-Elective", label: "N-Level Elective Geography (2125)" },
    { id: "N-Pure", label: "N-Level Pure Geography (2246)" },
  ];

  const handleSave = () => {
    if (examDate) {
      const v = validateExamDate(examDate, user);
      if (!v.valid) { setError(v.message); return; }
    }
    const updated = {
      ...user,
      previousExamDate: examDate && user.examDate && examDate !== user.examDate ? user.examDate : user.previousExamDate,
      examDate: examDate || null
    };
    onUpdate(updated);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,46,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 420, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(255,107,53,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Clash Display',sans-serif", color: C.text, fontSize: 18 }}>Account Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.light, fontSize: 20 }}>✕</button>
        </div>

        {/* Syllabus field */}
        {!syllabusEditMode ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
            <div>
              <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>Geography syllabus</div>
              <div style={{ color: C.mid, fontSize: 13, marginTop: 2 }}>{SYLLABUS_LABELS[user.syllabus] || user.syllabus}</div>
            </div>
            <button onClick={() => { setSyllabusEditMode(true); setPendingSyllabus(user.syllabus); }}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 13, color: C.mid, cursor: "pointer", fontWeight: 600 }}>
              Change
            </button>
          </div>
        ) : (
          <div style={{ padding: "4px 0 16px" }}>
            <div style={{ fontWeight: 600, color: C.text, fontSize: 14, marginBottom: 12 }}>Change syllabus</div>
            {sylOpts.map(s => (
              <div key={s.id} onClick={() => setPendingSyllabus(s.id)} style={{
                padding: "12px 16px", borderRadius: 10, marginBottom: 8,
                border: `2px solid ${pendingSyllabus === s.id ? C.coral : C.border}`,
                background: pendingSyllabus === s.id ? C.coralL : C.card,
                cursor: "pointer", fontSize: 14, fontWeight: 600,
                color: pendingSyllabus === s.id ? C.coral : C.text,
              }}>
                {s.label}
              </div>
            ))}
            {pendingSyllabus && pendingSyllabus !== user.syllabus && (
              <div style={{ background: C.amberL, border: `1px solid ${C.amber}`, borderRadius: 10, padding: "12px 14px", marginTop: 8, fontSize: 13, color: C.amber, marginBottom: 12 }}>
                Changing your syllabus will reset your current weekly session. Your attempt history will be kept.
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={() => { setSyllabusEditMode(false); setPendingSyllabus(null); }}
                style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 13, color: C.mid, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingSyllabus && pendingSyllabus !== user.syllabus) {
                    onSyllabusChange(pendingSyllabus);
                    setSyllabusEditMode(false);
                    setPendingSyllabus(null);
                  }
                }}
                disabled={!pendingSyllabus || pendingSyllabus === user.syllabus}
                style={{ flex: 1, background: C.coral, border: "none", borderRadius: 10, padding: 10, fontSize: 13, color: C.deepBg, cursor: "pointer", fontWeight: 700, opacity: (!pendingSyllabus || pendingSyllabus === user.syllabus) ? 0.4 : 1 }}>
                Confirm change
              </button>
            </div>
          </div>
        )}

        <label style={{ color: C.mid, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 5 }}>WHEN IS YOUR NEXT GEOGRAPHY EXAM?</label>
        <input type="date" value={examDate} min={minDateStr}
          onChange={e => { setExamDate(e.target.value); setError(null); }}
          style={{ width: "100%", background: C.bg, border: `1.5px solid ${error ? C.red : C.border}`, borderRadius: 10, padding: "10px 13px", color: C.text, fontSize: 14, marginBottom: 4 }} />
        <div style={{ color: C.light, fontSize: 12, marginBottom: error ? 4 : 16 }}>We'll increase your weekly practice as your exam gets closer.</div>
        {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.mid, borderRadius: 10, padding: 10, fontWeight: 600, fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} className="hl" style={{ flex: 2, background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: 10, fontWeight: 700, fontSize: 13 }}>Save</button>
        </div>
      </div>
    </div>
  );
};

// ─── THIS WEEK TAB ─────────────────────────────────────────────────────────────
// ─── TOPIC UPDATE MODAL ───────────────────────────────────────────────────────
const TopicUpdateModal = ({ user, syllabus, onSave, onClose }) => {
  const sylClusters = SYLLABUSES[syllabus]?.clusters || Object.keys(ONBOARDING_TOPICS);
  const visibleClusters = Object.entries(ONBOARDING_TOPICS).filter(([c]) => sylClusters.includes(c));
  const [selected, setSelected] = useState(() => {
    const cur = user?.topicsCovered;
    if (!cur || cur === "all") return visibleClusters.flatMap(([, ts]) => ts.map(t => t.id));
    return Array.isArray(cur) ? cur : [];
  });

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleCluster = (topics) => {
    const ids = topics.map(t => t.id);
    const allOn = ids.every(id => selected.includes(id));
    setSelected(s => allOn ? s.filter(id => !ids.includes(id)) : [...new Set([...s, ...ids])]);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,46,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 600 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 520, maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 700, fontSize: 18, color: C.text }}>Update my topics</div>
            <div style={{ color: C.light, fontSize: 13, marginTop: 2 }}>Tick topics you've covered in class.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.light, fontSize: 20 }}>✕</button>
        </div>
        {visibleClusters.map(([cluster, topics]) => {
          const cc = CLUSTER_COLOR[cluster] || {};
          const allOn = topics.every(t => selected.includes(t.id));
          return (
            <div key={cluster} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: cc.dot || C.coral }} />
                  <span style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{cluster}</span>
                </div>
                <button onClick={() => toggleCluster(topics)} style={{ background: "none", border: "none", color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {allOn ? "Deselect all" : "Select all"}
                </button>
              </div>
              {topics.map(t => {
                const checked = selected.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggle(t.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                    padding: "10px 13px", marginBottom: 6, borderRadius: 10,
                    border: `1.5px solid ${checked ? C.coral : C.border}`,
                    background: checked ? C.coralL : "#fff",
                    color: checked ? C.coral : C.text, fontWeight: checked ? 600 : 400, fontSize: 13, cursor: "pointer",
                  }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? C.coral : C.borderM}`, background: checked ? C.coral : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </div>
                    {t.label}
                  </button>
                );
              })}
            </div>
          );
        })}
        <button onClick={() => onSave(selected.length === 0 ? "all" : selected)} className="hl"
          style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 15, marginTop: 4 }}>
          Save topics →
        </button>
      </div>
    </div>
  );
};

// ─── SESSION COMPLETE PROMPT ──────────────────────────────────────────────────
const SessionCompletePrompt = ({ completedCount, gapsFixed, onUpdateTopics, onDismiss }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,46,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
    <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", width: 380, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(255,107,53,0.18)" }} className="fade">
      <div style={{ width: 44, height: 44, background: C.greenL, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <span style={{ color: C.green, fontSize: 20, fontWeight: 700 }}>✓</span>
      </div>
      <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 700, fontSize: 20, color: C.text, marginBottom: 16 }}>
        Session complete — well done.
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, background: C.coralL, borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.green }}>{completedCount}</div>
          <div style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>Sessions completed</div>
        </div>
        <div style={{ flex: 1, background: C.greenL, borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.green }}>{gapsFixed}</div>
          <div style={{ color: C.mid, fontSize: 12, marginTop: 2 }}>Reasoning gaps identified</div>
        </div>
      </div>
      <div style={{ fontWeight: 600, color: C.text, fontSize: 14, marginBottom: 18 }}>
        Have you started any new topics since last week?
      </div>
      <button onClick={onUpdateTopics} className="hl" style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
        Update my topics →
      </button>
      <button onClick={onDismiss} style={{ width: "100%", background: "none", border: "none", color: C.light, padding: 10, fontWeight: 500, fontSize: 13, cursor: "pointer" }}>
        Not yet — go to dashboard
      </button>
    </div>
  </div>
);

// ─── QUESTION SCREEN ──────────────────────────────────────────────────────────
const QuestionScreen = ({ q, qIdx, total, sessionQs, sessionCompleted, onAttempt, onMoveOn, canSubmit, onUpgrade, syllabus, user }) => {
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [blocked, setBlocked] = useState(null);
  const [showMoveOnConfirm, setShowMoveOnConfirm] = useState(false);

  const latest = attempts[attempts.length - 1];
  const prevBand = attempts.length >= 2 ? attempts[attempts.length - 2].parsed?.markBand : null;
  const isComplete = latest?.parsed?.isComplete || false;
  const busy = phase !== "idle";
  const isLast = qIdx === total - 1;

  // Reset state when question changes
  useEffect(() => {
    setAnswer("");
    setAttempts([]);
    setPhase("idle");
    setBlocked(null);
    setShowMoveOnConfirm(false);
  }, [q.id]);

  // Pre-fill textarea with last submission
  useEffect(() => {
    if (attempts.length > 0) setAnswer(attempts[attempts.length - 1].answerText || "");
  }, [attempts.length]);

  const submit = async () => {
    if (!answer.trim() || busy) return;
    if (!canSubmit) { onUpgrade(); return; }
    const n = attempts.length + 1;
    setPhase("checking");
    const prevAnswer = attempts.length > 0 ? attempts[attempts.length - 1].answerText || null : null;
    const prevFeedback = attempts.length > 0 ? attempts[attempts.length - 1].feedback || null : null;
    const check = await classifySubmission(q.question, q.marks, answer, prevAnswer, prevFeedback);
    if (check.verdict === "fail") {
      setBlocked(check.message);
      await logFlaggedAttempt(user?.id, q.id, n, check.message);
      setPhase("idle");
      return;
    }
    setPhase("analysing");
    const syl = SYLLABUSES[syllabus] || SYLLABUSES["O-Elective"];
    const userMsg = `Syllabus: ${syl.label} (${syl.code})\nQuestion [${q.marks} marks] — ${q.skill} — ${q.cluster}:\n${q.question}`
      + (q.context ? `\n\nContext: ${q.context}` : "")
      + (q.figure ? `\n\nFigure: ${q.figure.caption}` : "")
      + markingNote(q.question, q.marks)
      + `\n\nStudent answer: ${answer}`;
    try {
      let evalRaw = await callClaude("eval", userMsg);
      let evalResult;
      evalResult = extractJSON(evalRaw);
      if (!evalResult) {
        evalRaw = await callClaude("eval", userMsg);
        evalResult = extractJSON(evalRaw);
      }
      if (!evalResult || (!evalResult.isComplete && !evalResult.primaryGap && !(evalResult.gaps?.length))) {
        setAttempts(p => [...p, { feedback: "Something went wrong on our end — please resubmit your answer.", parsed: null, answerText: answer }]);
        setPhase("idle");
        return;
      }
      const feedbackInput = `${userMsg}\n\nEVALUATION (fixed — do not recalculate):\n${JSON.stringify(evalResult, null, 2)}`;
      let fb = stripAudit(await callClaude("feedback", feedbackInput));
      const parsed = evalToParsed(evalResult, q.marks);
      fb = sealIfComplete(fb, parsed, q.marks);
      setAttempts(p => [...p, { feedback: fb, parsed, answerText: answer }]);
      onAttempt({ questionId: q.id, cluster: q.cluster, skill: q.skill, marks: q.marks, syllabus, attemptNumber: n, parsed, timestamp: Date.now() });
    } catch (err) {
      setAttempts(p => [...p, { feedback: `Connection error — ${err.message}`, parsed: null, answerText: answer }]);
    }
    setPhase("idle");
  };

  const handleMoveOnClick = () => {
    if (attempts.length === 0) { setShowMoveOnConfirm(true); return; }
    onMoveOn({ didAttempt: true, parsed: latest?.parsed });
  };

  const suggestedMins = Math.ceil(q.marks * 1.5);
  const btnLabel = busy
    ? (phase === "checking" ? "Checking…" : "Analysing…")
    : attempts.length > 0 ? "I've updated my answer →" : "Submit answer →";

  return (
    <div style={{ background: C.bg, minHeight: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>

      {/* ── Progress bar ─────────────────────────────────────── */}
      <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, background: C.bg }}>
        <span style={{ color: C.light, fontSize: 13, fontWeight: 500 }}>Question {qIdx + 1} of {total}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {sessionQs.map((sq, i) => (
            <div key={i} style={{
              width: i === qIdx ? 22 : 8, height: 8, borderRadius: 4,
              background: sessionCompleted.includes(sq.id) ? C.green : i === qIdx ? C.coral : C.border,
              transition: "all 0.25s",
            }} />
          ))}
        </div>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────── */}
      <div className="question-panels" style={{ flex: 1, padding: "28px 24px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* LEFT: Question */}
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
            <Tag label={q.cluster} type="cluster" />
            <Tag label={q.skill} type="skill" />
            <Pill label={`${q.marks}m`} bg={C.coralL} color={C.coral} />
            <Pill label={`~${suggestedMins} min`} bg={C.bg} color={C.light} />
            {q.figure && <Pill label="Fig." bg={C.card} color={C.light} />}
          </div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(17px,2.2vw,22px)", fontWeight: 600, color: C.text, lineHeight: 1.5, marginBottom: q.context ? 14 : 18 }}>
            {q.question}{" "}
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.78em", fontWeight: 700, color: C.light, whiteSpace: "nowrap" }}>[{q.marks}m]</span>
          </h2>
          {q.context && (
            <div style={{ background: C.card, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.mid, lineHeight: 1.65, marginBottom: 14, borderLeft: `3px solid ${C.border}` }}>
              {q.context}
            </div>
          )}
          {q.figureRequired && !q.figure?.src && (
            <div style={{ background: C.amberL, border: `1px solid ${C.amber}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: C.amber, fontWeight: 500 }}>
              Figure not yet available — question enabled in a future update.
            </div>
          )}
          {q.figure && <div style={{ marginBottom: 14 }}><FigurePlaceholder figure={q.figure} /></div>}

          {attempts.length > 0 && !isComplete && (
            <div style={{ borderLeft: `3px solid ${C.green}`, background: C.greenL, borderRadius: "0 6px 6px 0", padding: "7px 12px", marginBottom: 10, fontSize: 13, color: C.green, fontWeight: 500 }}>
              Edit your answer and resubmit to improve.
            </div>
          )}
          <textarea
            value={answer}
            onChange={e => { setAnswer(e.target.value); if (blocked) setBlocked(null); }}
            placeholder="Write your answer here…"
            disabled={isComplete}
            style={{ width: "100%", minHeight: 160, background: isComplete ? C.card : blocked ? "#fff5f3" : C.bg, border: `1.5px solid ${blocked ? C.red : C.border}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 14, lineHeight: 1.65, resize: "vertical", opacity: isComplete ? 0.6 : 1 }}
          />
          {blocked && (
            <div style={{ background: C.redL, border: `1px solid ${C.red}`, borderRadius: 8, padding: "8px 12px", marginTop: 6, fontSize: 13, color: C.red }}>
              {blocked}
            </div>
          )}
          {!isComplete && (
            <>
              <div style={{ marginTop: 8, marginBottom: 2 }}>
                <span style={{ color: C.light, fontSize: 12 }}>
                  {answer.split(/\s+/).filter(Boolean).length} words · {q.marks} marks
                  {attempts.length > 0 && ` · ${attempts.length} attempt${attempts.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              <button
                onClick={submit}
                disabled={!answer.trim() || busy}
                className="hl"
                style={{ width: "100%", marginTop: 10, background: (!answer.trim() || busy) ? C.border : C.coral, color: (!answer.trim() || busy) ? C.light : C.deepBg, border: "none", borderRadius: 8, padding: "13px 0", fontWeight: 700, fontSize: 15 }}
              >
                {btnLabel}
              </button>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={handleMoveOnClick}
                  style={{ background: "none", border: "none", color: C.light, fontSize: 13, cursor: "pointer", padding: 0 }}
                >
                  {isLast ? "Finish session →" : "Skip this question →"}
                </button>
              </div>
            </>
          )}

          {showMoveOnConfirm && (
            <div style={{ marginTop: 14, background: C.amberL, border: `1px solid ${C.amber}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, color: C.amber, fontSize: 13, marginBottom: 10 }}>
                {attempts.length > 0
                  ? `You have ${latest?.parsed?.marksAwarded ?? "some"} marks. Move on anyway?`
                  : "You haven't submitted an answer. Move on anyway?"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setShowMoveOnConfirm(false); onMoveOn({ didAttempt: attempts.length > 0, parsed: latest?.parsed }); }}
                  style={{ background: C.amber, color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 13 }}>
                  Yes, move on
                </button>
                <button onClick={() => setShowMoveOnConfirm(false)}
                  style={{ background: "transparent", border: `1px solid ${C.amber}`, color: C.amber, borderRadius: 8, padding: "7px 14px", fontSize: 13 }}>
                  Stay
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Feedback */}
        <div>
          {!latest ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: C.light, fontSize: 14, border: `1.5px dashed ${C.border}`, borderRadius: 12, padding: "48px 24px", textAlign: "center", minHeight: 200 }}>
              <div>
                <div style={{ fontSize: 26, marginBottom: 12, opacity: 0.25, fontFamily: "'Fraunces', serif" }}>◎</div>
                <div style={{ fontWeight: 500 }}>Your diagnosis will appear here</div>
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>Submit your answer to get feedback</div>
              </div>
            </div>
          ) : (
            <FeedbackPanel
              feedback={latest.feedback}
              attemptNum={attempts.length}
              parsed={latest.parsed}
              prevBand={prevBand}
              flagData={{ questionId: q.id, questionText: q.question, answer: latest.answerText, syllabus }}
            />
          )}

          {isComplete && (
            <div className="fade" style={{ marginTop: 14, background: C.greenL, border: `2px solid ${C.green}`, borderRadius: 12, padding: "20px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 6, animation: "checkPop 0.4s ease both" }}>✓</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19, color: C.green, marginBottom: 4 }}>
                Full marks — {latest.parsed?.marksAwarded}/{q.marks}
              </div>
              <button
                onClick={() => onMoveOn({ didAttempt: true, parsed: latest.parsed })}
                className="hl"
                style={{ width: "100%", marginTop: 14, background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 14 }}
              >
                {isLast ? "Finish session →" : "Next question →"}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// ─── THIS WEEK TAB ─────────────────────────────────────────────────────────────
const ThisWeekTab = ({ session, syllabus, onAttempt, user, onUpgrade, onSettings, onUpdateTopics, onFinish, records = [] }) => {
  const [activeIdx, setActiveIdx] = useState(0);

  const examDate = user?.examDate ? new Date(user.examDate) : null;
  const today = new Date();
  const daysToExam = examDate ? Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)) : null;
  const examMode = daysToExam !== null && daysToExam <= 14;
  const day = today.getDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;

  const sessionQs = (session?.questions || []).map(id => QUESTION_BANK.find(q => q.id === id)).filter(Boolean);
  const completed = session?.completed || [];
  const total = sessionQs.length;
  const lastUpdate = user?.lastTopicUpdate;
  const topicNudge = lastUpdate && (Date.now() - lastUpdate > 21 * 24 * 60 * 60 * 1000);
  const weekStartMs = session?.weekStart ? new Date(session.weekStart).getTime() : 0;
  const attemptedIds = new Set(records.filter(r => r.timestamp >= weekStartMs).map(r => r.questionId));

  // Resume at first unattempted question when session changes or on mount
  useEffect(() => {
    const firstUnattempted = sessionQs.findIndex(q => !attemptedIds.has(q.id));
    setActiveIdx(firstUnattempted === -1 ? total - 1 : firstUnattempted);
  }, [session?.weekStart]); // eslint-disable-line

  const allDone = total > 0 && sessionQs.every(q => attemptedIds.has(q.id));
  if (allDone) return (
    <div style={{ textAlign: "center", padding: 48 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: C.text, fontSize: 20, marginBottom: 8 }}>Session complete</div>
      <div style={{ color: C.mid, fontSize: 14, marginBottom: 20 }}>You've finished all questions for this week. New session on Monday.</div>
      <button onClick={onFinish} className="hl" style={{ background: C.green, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Go to dashboard →</button>
    </div>
  );

  if (session?.expired) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: C.text, fontSize: 20, marginBottom: 8 }}>Session expired</div>
      <div style={{ color: C.mid, fontSize: 14, marginBottom: 4 }}>New one starts Monday.</div>
      <div style={{ color: C.light, fontSize: 13 }}>{daysUntilMonday} day{daysUntilMonday !== 1 ? "s" : ""} to go</div>
    </div>
  );

  if (!session || sessionQs.length === 0) return (
    <div style={{ textAlign: "center", padding: 40, color: C.light }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: C.text, fontSize: 20, marginBottom: 8 }}>No session yet</div>
      <div style={{ fontSize: 14 }}>Your next session starts Monday.</div>
    </div>
  );

  const handleMoveOn = ({ didAttempt }) => {
    const nextIdx = activeIdx + 1;
    if (nextIdx < total) {
      setActiveIdx(nextIdx);
    } else {
      onFinish?.();
    }
  };

  const currentQ = sessionQs[activeIdx];

  // Session banners shown above the question screen
  const banners = (
    <div style={{ padding: "0 24px" }}>
      {topicNudge && (
        <div style={{ background: C.amberL, border: `1.5px solid ${C.amber}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 13, color: C.amber, fontWeight: 600 }}>It's been 3 weeks — have you covered new topics?</div>
          <button onClick={onUpdateTopics} className="hl" style={{ background: C.amber, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Update →</button>
        </div>
      )}
      {session.isBenchmark && (
        <div style={{ background: C.coralL, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", marginBottom: 12, fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: C.green }}>Benchmark · </span>
          <span style={{ color: C.mid }}>{session.themeDescription}</span>
        </div>
      )}
      {session.isCheckin && (
        <div style={{ background: C.greenL, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", marginBottom: 12, fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: C.green }}>Progress check-in · </span>
          <span style={{ color: C.mid }}>{session.themeDescription}</span>
        </div>
      )}
      {examMode && (
        <div style={{ background: C.coralL, border: `1.5px solid ${C.coral}`, borderRadius: 10, padding: "8px 14px", marginBottom: 12, fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: C.green }}>⚡ Exam mode · {daysToExam}d to go · </span>
          <span style={{ color: C.mid }}>Full question bank unlocked.</span>
        </div>
      )}
      {session.carriedOver && !examMode && (
        <div style={{ background: C.amberL, border: `1px solid ${C.amber}40`, borderRadius: 10, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: C.amber }}>
          Carried over from last week — {daysUntilMonday} day{daysUntilMonday !== 1 ? "s" : ""} left to finish.
        </div>
      )}
    </div>
  );

  if (!currentQ) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: C.green, fontSize: 22, marginBottom: 8 }}>All done for this session</div>
      <div style={{ color: C.mid, fontSize: 14 }}>Next session starts Monday.</div>
    </div>
  );

  return (
    <div>
      {banners}
      <QuestionScreen
        q={currentQ}
        qIdx={activeIdx}
        total={total}
        sessionQs={sessionQs}
        sessionCompleted={completed}
        onAttempt={onAttempt}
        onMoveOn={handleMoveOn}
        canSubmit={true}
        onUpgrade={onUpgrade}
        syllabus={syllabus}
        user={user}
      />
    </div>
  );
};

// ─── PAPER SIMULATION ─────────────────────────────────────────────────────────
const PaperSimulation = ({ user, syllabus, onAttempt, onUpgrade, allQuestions = [] }) => {
  const [step, setStep] = useState("entry"); // entry | select-paper | select-section-b | briefing | in-progress | complete
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [selectedSectionB, setSelectedSectionB] = useState(null);
  const [paperQuestions, setPaperQuestions] = useState([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [simAnswers, setSimAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [simHistory, setSimHistory] = useState([]);

  const timeLeftRef = useRef(0);
  const timerRef = useRef(null);
  const currentAnswerRef = useRef("");
  const autoSubmittedRef = useRef(false);
  const simAnswersRef = useRef([]);
  const paperQuestionsRef = useRef([]);
  const selectedPaperRef = useRef(null);
  const paperDefTimeRef = useRef(105);

  const struct = PAPER_STRUCTURES[syllabus];
  const isElective = syllabus === "O-Elective" || syllabus === "N-Elective";

  useEffect(() => {
    (async () => {
      const h = await sg("gm4_simulations");
      if (h) setSimHistory(h);
    })();
  }, []);

  // Timer
  useEffect(() => {
    if (!timerActive) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 1;
        timeLeftRef.current = next;
        if (next <= 0) {
          clearInterval(timerRef.current);
          setTimerActive(false);
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            handleTimeUp();
          }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerActive]); // eslint-disable-line

  const selectByMarkBudget = (pool, targetMarks) => {
    const sorted = [...pool].sort((a, b) => b.marks - a.marks);
    const selected = [];
    let remaining = targetMarks;
    for (const q of sorted) {
      if (q.marks <= remaining) {
        selected.push(q);
        remaining -= q.marks;
        if (remaining <= 0) break;
      }
    }
    return selected;
  };

  const selectSimulationQuestions = (papDef, sectionBCluster) => {
    const pool = allQuestions.filter(q =>
      q.syllabus.includes(syllabus) &&
      !needsFigure(q) &&
      q.tier === "paid"
    );
    const questions = [];
    for (const section of papDef.sections) {
      for (const slot of section.questions) {
        if (!section.compulsory && slot.cluster !== sectionBCluster) continue;
        const clusterPool = pool.filter(q => q.cluster === slot.cluster);
        if (slot.essayMarks) {
          const nonEssayQs = selectByMarkBudget(
            clusterPool.filter(q => q.skill !== "Evaluate"),
            slot.marks - slot.essayMarks
          );
          const essay = clusterPool.find(q => q.skill === "Evaluate" && q.marks === slot.essayMarks);
          questions.push(...nonEssayQs.map(q => ({ ...q, _slotCluster: slot.cluster, _slotSection: section.name })));
          if (essay) questions.push({ ...essay, _slotCluster: slot.cluster, _slotSection: section.name });
        } else {
          const nonEssayQs = selectByMarkBudget(
            clusterPool.filter(q => ["Describe", "Explain", "Compare"].includes(q.skill)),
            slot.marks
          );
          questions.push(...nonEssayQs.map(q => ({ ...q, _slotCluster: slot.cluster, _slotSection: section.name })));
        }
      }
    }
    return questions;
  };

  const beginSimulation = (papDef, sectionBCluster) => {
    const qs = selectSimulationQuestions(papDef, sectionBCluster);
    setPaperQuestions(qs);
    paperQuestionsRef.current = qs;
    setCurrentQIdx(0);
    setCurrentAnswer("");
    currentAnswerRef.current = "";
    setSimAnswers([]);
    simAnswersRef.current = [];
    setPendingFeedback(null);
    setTimedOut(false);
    setShowReview(false);
    autoSubmittedRef.current = false;
    selectedPaperRef.current = selectedPaper;
    paperDefTimeRef.current = papDef.time;
    const totalSecs = papDef.time * 60;
    setTimeLeft(totalSecs);
    timeLeftRef.current = totalSecs;
    setStep("briefing");
  };

  const startTimer = () => {
    setTimerActive(true);
    setStep("in-progress");
  };

  const handleTimeUp = () => {
    setTimedOut(true);
    setTimerActive(false);
    clearInterval(timerRef.current);
    finishSimulation(simAnswersRef.current, paperQuestionsRef.current, selectedPaperRef.current);
  };

  const finishSimulation = async (answers, qs, papId) => {
    const papDef = struct?.[papId] || struct?.main;
    const totalSecs = (papDef?.time || 105) * 60;
    const elapsedSecs = totalSecs - timeLeftRef.current;
    const elapsedMins = Math.max(1, Math.floor(elapsedSecs / 60));
    const totalMarksAwarded = answers.reduce((sum, a) => sum + (a.parsed?.marksAwarded || 0), 0);
    const totalPossible = answers.reduce((sum, a) => sum + (a.q?.marks || 0), 0);
    const simRecord = {
      timestamp: Date.now(),
      syllabus,
      paper: papId,
      paperLabel: papDef?.label || papId,
      totalMarks: totalMarksAwarded,
      totalPossible,
      timeTaken: elapsedMins,
      questions: answers.map(a => ({
        cluster: a.q.cluster,
        marksAwarded: a.parsed?.marksAwarded || 0,
        totalMarks: a.q.marks,
        band: a.parsed?.markBand || "L1",
      })),
    };
    const existing = await sg("gm4_simulations") || [];
    const updated = [simRecord, ...existing];
    await ss("gm4_simulations", updated);
    setSimHistory(updated);
    setStep("complete");
  };

  const handleSubmitQuestion = async () => {
    if (loadingFeedback) return;
    const currentQ = paperQuestions[currentQIdx];
    if (!currentQ) return;
    setLoadingFeedback(true);
    try {
      const sylObj = SYLLABUSES[syllabus] || SYLLABUSES["O-Elective"];
      const userMsg = `Syllabus: ${sylObj.label} (${sylObj.code})\nQuestion [${currentQ.marks} marks] — ${currentQ.skill} — ${currentQ.cluster}:\n${currentQ.question}`
        + (currentQ.context ? `\n\nContext: ${currentQ.context}` : "")
        + (currentQ.figure ? `\n\nFigure: ${currentQ.figure.caption}` : "")
        + markingNote(currentQ.question, currentQ.marks)
        + `\n\n---TIMED EXAM ATTEMPT---\nStudent answer: ${currentAnswerRef.current || "(no answer submitted)"}`;
      const evalRaw = await callClaude("eval", userMsg);
      let evalResult;
      evalResult = extractJSON(evalRaw) || { marksAwarded: null, totalMarks: currentQ.marks, markBand: 'L1', isComplete: false, completedPoints: [], gaps: [], primaryGap: null };
      const feedbackInput = `${userMsg}\n\nEVALUATION (fixed — do not recalculate):\n${JSON.stringify(evalResult, null, 2)}`;
      let fb = stripAudit(await callClaude("feedback", feedbackInput));
      const parsed = evalToParsed(evalResult, currentQ.marks);
      fb = sealIfComplete(fb, parsed, currentQ.marks);
      const answerRecord = { q: currentQ, answer: currentAnswerRef.current, feedback: fb, parsed };
      setPendingFeedback(answerRecord);
      const updated = [...simAnswersRef.current, answerRecord];
      simAnswersRef.current = updated;
      setSimAnswers(updated);
      onAttempt({ questionId: currentQ.id, cluster: currentQ.cluster, skill: currentQ.skill, marks: currentQ.marks, syllabus, attemptNumber: 1, parsed, timestamp: Date.now() });
    } catch (err) {
      const answerRecord = { q: currentQ, answer: currentAnswerRef.current, feedback: `Connection error — ${err.message}`, parsed: null };
      setPendingFeedback(answerRecord);
      const updated = [...simAnswersRef.current, answerRecord];
      simAnswersRef.current = updated;
      setSimAnswers(updated);
    }
    setLoadingFeedback(false);
  };

  const handleNextQuestion = () => {
    setPendingFeedback(null);
    setCurrentAnswer("");
    currentAnswerRef.current = "";
    const nextIdx = currentQIdx + 1;
    if (nextIdx >= paperQuestions.length) {
      finishSimulation(simAnswersRef.current, paperQuestionsRef.current, selectedPaperRef.current);
    } else {
      setCurrentQIdx(nextIdx);
    }
  };

  const resetSim = () => {
    setStep("entry");
    setSelectedPaper(null);
    setSelectedSectionB(null);
    setSimAnswers([]);
    setPendingFeedback(null);
    setCurrentQIdx(0);
    setCurrentAnswer("");
    setShowReview(false);
    setTimedOut(false);
  };

  // ── Tier gate ──
  if (BETA_MODE || user?.tier !== "plus") {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px 22px", marginTop: 8 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>📄</div>
          <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Full Paper Simulation</div>
          <div style={{ color: C.mid, fontSize: 14, lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
            {BETA_MODE ? "Coming soon." : "Simulate real exam conditions with a full paper — all questions, timed, one submission each. Available on Plus."}
          </div>
          {!BETA_MODE && <button onClick={onUpgrade} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "12px 28px", fontWeight: 700, fontSize: 14, marginTop: 24 }}>Upgrade to Plus →</button>}
        </div>
      </div>
    );
  }

  // ── Step: ENTRY ──
  if (step === "entry") {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 20px 16px", marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>Full Paper Simulation</div>
          <Pill label="Plus" bg={C.blueL} color={C.blue} />
        </div>
        <div style={{ color: C.mid, fontSize: 13, marginBottom: 14 }}>Simulate real exam conditions — all questions, timed, one submission each.</div>
        <button onClick={() => {
          if (!struct) return;
          if (isElective) {
            setSelectedPaper("main");
            selectedPaperRef.current = "main";
            const papDef = struct.main;
            const hasSectionB = papDef.sections.some(s => !s.compulsory);
            hasSectionB ? setStep("select-section-b") : beginSimulation(papDef, null);
          } else {
            setStep("select-paper");
          }
        }} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13 }}>Start simulation →</button>
        {simHistory.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.light, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Previous simulations</div>
            {simHistory.slice(0, 5).map((s, i) => {
              const date = new Date(s.timestamp).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
              const hrs = Math.floor(s.timeTaken / 60);
              const rem = s.timeTaken % 60;
              const timeStr = hrs > 0 ? `${hrs}h ${rem}m` : `${s.timeTaken}m`;
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.mid, fontSize: 13 }}>{date} · {s.paperLabel}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{s.totalMarks}/{s.totalPossible} · {timeStr}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Step: SELECT PAPER (Pure only) ──
  if (step === "select-paper") {
    return (
      <div>
        <button onClick={() => setStep("entry")} style={{ background: "none", border: "none", color: C.light, fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0 }}>← Back</button>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 700, color: C.text, fontSize: 18, marginBottom: 20 }}>Choose your paper</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {struct.papers.map(papId => {
            const pap = struct[papId];
            const allSlots = pap.sections.flatMap(s => s.questions);
            return (
              <div key={papId} style={{ background: "#fff", border: `1.5px solid ${pap.blocked ? C.border : C.coral}`, borderRadius: 14, padding: "20px 18px", opacity: pap.blocked ? 0.75 : 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>{pap.label}</div>
                <div style={{ color: C.light, fontSize: 12, marginBottom: 12 }}>{pap.time} min · {pap.totalMarks} marks</div>
                {allSlots.map((slot, i) => (
                  <div key={i} style={{ color: C.mid, fontSize: 13, marginBottom: 3 }}>
                    Q{i + 1} {slot.cluster}{slot.fieldwork ? "/Fieldwork" : ""}
                  </div>
                ))}
                {pap.blocked ? (
                  <div style={{ background: C.amberL, border: `1px solid ${C.amber}`, borderRadius: 8, padding: "8px 12px", marginTop: 14, fontSize: 12, color: C.amber, fontWeight: 600 }}>⚠ {pap.blockedReason}</div>
                ) : (
                  <button onClick={() => {
                    setSelectedPaper(papId);
                    selectedPaperRef.current = papId;
                    const hasSectionB = pap.sections.some(s => !s.compulsory);
                    hasSectionB ? setStep("select-section-b") : beginSimulation(pap, null);
                  }} className="hl" style={{ display: "block", width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 700, fontSize: 13, marginTop: 14, cursor: "pointer" }}>
                    Start {pap.label} →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step: SELECT SECTION B ──
  if (step === "select-section-b") {
    const papDef = struct[selectedPaper] || struct.main;
    const sectionA = papDef.sections.find(s => s.compulsory);
    const sectionB = papDef.sections.find(s => !s.compulsory);
    const sectionAQCount = sectionA?.questions?.length || 0;
    if (!sectionB) {
      beginSimulation(papDef, null);
      return null;
    }
    return (
      <div>
        <button onClick={() => setStep(isElective ? "entry" : "select-paper")} style={{ background: "none", border: "none", color: C.light, fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0 }}>← Back</button>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 700, color: C.text, fontSize: 18, marginBottom: 6 }}>{sectionB.name} — Choose one question</div>
        <div style={{ color: C.mid, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          You'll answer ONE of the following. This is the same choice you'll make in the real exam.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {sectionB.questions.map((slot, i) => (
            <div key={slot.cluster} style={{
              background: selectedSectionB === slot.cluster ? C.coralL : "#fff",
              border: `1.5px solid ${selectedSectionB === slot.cluster ? C.coral : C.border}`,
              borderRadius: 14, padding: "20px 18px"
            }}>
              <div style={{ color: C.light, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Question {sectionAQCount + 1 + i}</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>{slot.cluster}</div>
              <div style={{ color: C.mid, fontSize: 13, marginBottom: 14 }}>{slot.marks} marks{slot.essayMarks ? ` · Includes ${slot.essayMarks}m essay` : ""}</div>
              <button onClick={() => setSelectedSectionB(slot.cluster)} className="hl" style={{
                width: "100%", background: selectedSectionB === slot.cluster ? C.coral : "#fff",
                color: selectedSectionB === slot.cluster ? "#fff" : C.coral,
                border: `1.5px solid ${C.coral}`, borderRadius: 10, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer"
              }}>Select {slot.cluster}</button>
            </div>
          ))}
        </div>
        {selectedSectionB && (
          <div style={{ background: C.greenL, border: `1px solid ${C.green}40`, borderRadius: 12, padding: "16px 18px", marginBottom: 4 }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 8 }}>
              You've chosen {selectedSectionB}. This is your Section B question.
            </div>
            <div style={{ color: C.mid, fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>
              <div><strong>Your paper:</strong></div>
              {papDef.sections.map(section => (
                <div key={section.name}>
                  {section.name}:{" "}
                  {section.compulsory
                    ? section.questions.map(q => `${q.cluster} [${q.marks}m]`).join(" + ")
                    : `${selectedSectionB} [${section.questions.find(q => q.cluster === selectedSectionB)?.marks}m]`}
                </div>
              ))}
              <div>Total: {papDef.totalMarks} marks · {papDef.time} min</div>
            </div>
            <button onClick={() => beginSimulation(papDef, selectedSectionB)} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Begin simulation →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Step: BRIEFING ──
  if (step === "briefing") {
    const papDef = struct[selectedPaper] || struct.main;
    return (
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 24px" }}>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 800, fontSize: 20, color: C.text, marginBottom: 20 }}>Paper simulation — exam conditions</div>
        <div style={{ marginBottom: 24 }}>
          {[
            `${papDef.time} minutes`,
            "Answer all questions",
            "One submission per question — no resubmissions",
            "Feedback shown after you submit each question or when time runs out",
          ].map(pt => (
            <div key={pt} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ color: C.green, fontWeight: 700, flexShrink: 0 }}>·</span>
              <span style={{ color: C.mid, fontSize: 14, lineHeight: 1.6 }}>{pt}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 10 }}>Tips</div>
          {[
            "Allocate time by marks — roughly 2 minutes per mark",
            "Attempt every question even if unsure",
            "Write in full sentences",
          ].map(tip => (
            <div key={tip} style={{ color: C.mid, fontSize: 13, marginBottom: 6 }}>· {tip}</div>
          ))}
        </div>
        <button onClick={startTimer} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 12, padding: "13px 30px", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 14px rgba(255,107,53,0.25)", cursor: "pointer" }}>
          Begin — timer starts now →
        </button>
      </div>
    );
  }

  // ── Step: IN PROGRESS ──
  if (step === "in-progress") {
    const papDef = struct[selectedPaper] || struct.main;
    const currentQ = paperQuestions[currentQIdx];
    const totalQs = paperQuestions.length;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timerColor = timeLeft < 600 ? C.red : timeLeft < 1200 ? C.amber : C.text;
    const timerPct = (timeLeft / (papDef.time * 60)) * 100;
    const suggestedMins = (currentQ?.marks || 0) * 2;
    return (
      <div>
        {/* Sticky timer bar */}
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 18px", marginBottom: 16, position: "sticky", top: 60, zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.light, fontWeight: 600 }}>Q{currentQIdx + 1} of {totalQs} · {papDef.label}</div>
            <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 800, fontSize: 20, color: timerColor }}>
              {mins}:{String(secs).padStart(2, "0")}
            </div>
          </div>
          <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${timerPct}%`, background: timeLeft < 600 ? C.red : timeLeft < 1200 ? C.amber : C.coral, borderRadius: 3, transition: "width 1s linear" }} />
          </div>
        </div>
        {/* Current question */}
        {currentQ && (
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 20px 24px" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
              <Tag label={currentQ.cluster} type="cluster" />
              <Tag label={currentQ.skill} type="skill" />
              <Pill label={`[${currentQ.marks}m]`} bg={C.coralL} color={C.coral} />
              <Pill label={`~${suggestedMins} min`} bg={C.bg} color={C.light} />
            </div>
            <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, fontWeight: 500, marginBottom: currentQ.context ? 12 : 0 }}>{currentQ.question}</div>
            {currentQ.context && <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.mid, lineHeight: 1.6, marginBottom: 12 }}>{currentQ.context}</div>}
            {currentQ.figure && <div style={{ marginBottom: 12 }}><FigurePlaceholder figure={currentQ.figure} /></div>}
            {!pendingFeedback ? (
              <>
                <textarea
                  value={currentAnswer}
                  onChange={e => { setCurrentAnswer(e.target.value); currentAnswerRef.current = e.target.value; }}
                  placeholder="Write your answer here…"
                  style={{ width: "100%", minHeight: 140, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", color: C.text, fontSize: 14, lineHeight: 1.6, resize: "vertical", marginTop: 4 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <span style={{ color: C.light, fontSize: 12 }}>{currentAnswer.split(/\s+/).filter(Boolean).length} words · {currentQ.marks} marks</span>
                  <button onClick={handleSubmitQuestion} disabled={loadingFeedback || !currentAnswer.trim()} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, opacity: loadingFeedback || !currentAnswer.trim() ? 0.6 : 1, cursor: loadingFeedback || !currentAnswer.trim() ? "default" : "pointer" }}>
                    {loadingFeedback ? "Analysing…" : "Submit this question →"}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 12 }}>
                <FeedbackPanel feedback={pendingFeedback.feedback} attemptNum={1} parsed={pendingFeedback.parsed}
                  flagData={{ questionId: pendingFeedback.q?.id || null, questionText: pendingFeedback.q?.question || "", answer: pendingFeedback.answer || "", syllabus }} />
                <button onClick={handleNextQuestion} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, marginTop: 14, cursor: "pointer" }}>
                  {currentQIdx + 1 >= paperQuestions.length ? "Finish paper →" : "Next question →"}
                </button>
              </div>
            )}
          </div>
        )}
        {timedOut && (
          <div style={{ background: C.redL, border: `1px solid ${C.red}`, borderRadius: 12, padding: "14px 18px", marginTop: 12, color: C.red, fontWeight: 600, fontSize: 14 }}>
            Time's up — your answer has been submitted.
          </div>
        )}
      </div>
    );
  }

  // ── Step: COMPLETE ──
  if (step === "complete") {
    const totalMarksAwarded = simAnswers.reduce((sum, a) => sum + (a.parsed?.marksAwarded || 0), 0);
    const totalPossible = simAnswers.reduce((sum, a) => sum + (a.q?.marks || 0), 0);
    const papDef = struct[selectedPaperRef.current] || struct?.main;
    const totalSecs = (papDef?.time || 105) * 60;
    const elapsedMins = Math.max(1, Math.floor((totalSecs - timeLeftRef.current) / 60));
    const hrs = Math.floor(elapsedMins / 60);
    const rem = elapsedMins % 60;
    const timeStr = hrs > 0 ? `${hrs}h ${rem}m` : `${elapsedMins}m`;
    return (
      <div>
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 24px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 6 }}>Paper complete</div>
          <div style={{ color: C.mid, fontSize: 14, marginBottom: 22 }}>
            Total attempted: <strong>{totalMarksAwarded} / {totalPossible} marks</strong> · Time taken: <strong>{timeStr}</strong>
          </div>
          <div>
            {simAnswers.map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Q{i + 1} {a.q.cluster}</div>
                  <div style={{ color: C.light, fontSize: 12 }}>{a.q.skill} · {a.q.marks}m</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{a.parsed?.marksAwarded ?? "—"} / {a.q.marks}</span>
                  <BandDot band={a.parsed?.markBand || "L1"} marksAwarded={a.parsed?.marksAwarded} totalMarks={a.q.marks} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={() => setShowReview(!showReview)} style={{ background: "none", border: `1.5px solid ${C.coral}`, color: C.green, borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {showReview ? "Hide feedback" : "Review full feedback →"}
            </button>
            <button onClick={resetSim} style={{ background: "none", border: `1px solid ${C.border}`, color: C.mid, borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Back to Practice
            </button>
          </div>
        </div>
        {showReview && simAnswers.map((a, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>Q{i + 1} — {a.q.cluster} [{a.q.marks}m]</div>
            <div style={{ color: C.mid, fontSize: 13, marginBottom: 10 }}>{a.q.question}</div>
            <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.mid, marginBottom: 10 }}>
              <strong>Your answer:</strong> {a.answer || "(no answer submitted)"}
            </div>
            <FeedbackPanel feedback={a.feedback} attemptNum={1} parsed={a.parsed}
              flagData={{ questionId: a.q?.id || null, questionText: a.q?.question || "", answer: a.answer || "", syllabus }} />
          </div>
        ))}
      </div>
    );
  }

  return null;
};

// ─── SESSION CONCLUSION ───────────────────────────────────────────────────────
const SessionConclusion = ({ session, records, sessionStartTime, sessionEndTime, user, onGoToDashboard, onGoBonusQuestions, onStartExtension, allQuestions = [] }) => {
  const questionJourneys = (session?.questions || []).map(qId => {
    const q = allQuestions.find(x => x.id === qId);
    const qRecords = records.filter(r => r.questionId === qId).sort((a, b) => a.timestamp - b.timestamp);
    const firstBand = qRecords[0]?.parsed?.markBand || null;
    const lastBand = qRecords[qRecords.length - 1]?.parsed?.markBand || null;
    const improved = BAND_NUM[lastBand] > BAND_NUM[firstBand];
    const achieved = lastBand === "L3";
    return { q, firstBand, lastBand, improved, achieved };
  });

  const gapsFixed = questionJourneys.filter(j => j.improved).length;
  const durationMins = sessionStartTime && sessionEndTime
    ? Math.round((sessionEndTime - sessionStartTime) / 60000)
    : null;

  const failureCounts = {};
  records
    .filter(r => session?.questions?.includes(r.questionId))
    .forEach(r => { (r.parsed?.failures || []).forEach(f => { failureCounts[f] = (failureCounts[f] || 0) + 1; }); });
  const topFocus = Object.entries(failureCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const allL3 = questionJourneys.length > 0 && questionJourneys.every(j => j.achieved);
  const fastFinish = durationMins !== null && durationMins < 30;
  const showExtension = allL3 && fastFinish;

  const extensionQuestions = useMemo(() => {
    if (!showExtension) return [];
    const sessionClusters = new Set((session?.questions || []).map(qId => allQuestions.find(x => x.id === qId)?.cluster));
    const pool = allQuestions.filter(q =>
      q.syllabus.includes(user.syllabus) &&
      !needsFigure(q) &&
      !(session?.questions || []).includes(q.id) &&
      !sessionClusters.has(q.cluster) &&
      q.tier === "paid"
    );
    return pool.sort((a, b) => b.marks - a.marks).slice(0, 2);
  }, [showExtension, session, user.syllabus]);

  const bandColor = (band) => ({ L1: C.red, L2: C.amber, L3: C.green })[band] || C.light;
  const bandBg = (band) => ({ L1: C.redL, L2: C.amberL, L3: C.greenL })[band] || C.bg;

  // Total marks across session (point-marked questions only)
  const totalEarned = questionJourneys.reduce((sum, { q, lastBand }) => {
    if (!q || isLormQuestion(q.marks)) return sum;
    const rec = records.filter(r => r.questionId === q.id).sort((a, b) => a.timestamp - b.timestamp);
    const m = rec[rec.length - 1]?.parsed?.marksAwarded ?? 0;
    return sum + m;
  }, 0);
  const totalPossible = questionJourneys.reduce((sum, { q }) => {
    if (!q || isLormQuestion(q.marks)) return sum;
    return sum + (q.marks || 0);
  }, 0);

  return (
    <div style={{ background: C.deepBg, minHeight: "calc(100vh - 56px)", padding: "0 0 60px" }}>

      {/* ── Top stripe ───────────────────────────────────── */}
      <div style={{ background: C.green, padding: "52px 24px 40px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: C.textOnDark, opacity: 0.5, marginBottom: 16 }}>
            {session?.isBenchmark ? "BENCHMARK COMPLETE" : session?.isCheckin ? "PROGRESS CHECK COMPLETE" : "SESSION COMPLETE"}
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(34px,6vw,52px)", fontWeight: 700, color: C.textOnDark, lineHeight: 1.1, marginBottom: 16 }}>
            {allL3 ? "Perfect session." : "Session complete."}
          </h1>
          <p style={{ color: C.textOnDark, opacity: 0.65, fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
            {session?.isBenchmark
              ? "Starting point recorded. We'll check in again in 4 weeks."
              : session?.isCheckin
                ? "Progress check complete — see your improvement on the dashboard."
                : "Good work. See you next week."}
          </p>
          {/* Total marks (point questions) */}
          {totalPossible > 0 && (
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, background: "rgba(245,240,232,0.08)", border: `1px solid ${C.borderOnDark}`, borderRadius: 10, padding: "10px 20px" }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 700, color: C.textOnDark, lineHeight: 1 }}>{totalEarned}</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: C.textOnDark, opacity: 0.45 }}>/ {totalPossible}</span>
              <span style={{ fontSize: 13, color: C.textOnDark, opacity: 0.5, marginLeft: 4 }}>marks</span>
            </div>
          )}
          {durationMins !== null && (
            <div style={{ marginTop: 12, fontSize: 12, color: C.textOnDark, opacity: 0.4 }}>
              Completed in {durationMins} minute{durationMins !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* ── Question summaries ───────────────────────────── */}
      <div style={{ maxWidth: 560, margin: "32px auto 0", padding: "0 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textOnDark, opacity: 0.4, letterSpacing: "0.1em", marginBottom: 12 }}>THIS SESSION</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {questionJourneys.map(({ q, firstBand, lastBand, improved, achieved }, i) => {
            const qRecs = records.filter(r => r.questionId === q?.id).sort((a, b) => a.timestamp - b.timestamp);
            const finalMarks = qRecs[qRecs.length - 1]?.parsed?.marksAwarded ?? null;
            const gapsResolved = (qRecs[0]?.parsed?.failures || []).filter(f =>
              !(qRecs[qRecs.length - 1]?.parsed?.failures || []).includes(f)
            ).length;
            const bColor = { L1: C.red, L2: C.amber, L3: C.green };
            return (
              <div key={q?.id || i} style={{ background: C.green, border: `1px solid ${C.borderOnDark}`, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textOnDark, opacity: 0.55, marginBottom: 4, letterSpacing: "0.04em" }}>
                      {q?.skill?.toUpperCase()} · {q?.cluster}
                    </div>
                    <div style={{ fontSize: 13, color: C.textOnDark, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {q?.question}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    {/* Band journey */}
                    {firstBand && firstBand !== lastBand ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: bColor[firstBand], background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "2px 6px" }}>{firstBand}</span>
                        <span style={{ color: C.textOnDark, opacity: 0.4, fontSize: 10 }}>→</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: bColor[lastBand], background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "2px 6px" }}>{lastBand}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: bColor[lastBand] || C.light, background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "2px 6px" }}>{lastBand || "—"}</span>
                    )}
                    {/* Mark score */}
                    {!isLormQuestion(q?.marks) && finalMarks != null && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.textOnDark, opacity: 0.8 }}>{finalMarks}/{q.marks}m</span>
                    )}
                  </div>
                </div>
                {/* Gaps resolved */}
                {gapsResolved > 0 && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.green }}>
                    <span style={{ fontWeight: 700 }}>✓</span>
                    <span>{gapsResolved} gap{gapsResolved !== 1 ? "s" : ""} resolved</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Focus for next week */}
        {topFocus && !allL3 && (
          <div style={{ background: C.green, border: `1px solid ${C.borderOnDark}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textOnDark, opacity: 0.4, letterSpacing: "0.1em", marginBottom: 8 }}>FOCUS FOR NEXT WEEK</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.coral, flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 14, color: C.textOnDark, opacity: 0.8 }}>{topFocus}</span>
            </div>
          </div>
        )}

        {/* Extension questions */}
        {showExtension && extensionQuestions.length > 0 && (
          <div style={{ background: C.green, border: `2px solid ${C.coral}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: "0.1em", marginBottom: 6 }}>EXTENSION QUESTIONS</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.textOnDark, marginBottom: 4 }}>You finished early with full marks.</div>
            <div style={{ fontSize: 13, color: C.textOnDark, opacity: 0.6, marginBottom: 14, lineHeight: 1.55 }}>Two optional questions to keep you sharp. Won't affect your session record.</div>
            {extensionQuestions.map((q, i) => (
              <div key={q.id} style={{ paddingBottom: i < extensionQuestions.length - 1 ? 10 : 0, marginBottom: i < extensionQuestions.length - 1 ? 10 : 14, borderBottom: i < extensionQuestions.length - 1 ? `1px solid ${C.borderOnDark}` : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textOnDark, opacity: 0.5, marginBottom: 2 }}>{q.skill} · {q.marks}m · {q.cluster}</div>
                <div style={{ fontSize: 13, color: C.textOnDark, opacity: 0.85, lineHeight: 1.5 }}>{q.question.slice(0, 90)}{q.question.length > 90 ? "…" : ""}</div>
              </div>
            ))}
            <button onClick={() => onStartExtension(extensionQuestions)} className="hl" style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 13 }}>
              Start extension questions →
            </button>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onGoToDashboard} className="hl" style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "14px", fontWeight: 700, fontSize: 15 }}>
            See your progress →
          </button>
          {!showExtension && (
            <button onClick={onGoBonusQuestions} style={{ width: "100%", background: "transparent", border: `1px solid ${C.borderOnDark}`, borderRadius: 8, padding: "13px", fontWeight: 600, fontSize: 14, color: C.textOnDark, opacity: 0.6 }}>
              Try bonus questions
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── PRACTICE TAB ─────────────────────────────────────────────────────────────
const PracticeTab = ({ user, records, currentSession, syllabus, onAttempt, onUpgrade, onSignup, allQuestions = [] }) => {
  const [practiceMode, setPracticeMode] = useState(null); // null | 'bonus' | 'timed'
  const [selectedBonusQ, setSelectedBonusQ] = useState(null);
  const [timedConfig, setTimedConfig] = useState({ skill: null, marks: null });
  const [timedQuestion, setTimedQuestion] = useState(null);
  const [timedAnswer, setTimedAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const [timedSubmitted, setTimedSubmitted] = useState(false);
  const [timedFeedback, setTimedFeedback] = useState(null);
  const [timedLoading, setTimedLoading] = useState(false);
  const timerRef = useRef(null);

  // Tier gate
  const canAccess = user?.tier === "basic" || user?.tier === "plus";
  if (!canAccess) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🎯</div>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Practice Mode</div>
        <div style={{ color: C.mid, fontSize: 14, marginBottom: 24, lineHeight: 1.6, maxWidth: 320, margin: "0 auto 24px" }}>
          Bonus questions and timed practice unlock with a Basic account.
        </div>
        <button onClick={onUpgrade} style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "12px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Upgrade to Basic →</button>
      </div>
    );
  }

  // Derive covered clusters from user's topicsCovered
  const coveredClusters = (() => {
    const tc = user?.topicsCovered;
    if (!tc || tc === "all" || (Array.isArray(tc) && tc.length === 0)) return null;
    return Object.entries(ONBOARDING_TOPICS)
      .filter(([, topics]) => topics.some(t => tc.includes(t.id)))
      .map(([cluster]) => cluster);
  })();
  const inCoveredCluster = (q) => !coveredClusters || coveredClusters.includes(q.cluster);

  // Bonus questions logic
  const sessionComplete = currentSession?.questions?.every(qId => currentSession?.completed?.includes(qId));
  const bonusQuestions = useMemo(() => {
    if (!sessionComplete) return [];
    const recentIds = new Set(records.filter(r => Date.now() - r.timestamp < 7 * 24 * 60 * 60 * 1000).map(r => r.questionId));
    const sessionIds = new Set(currentSession?.questions || []);
    const pool = allQuestions.filter(q =>
      q.syllabus.includes(user.syllabus) &&
      !needsFigure(q) &&
      !sessionIds.has(q.id) &&
      !recentIds.has(q.id) &&
      q.tier === "paid" &&
      inCoveredCluster(q)
    );
    // Deterministic shuffle seeded on weekStart so bonus questions stay stable across tab switches
    const seed = currentSession?.weekStart || "default";
    const seeded = (id) => { let h = 0; for (const c of seed + id) h = Math.imul(31, h) + c.charCodeAt(0) | 0; return h >>> 0; };
    return pool.sort((a, b) => seeded(a.id) - seeded(b.id)).slice(0, 3);
  }, [sessionComplete, records, currentSession, user.syllabus, allQuestions, coveredClusters]);

  // Timed question selection
  const selectTimedQuestion = () => {
    const pool = allQuestions.filter(q => {
      if (!q.syllabus.includes(user.syllabus)) return false;
      if (needsFigure(q)) return false;
      if (!inCoveredCluster(q)) return false;
      if (timedConfig.skill && q.skill !== timedConfig.skill) return false;
      if (timedConfig.marks && q.marks !== timedConfig.marks) return false;
      return true;
    });
    if (pool.length === 0) return null;
    const weakIds = new Set(records.filter(r => r.parsed?.markBand === "L1").map(r => r.questionId));
    const weak = pool.filter(q => weakIds.has(q.id));
    const source = weak.length > 0 ? weak : pool;
    return source[Math.floor(Math.random() * source.length)];
  };

  const startTimer = (marks) => {
    const seconds = marks * 120; // 2 minutes per mark, matches the suggested time label
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimedSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };
  useEffect(() => () => stopTimer(), []);

  const handleTimedSubmit = async (autoSubmit = false) => {
    stopTimer();
    setTimedSubmitted(true);
    setTimedLoading(true);
    const q = timedQuestion;
    const sylObj = SYLLABUSES[syllabus] || SYLLABUSES["O-Elective"];
    const userMsg = `Syllabus: ${sylObj.label} (${sylObj.code})\nQuestion [${q.marks} marks] — ${q.skill} — ${q.cluster}:\n${q.question}`
      + (q.context ? `\n\nContext: ${q.context}` : "")
      + markingNote(q.question, q.marks)
      + `\n\n---TIMED PRACTICE ATTEMPT---\nStudent answer: ${timedAnswer || "[No answer submitted — time ran out]"}`;
    try {
      const evalRaw = await callClaude("eval", userMsg);
      let evalResult;
      evalResult = extractJSON(evalRaw) || { marksAwarded: null, totalMarks: q.marks, markBand: 'L1', isComplete: false, completedPoints: [], gaps: [], primaryGap: null };
      const feedbackInput = `${userMsg}\n\nEVALUATION (fixed — do not recalculate):\n${JSON.stringify(evalResult, null, 2)}`;
      let fb = stripAudit(await callClaude("feedback", feedbackInput));
      const parsed = evalToParsed(evalResult, q.marks);
      fb = sealIfComplete(fb, parsed, q.marks);
      setTimedFeedback({ text: fb, parsed });
      onAttempt({ questionId: q.id, cluster: q.cluster, skill: q.skill, marks: q.marks, syllabus, attemptNumber: 1, parsed, timestamp: Date.now() });
    } catch (e) {
      setTimedFeedback({ text: "Could not load feedback. Please try again.", parsed: null });
    }
    setTimedLoading(false);
  };

  // ── Bonus question open ──
  if (practiceMode === "bonus" && selectedBonusQ) {
    return (
      <div>
        <button onClick={() => { setSelectedBonusQ(null); setPracticeMode(null); }}
          style={{ background: "none", border: "none", color: C.light, fontSize: 13, cursor: "pointer", padding: "4px 0 12px", display: "block" }}>
          ← Back to Practice
        </button>
        <QuestionScreen
          q={selectedBonusQ}
          qIdx={0}
          total={1}
          sessionQs={[selectedBonusQ]}
          sessionCompleted={[]}
          onAttempt={onAttempt}
          onMoveOn={() => { setSelectedBonusQ(null); setPracticeMode(null); }}
          canSubmit={true}
          onUpgrade={onUpgrade}
          syllabus={syllabus}
          user={user}
        />
      </div>
    );
  }

  // ── Timed practice — active ──
  if (practiceMode === "timed" && timedQuestion) {
    const mins = Math.floor((timeLeft || 0) / 60);
    const secs = String((timeLeft || 0) % 60).padStart(2, "0");
    const timerColor = timeLeft < 60 ? C.red : timeLeft < 180 ? C.amber : C.text;
    const timerPct = timeLeft / (timedQuestion.marks * 120);
    return (
      <div>
        {/* Timer bar */}
        <div style={{ position: "sticky", top: 56, zIndex: 9, background: C.card, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.light, letterSpacing: "0.06em" }}>
              TIMED PRACTICE · {timedQuestion.skill} [{timedQuestion.marks}m]
            </div>
            <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 20, fontWeight: 800, color: timerColor }}>
              {timedSubmitted ? "—" : `${mins}:${secs}`}
            </div>
          </div>
          <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
            <div style={{ height: "100%", borderRadius: 2, background: timeLeft < 60 ? C.red : C.coral, width: `${Math.max(0, timerPct * 100)}%`, transition: "width 1s linear, background 0.3s" }} />
          </div>
        </div>
        {/* Question */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", marginBottom: 16 }}>
          {timedQuestion.context && <div style={{ fontSize: 13, color: C.mid, marginBottom: 12, lineHeight: 1.6, fontStyle: "italic" }}>{timedQuestion.context}</div>}
          {timedQuestion.figure && <FigurePlaceholder figure={timedQuestion.figure} />}
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.6 }}>
            {timedQuestion.question}<span style={{ color: C.light, fontWeight: 500, fontSize: 13 }}> [{timedQuestion.marks} marks]</span>
          </div>
        </div>
        {!timedSubmitted ? (
          <div>
            <textarea value={timedAnswer} onChange={e => setTimedAnswer(e.target.value)} placeholder="Write your answer here..."
              style={{ width: "100%", minHeight: 160, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", fontSize: 14, lineHeight: 1.6, fontFamily: "inherit", resize: "vertical", background: C.card, color: C.text, marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: C.light }}>Suggested time: {timedQuestion.marks * 2} minutes</div>
              <button onClick={() => handleTimedSubmit(false)} disabled={!timedAnswer.trim()}
                style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: timedAnswer.trim() ? "pointer" : "default", opacity: timedAnswer.trim() ? 1 : 0.4 }}>
                Submit →
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px" }}>
            {timedLoading ? (
              <div style={{ color: C.mid, fontSize: 14 }}>Marking your answer…</div>
            ) : (
              <>
                <FeedbackPanel feedback={timedFeedback?.text} attemptNum={1} parsed={timedFeedback?.parsed}
                  flagData={{ questionId: timedQuestion?.id || null, questionText: timedQuestion?.question || "", answer: timedAnswer, syllabus }} />
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button onClick={() => { setTimedQuestion(null); setTimedAnswer(""); setTimedFeedback(null); setTimedSubmitted(false); setTimeLeft(null); }}
                    style={{ flex: 1, background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "10px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Try another →
                  </button>
                  <button onClick={() => setPracticeMode(null)}
                    style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px", fontWeight: 600, fontSize: 13, color: C.mid, cursor: "pointer" }}>
                    Back to Practice
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Timed practice — config ──
  if (practiceMode === "timed" && !timedQuestion) {
    const SKILL_OPTIONS = ["Describe", "Explain", "Evaluate", "Compare"];
    const MARK_OPTIONS = [2, 3, 4, 6, 9];
    const recommended = selectTimedQuestion();
    return (
      <div>
        <button onClick={() => setPracticeMode(null)} style={{ background: "none", border: "none", color: C.mid, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>← Back</button>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>Timed Practice</div>
        <div style={{ color: C.mid, fontSize: 13, marginBottom: 24 }}>One question. One submission. Timed.</div>
        {recommended && (
          <div style={{ background: C.coralL, border: `1px solid ${C.coral}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: "0.06em", marginBottom: 8 }}>RECOMMENDED FOR YOU</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{recommended.skill} [{recommended.marks}m] · {recommended.cluster}</div>
            <div style={{ fontSize: 13, color: C.mid, marginBottom: 14, lineHeight: 1.5 }}>
              {recommended.question.slice(0, 100)}{recommended.question.length > 100 ? "…" : ""}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: C.light }}>⏱ {recommended.marks * 2} minutes</div>
              <button onClick={() => { setTimedQuestion(recommended); setTimedAnswer(""); setTimedSubmitted(false); setTimedFeedback(null); startTimer(recommended.marks); }}
                style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Start →</button>
            </div>
          </div>
        )}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>Or choose your own</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.light, marginBottom: 8 }}>SKILL TYPE</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[null, ...SKILL_OPTIONS].map(s => (
                <div key={s || "any"} onClick={() => setTimedConfig(prev => ({ ...prev, skill: s }))}
                  style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600, background: timedConfig.skill === s ? C.coral : C.bg, color: timedConfig.skill === s ? "#fff" : C.mid, border: `1px solid ${timedConfig.skill === s ? C.coral : C.border}` }}>
                  {s || "Any"}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.light, marginBottom: 8 }}>MARKS</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[null, ...MARK_OPTIONS].map(m => (
                <div key={m || "any"} onClick={() => setTimedConfig(prev => ({ ...prev, marks: m }))}
                  style={{ padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600, background: timedConfig.marks === m ? C.coral : C.bg, color: timedConfig.marks === m ? "#fff" : C.mid, border: `1px solid ${timedConfig.marks === m ? C.coral : C.border}` }}>
                  {m ? `${m}m` : "Any"}
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => {
            const q = selectTimedQuestion();
            if (q) { setTimedQuestion(q); setTimedAnswer(""); setTimedSubmitted(false); setTimedFeedback(null); startTimer(q.marks); }
          }} style={{ width: "100%", background: C.text, color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Start with these filters →
          </button>
        </div>
      </div>
    );
  }

  // ── Default: Practice home ──
  return (
    <div>
      <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 2 }}>Practice</div>
      <div style={{ color: C.light, fontSize: 13, marginBottom: 24 }}>Extra reps, on your terms.</div>

      {/* BONUS QUESTIONS */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>Bonus Questions</div>
        <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.5, marginBottom: 14 }}>
          3 extra questions — unlocks after you complete your weekly session. Full diagnostic feedback, unlimited resubmissions.
        </div>
        {!sessionComplete ? (
          <div style={{ padding: "12px 14px", background: C.bg, borderRadius: 10, fontSize: 13, color: C.light, fontStyle: "italic" }}>
            Complete this week's session to unlock bonus questions.
          </div>
        ) : bonusQuestions.length === 0 ? (
          <div style={{ padding: "12px 14px", background: C.bg, borderRadius: 10, fontSize: 13, color: C.light, fontStyle: "italic" }}>
            No new bonus questions available — check back next week.
          </div>
        ) : (
          <div>
            {bonusQuestions.map((q, i) => (
              <div key={q.id} style={{ padding: "12px 0", borderBottom: i < bonusQuestions.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>{q.skill} [{q.marks}m] · {q.cluster}</div>
                    <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.4 }}>{q.question.slice(0, 80)}{q.question.length > 80 ? "…" : ""}</div>
                  </div>
                  <button onClick={() => { setSelectedBonusQ(q); setPracticeMode("bonus"); }}
                    style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: C.mid, cursor: "pointer", flexShrink: 0, marginLeft: 12 }}>
                    Attempt →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TIMED PRACTICE */}
      <div onClick={() => setPracticeMode("timed")}
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", cursor: "pointer", transition: "border-color 0.15s", marginBottom: 16 }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.coral}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>Timed Practice</div>
            <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.5 }}>
              One question. One submission. Timer running. System picks based on your weakest areas — or choose your own skill type and mark value.
            </div>
          </div>
          <div style={{ color: C.green, fontSize: 20, marginLeft: 16, flexShrink: 0 }}>→</div>
        </div>
      </div>

      {/* MY QUESTIONS — Plus only */}
      {!BETA_MODE && (user?.tier === "plus" ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: C.light, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>My Questions</div>
          <CustomQuestion onAttempt={onAttempt} syllabus={syllabus} user={user} />
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", marginBottom: 16, opacity: 0.7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>My Questions</div>
              <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.5 }}>Paste any question from your past papers and get full diagnostic feedback. Plus only.</div>
            </div>
            <button onClick={onUpgrade} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 12, flexShrink: 0, marginLeft: 16, cursor: "pointer" }}>Upgrade →</button>
          </div>
        </div>
      ))}

      {/* FULL PAPER SIMULATION */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: C.light, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Full Paper Simulation</div>
        <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: "24px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🛠</div>
          <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>Coming soon</div>
          <div style={{ color: C.mid, fontSize: 13 }}>Full timed paper simulations are in the works. Check back soon.</div>
        </div>
      </div>
    </div>
  );
};

// ─── SIGNUP PROMPT MODAL ───────────────────────────────────────────────────────
const SIGNUP_PROMPT_COPY = {
  completed: {
    title: "You've finished your 3 free questions.",
    body: "Sign up free to save your progress, get fresh questions every week, and see your reasoning gaps close over time.",
    cta: "Save my progress →",
  },
  returning: {
    title: "Welcome back.",
    body: "You've already started — sign up free to save your progress and pick up where you left off.",
    cta: "Save my progress →",
  },
  progress: {
    title: "Want to save your progress?",
    body: "Sign up free to track your reasoning gaps week by week. It takes 30 seconds.",
    cta: "Sign up free →",
  },
};

const SignupPromptModal = ({ type, onSignup, onClose }) => {
  const copy = SIGNUP_PROMPT_COPY[type] || SIGNUP_PROMPT_COPY.progress;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: "32px 28px", maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>📈</div>
        <div style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 800, fontSize: 20, color: C.text, marginBottom: 10 }}>{copy.title}</div>
        <div style={{ color: C.mid, fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>{copy.body}</div>
        <button onClick={onSignup} className="hl" style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 11, padding: "12px 0", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{copy.cta}</button>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.light, fontSize: 13, cursor: "pointer" }}>Maybe later</button>
      </div>
    </div>
  );
};

// ─── FREE SESSION VIEW ─────────────────────────────────────────────────────────
const FreeSessionView = ({ session, syllabus, onAttempt, user, onSignup, records = [], allQuestions = [] }) => {
  const freeIds = allQuestions.filter(q => q.tier === "free" && !needsFigure(q) && q.syllabus.includes(syllabus)).slice(0, 3).map(q => q.id);
  const sessionQs = (session?.questions || freeIds).map(id => allQuestions.find(q => q.id === id)).filter(Boolean);
  const total = sessionQs.length;
  const sessionCompleted = session?.completed || [];

  const [currentIdx, setCurrentIdx] = useState(0);

  const handleMoveOn = () => {
    if (currentIdx + 1 < total) setCurrentIdx(currentIdx + 1);
    else setCurrentIdx(total); // triggers done state
  };

  const tc = user?.topicsCovered;
  const coveredClusterNames = Array.isArray(tc) && tc.length > 0
    ? Object.entries(ONBOARDING_TOPICS)
      .filter(([, topics]) => topics.some(t => tc.includes(t.id)))
      .map(([cluster]) => cluster)
    : [];
  const upgradeMsg = coveredClusterNames.length > 0
    ? `Upgrade to Basic to get weekly sessions covering ${coveredClusterNames.join(", ")} — tailored to where you struggle.`
    : "Upgrade to Basic for personalised weekly sessions tailored to where you struggle.";

  const upgradeCTA = (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginTop: 24, textAlign: "center" }}>
      <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>
        {!user ? "Save your progress and keep training." : "Want fresh questions every week?"}
      </div>
      <div style={{ color: C.mid, fontSize: 13, marginBottom: 14 }}>
        {!user
          ? "Sign up free to get fresh questions every week and track your reasoning gaps over time."
          : upgradeMsg}
      </div>
      <button onClick={onSignup} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "11px 24px", fontWeight: 700, fontSize: 14 }}>
        {!user ? "Sign up free →" : "Upgrade to Basic →"}
      </button>
    </div>
  );

  if (currentIdx >= total) {
    return (
      <div style={{ position: "fixed", inset: 0, background: C.deepBg, overflowY: "auto", zIndex: 50, padding: "48px 24px 64px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* ── Header ── */}
          <div className="fade" style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 14, animation: "checkPop 0.4s ease both" }}>✓</div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(28px,5vw,40px)", color: C.textOnDark, lineHeight: 1.1, marginBottom: 12 }}>
              Session complete.
            </h1>
            <p style={{ color: C.textOnDark, opacity: 0.6, fontSize: 15, maxWidth: 400, margin: "0 auto" }}>
              You've worked through {total} questions. Here's what tracking your progress looks like with an account.
            </p>
          </div>

          {/* ── Dashboard teaser ── */}
          <div style={{ marginBottom: 32, opacity: 0.92 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.textOnDark, opacity: 0.45, marginBottom: 14 }}>WHAT YOU GET WITH AN ACCOUNT</div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
              {[
                { label: "Sessions completed", value: "—", sub: "tracked weekly" },
                { label: "Reasoning gaps fixed", value: "—", sub: "across all questions" },
                { label: "Exam days left", value: "—", sub: "countdown" },
              ].map((s, i) => (
                <div key={i} style={{ background: C.midBg, borderRadius: 10, padding: "14px 12px", border: `1px solid ${C.borderOnDark}` }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: C.textOnDark, marginBottom: 2 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textOnDark, opacity: 0.5, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Band history preview */}
            <div style={{ background: C.midBg, borderRadius: 10, padding: "16px", border: `1px solid ${C.borderOnDark}`, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textOnDark, opacity: 0.5, letterSpacing: "0.08em", marginBottom: 12 }}>YOUR REASONING PROGRESS</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
                {["L1", "L1", "L2", "L1", "L2", "L2", "L3"].map((b, i) => {
                  const h = b === "L3" ? 56 : b === "L2" ? 38 : 22;
                  const col = b === "L3" ? "#a8d080" : b === "L2" ? "#c8a85a" : "#3a5448";
                  return <div key={i} style={{ flex: 1, height: h, borderRadius: 4, background: col, opacity: 0.7 }} />;
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: C.textOnDark, opacity: 0.35 }}>Week 1</span>
                <span style={{ fontSize: 10, color: C.textOnDark, opacity: 0.35 }}>This week</span>
              </div>
            </div>

            {/* Gap categories preview */}
            <div style={{ background: C.midBg, borderRadius: 10, padding: "16px", border: `1px solid ${C.borderOnDark}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textOnDark, opacity: 0.5, letterSpacing: "0.08em", marginBottom: 10 }}>COMMON REASONING GAPS</div>
              {[
                { label: "Incomplete causal chain", count: 4, pct: 80 },
                { label: "Missing comparison", count: 2, pct: 45 },
                { label: "Unsupported evidence", count: 1, pct: 20 },
              ].map((g, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: C.textOnDark, opacity: 0.7 }}>{g.label}</span>
                    <span style={{ fontSize: 11, color: C.textOnDark, opacity: 0.4 }}>{g.count}×</span>
                  </div>
                  <div style={{ height: 4, background: C.borderOnDark, borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${g.pct}%`, background: "#a8d080", borderRadius: 2, opacity: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <div style={{ textAlign: "center" }}>
            <button onClick={onSignup} className="hl" style={{ width: "100%", background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "14px 0", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
              {!user ? "Sign up free — save your progress →" : "Upgrade to Basic →"}
            </button>
            <div style={{ fontSize: 13, color: C.textOnDark, opacity: 0.45 }}>
              Free forever · No credit card required
            </div>
          </div>

        </div>
      </div>
    );
  }

  const currentQ = sessionQs[currentIdx];

  return (
    <div>
      <QuestionScreen
        q={currentQ}
        qIdx={currentIdx}
        total={total}
        sessionQs={sessionQs}
        sessionCompleted={sessionCompleted}
        onAttempt={onAttempt}
        onMoveOn={handleMoveOn}
        canSubmit={true}
        onUpgrade={onSignup}
        syllabus={syllabus}
        user={user}
      />
      {upgradeCTA}
    </div>
  );
};

// ─── LANDING ──────────────────────────────────────────────────────────────────
const StudentIllustration = () => (
  <svg viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 200, opacity: 0.18 }}>
    {/* desk */}
    <rect x="20" y="160" width="160" height="8" rx="4" stroke="#f5f0e8" strokeWidth="2" />
    {/* paper */}
    <rect x="60" y="110" width="90" height="55" rx="4" stroke="#f5f0e8" strokeWidth="2" />
    <line x1="70" y1="125" x2="140" y2="125" stroke="#f5f0e8" strokeWidth="1.5" />
    <line x1="70" y1="135" x2="130" y2="135" stroke="#f5f0e8" strokeWidth="1.5" />
    <line x1="70" y1="145" x2="120" y2="145" stroke="#f5f0e8" strokeWidth="1.5" />
    {/* arm + hand */}
    <path d="M80 110 Q75 90 90 85" stroke="#f5f0e8" strokeWidth="2" strokeLinecap="round" />
    {/* pen */}
    <line x1="90" y1="85" x2="105" y2="100" stroke="#f5f0e8" strokeWidth="2" strokeLinecap="round" />
    <polygon points="105,100 112,95 108,106" fill="#f5f0e8" opacity="0.5" />
    {/* head */}
    <circle cx="100" cy="55" r="24" stroke="#f5f0e8" strokeWidth="2" />
    {/* hair */}
    <path d="M76 50 Q80 30 100 28 Q120 30 124 50" stroke="#f5f0e8" strokeWidth="2" fill="none" />
    {/* body */}
    <path d="M82 78 Q80 95 80 110" stroke="#f5f0e8" strokeWidth="2" strokeLinecap="round" />
    <path d="M118 78 Q120 95 120 110" stroke="#f5f0e8" strokeWidth="2" strokeLinecap="round" />
    <path d="M82 78 Q100 85 118 78" stroke="#f5f0e8" strokeWidth="2" fill="none" />
  </svg>
);

const Landing = ({ onStart, onSignup }) => (
  <div style={{ fontFamily: "'DM Sans', sans-serif" }}>

    {/* ── HERO (dark green) ─────────────────────────────────────── */}
    <section style={{ background: C.deepBg, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 24px", position: "relative", overflow: "hidden" }}>
      {/* background grid lines */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(245,240,232,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,240,232,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
      <div style={{ maxWidth: 860, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", border: `1px solid ${C.borderOnDark}`, color: C.textOnDark, borderRadius: 4, padding: "4px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 28, opacity: 0.6 }}>
            SINGAPORE O-LEVEL &amp; N-LEVEL GEOGRAPHY
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(36px,6vw,62px)", fontWeight: 700, color: C.textOnDark, lineHeight: 1.1, marginBottom: 24 }}>
            Understand why<br />you lost the mark.
          </h1>
          <p style={{ color: C.textOnDark, opacity: 0.72, fontSize: "clamp(15px,2vw,17px)", maxWidth: 480, lineHeight: 1.7, marginBottom: 36 }}>
            Unpack diagnoses the exact reasoning gap in your Geography answer — and trains you to fix it.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={onStart} className="hl" style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "13px 28px", fontWeight: 700, fontSize: 15 }}>
              Start free →
            </button>
            <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} style={{ background: "transparent", color: C.textOnDark, border: `1.5px solid ${C.borderOnDark}`, borderRadius: 8, padding: "12px 24px", fontWeight: 600, fontSize: 15, opacity: 0.8 }}>
              See how it works
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 120 }}>
          <StudentIllustration />
        </div>
      </div>
    </section>

    {/* ── HOW IT WORKS (cream) ──────────────────────────────────── */}
    <section id="how-it-works" style={{ background: C.bg, padding: "80px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 700, color: C.text, marginBottom: 12 }}>How it works</h2>
        <p style={{ color: C.light, fontSize: 15, marginBottom: 56, lineHeight: 1.6 }}>Three steps. No grades — just diagnosis.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, position: "relative" }}>
          {/* connecting line */}
          <div style={{ position: "absolute", top: 28, left: "16.66%", right: "16.66%", height: 1, background: C.border, zIndex: 0 }} />
          {[
            { icon: "✍", title: "Attempt a question", desc: "Write your Geography exam answer. Any question type — Explain, Describe, Evaluate, Compare." },
            { icon: "◎", title: "Get diagnosed", desc: "Unpack finds the exact reasoning gap holding your marks back. One gap at a time, in plain language." },
            { icon: "↑", title: "Fix your thinking", desc: "Revise your answer. Resubmit. Track how your reasoning improves across the session." },
          ].map((s, i) => (
            <div key={i} style={{ padding: "0 24px", textAlign: "center", position: "relative", zIndex: 1 }}>
              <div style={{ width: 56, height: 56, border: `2px solid ${C.border}`, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 22, color: C.mid }}>
                {s.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 8 }}>{s.title}</div>
              <div style={{ color: C.light, fontSize: 13, lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── WHAT UNPACK FINDS (dark green) ───────────────────────── */}
    <section style={{ background: C.green, padding: "80px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 700, color: C.textOnDark, marginBottom: 12 }}>What Unpack finds</h2>
        <p style={{ color: C.textOnDark, opacity: 0.65, fontSize: 15, marginBottom: 44, lineHeight: 1.6 }}>The reasoning gaps that mark schemes penalise — but teachers rarely have time to explain.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {[
            { icon: "⛓", label: "Incomplete chain", desc: "Your cause stops before reaching the effect." },
            { icon: "⇄", label: "Missing comparison", desc: "You described one side without comparing the other." },
            { icon: "↗", label: "Question drift", desc: "Your answer is correct — but answers a different question." },
            { icon: "⟳", label: "Point recycling", desc: "The same idea rephrased — not a new point." },
            { icon: "◌", label: "Generic evidence", desc: "A real example would earn the mark. A vague one won't." },
          ].map(g => (
            <div key={g.label} style={{ background: C.deepBg, border: `1px solid ${C.borderOnDark}`, borderRadius: 12, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, opacity: 0.7 }}>{g.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.textOnDark }}>{g.label}</span>
              </div>
              <p style={{ color: C.textOnDark, opacity: 0.6, fontSize: 13, lineHeight: 1.55, margin: 0 }}>{g.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── SYLLABUS (cream) ──────────────────────────────────────── */}
    <section style={{ background: C.bg, padding: "80px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 700, color: C.text, marginBottom: 12 }}>Built for Singapore Geography</h2>
        <p style={{ color: C.light, fontSize: 15, marginBottom: 36, lineHeight: 1.6 }}>Calibrated to MOE marking criteria.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {["O-Level Elective", "O-Level Pure", "N(A)-Level Elective", "N(A)-Level Pure"].map(s => (
            <div key={s} style={{ border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: C.text, background: C.card }}>
              {s}
            </div>
          ))}
        </div>
        <p style={{ color: C.light, fontSize: 13, marginTop: 8 }}>Social Studies · History · Literature — coming next.</p>
      </div>
    </section>

    {/* ── PRICING (dark green) ──────────────────────────────────── */}
    {!BETA_MODE && (
      <section style={{ background: C.deepBg, padding: "80px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 700, color: C.textOnDark, marginBottom: 8 }}>Pricing</h2>
          <p style={{ color: C.textOnDark, opacity: 0.6, fontSize: 15, marginBottom: 44 }}>Start free. No credit card, no expiry.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {[
              {
                name: "Free", price: "$0", period: "forever",
                highlight: false,
                features: ["3 questions, always free", "Full diagnostic feedback", "Unlimited re-submissions"]
              },
              {
                name: "Basic", price: "$12.90", period: "/month",
                highlight: false,
                tag: "Most popular",
                features: ["Everything in Free", "Weekly curated sessions", "Bonus additional practice", "Progress dashboard", "More sessions near exam"]
              },
              {
                name: "Plus", price: "$15.90", period: "/month",
                highlight: true,
                tag: "For serious prep",
                features: ["Everything in Basic", "Custom question diagnostics", "Full paper simulation (coming soon!)"]
              },
            ].map(p => (
              <div key={p.name} style={{ background: C.green, border: `2px solid ${p.highlight ? C.coral : C.borderOnDark}`, borderRadius: 12, padding: "26px 22px", position: "relative" }}>
                {p.tag && (
                  <div style={{ position: "absolute", top: -11, left: 18, background: p.highlight ? C.coral : C.borderOnDark, color: p.highlight ? C.deepBg : C.textOnDark, borderRadius: 4, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{p.tag}</div>
                )}
                <div style={{ fontWeight: 700, fontSize: 13, color: C.textOnDark, opacity: 0.6, marginBottom: 6, letterSpacing: "0.06em" }}>{p.name.toUpperCase()}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 700, color: C.textOnDark }}>{p.price}</span>
                  <span style={{ color: C.textOnDark, opacity: 0.5, fontSize: 13 }}>{p.period}</span>
                </div>
                <div style={{ borderTop: `1px solid ${C.borderOnDark}`, marginBottom: 16 }} />
                {p.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ color: C.green, flexShrink: 0, fontWeight: 700 }}>✓</span>
                    <span style={{ color: C.textOnDark, opacity: 0.75, fontSize: 13 }}>{f}</span>
                  </div>
                ))}
                <button onClick={p.name === "Free" ? onStart : onSignup} className="hl" style={{ width: "100%", marginTop: 20, background: p.highlight ? C.coral : "transparent", color: p.highlight ? C.deepBg : C.textOnDark, border: `1.5px solid ${p.highlight ? C.coral : C.borderOnDark}`, borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 13 }}>
                  {p.name === "Free" ? "Start free →" : "Start training →"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    )}

    {/* ── FOOTER (deep green) ───────────────────────────────────── */}
    <footer style={{ background: C.deepBg, borderTop: `1px solid ${C.borderOnDark}`, padding: "28px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, color: C.textOnDark }}>Unpack</span>
        <span style={{ color: C.textOnDark, opacity: 0.45, fontSize: 12 }}>Built for Singapore students</span>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.textOnDark, opacity: 0.45, fontSize: 12, textDecoration: "none" }}>Privacy Policy</a>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.textOnDark, opacity: 0.45, fontSize: 12, textDecoration: "none" }}>Terms of Use</a>
        </div>
      </div>
    </footer>

  </div>
);

// ─── ACCOUNT TAB ──────────────────────────────────────────────────────────────
const AccountTab = ({ user, tier, syllabus, onEditTopics, onSettings, onUpgrade, onChangeTier, onDeleteAccount, onLogout }) => {
  const [confirmCancel, setConfirmCancel] = useState(null); // null | 'downgrade-basic' | 'downgrade-free' | 'delete'
  const [deleteLoading, setDeleteLoading] = useState(false);

  const tc = user?.topicsCovered;
  const sylClusters = SYLLABUSES[syllabus]?.clusters || Object.keys(ONBOARDING_TOPICS);
  const visibleClusters = Object.entries(ONBOARDING_TOPICS).filter(([c]) => sylClusters.includes(c));
  const allTopicIds = visibleClusters.flatMap(([, ts]) => ts.map(t => t.id));
  const coveredIds = !tc || tc === "all" ? allTopicIds : Array.isArray(tc) ? tc : [];

  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.mid }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</span>
    </div>
  );

  const TIER_LABELS = { null: "Free", "free-account": "Free", basic: "Basic", plus: "Plus" };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 20 }}>Account</div>

      {/* ── Profile ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: C.text, fontSize: 15, marginBottom: 2 }}>{user?.name}</div>
        <div style={{ color: C.light, fontSize: 13, marginBottom: 10 }}>{user?.email}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ background: C.coralL, color: C.green, borderRadius: 10, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>{TIER_LABELS[tier] || "Free"}</span>
          <span style={{ background: C.bg, color: C.light, borderRadius: 10, padding: "3px 12px", fontSize: 12 }}>{SYLLABUS_LABELS[user?.syllabus] || user?.syllabus}</span>
        </div>
      </div>

      {/* ── Topics covered ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>Topics covered</div>
            <div style={{ color: C.light, fontSize: 12, marginTop: 2 }}>{coveredIds.length} of {allTopicIds.length} topics</div>
          </div>
          <button onClick={onEditTopics} className="hl"
            style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12 }}>
            Edit →
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleClusters.map(([cluster, topics]) => {
            const cc = CLUSTER_COLOR[cluster] || {};
            const coveredCount = topics.filter(t => coveredIds.includes(t.id)).length;
            const pct = Math.round((coveredCount / topics.length) * 100);
            return (
              <div key={cluster}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: cc.dot || C.coral, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{cluster}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.light }}>{coveredCount}/{topics.length}</span>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? C.green : C.coral, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Subscription ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 14 }}>Subscription</div>
        {row("Current plan", TIER_LABELS[tier] || "Free")}
        {!BETA_MODE && row("Monthly price", tier === "plus" ? "$15.90/mo" : tier === "basic" ? "$12.90/mo" : "Free")}
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {!BETA_MODE && tier !== "plus" && (
            <button onClick={onUpgrade} className="hl"
              style={{ background: C.coral, color: C.deepBg, border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 700, fontSize: 13, width: "100%", cursor: "pointer" }}>
              {tier === "basic" ? "Upgrade to Plus ($15.90/mo) →" : "Upgrade to Basic ($12.90/mo) →"}
            </button>
          )}
          {!BETA_MODE && tier === "plus" && (
            confirmCancel === "downgrade-basic" ? (
              <div style={{ background: C.amberL, border: `1px solid ${C.amber}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 6 }}>Downgrade to Basic?</div>
                <div style={{ fontSize: 12, color: C.mid, marginBottom: 12 }}>You'll lose access to My Questions and Plus features. Takes effect immediately.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmCancel(null)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 0", fontSize: 12, color: C.mid, cursor: "pointer" }}>Keep Plus</button>
                  <button onClick={async () => { await onChangeTier("basic"); setConfirmCancel(null); }} style={{ flex: 1, background: C.amber, color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirm downgrade</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmCancel("downgrade-basic")}
                style={{ background: "none", border: `1px solid ${C.border}`, color: C.mid, borderRadius: 10, padding: "10px 0", fontWeight: 600, fontSize: 13, width: "100%", cursor: "pointer" }}>
                Downgrade to Basic
              </button>
            )
          )}
          {(tier === "plus" || tier === "basic") && (
            confirmCancel === "downgrade-free" ? (
              <div style={{ background: C.coralL, border: `1px solid ${C.coral}40`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 6 }}>Cancel subscription?</div>
                <div style={{ fontSize: 12, color: C.mid, marginBottom: 12 }}>You'll be moved to the Free plan and lose access to your weekly sessions and question bank. Takes effect immediately.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmCancel(null)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 0", fontSize: 12, color: C.mid, cursor: "pointer" }}>Keep plan</button>
                  <button onClick={async () => { await onChangeTier("free-account"); setConfirmCancel(null); }} style={{ flex: 1, background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancel subscription</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmCancel("downgrade-free")}
                style={{ background: "none", border: `1px solid ${C.border}`, color: C.mid, borderRadius: 10, padding: "10px 0", fontWeight: 600, fontSize: 13, width: "100%", cursor: "pointer" }}>
                Cancel subscription
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Other settings ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 12 }}>Settings</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onSettings} style={{ background: "none", border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", textAlign: "left" }}>Edit syllabus &amp; exam date →</button>
          <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.border}`, color: C.mid, borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", textAlign: "left" }}>Sign out</button>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div style={{ border: `1px solid ${C.red}40`, borderRadius: 14, padding: "16px 20px" }}>
        <div style={{ fontWeight: 700, color: C.red, fontSize: 13, marginBottom: 10 }}>Danger zone</div>
        {confirmCancel === "delete" ? (
          <div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4 }}>Delete your account?</div>
            <div style={{ fontSize: 12, color: C.mid, marginBottom: 12 }}>This permanently deletes your profile and all progress. This cannot be undone.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmCancel(null)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 0", fontSize: 13, color: C.mid, cursor: "pointer" }}>Cancel</button>
              <button
                disabled={deleteLoading}
                onClick={async () => { setDeleteLoading(true); await onDeleteAccount(); }}
                style={{ flex: 1, background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: deleteLoading ? 0.6 : 1 }}>
                {deleteLoading ? "Deleting…" : "Yes, delete my account"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmCancel("delete")}
            style={{ background: "none", border: `1px solid ${C.red}60`, color: C.red, borderRadius: 10, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Delete account
          </button>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [hiddenQIds, setHiddenQIds] = useState(new Set());
  const [page, setPage] = useState("home");
  const [tab, setTab] = useState("thisweek");
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(null);
  const [syllabus, setSyllabus] = useState("O-Elective");
  const [freeCount, setFreeCount] = useState(0);
  const [records, setRecords] = useState([]);
  const [filterC, setFilterC] = useState("All");
  const [filterS, setFilterS] = useState("All");
  const [session, setSession] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [devUserIndex, setDevUserIndex] = useState(2);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingInitData, setOnboardingInitData] = useState(null);
  const [onboardingInitStep, setOnboardingInitStep] = useState(1);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [showSessionComplete, setShowSessionComplete] = useState(false);
  const [showTopicUpdate, setShowTopicUpdate] = useState(false);
  const [signupPrompt, setSignupPrompt] = useState(null); // "completed" | "returning" | "progress" | null
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [showConclusion, setShowConclusion] = useState(false);
  const [extensionQuestions, setExtensionQuestions] = useState([]);
  const profileLoadedRef = useRef(false);
  const activeBank = useMemo(() => QUESTION_BANK.filter(q => !hiddenQIds.has(q.id)), [hiddenQIds]);

  const switchDevUser = useCallback((dir) => {
    const next = (devUserIndex + dir + DEV_USERS.length) % DEV_USERS.length;
    setDevUserIndex(next);
    const mock = DEV_USERS[next];
    setUser(mock.tier === null ? null : mock);
    setSyllabus(mock.syllabus || "O-Elective");
    setPage("app");
    setTab("thisweek");
    setSession(null);
    setRecords([]);
    setShowConclusion(false);
    // Generate a fresh session for the new profile
    const newSess = generateSession(mock.tier !== null ? mock : null, [], activeBank, null, []);
    setSession(newSess);
  }, [devUserIndex]);

  const loadProfile = useCallback(async (supabaseUser) => {
    // Guard: only run once per session — prevents double-fire from getSession + onAuthStateChange
    if (profileLoadedRef.current) return;
    profileLoadedRef.current = true;

    // Fetch hidden question IDs first — must be resolved before session generation
    const { data: hiddenRows, error: hiddenErr } = await supabase.from("questions").select("id").eq("hidden", true);
    if (hiddenErr) console.warn("[Unpack] hidden fetch error:", hiddenErr.message);
    const freshHiddenIds = new Set((hiddenRows || []).map(q => q.id));
    if (freshHiddenIds.size) setHiddenQIds(freshHiddenIds);
    const visibleBank = QUESTION_BANK.filter(q => !freshHiddenIds.has(q.id));

    const u = await sg("gm4_user");
    const r = await sg("gm4_records"); if (r) setRecords(r);
    const f = await sg("gm4_free"); if (typeof f === "number") setFreeCount(f);
    const sy = await sg("gm4_syllabus"); if (sy) setSyllabus(sy);
    const cs = await sg("gm4_completed_sessions"); if (cs) setCompletedSessions(cs);

    // Fetch Supabase profile — authoritative for tier and onboarding state
    const { data: sbProfile } = await supabase.from("profiles")
      .select("tier, name, syllabus, year, school, topics_covered, exam_type, onboarding_complete")
      .eq("id", supabaseUser.id).single();

    // Merge: Supabase wins for tier; localStorage has session/records
    const effectiveUser = u
      ? { ...u, tier: sbProfile?.tier ?? u.tier, onboardingComplete: sbProfile?.onboarding_complete ?? u.onboardingComplete }
      : sbProfile?.onboarding_complete
        ? {
          name: sbProfile.name || "Student",
          email: supabaseUser.email || "",
          tier: sbProfile.tier || "free-account",
          syllabus: sbProfile.syllabus || "O-Elective",
          year: sbProfile.year || ONBOARDING_DEFAULTS.year,
          school: sbProfile.school || "",
          topicsCovered: sbProfile.topics_covered || ONBOARDING_DEFAULTS.topicsCovered,
          examType: sbProfile.exam_type || ONBOARDING_DEFAULTS.examType,
          examDate: null, previousExamDate: null, sessionResetDay: 1, onboardingComplete: true,
        }
        : null;

    if (effectiveUser) {
      if (effectiveUser.tier !== u?.tier) await ss("gm4_user", effectiveUser); // sync tier to localStorage
      setUser(effectiveUser);
      if (!effectiveUser.onboardingComplete) {
        const draft = await sg("gm4_onboarding_draft");
        if (draft) { setOnboardingInitData(draft.data); setOnboardingInitStep(draft.step); }
        setShowOnboarding(true);
        return;
      }
      const effectiveSyl = sbProfile?.syllabus || sy || "O-Elective";
      setSyllabus(effectiveSyl);
      const existingSess = await sg("gm4_session");
      const currentWeek = getWeekStart();
      if (!existingSess || existingSess.weekStart !== currentWeek) {
        const newSess = generateSession({ ...effectiveUser, syllabus: effectiveSyl }, r || [], visibleBank, existingSess, cs || []);
        setSession(newSess);
        await ss("gm4_session", newSess);
      } else {
        // Strip any hidden questions from the cached session
        const filtered = freshHiddenIds.size
          ? { ...existingSess, questions: existingSess.questions.filter(id => !freshHiddenIds.has(id)) }
          : existingSess;
        setSession(filtered);
        if (filtered !== existingSess) await ss("gm4_session", filtered);
      }
      setPage("app");
    } else {
      // No profile anywhere — start onboarding
      const draft = await sg("gm4_onboarding_draft");
      if (draft) {
        setOnboardingInitData(draft.data);
        setOnboardingInitStep(draft.step);
      } else {
        setOnboardingInitStep(2);
        setOnboardingInitData({ email: supabaseUser?.email || "", name: supabaseUser?.user_metadata?.name || "" });
      }
      setShowOnboarding(true);
    }
  }, []);


  useEffect(() => {
    if (DEV_MODE) {
      setUser(DEV_USERS[2]);
      setPage("app");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) loadProfile(session.user);
      if (event === "SIGNED_OUT") {
        profileLoadedRef.current = false;
        setUser(null);
        setRecords([]);
        setSession(null);
        setFreeCount(0);
        setPage("home");
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const handleAttempt = useCallback(async (record) => {
    const updated = [...records, record];
    setRecords(updated);
    await ss("gm4_records", updated);

    // Start session timer on first attempt of a session question
    if (!sessionStartTime && session?.questions?.includes(record.questionId)) {
      setSessionStartTime(Date.now());
    }

    if (!user) {
      const n = freeCount + 1;
      setFreeCount(n);
      await ss("gm4_free", n);
      const freeQIds = activeBank.filter(q => q.tier === "free" && !needsFigure(q) && q.syllabus.includes(syllabus || "O-Elective")).map(q => q.id);
      const allAttemptedNow = freeQIds.every(id => id === record.questionId || records.some(r => r.questionId === id));
      if (allAttemptedNow) setSignupPrompt("completed");
    }

    let updatedSess = session;

    // Mark complete in session when L3 reached
    if (record.parsed?.markBand === "L3" && session && !session.completed.includes(record.questionId)) {
      updatedSess = { ...session, completed: [...session.completed, record.questionId] };
      setSession(updatedSess);
      await ss("gm4_session", updatedSess);
    }

    // Detect when all session questions have been attempted (at least once)
    if (session && !session.allAttempted) {
      const allAttempted = session.questions.every(
        qId => qId === record.questionId || updated.some(r => r.questionId === qId)
      );
      if (allAttempted) {
        const completedEntry = {
          weekStart: session.weekStart,
          theme: session.theme,
          questionsAttempted: session.questions.length,
          isBenchmark: session.isBenchmark || false,
          isCheckin: session.isCheckin || false,
          timestamp: Date.now(),
        };
        const newCS = [...completedSessions, completedEntry];
        setCompletedSessions(newCS);
        await ss("gm4_completed_sessions", newCS);
        const finalSess = { ...(updatedSess || session), allAttempted: true };
        setSession(finalSess);
        await ss("gm4_session", finalSess);
        setSessionEndTime(Date.now());
        setShowConclusion(true);
      }
    }
  }, [records, user, freeCount, session, completedSessions]);

  const handleAuth = async (userData) => {
    setUser(userData);
    await ss("gm4_user", userData);
    setAuth(null);
    // Redirect to onboarding if not complete (e.g. returning user who abandoned)
    if (!userData.onboardingComplete) {
      const draft = await sg("gm4_onboarding_draft");
      if (draft) { setOnboardingInitData(draft.data); setOnboardingInitStep(draft.step); }
      setShowOnboarding(true);
      return;
    }
    // Generate session for signed-in user
    const existingSess = await sg("gm4_session");
    const cs = await sg("gm4_completed_sessions");
    const newSess = generateSession({ ...userData, syllabus }, records, activeBank, existingSess, cs || []);
    setSession(newSess);
    await ss("gm4_session", newSess);
    setPage("app");
    setTab("thisweek");
  };

  const handleOnboardingComplete = async (onboardingData) => {
    const sylId = onboardingData.syllabus || ONBOARDING_DEFAULTS.syllabus;
    const userData = {
      name: onboardingData.name || "Student",
      email: onboardingData.email || "",
      tier: onboardingData.tier === "basic" ? "basic" : onboardingData.tier === "plus" ? "plus" : "free-account",
      syllabus: sylId,
      year: onboardingData.year || ONBOARDING_DEFAULTS.year,
      school: onboardingData.school || "",
      topicsCovered: onboardingData.topicsCovered || ONBOARDING_DEFAULTS.topicsCovered,
      examType: onboardingData.examType || ONBOARDING_DEFAULTS.examType,
      examDate: null,
      previousExamDate: null,
      sessionResetDay: 1,
      onboardingComplete: true,
    };
    setUser(userData);
    setSyllabus(sylId);
    await ss("gm4_user", userData);
    await ss("gm4_syllabus", sylId);
    await ss("gm4_onboarding_draft", null);
    // Persist profile to Supabase so tier survives across devices
    const { data: { session: authSess } } = await supabase.auth.getSession();
    if (authSess?.user?.id) {
      await supabase.from("profiles").upsert({
        id: authSess.user.id,
        tier: userData.tier,
        name: userData.name,
        syllabus: userData.syllabus,
        year: userData.year,
        school: userData.school,
        topics_covered: userData.topicsCovered,
        exam_type: userData.examType,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      });
    }
    const newSess = generateSession({ ...userData, syllabus: sylId }, records, activeBank, null, []);
    setSession(newSess);
    await ss("gm4_session", newSess);
    setShowOnboarding(false);
    setPage("app");
    setTab("thisweek");
  };

  const handleUserUpdate = async (updatedUser) => {
    setUser(updatedUser);
    await ss("gm4_user", updatedUser);
    // Regenerate session with new exam date
    const newSess = generateSession({ ...updatedUser, syllabus }, records, activeBank, null, completedSessions);
    setSession(newSess);
    await ss("gm4_session", newSess);
  };

  const handleTopicSave = async (newTopics) => {
    const updatedUser = { ...user, topicsCovered: newTopics, lastTopicUpdate: Date.now() };
    setUser(updatedUser);
    await ss("gm4_user", updatedUser);

    // Regenerate session with updated topics (paid users only — free pool is fixed by syllabus)
    const isPaid = updatedUser.tier === "basic" || updatedUser.tier === "plus";
    if (isPaid) {
      const newSession = generateSession(updatedUser, records, activeBank, null, completedSessions);
      if (newSession) {
        setSession(newSession);
        await ss("gm4_session", newSession);
      }
    }

    setShowTopicUpdate(false);
    setShowSessionComplete(false);
  };

  const updateUserSyllabus = async (newSyllabus) => {
    const updatedUser = { ...user, syllabus: newSyllabus };
    setUser(updatedUser);
    setSyllabus(newSyllabus);
    await ss("gm4_user", updatedUser);
    await ss("gm4_syllabus", newSyllabus);
    const newSess = generateSession(updatedUser, records, activeBank, null, completedSessions);
    setSession(newSess);
    await ss("gm4_session", newSess);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT clears state and redirects to home
  };

  const handleUpgrade = () => { if (!BETA_MODE) alert("Production: redirect to Stripe checkout.\nBasic=$12.90/mo, Plus=$15.90/mo"); };

  const handleChangeTier = async (newTier) => {
    const updatedUser = { ...user, tier: newTier };
    setUser(updatedUser);
    await ss("gm4_user", updatedUser);
    await supabase.from("profiles").update({ tier: newTier }).eq("id", (await supabase.auth.getUser()).data.user?.id);
  };

  const handleDeleteAccount = async () => {
    const sbUser = (await supabase.auth.getUser()).data.user;
    if (sbUser) await supabase.from("profiles").delete().eq("id", sbUser.id);
    // Clear all local data
    for (const k of ["gm4_user","gm4_records","gm4_free","gm4_session","gm4_syllabus","gm4_completed_sessions","gm4_onboarding_draft"]) localStorage.removeItem(k);
    await supabase.auth.signOut();
  };

  const tier = user?.tier || null;
  const syl = SYLLABUSES[syllabus] || SYLLABUSES["O-Elective"];
  const isFreeAccount = !tier || tier === "free-account";

  const examDate = user?.examDate ? new Date(user.examDate) : null;
  const today = new Date();
  const daysToExam = examDate ? Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)) : null;
  const examMode = daysToExam !== null && daysToExam <= 14;

  const freeQs = activeBank.filter(q => q.tier === "free" && q.syllabus.includes(syllabus));
  const paidQs = activeBank.filter(q =>
    (examMode || q.tier === "paid") && q.syllabus.includes(syllabus)
    && (filterC === "All" || q.cluster === filterC) && (filterS === "All" || q.skill === filterS));

  const TABS = [
    { id: "thisweek", label: "This Week" },
    { id: "dashboard", label: "Dashboard" },
    { id: "practice", label: "Practice" },
    { id: "account", label: "Account" },
  ];

  if (page === "home") return (
    <><GlobalStyles />
      <div style={{ background: C.deepBg }}>
        {/* Landing nav — overlaid on dark green hero */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 60, position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(13,43,31,0.9)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.borderOnDark}` }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18, color: C.textOnDark }}>Unpack</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {user ? (
              <>
                <span style={{ color: C.textOnDark, fontSize: 13, opacity: 0.7 }}>{user.name}</span>
                <button onClick={() => setPage("app")} className="hl" style={{ background: C.coral, border: "none", color: C.deepBg, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700 }}>Go to app →</button>
              </>
            ) : (
              <>
                <button onClick={() => setAuth("signin")} style={{ background: "transparent", border: `1px solid ${C.borderOnDark}`, color: C.textOnDark, borderRadius: 8, padding: "6px 16px", fontSize: 13, opacity: 0.8 }}>Sign in</button>
                <button onClick={() => setShowOnboarding(true)} className="hl" style={{ background: C.coral, border: "none", color: C.deepBg, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700 }}>Sign up free</button>
              </>
            )}
          </div>
        </header>
        {/* pt-[60px] to clear fixed nav */}
        <div style={{ paddingTop: 60 }}>
          <Landing onStart={() => { setPage("app"); setTab("thisweek"); }} onSignup={() => setShowOnboarding(true)} />
        </div>
        {auth && <AuthModal initMode={auth} onClose={() => setAuth(null)} onSignup={() => { setAuth(null); setShowOnboarding(true); }} />}
        {showOnboarding && <Onboarding initialData={onboardingInitData} initialStep={onboardingInitStep} onComplete={handleOnboardingComplete} onClose={() => setShowOnboarding(false)} tier={user?.tier} />}
      </div></>
  );

  return (
    <><GlobalStyles />
      <div style={{ minHeight: "100vh", background: C.bg }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 60, background: "rgba(13,43,31,0.95)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.borderOnDark}`, position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setPage("home")}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18, color: C.textOnDark }}>Unpack</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {user ? (
              <>
                <span style={{ color: C.textOnDark, fontSize: 12, display: "flex", alignItems: "center", gap: 6, opacity: 0.7 }}>
                  {user.name}
                  <span style={{ background: C.coral, color: C.deepBg, borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 700, opacity: 1 }}>
                    {tier === "plus" ? "Plus" : tier === "basic" ? "Basic" : "Free"}
                  </span>
                </span>
                <button onClick={() => setShowSettings(true)} style={{ background: "transparent", border: `1px solid ${C.borderOnDark}`, color: C.textOnDark, borderRadius: 8, padding: "5px 10px", fontSize: 12, opacity: 0.8 }}>⚙ Settings</button>
                {!BETA_MODE && tier !== "plus" && <button onClick={handleUpgrade} className="hl" style={{ background: C.coral, border: "none", color: C.deepBg, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700 }}>Upgrade</button>}
                <button onClick={handleLogout} style={{ background: "transparent", border: `1px solid ${C.borderOnDark}`, color: C.textOnDark, borderRadius: 8, padding: "5px 10px", fontSize: 11, opacity: 0.7 }}>Sign out</button>
              </>
            ) : (
              <>
                <button onClick={() => setAuth("signin")} style={{ background: "transparent", border: `1px solid ${C.borderOnDark}`, color: C.textOnDark, borderRadius: 8, padding: "6px 16px", fontSize: 13, opacity: 0.8 }}>Sign in</button>
                <button onClick={() => setShowOnboarding(true)} className="hl" style={{ background: C.coral, border: "none", color: C.deepBg, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 700 }}>Sign up free</button>
              </>
            )}
          </div>
        </header>


        <div style={{ maxWidth: tab === "thisweek" ? 1100 : 860, margin: "0 auto", padding: tab === "thisweek" ? "24px 0" : "24px 14px", background: (tab === "thisweek" && showConclusion) ? C.deepBg : undefined, minHeight: (tab === "thisweek" && showConclusion) ? "calc(100vh - 56px)" : undefined }}>
          {/* Free users — whole screen, no tab bar */}
          {(tier === null || tier === "free-account") ? (
            <FreeSessionView session={session} syllabus={syllabus} onAttempt={handleAttempt} user={user} onSignup={tier === null ? () => setShowOnboarding(true) : handleUpgrade} records={records} allQuestions={activeBank} />
          ) : (
            <>
              {/* Tab bar — hidden during session conclusion */}
              <div style={{ display: showConclusion ? "none" : "flex", gap: 2, marginBottom: 22, background: "#fff", borderRadius: 12, padding: 4, border: `1px solid ${C.border}` }}>
                {TABS.map(t => {
                  const locked = t.req && !canAccess(tier, t.req);
                  return (
                    <button key={t.id} onClick={() => { if (locked) { setAuth(tier ? "upgrade" : "signup"); return; } setTab(t.id); }}
                      style={{
                        flex: 1, background: tab === t.id ? C.coral : "transparent",
                        color: tab === t.id ? "#fff" : locked ? C.light : C.mid,
                        border: "none", borderRadius: 9, padding: "8px 6px",
                        fontSize: 12, fontWeight: tab === t.id ? 700 : 500, transition: "all 0.15s"
                      }}>
                      {t.label}{locked ? " 🔒" : ""}
                    </button>
                  );
                })}
              </div>

              {/* THIS WEEK */}
              {tab === "thisweek" && (
                showConclusion ? (
                  <SessionConclusion
                    session={session}
                    records={records}
                    sessionStartTime={sessionStartTime}
                    sessionEndTime={sessionEndTime}
                    user={user}
                    onGoToDashboard={() => { setShowConclusion(false); setTab("dashboard"); }}
                    onGoBonusQuestions={() => { setShowConclusion(false); setTab("practice"); }}
                    onStartExtension={(qs) => { setShowConclusion(false); setExtensionQuestions(qs); setTab("practice"); }}
                    allQuestions={activeBank}
                  />
                ) : canAccess(tier, "basic") ? (
                  <ThisWeekTab session={session} syllabus={syllabus} onAttempt={handleAttempt} user={user} onUpgrade={handleUpgrade} onSettings={() => setShowSettings(true)} onUpdateTopics={() => setShowTopicUpdate(true)} onFinish={() => setTab("dashboard")} records={records} />
                ) : (
                  <UpgradePrompt reason="Upgrade to Basic to access weekly sessions" onSignup={() => setShowOnboarding(true)} onUpgrade={handleUpgrade} userTier={tier} />
                )
              )}

              {/* DASHBOARD */}
              {tab === "dashboard" && <Dashboard records={records} currentSession={session} user={user} completedSessions={completedSessions} />}

              {/* PRACTICE */}
              {tab === "practice" && (
                <PracticeTab
                  user={user}
                  records={records}
                  currentSession={session}
                  syllabus={syllabus}
                  onAttempt={handleAttempt}
                  onUpgrade={handleUpgrade}
                  onSignup={() => setShowOnboarding(true)}
                  allQuestions={activeBank}
                />
              )}

              {/* ACCOUNT */}
              {tab === "account" && (
                <AccountTab
                  user={user}
                  tier={tier}
                  syllabus={syllabus}
                  onEditTopics={() => setShowTopicUpdate(true)}
                  onSettings={() => setShowSettings(true)}
                  onUpgrade={handleUpgrade}
                  onChangeTier={handleChangeTier}
                  onDeleteAccount={handleDeleteAccount}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}
        </div>

        {signupPrompt && <SignupPromptModal type={signupPrompt} onSignup={() => { setSignupPrompt(null); setShowOnboarding(true); }} onClose={() => setSignupPrompt(null)} />}
        {auth && auth !== "upgrade" && <AuthModal initMode={auth} onClose={() => setAuth(null)} />}
        {showSettings && user && <AccountSettings user={user} onUpdate={handleUserUpdate} onSyllabusChange={updateUserSyllabus} onClose={() => setShowSettings(false)} />}
        {showOnboarding && <Onboarding initialData={onboardingInitData} initialStep={onboardingInitStep} onComplete={handleOnboardingComplete} tier={user?.tier} />}
        {showSessionComplete && (
          <SessionCompletePrompt
            completedCount={session?.questions?.length || 0}
            gapsFixed={session?.completed?.length || 0}
            onUpdateTopics={() => { setShowSessionComplete(false); setShowTopicUpdate(true); }}
            onDismiss={() => setShowSessionComplete(false)}
          />
        )}
        {showTopicUpdate && user && (
          <TopicUpdateModal
            user={user}
            syllabus={syllabus}
            onSave={handleTopicSave}
            onClose={() => setShowTopicUpdate(false)}
          />
        )}

        {DEV_MODE && (
          <div style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 9999,
            background: "#1a1a2e", color: "#ffffff", borderRadius: 12,
            padding: "12px 16px", fontSize: 12, fontFamily: "monospace",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)", minWidth: 200,
          }}>
            <div style={{ color: "#ff6b35", fontWeight: 700, marginBottom: 8, fontSize: 11, letterSpacing: "0.08em" }}>
              🛠 DEV MODE
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
              {DEV_USERS.map((u, i) => (
                <button key={u.id} onClick={() => switchDevUser(i - devUserIndex)} style={{
                  background: i === devUserIndex ? "#ff6b35" : "#2a2a4a",
                  color: "#ffffff", border: "none", borderRadius: 6,
                  padding: "5px 10px", fontSize: 11, cursor: "pointer",
                  fontWeight: i === devUserIndex ? 700 : 400, textAlign: "left",
                }}>
                  {i === devUserIndex ? "▶ " : "  "}{u.name}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, borderTop: "1px solid #2a2a4a", paddingTop: 8 }}>
              <button onClick={() => { setOnboardingInitData(null); setOnboardingInitStep(1); setShowOnboarding(true); }} style={{
                width: "100%", background: "#2a2a4a", color: "#ff6b35", border: "none",
                borderRadius: 6, padding: "5px 0", fontSize: 11, cursor: "pointer", marginBottom: 8, fontWeight: 700,
              }}>▶ Preview onboarding</button>
            </div>
            <div style={{ borderTop: "1px solid #2a2a4a", paddingTop: 8, marginTop: 6 }}>
              <button onClick={async () => {
                await ss("gm4_session", null);
                await ss("gm4_completed_sessions", null);
                setSession(null);
                setCompletedSessions([]);
                const newSess = generateSession(user, records, activeBank, null, []);
                setSession(newSess);
                await ss("gm4_session", newSess);
              }} style={{
                width: "100%", background: "#2a2a4a", color: "#ff6b35",
                border: "none", borderRadius: 6, padding: "5px 0",
                fontSize: 11, cursor: "pointer", marginBottom: 8, fontWeight: 700,
              }}>🔄 Reset + Regenerate Session</button>
            </div>
            <div style={{ borderTop: "1px solid #2a2a4a", paddingTop: 8, marginTop: 6 }}>
              <div style={{ color: "#8a8aaa", fontSize: 10, marginBottom: 6 }}>CONCLUSION SCREEN</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button onClick={() => {
                  const now = Date.now();
                  setSessionStartTime(now - 25 * 60 * 1000);
                  setSessionEndTime(now);
                  setShowConclusion(true);
                  setTab("thisweek");
                }} style={{
                  background: "#2a2a4a", color: "#ffffff",
                  border: "none", borderRadius: 6, padding: "4px 8px",
                  fontSize: 10, cursor: "pointer"
                }}>🏁 25 min</button>
                <button onClick={() => {
                  const now = Date.now();
                  setSessionStartTime(now - 15 * 60 * 1000);
                  setSessionEndTime(now);
                  setShowConclusion(true);
                  setTab("thisweek");
                }} style={{
                  background: "#2a2a4a", color: "#ffffff",
                  border: "none", borderRadius: 6, padding: "4px 8px",
                  fontSize: 10, cursor: "pointer"
                }}>⚡ 15 min</button>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #2a2a4a", paddingTop: 8 }}>
              <div style={{ color: "#8a8aaa", fontSize: 10, marginBottom: 6 }}>SESSION OVERRIDES</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[
                  { label: "Fresh", weekOffset: 0 },
                  { label: "Carry-over", weekOffset: -7 },
                  { label: "Expired", weekOffset: -14 },
                ].map(({ label, weekOffset }) => (
                  <button key={label} onClick={async () => {
                    const d = new Date();
                    d.setDate(d.getDate() + weekOffset);
                    const fakeStart = d.toISOString().split("T")[0];
                    const fakeSession = {
                      weekStart: fakeStart,
                      questions: ["q1", "q3", "q4"],
                      completed: [],
                      carriedOver: weekOffset === -7,
                      expired: weekOffset === -14,
                      examMode: false,
                    };
                    await ss("gm4_session", fakeSession);
                    window.location.reload();
                  }} style={{
                    background: "#2a2a4a", color: "#ffffff",
                    border: "none", borderRadius: 6, padding: "4px 8px",
                    fontSize: 10, cursor: "pointer"
                  }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div></>
  );
}
