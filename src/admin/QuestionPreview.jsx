import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { runEvalPipeline, isLormQuestion } from '../lib/evalEngine.js';

const SYLLABUSES = ['O-Elective', 'O-Pure', 'N-Elective', 'N-Pure'];
const SYL_META = {
  'O-Elective': { label: 'O-Level Elective Geography', code: 'Syllabus 2260' },
  'O-Pure':     { label: 'O-Level Pure Geography',     code: 'Syllabus 2279' },
  'N-Elective': { label: 'N(A)-Level Elective Geography', code: 'Syllabus 2125' },
  'N-Pure':     { label: 'N(A)-Level Pure Geography',  code: 'Syllabus 2246' },
};

const LORM_RANGES = { 9: { L1: '1–3', L2: '4–6', L3: '7–9' }, 6: { L1: '1–2', L2: '3–4', L3: '5–6' } };

const C = {
  bg: '#faf9f6', card: '#ffffff', coral: '#ff6b35', coralL: '#fff0ea',
  text: '#1a1a2e', mid: '#4a4a6a', light: '#8a8aaa',
  border: '#e8e6e0', borderM: '#c8c4bc',
  green: '#2d7a4f', greenL: '#e6f4ed',
  amber: '#c17f24', amberL: '#fef3dc',
  red: '#c0392b', redL: '#fdecea',
  // Admin sidebar uses dark theme
  dark: '#0c0c0e', darkSurface: '#16161a', darkSurface2: '#1e1e24',
  darkBorder: '#2a2a34', darkBorder2: '#34343f',
  darkText: '#e2e2ee', darkText2: '#9090b0', darkText3: '#5a5a7a',
  accent: '#6c5ce7',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function BandPill({ band, marksAwarded, totalMarks }) {
  const lorm = isLormQuestion(totalMarks);
  const colors = {
    L1: { bg: C.redL, color: C.red },
    L2: { bg: C.amberL, color: C.amber },
    L3: { bg: C.greenL, color: C.green },
  };
  const s = colors[band] || colors.L1;
  if (lorm) {
    const range = LORM_RANGES[totalMarks]?.[band];
    return <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{band}{range ? ` · ${range}/${totalMarks}m` : ''}</span>;
  }
  if (marksAwarded !== null && marksAwarded !== undefined && totalMarks) {
    const ratio = marksAwarded / totalMarks;
    const sc = ratio >= 0.75 ? colors.L3 : ratio >= 0.4 ? colors.L2 : colors.L1;
    return <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{marksAwarded}/{totalMarks}m</span>;
  }
  return <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{band}</span>;
}

function FeedbackPanel({ feedback, attemptNum, parsed }) {
  if (!feedback) return null;
  return (
    <div style={{ marginTop: 16, background: C.bg, borderLeft: `4px solid ${C.coral}`, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, fontSize: 14, lineHeight: 1.75, color: C.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: C.coral, fontSize: 14 }}>🎯 Feedback · Attempt {attemptNum}</span>
        {parsed && <BandPill band={parsed.markBand} marksAwarded={parsed.marksAwarded} totalMarks={parsed.totalMarks} />}
      </div>
      {feedback.split('\n').map((line, i) => {
        if (line.startsWith("MARK BAND:")) return <div key={i} style={{ background: C.coralL, borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontWeight: 700, color: C.coral, fontSize: 13 }}>{line}</div>;
        if (line.startsWith("WHAT'S HOLDING YOU BACK:")) return <div key={i} style={{ background: C.amberL, borderRadius: 8, padding: '7px 12px', marginBottom: 10, fontWeight: 600, color: C.amber, fontSize: 13 }}>⚠️ {line.replace("WHAT'S HOLDING YOU BACK:", "").trim()}</div>;
        if (line.startsWith("WHAT YOU DID WELL:")) return <div key={i} style={{ fontWeight: 700, color: C.green, fontSize: 13, marginTop: 10, marginBottom: 3 }}>✅ What you did well</div>;
        if (line.startsWith("WHAT TO FIX:")) return <div key={i} style={{ fontWeight: 700, color: C.amber, fontSize: 13, marginTop: 14, marginBottom: 3 }}>🔧 What to fix</div>;
        if (line.startsWith("YOUR NEXT STEP:")) return <div key={i} style={{ fontWeight: 700, color: C.coral, fontSize: 13, marginTop: 14, marginBottom: 3 }}>👉 Your next step</div>;
        if (line === '---') return <hr key={i} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />;
        if (!line.trim()) return <div key={i} style={{ height: 5 }} />;
        if (line.includes('**')) {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return <div key={i} style={{ color: C.mid }}>{parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p)}</div>;
        }
        return <div key={i} style={{ color: C.mid }}>{line}</div>;
      })}
      {parsed?.totalGaps > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.light, letterSpacing: '0.06em', marginBottom: 6 }}>PROGRESS</div>
          {parsed.positives?.map((p, i) => <div key={i} style={{ fontSize: 13, color: C.green, marginBottom: 3, display: 'flex', gap: 6 }}><span>✓</span><span>{p}</span></div>)}
          {parsed.currentGap && <div style={{ fontSize: 13, color: C.coral, fontWeight: 600, display: 'flex', gap: 6 }}><span>→</span><span>{parsed.currentGap}</span></div>}
        </div>
      )}
    </div>
  );
}

