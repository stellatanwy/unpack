import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const SYLLABUSES = ['O-Elective', 'O-Pure', 'N-Elective', 'N-Pure'];
const SYL_ORDER = ['O-Elective', 'O-Pure', 'N-Elective', 'N-Pure'];

const C = {
  bg: '#0c0c0e', surface: '#16161a', surface2: '#1e1e24', surface3: '#26262e',
  border: '#2a2a34', border2: '#34343f',
  text: '#e2e2ee', text2: '#9090b0', text3: '#5a5a7a',
  accent: '#6c5ce7', accentSoft: 'rgba(108,92,231,0.15)',
  green: '#00b894', greenSoft: 'rgba(0,184,148,0.12)',
  amber: '#fdcb6e', amberSoft: 'rgba(253,203,110,0.12)',
  red: '#e17055', redSoft: 'rgba(225,112,85,0.12)',
  blue: '#74b9ff', blueSoft: 'rgba(116,185,255,0.12)',
};

// ── Toast ──────────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

function ToastContainer({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 999 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: C.surface2, border: `1px solid ${t.type === 'success' ? C.green : C.red}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 12, color: C.text,
          display: 'flex', alignItems: 'center', gap: 8, minWidth: 220,
          animation: 'slideIn 0.2s ease',
        }}>
          <span>{t.type === 'success' ? '✓' : '⚠'}</span> {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function HideToggle({ hidden, onChange }) {
  return (
    <div onClick={onChange} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <div style={{
        width: 34, height: 18, borderRadius: 9,
        background: hidden ? C.redSoft : C.surface3,
        border: `1px solid ${hidden ? C.red : C.border2}`,
        position: 'relative', flexShrink: 0, transition: 'background 0.2s, border-color 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: 2, width: 12, height: 12,
          borderRadius: '50%', background: hidden ? C.red : C.text3,
          transform: hidden ? 'translateX(16px)' : 'none',
          transition: 'transform 0.2s, background 0.2s',
        }} />
      </div>
      <span style={{ fontSize: 11, color: hidden ? C.red : C.text3 }}>{hidden ? 'Hidden' : 'Visible'}</span>
    </div>
  );
}

function SyllabusGrid({ syllabus, onChange }) {
  const active = (syllabus || '').split(' | ').map(s => s.trim()).filter(Boolean);
  const toggle = (syl, checked) => {
    let next = checked ? [...active, syl] : active.filter(s => s !== syl);
    next.sort((a, b) => SYL_ORDER.indexOf(a) - SYL_ORDER.indexOf(b));
    onChange(next.join(' | '));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
      {SYLLABUSES.map(syl => (
        <label key={syl} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: C.text2 }}>
          <input
            type="checkbox"
            checked={active.includes(syl)}
            onChange={e => toggle(syl, e.target.checked)}
            style={{ accentColor: C.accent, width: 14, height: 14, cursor: 'pointer' }}
          />
          {syl}
        </label>
      ))}
    </div>
  );
}

function ImageModal({ url, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
      <img src={url} onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', cursor: 'default' }} />
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: 'white', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>×</button>
    </div>
  );
}

function FigureCell({ figureType, figures, question, figureDescription, figureCaption, context, onChange, onOpenImage }) {
  const needsImage = !!(figureDescription || figureCaption || context ||
    (question && question.toLowerCase().includes('fig')));
  const status = figureType === 'uploaded' ? 'uploaded' : needsImage ? 'needs_image' : 'none';

  const badge = status === 'uploaded'
    ? <span style={{ background: C.greenSoft, color: C.green, padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>✓ Uploaded</span>
    : status === 'needs_image'
      ? <span style={{ background: C.amberSoft, color: C.amber, padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>⚠ Needs image</span>
      : <span style={{ background: C.surface3, color: C.text3, padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>No figure</span>;

  const thumbs = Array.isArray(figures) && figures.length > 0 ? figures : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {badge}
      {thumbs && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {thumbs.map((f, i) => (
            <img
              key={i} src={f.url} alt={f.path}
              onClick={() => onOpenImage(f.url)}
              style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.border2}`, cursor: 'zoom-in' }}
            />
          ))}
        </div>
      )}
      <select
        value={figureType || 'none'}
        onChange={e => onChange(e.target.value)}
        style={{ background: C.bg, border: `1px solid ${C.border2}`, color: C.text, padding: '4px 8px', borderRadius: 4, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
      >
        <option value="none">No figure</option>
        <option value="needs_image">Needs image</option>
        <option value="uploaded">Uploaded ✓</option>
      </select>
    </div>
  );
}

