import { useState, useEffect } from 'react'
import { useClaudeAI } from '../hooks/useClaudeAI'

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  TURNED_IN: { label: 'Entregue',     color: '#34a853', bg: '#e6f4ea' },
  PENDING:   { label: 'Em andamento', color: '#f29900', bg: '#fef7e0' },
  NEW:       { label: 'Atribuída',    color: '#1a73e8', bg: '#e8f0fe' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaskCard({ task, isUrgent, courseColor = '#1a73e8', cachedSolution, onSolutionSaved, difficulty = null, classifyingDifficulty = false }) {
  const [expanded, setExpanded]           = useState(false)
  const [modalOpen, setModalOpen]         = useState(false)
  const [analysis, setAnalysis]           = useState(null)
  const [loading, setLoading]             = useState(false)
  const [aiError, setAiError]             = useState(null)

  const [solveOpen, setSolveOpen]         = useState(false)
  const [solution, setSolution]           = useState(cachedSolution || null)
  const [solveLoading, setSolveLoading]   = useState(false)
  const [solveError, setSolveError]       = useState(null)
  const [copied, setCopied]               = useState(false)
  const [editMode, setEditMode]           = useState(false)
  const [editedSolution, setEditedSolution] = useState(cachedSolution || '')

  useEffect(() => {
    if (cachedSolution && !solution) {
      setSolution(cachedSolution)
      setEditedSolution(cachedSolution)
    }
  }, [cachedSolution])

  const { analyzeTask, solveTask } = useClaudeAI()

  const urgent = isUrgent && task.status !== 'TURNED_IN'
  const cfg = urgent
    ? { label: 'Urgente', color: '#ea4335', bg: '#fce8e6' }
    : STATUS_CONFIG[task.status] || STATUS_CONFIG.NEW

  const handleSolveClick = async (e) => {
    e.stopPropagation()
    setSolveOpen(true)
    if (solution) return

    setSolveLoading(true)
    setSolveError(null)
    try {
      const result = await solveTask(task)
      setSolution(result)
      setEditedSolution(result)
      onSolutionSaved?.(result)
    } catch (err) {
      setSolveError(err.message)
    } finally {
      setSolveLoading(false)
    }
  }

  const handleCopy = () => {
    const text = editedSolution || solution
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAIClick = async (e) => {
    e.stopPropagation()
    setModalOpen(true)
    if (analysis) return
    setLoading(true)
    setAiError(null)
    try {
      const result = await analyzeTask(task)
      setAnalysis(result)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Row item (like Classroom's to-do list) ── */}
      <div style={styles.row} onClick={() => setExpanded(!expanded)}>
        {/* Course color dot */}
        <div style={{ ...styles.dot, background: courseColor }} />

        {/* Assignment icon */}
        <div style={styles.icon}>
          <AssignmentIcon color={courseColor} />
        </div>

        {/* Main content */}
        <div style={styles.content}>
          <div style={styles.titleRow}>
            <span style={styles.title}>{task.title}</span>
            {solution && (
              <span style={styles.solvedBadge} title="Resposta gerada">✓</span>
            )}
            {urgent && (
              <span style={{ ...styles.statusChip, color: '#ea4335', background: '#fce8e6' }}>Urgente</span>
            )}
            {(difficulty !== null || classifyingDifficulty) && (
              <span style={diffBadge(difficulty)} title="Dificuldade estimada pela IA">
                {classifyingDifficulty ? '…' : DIFF_LABEL[difficulty] || `D${difficulty}`}
              </span>
            )}
          </div>
          <div style={styles.meta}>
            <span style={{ ...styles.metaCourse, color: courseColor }}>{task.courseName}</span>
            {task.dueDateStr !== 'Sem prazo' && (
              <>
                <span style={styles.metaDot}>·</span>
                <span style={styles.metaDate}>Entrega: {task.dueDateStr}</span>
              </>
            )}
            {task.dueDate && task.status !== 'TURNED_IN' && (
              <>
                <span style={styles.metaDot}>·</span>
                <Countdown dueDate={task.dueDate} />
              </>
            )}
            {task.maxPoints != null && (
              <>
                <span style={styles.metaDot}>·</span>
                <span style={styles.metaDate}>{task.maxPoints} pts</span>
              </>
            )}
          </div>

          {/* Expanded area */}
          {expanded && (
            <div style={styles.expandedArea} onClick={(e) => e.stopPropagation()}>
              {task.description && (
                <p style={styles.description}>{task.description}</p>
              )}
              <div style={styles.actions}>
                {task.alternateLink && (
                  <a href={task.alternateLink} target="_blank" rel="noopener noreferrer" style={styles.openBtn}>
                    Abrir no Classroom
                  </a>
                )}
                <button style={styles.aiBtn} onClick={handleAIClick}>
                  ✦ Dicas da IA
                </button>
                {task.status !== 'TURNED_IN' && (
                  <button
                    style={{ ...styles.solveBtn, ...(solution ? styles.solveBtnDone : {}) }}
                    onClick={handleSolveClick}
                  >
                    {solution ? '✓ Ver Resposta' : '✎ Resolver com IA'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: status chip + chevron */}
        <div style={styles.right}>
          <span style={{ ...styles.statusChip, color: cfg.color, background: cfg.bg }}>
            {cfg.label}
          </span>
          <span style={styles.chevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      <div style={styles.rowDivider} />

      {/* ── Resolver Modal ── */}
      {solveOpen && (
        <div style={styles.overlay} onClick={() => setSolveOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ height: 5, background: courseColor, borderRadius: '12px 12px 0 0' }} />

            <div style={styles.modalHeader}>
              <div>
                <p style={{ ...styles.modalCourse, color: courseColor }}>{task.courseName}</p>
                <h2 style={styles.modalTitle}>✎ {task.title}</h2>
              </div>
              <button style={styles.closeBtn} onClick={() => setSolveOpen(false)}>✕</button>
            </div>

            <div style={styles.modalDivider} />
            <div style={styles.modalBody}>
              {solveLoading && (
                <div style={styles.loadingWrap}>
                  <Spinner />
                  <p style={styles.loadingText}>Claude está resolvendo a atividade…</p>
                </div>
              )}
              {solveError && !solveLoading && (
                <div style={styles.errorBox}><strong>Erro:</strong> {solveError}</div>
              )}
              {solution && !solveLoading && (
                <>
                  <div style={styles.solveToolbar}>
                    <span style={styles.solveToolbarLabel}>Resposta gerada pela IA</span>
                    <button style={styles.editToggleBtn(editMode)} onClick={() => setEditMode(!editMode)}>
                      {editMode ? '👁 Visualizar' : '✎ Editar'}
                    </button>
                  </div>
                  {editMode ? (
                    <textarea
                      style={styles.solutionTextarea}
                      value={editedSolution}
                      onChange={(e) => setEditedSolution(e.target.value)}
                      rows={12}
                    />
                  ) : (
                    <div style={styles.solutionBox}>
                      <MarkdownLike text={editedSolution || solution} />
                    </div>
                  )}
                  <button style={styles.copyBtn} onClick={handleCopy}>
                    {copied ? '✓ Copiado!' : '⎘ Copiar resposta'}
                  </button>
                  <p style={styles.solveHint}>Edite se necessário, depois copie e cole no Google Classroom.</p>
                </>
              )}
            </div>
            <div style={styles.modalFooter}>
              <span style={styles.footerNote}>Gerado por Claude AI · Secretário Escolar</span>
            </div>
          </div>
        </div>
      )}

      {/* ── IA Modal ── */}
      {modalOpen && (
        <div style={styles.overlay} onClick={() => setModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ height: 5, background: courseColor, borderRadius: '12px 12px 0 0' }} />

            <div style={styles.modalHeader}>
              <div>
                <p style={{ ...styles.modalCourse, color: courseColor }}>{task.courseName}</p>
                <h2 style={styles.modalTitle}>{task.title}</h2>
              </div>
              <button style={styles.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div style={styles.modalDivider} />
            <div style={styles.modalBody}>
              {loading && (
                <div style={styles.loadingWrap}>
                  <Spinner />
                  <p style={styles.loadingText}>Consultando a IA…</p>
                </div>
              )}
              {aiError && !loading && (
                <div style={styles.errorBox}><strong>Erro:</strong> {aiError}</div>
              )}
              {analysis && !loading && (
                <div style={styles.analysisText}><MarkdownLike text={analysis} /></div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <span style={styles.footerNote}>Gerado por Claude AI · Secretário Escolar</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ dueDate }) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('#9aa0a6')

  useEffect(() => {
    const update = () => {
      const diff = dueDate - new Date()
      if (diff <= 0) { setLabel('Prazo encerrado'); setColor('#ea4335'); return }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)

      if (days > 3)      { setLabel(`${days} dias`); setColor('#9aa0a6') }
      else if (days >= 1){ setLabel(`${days}d ${hours}h`); setColor('#f29900') }
      else if (hours >= 1){ setLabel(`${hours}h ${mins}min`); setColor('#ea4335') }
      else               { setLabel(`${mins} min`); setColor('#ea4335') }
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [dueDate])

  return <span style={{ color, fontWeight: 600, fontSize: 12 }}>⏱ {label}</span>
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownLike({ text }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <br key={i} />
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <p key={i} style={{ marginBottom: 8 }}>
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          </p>
        )
      })}
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function AssignmentIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" fill={color} opacity="0.15" />
      <rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="9" y1="8" x2="15" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="12" x2="15" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="16" x2="12" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: '3px solid rgba(26,115,232,0.15)', borderTopColor: '#1a73e8',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const styles = {
  // ── List row (Classroom-style)
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 0,
    background: '#fff', cursor: 'pointer',
    padding: '12px 16px 12px 0',
    transition: 'background 0.1s',
    position: 'relative',
  },
  rowDivider: { height: 1, background: '#f1f3f4', marginLeft: 56 },

  dot: {
    width: 4, flexShrink: 0, alignSelf: 'stretch',
    borderRadius: 2, marginRight: 12,
  },
  icon: {
    flexShrink: 0, width: 36, display: 'flex',
    alignItems: 'center', justifyContent: 'center', paddingTop: 2,
  },
  content: { flex: 1, minWidth: 0 },

  titleRow: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2,
  },
  title: {
    fontSize: 14, color: '#202124', fontWeight: 500, fontFamily: FONT, lineHeight: 1.4,
  },
  solvedBadge: {
    fontSize: 10, color: '#34a853', background: '#e6f4ea',
    padding: '1px 6px', borderRadius: 20, fontWeight: 700,
  },

  meta: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaCourse: { fontSize: 12, fontWeight: 500 },
  metaDot: { color: '#dadce0', fontSize: 12 },
  metaDate: { fontSize: 12, color: '#9aa0a6' },

  right: {
    display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingLeft: 12,
  },
  statusChip: {
    fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap',
  },
  chevron: { color: '#9aa0a6', fontSize: 10 },

  expandedArea: { marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f3f4' },
  description: {
    fontSize: 13, color: '#5f6368', lineHeight: 1.6, marginBottom: 10,
  },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },

  openBtn: {
    fontSize: 13, color: '#1a73e8', textDecoration: 'none',
    background: '#e8f0fe', padding: '6px 14px',
    borderRadius: 20, border: '1px solid #c5d9fb', fontWeight: 500,
  },
  aiBtn: {
    fontSize: 13, color: '#5f6368', cursor: 'pointer',
    background: '#f1f3f4', padding: '6px 14px', borderRadius: 20,
    border: '1px solid #dadce0', fontWeight: 400,
  },
  solveBtn: {
    fontSize: 13, color: '#fff', cursor: 'pointer',
    background: '#1a73e8', padding: '6px 16px', borderRadius: 20,
    border: 'none', fontWeight: 500,
    boxShadow: '0 1px 3px rgba(26,115,232,0.3)',
  },
  solveBtnDone: {
    background: '#34a853',
    boxShadow: '0 1px 3px rgba(52,168,83,0.3)',
  },

  // ── Modals
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    zIndex: 1000, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 20,
  },
  modal: {
    background: '#fff', borderRadius: 12,
    width: '100%', maxWidth: 620,
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '18px 24px 0',
  },
  modalCourse: { fontSize: 12, fontWeight: 600, marginBottom: 2 },
  modalTitle: { fontSize: 17, color: '#202124', fontWeight: 600, lineHeight: 1.4, fontFamily: FONT },
  closeBtn: {
    background: 'none', border: 'none', color: '#9aa0a6',
    fontSize: 18, cursor: 'pointer', padding: '4px 8px', flexShrink: 0,
  },
  modalDivider: { height: 1, background: '#e8eaed', margin: '14px 0 0' },
  modalBody: { flex: 1, overflowY: 'auto', padding: '18px 24px' },

  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 14, padding: '40px 0',
  },
  loadingText: { color: '#5f6368', fontSize: 14 },
  errorBox: {
    background: '#fce8e6', border: '1px solid #f28b82',
    borderRadius: 8, padding: 14, color: '#c5221f', fontSize: 14,
  },

  solveToolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  solveToolbarLabel: { fontSize: 12, color: '#9aa0a6' },
  editToggleBtn: (active) => ({
    background: active ? '#e8f0fe' : '#f1f3f4',
    border: `1px solid ${active ? '#c5d9fb' : '#dadce0'}`,
    color: active ? '#1a73e8' : '#5f6368',
    borderRadius: 20, padding: '3px 12px', fontSize: 12, cursor: 'pointer',
  }),
  solutionTextarea: {
    width: '100%', minHeight: 220, background: '#fff', border: '1px solid #dadce0',
    borderRadius: 8, color: '#202124', fontSize: 14, lineHeight: 1.7,
    fontFamily: FONT, padding: '12px 14px', resize: 'vertical',
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
  },
  solutionBox: {
    background: '#f8f9fa', border: '1px solid #e8eaed',
    borderRadius: 8, padding: '14px 16px', marginBottom: 12,
    color: '#3c4043', fontSize: 14, lineHeight: 1.8,
    whiteSpace: 'pre-wrap', fontFamily: FONT,
  },
  copyBtn: {
    display: 'block', width: '100%', padding: '10px',
    background: '#1a73e8', border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 8,
  },
  solveHint: { fontSize: 12, color: '#9aa0a6', textAlign: 'center' },

  analysisText: { color: '#3c4043', fontSize: 14, lineHeight: 1.7, fontFamily: FONT },
  modalFooter: { padding: '10px 24px 14px', borderTop: '1px solid #f1f3f4' },
  footerNote: { fontSize: 11, color: '#c5c8cc', fontStyle: 'italic' },
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────

const DIFF_LABEL = { 1: 'Fácil', 2: 'Fácil', 3: 'Médio', 4: 'Difícil', 5: 'Difícil' }

function diffBadge(d) {
  const color = d === null ? '#9aa0a6'
    : d <= 2 ? '#137333'
    : d === 3 ? '#b06000'
    : '#c5221f'
  const bg = d === null ? '#f1f3f4'
    : d <= 2 ? '#e6f4ea'
    : d === 3 ? '#fef0c7'
    : '#fce8e6'
  return {
    fontSize: 10, fontWeight: 700, padding: '1px 7px',
    borderRadius: 20, color, background: bg,
    letterSpacing: 0.2, flexShrink: 0,
  }
}

if (typeof document !== 'undefined' && !document.getElementById('tc-styles')) {
  const s = document.createElement('style')
  s.id = 'tc-styles'
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
  document.head.appendChild(s)
}