// ── Image lightbox ─────────────────────────────────────────────────────────

function ImageModal({ url, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
      <img src={url} onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, cursor: 'default' }} />
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: 'white', fontSize: 28, cursor: 'pointer' }}>×</button>
    </div>
  );
}

// ── Question attempt card ──────────────────────────────────────────────────

function AttemptCard({ q, syllabus }) {
  const [answer, setAnswer] = useState('');
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const figures = Array.isArray(q.figures) ? q.figures : [];
  const syl = SYL_META[syllabus] || SYL_META['O-Elective'];

  const submit = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);
    try {
      const { fb, parsed } = await runEvalPipeline({ q, syl, answer });
      setAttempts(prev => [...prev, { feedback: fb, parsed, answerText: answer }]);
    } catch (err) {
      setAttempts(prev => [...prev, { feedback: `Error: ${err.message}`, parsed: null, answerText: answer }]);
    }
    setLoading(false);
  };

  return (
    <div>
      {lightboxUrl && <ImageModal url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* Question text */}
      <div style={{ fontSize: 15, lineHeight: 1.7, color: C.text, marginBottom: 14 }}>
        {q.question}
        <span style={{ marginLeft: 8, color: C.coral, fontWeight: 700 }}>[{q.marks}]</span>
      </div>

      {/* Context */}
      {q.context && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.mid, marginBottom: 12 }}>
          {q.context}
        </div>
      )}

      {/* Figures */}
      {figures.length > 0 && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {figures.map((f, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <img
                src={f.url} alt={f.path}
                onClick={() => setLightboxUrl(f.url)}
                style={{ maxWidth: 320, maxHeight: 220, borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'zoom-in', display: 'block' }}
              />
              {q.figure_caption && <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>{q.figure_caption}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Previous attempts */}
      {attempts.map((a, i) => (
        <div key={i}>
          <div style={{ fontSize: 12, color: C.light, marginTop: i > 0 ? 16 : 0, marginBottom: 4 }}>
            Attempt {i + 1}:
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.mid, marginBottom: 4, whiteSpace: 'pre-wrap' }}>
            {a.answerText}
          </div>
          <FeedbackPanel feedback={a.feedback} attemptNum={i + 1} parsed={a.parsed} />
        </div>
      ))}

      {/* Answer input */}
      <div style={{ marginTop: attempts.length > 0 ? 16 : 0 }}>
        {attempts.length > 0 && <div style={{ fontSize: 12, color: C.light, marginBottom: 4 }}>Attempt {attempts.length + 1}:</div>}
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Type your answer here…"
          rows={5}
          style={{ width: '100%', border: `1.5px solid ${C.borderM}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, color: C.text, resize: 'vertical', lineHeight: 1.6, background: C.card }}
        />
        <button
          onClick={submit}
          disabled={!answer.trim() || loading}
          style={{
            marginTop: 8, background: loading || !answer.trim() ? C.borderM : C.coral,
            color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px',
            fontSize: 13, fontWeight: 700, cursor: loading || !answer.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analysing…' : attempts.length > 0 ? 'Resubmit' : 'Submit'}
        </button>
        {attempts.length > 0 && (
          <button
            onClick={() => { setAttempts([]); setAnswer(''); }}
            style={{ marginTop: 8, marginLeft: 8, background: 'none', border: `1px solid ${C.borderM}`, borderRadius: 8, padding: '9px 16px', fontSize: 13, color: C.mid, cursor: 'pointer' }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function QuestionPreview() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [syllabus, setSyllabus] = useState('O-Elective');
  const [fCluster, setFCluster] = useState('');
  const [fSkill, setFSkill] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('questions').select('*').eq('hidden', false).order('id').then(({ data }) => {
      setLoading(false);
      setQuestions(data || []);
    });
  }, []);

  const clusters = [...new Set(questions.map(q => q.cluster).filter(Boolean))].sort();
  const skills = [...new Set(questions.map(q => q.skill).filter(Boolean))].sort();

  const filtered = questions.filter(q => {
    const inSyl = !q.syllabus || q.syllabus.includes(syllabus);
    if (!inSyl) return false;
    if (fCluster && q.cluster !== fCluster) return false;
    if (fSkill && q.skill !== fSkill) return false;
    if (search) {
      const hay = [q.id, q.question, q.topic, q.cluster].join(' ').toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const grouped = {};
  filtered.forEach(q => {
    const c = q.cluster || 'Other';
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(q);
  });

  const selectedQ = questions.find(q => q.id === selected);

  const selStyle = {
    background: C.darkSurface2, border: `1px solid ${C.darkBorder2}`, color: C.darkText,
    padding: '6px 10px', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: C.dark, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; } @keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 24px', background: C.darkSurface, borderBottom: `1px solid ${C.darkBorder}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.5px', color: C.darkText }}>
          Un<span style={{ color: C.accent }}>pack</span>
        </div>
        <div style={{ width: 1, height: 18, background: C.darkBorder2 }} />
        <div style={{ fontSize: 12, color: C.darkText3 }}>Question Preview</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/admin" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 600, padding: '5px 10px', border: `1px solid ${C.darkBorder2}`, borderRadius: 6 }}>
            ← Admin
          </a>
          <span style={{ fontSize: 11, color: C.darkText3 }}>Syllabus:</span>
          <select value={syllabus} onChange={e => { setSyllabus(e.target.value); setSelected(null); }} style={selStyle}>
            {SYLLABUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fCluster} onChange={e => { setFCluster(e.target.value); setSelected(null); }} style={selStyle}>
            <option value="">All clusters</option>
            {clusters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fSkill} onChange={e => { setFSkill(e.target.value); setSelected(null); }} style={selStyle}>
            <option value="">All skills</option>
            {skills.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ position: 'relative' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ background: C.darkSurface2, border: `1px solid ${C.darkBorder2}`, color: C.darkText, padding: '6px 10px', borderRadius: 6, fontSize: 12, outline: 'none', width: 160 }}
            />
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Sidebar */}
        <aside style={{ width: 280, background: C.darkSurface, borderRight: `1px solid ${C.darkBorder}`, overflowY: 'auto', flexShrink: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.darkText3, fontSize: 12 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.darkText3, fontSize: 12 }}>No visible questions.</div>
          ) : Object.entries(grouped).map(([cluster, qs]) => (
            <div key={cluster}>
              <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: C.darkText3, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${C.darkBorder}` }}>
                {cluster} · {qs.length}
              </div>
              {qs.map(q => (
                <div
                  key={q.id}
                  onClick={() => setSelected(q.id)}
                  style={{
                    padding: '10px 16px', cursor: 'pointer', borderBottom: `1px solid ${C.darkBorder}`,
                    background: selected === q.id ? C.darkSurface2 : 'transparent',
                    borderLeft: selected === q.id ? `3px solid ${C.accent}` : '3px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.darkText3 }}>{q.id}</span>
                    <span style={{ fontSize: 10, background: C.darkSurface2, color: C.darkText3, borderRadius: 3, padding: '1px 5px', marginLeft: 'auto' }}>{q.skill}</span>
                    <span style={{ fontSize: 10, color: C.accent, fontWeight: 700 }}>{q.marks}m</span>
                  </div>
                  <div style={{ fontSize: 12, color: selected === q.id ? C.darkText : C.darkText2, lineHeight: 1.4 }}>
                    {q.question.length > 80 ? q.question.slice(0, 80) + '…' : q.question}
                  </div>
                  {Array.isArray(q.figures) && q.figures.length > 0 && (
                    <div style={{ fontSize: 10, color: C.accent, marginTop: 3 }}>📷 {q.figures.length} figure{q.figures.length > 1 ? 's' : ''}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* Main panel */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 32, background: C.bg }}>
          {!selectedQ ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.light, gap: 8 }}>
              <div style={{ fontSize: 32 }}>←</div>
              <div style={{ fontSize: 14 }}>Select a question to attempt it</div>
              <div style={{ fontSize: 12 }}>{filtered.length} visible question{filtered.length !== 1 ? 's' : ''} in view</div>
            </div>
          ) : (
            <div style={{ maxWidth: 720 }}>
              {/* Question header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.light, background: '#f0ede8', borderRadius: 4, padding: '2px 8px' }}>{selectedQ.id}</span>
                <span style={{ fontSize: 11, background: '#f0ede8', color: C.mid, borderRadius: 4, padding: '2px 8px' }}>{selectedQ.cluster}</span>
                <span style={{ fontSize: 11, background: '#f0ede8', color: C.mid, borderRadius: 4, padding: '2px 8px' }}>{selectedQ.skill}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.coral }}>{selectedQ.marks}m</span>
              </div>

              {/* Re-mount on question change to reset state */}
              <AttemptCard key={selectedQ.id} q={selectedQ} syllabus={syllabus} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