function QuestionRow({ q, dirtyFields, onUpdate, onOpenImage }) {
  const current = { ...q, ...dirtyFields };
  const isDirty = dirtyFields && Object.keys(dirtyFields).length > 0;
  const taRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = taRef.current.scrollHeight + 'px';
    }
  }, [current.question]);

  return (
    <tr style={{
      borderBottom: `1px solid ${C.border}`,
      background: isDirty ? 'rgba(108,92,231,0.05)' : 'transparent',
      opacity: current.hidden ? 0.4 : 1,
    }}>
      <td style={{ width: 40, textAlign: 'center', padding: '10px 14px' }}>
        {isDirty && <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, display: 'inline-block' }} />}
      </td>
      <td style={{ padding: '10px 14px', minWidth: 160 }}>
        <input
          value={current.id ?? q.id}
          onChange={e => onUpdate('id', e.target.value)}
          style={{
            width: '100%', background: 'transparent', border: `1px solid transparent`,
            color: current.id && current.id !== q.id ? C.amber : C.text3,
            fontFamily: 'monospace', fontSize: 11,
            borderRadius: 4, padding: '3px 6px', outline: 'none',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = C.border2; e.target.style.background = C.surface2; }}
          onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
        />
        {current.id && current.id !== q.id && (
          <div style={{ fontSize: 9, color: C.amber, marginTop: 2, paddingLeft: 6 }}>was: {q.id}</div>
        )}
      </td>
      <td style={{ padding: '10px 14px', minWidth: 300, maxWidth: 420, lineHeight: 1.5, fontSize: 12 }}>
        <span style={{ display: 'block', fontSize: 10, color: C.text3, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          {q.cluster} · {q.topic || ''}
        </span>
        <textarea
          ref={taRef}
          value={current.question || ''}
          onChange={e => onUpdate('question', e.target.value)}
          rows={2}
          style={{
            width: '100%', background: 'transparent', border: `1px solid transparent`,
            color: C.text, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.55,
            resize: 'none', outline: 'none', borderRadius: 4, padding: '3px 6px',
            transition: 'border-color 0.15s, background 0.15s', overflow: 'hidden',
          }}
          onFocus={e => { e.target.style.borderColor = C.border2; e.target.style.background = C.surface2; }}
          onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
        />
      </td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{ background: C.surface3, color: C.text2, padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
          {q.skill || '—'}
        </span>
      </td>
      <td style={{ padding: '10px 14px' }}>
        <input
          type="number"
          min="1"
          max="9"
          value={current.marks ?? ''}
          onChange={e => onUpdate('marks', parseInt(e.target.value) || '')}
          style={{
            width: 52, background: 'transparent', border: `1px solid transparent`,
            color: C.accent, fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            borderRadius: 4, padding: '3px 6px', outline: 'none', textAlign: 'center',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = C.border2; e.target.style.background = C.surface2; }}
          onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
        />
      </td>
      <td style={{ padding: '10px 14px' }}>
        <SyllabusGrid syllabus={current.syllabus} onChange={val => onUpdate('syllabus', val)} />
      </td>
      <td style={{ padding: '10px 14px' }}>
        <FigureCell
          figureType={current.figure_type}
          figures={current.figures}
          question={q.question}
          figureDescription={q.figure_description}
          figureCaption={q.figure_caption}
          context={q.context}
          onChange={val => onUpdate('figure_type', val)}
          onOpenImage={onOpenImage}
        />
      </td>
      <td style={{ padding: '10px 14px' }}>
        <HideToggle hidden={current.hidden} onChange={() => onUpdate('hidden', !current.hidden)} />
      </td>
    </tr>
  );
}

const SKILLS = ['Describe', 'Explain', 'Evaluate', 'Compare', 'Fieldwork', 'Data Response'];
const CLUSTERS = ['GEL', 'Tourism', 'Climate', 'Tectonics', 'Singapore'];
const TIERS = ['free', 'basic', 'plus'];

const BLANK_Q = {
  id: '', cluster: '', topic: '', question: '', skill: '', marks: '', syllabus: '',
  context: '', figure_type: 'none', figure_caption: '', figure_description: '',
  tier: 'basic', hidden: false,
};

function AddQuestionModal({ onClose, onSaved, toast }) {
  const [form, setForm] = useState(BLANK_Q);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const sylActive = (form.syllabus || '').split(' | ').map(s => s.trim()).filter(Boolean);
  const toggleSyl = (syl) => {
    const next = sylActive.includes(syl) ? sylActive.filter(s => s !== syl) : [...sylActive, syl];
    next.sort((a, b) => SYL_ORDER.indexOf(a) - SYL_ORDER.indexOf(b));
    set('syllabus', next.join(' | '));
  };

  const save = async () => {
    if (!form.id.trim() || !form.question.trim() || !form.cluster || !form.skill || !form.marks) {
      toast('Fill in ID, question, cluster, skill and marks', 'error'); return;
    }
    setSaving(true);
    const payload = {
      ...form,
      marks: parseInt(form.marks),
      hidden: form.hidden,
      figure_type: form.figure_type || 'none',
    };
    const { data, error } = await supabase.from('questions').insert([payload]).select().single();
    setSaving(false);
    if (error) { toast(`Insert failed: ${error.message}`, 'error'); return; }
    toast(`Added ${data.id}`, 'success');
    onSaved(data);
    onClose();
  };

  const inp = (extra = {}) => ({
    style: {
      width: '100%', background: C.bg, border: `1px solid ${C.border2}`, color: C.text,
      borderRadius: 6, padding: '7px 10px', fontFamily: 'inherit', fontSize: 12, outline: 'none',
      ...extra,
    },
  });

  const label = (text) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{text}</div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px 16px 0 0',
        width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto',
        padding: '24px 28px 40px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Add new question</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.text3, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* ID */}
          <div>
            {label('Question ID *')}
            <input {...inp()} value={form.id} onChange={e => set('id', e.target.value)} placeholder="e.g. gel_explain_01" />
          </div>

          {/* Cluster */}
          <div>
            {label('Cluster *')}
            <select {...inp()} value={form.cluster} onChange={e => set('cluster', e.target.value)}>
              <option value="">Select cluster…</option>
              {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Topic */}
          <div>
            {label('Topic')}
            <input {...inp()} value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Plate boundaries" />
          </div>

          {/* Skill */}
          <div>
            {label('Skill *')}
            <select {...inp()} value={form.skill} onChange={e => set('skill', e.target.value)}>
              <option value="">Select skill…</option>
              {SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Marks */}
          <div>
            {label('Marks *')}
            <input {...inp()} type="number" min="1" max="9" value={form.marks} onChange={e => set('marks', e.target.value)} placeholder="e.g. 4" />
          </div>

          {/* Tier */}
          <div>
            {label('Tier')}
            <select {...inp()} value={form.tier} onChange={e => set('tier', e.target.value)}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Question text — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            {label('Question text *')}
            <textarea {...inp()} rows={3} value={form.question} onChange={e => set('question', e.target.value)} placeholder="Enter the full question text…" style={{ ...inp().style, resize: 'vertical', lineHeight: 1.55 }} />
          </div>

          {/* Context */}
          <div style={{ gridColumn: '1 / -1' }}>
            {label('Context / stimulus (optional)')}
            <textarea {...inp()} rows={2} value={form.context} onChange={e => set('context', e.target.value)} placeholder="Any case study or data extract shown above the question…" style={{ ...inp().style, resize: 'vertical' }} />
          </div>

          {/* Syllabus */}
          <div style={{ gridColumn: '1 / -1' }}>
            {label('Syllabus')}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {SYLLABUSES.map(syl => (
                <label key={syl} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.text2 }}>
                  <input type="checkbox" checked={sylActive.includes(syl)} onChange={() => toggleSyl(syl)} style={{ accentColor: C.accent, cursor: 'pointer' }} />
                  {syl}
                </label>
              ))}
            </div>
          </div>

          {/* Figure */}
          <div>
            {label('Figure status')}
            <select {...inp()} value={form.figure_type} onChange={e => set('figure_type', e.target.value)}>
              <option value="none">No figure</option>
              <option value="needs_image">Needs image (not yet uploaded)</option>
              <option value="uploaded">Uploaded to Supabase ✓</option>
            </select>
          </div>

          {/* Figure caption */}
          <div>
            {label('Figure caption')}
            <input {...inp()} value={form.figure_caption} onChange={e => set('figure_caption', e.target.value)} placeholder="e.g. Fig. 3.1 — Annual rainfall map" />
          </div>

          {/* Figure description */}
          <div style={{ gridColumn: '1 / -1' }}>
            {label('Figure description (for AI context)')}
            <textarea {...inp()} rows={2} value={form.figure_description} onChange={e => set('figure_description', e.target.value)} placeholder="Describe what the figure shows — used by the AI when no image is present…" style={{ ...inp().style, resize: 'vertical' }} />
          </div>

          {/* Hidden */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="hidden-cb" checked={form.hidden} onChange={e => set('hidden', e.target.checked)} style={{ accentColor: C.red, cursor: 'pointer', width: 14, height: 14 }} />
            <label htmlFor="hidden-cb" style={{ fontSize: 12, color: C.text2, cursor: 'pointer' }}>Hide this question (won't appear in student view)</label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, background: C.green, color: C.bg, border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Add question'}
          </button>
          <button onClick={onClose} style={{ background: C.surface2, color: C.text2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function QuestionBankAdmin() {
  const [questions, setQuestions] = useState([]);
  const [dirty, setDirty] = useState({}); // { id: { field: value } }
  const [loading, setLoading] = useState(true);
  const [connOk, setConnOk] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statFilter, setStatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [fCluster, setFCluster] = useState('');
  const [fSkill, setFSkill] = useState('');
  const [fSyllabus, setFSyllabus] = useState('');
  const [fHidden, setFHidden] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sortField, setSortField] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const { toasts, push: toast } = useToasts();

  useEffect(() => {
    supabase.from('questions').select('*').order('id').then(({ data, error }) => {
      setLoading(false);
      if (error) { setConnOk(false); return; }
      setConnOk(true);
      setQuestions(data || []);
    });
  }, []);

  const markDirty = (id, field, value) => {
    setDirty(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const pendingCount = Object.keys(dirty).length;

  // ── Filters ──
  const clusters = [...new Set(questions.map(q => q.cluster).filter(Boolean))].sort();
  const skills = [...new Set(questions.map(q => q.skill).filter(Boolean))].sort();

  const cycleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = questions.filter(q => {
    const cur = { ...q, ...dirty[q.id] };
    if (statFilter === 'hidden' && !cur.hidden) return false;
    if (statFilter === 'needs_image') {
      const hasRef = cur.figure_description || cur.figure_caption || (cur.question || '').toLowerCase().includes('fig');
      if (!hasRef || cur.figure_type === 'uploaded') return false;
    }
    if (statFilter === 'no_syllabus' && cur.syllabus) return false;
    if (fCluster && q.cluster !== fCluster) return false;
    if (fSkill && q.skill !== fSkill) return false;
    if (fSyllabus && !(cur.syllabus || '').includes(fSyllabus)) return false;
    if (fHidden === 'visible' && cur.hidden) return false;
    if (fHidden === 'hidden' && !cur.hidden) return false;
    if (search) {
      const hay = [q.id, q.question, q.topic, q.cluster, q.figure_description].join(' ').toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ca = { ...a, ...dirty[a.id] };
    const cb = { ...b, ...dirty[b.id] };
    let va, vb;
    if (sortField === 'id') { va = (ca.id || '').toLowerCase(); vb = (cb.id || '').toLowerCase(); }
    else if (sortField === 'skill') { va = ca.skill || ''; vb = cb.skill || ''; }
    else if (sortField === 'marks') { va = ca.marks ?? 0; vb = cb.marks ?? 0; }
    else if (sortField === 'hidden') { va = ca.hidden ? 1 : 0; vb = cb.hidden ? 1 : 0; }
    else if (sortField === 'figures') {
      const rank = t => t === 'uploaded' ? 2 : t === 'needs_image' ? 1 : 0;
      va = rank(ca.figure_type); vb = rank(cb.figure_type);
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // ── Stats ──
  const withDirty = questions.map(q => ({ ...q, ...dirty[q.id] }));
  const cntHidden = withDirty.filter(q => q.hidden).length;
  const cntNeeds = withDirty.filter(q => {
    const hasRef = q.figure_description || q.figure_caption || (q.question || '').toLowerCase().includes('fig');
    return hasRef && q.figure_type !== 'uploaded';
  }).length;
  const cntNoSyl = withDirty.filter(q => !q.syllabus).length;

  // ── Save ──
  const saveAll = async () => {
    setSaving(true);
    const ids = Object.keys(dirty);
    let saved = 0, failed = 0;

    for (const oldId of ids) {
      const changes = dirty[oldId];
      const newId = (changes.id || '').trim();
      const idChanged = newId && newId !== oldId;

      if (idChanged) {
        // Move storage figures to new ID path, then insert+delete
        const q = questions.find(x => x.id === oldId);
        let finalChanges = { ...changes };

        if (q?.figures?.length) {
          const movedFigures = [];
          let moveFailed = false;
          for (const fig of q.figures) {
            // Extract bucket and path from URL:
            // https://xxx.supabase.co/storage/v1/object/public/BUCKET/path/to/file
            const match = (fig.url || '').match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
            if (!match) { movedFigures.push(fig); continue; }
            const [, bucket, oldPath] = match;
            const newPath = oldPath.replace(oldId, newId);
            const { error: moveErr } = await supabase.storage.from(bucket).move(oldPath, newPath);
            if (moveErr) {
              toast(`Failed to move figure: ${moveErr.message}`, 'error');
              moveFailed = true; break;
            }
            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(newPath);
            movedFigures.push({ path: newPath, url: publicUrl });
          }
          if (moveFailed) { failed++; continue; }
          finalChanges.figures = movedFigures;
        }

        const newRecord = { ...q, ...finalChanges, id: newId };
        const { error: insertErr } = await supabase.from('questions').insert([newRecord]);
        if (insertErr) {
          toast(`Failed to save ${oldId}→${newId}: ${insertErr.message}`, 'error');
          failed++; continue;
        }
        const { error: deleteErr } = await supabase.from('questions').delete().eq('id', oldId);
        if (deleteErr) toast(`Saved ${newId} but couldn't remove ${oldId}: ${deleteErr.message}`, 'error');

        setQuestions(prev => prev.map(q => q.id === oldId ? { ...q, ...finalChanges, id: newId } : q));
        setDirty(prev => { const n = { ...prev }; delete n[oldId]; return n; });
        saved++;
      } else {
        const { error } = await supabase.from('questions').update(changes).eq('id', oldId);
        if (error) {
          failed++;
          toast(`Failed to save ${oldId}: ${error.message}`, 'error');
        } else {
          setQuestions(prev => prev.map(q => q.id === oldId ? { ...q, ...changes } : q));
          setDirty(prev => { const n = { ...prev }; delete n[oldId]; return n; });
          saved++;
        }
      }
    }
    setSaving(false);
    if (saved > 0) toast(`${saved} question${saved > 1 ? 's' : ''} saved`, 'success');
    if (failed > 0) toast(`${failed} failed — check console`, 'error');
  };

  const toggleStat = (key) => setStatFilter(s => s === key ? '' : key);

  // ── Styles ──
  const thStyle = {
    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px',
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
    background: C.surface,
  };
  const sortTh = (field, label) => {
    const active = sortField === field;
    return (
      <th
        style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', color: active ? C.text : C.text3 }}
        onClick={() => cycleSort(field)}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
      </th>
    );
  };

  const selStyle = {
    background: C.bg, border: `1px solid ${C.border2}`, color: C.text,
    padding: '7px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, outline: 'none', cursor: 'pointer',
  };

  // Fixed column widths shared between header table and body table
  const COLS = [40, 180, 380, 120, 80, 200, 160, 100];
  const colGroup = (
    <colgroup>
      {COLS.map((w, i) => <col key={i} style={{ width: w, minWidth: w }} />)}
    </colgroup>
  );

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: C.bg, color: C.text, height: '100vh', display: 'flex', flexDirection: 'column', fontSize: 13, overflow: 'hidden' }}>
      {lightboxUrl && <ImageModal url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      {showAdd && (
        <AddQuestionModal
          onClose={() => setShowAdd(false)}
          onSaved={newQ => setQuestions(prev => [...prev, newQ])}
          toast={toast}
        />
      )}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'); @keyframes slideIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } } @keyframes spin { to { transform:rotate(360deg) } }`}</style>

      {/* ── Fixed top block ── */}
      <div style={{ flexShrink: 0 }}>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 24px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.5px' }}>
            Un<span style={{ color: C.accent }}>pack</span>
          </div>
          <div style={{ width: 1, height: 20, background: C.border2 }} />
          <div style={{ color: C.text3, fontSize: 12 }}>Question Bank Admin</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/preview" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 600, padding: '5px 10px', border: `1px solid ${C.border2}`, borderRadius: 6 }}>
              Preview ↗
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text3 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: connOk === null ? C.text3 : connOk ? C.green : C.red,
                boxShadow: connOk ? `0 0 6px ${C.green}` : 'none',
              }} />
              {connOk === null ? 'Connecting…' : connOk ? 'Live' : 'Connection error'}
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: C.surface, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.text3, fontSize: 13 }}>⌕</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search questions, topics…"
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.border2}`, color: C.text, padding: '7px 12px 7px 32px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, outline: 'none' }}
            />
          </div>
          <select value={fCluster} onChange={e => setFCluster(e.target.value)} style={selStyle}>
            <option value="">All clusters</option>
            {clusters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fSkill} onChange={e => setFSkill(e.target.value)} style={selStyle}>
            <option value="">All skills</option>
            {skills.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fSyllabus} onChange={e => setFSyllabus(e.target.value)} style={selStyle}>
            <option value="">All syllabuses</option>
            {SYLLABUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fHidden} onChange={e => setFHidden(e.target.value)} style={selStyle}>
            <option value="">All visibility</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </select>
          <div style={{ width: 1, height: 24, background: C.border, margin: '0 4px' }} />
          <button
            onClick={() => setShowAdd(true)}
            style={{ background: C.green, color: C.bg, border: 'none', padding: '7px 14px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            + New question
          </button>
          <button
            onClick={saveAll} disabled={pendingCount === 0 || saving}
            style={{ marginLeft: 'auto', background: C.accent, color: 'white', border: 'none', padding: '7px 16px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: pendingCount === 0 || saving ? 'not-allowed' : 'pointer', opacity: pendingCount === 0 || saving ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? 'Saving…' : 'Save changes'}
            {pendingCount > 0 && <span style={{ background: 'white', color: C.accent, borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{pendingCount}</span>}
          </button>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface, overflowX: 'auto' }}>
          {[
            { key: '', n: questions.length, label: 'total', color: C.text },
            { key: 'hidden', n: cntHidden, label: 'hidden', color: C.red },
            { key: 'needs_image', n: cntNeeds, label: 'need images', color: C.amber },
            { key: 'no_syllabus', n: cntNoSyl, label: 'no syllabus', color: C.blue },
            { key: null, n: pendingCount, label: 'unsaved changes', color: C.accent },
          ].map(({ key, n, label, color }, i) => (
            <div
              key={i}
              onClick={key !== null ? () => toggleStat(key) : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRight: `1px solid ${C.border}`, cursor: key !== null ? 'pointer' : 'default', whiteSpace: 'nowrap', fontSize: 12, background: statFilter === key && key !== null ? C.surface2 : 'transparent' }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color }}>{n}</span>
              <span style={{ color: C.text2 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Column headers (always visible, aligned with body via shared colgroup) */}
        <div style={{ overflowX: 'hidden', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            {colGroup}
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }}></th>
                {sortTh('id', 'ID')}
                <th style={thStyle}>Question / Topic</th>
                {sortTh('skill', 'Skill')}
                {sortTh('marks', 'Marks')}
                <th style={thStyle}>Syllabus</th>
                {sortTh('figures', 'Figure needed?')}
                {sortTh('hidden', 'Hide')}
              </tr>
            </thead>
          </table>
        </div>

      </div>{/* end fixed top block */}

      {/* ── Scrollable body ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: C.text3, gap: 10 }}>
          <div style={{ width: 16, height: 16, border: `2px solid ${C.border2}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Loading questions from Supabase…
        </div>
      ) : !connOk ? (
        <div style={{ padding: 80, textAlign: 'center', color: C.red }}>⚠ Could not connect to Supabase</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: C.text3 }}>No questions match your filters.</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            {colGroup}
            <tbody>
              {sorted.map(q => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  dirtyFields={dirty[q.id] || {}}
                  onUpdate={(field, value) => markDirty(q.id, field, value)}
                  onOpenImage={setLightboxUrl}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
