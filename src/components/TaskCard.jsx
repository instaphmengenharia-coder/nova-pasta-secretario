import { useState, useEffect, useRef } from 'react'
import { useClaudeAI } from '../hooks/useClaudeAI'

const STATUS_CONFIG = {
  TURNED_IN: { label: 'Entregue',     color: '#34a853', bg: '#e6f4ea' },
  PENDING:   { label: 'Em andamento', color: '#f29900', bg: '#fef7e0' },
  NEW:       { label: 'Atribuída',    color: '#1a73e8', bg: '#e8f0fe' },
}

const AGENT_URL = 'https://agente-servidor-producao.up.railway.app'

export default function TaskCard({ task, isUrgent, courseColor = '#1a73e8', cachedSolution, onSolutionSaved, onSolutionCopied, styleExamples = [], difficulty = null, classifyingDifficulty = false, whatsappPhone = '' }) {
  const [expanded, setExpanded]             = useState(false)
  const [modalOpen, setModalOpen]           = useState(false)
  const [analysis, setAnalysis]             = useState(null)
  const [loading, setLoading]               = useState(false)
  const [aiError, setAiError]               = useState(null)

  const [solveOpen, setSolveOpen]           = useState(false)
  const [solution, setSolution]             = useState(cachedSolution || null)
  const [solveLoading, setSolveLoading]     = useState(false)
  const [solveError, setSolveError]         = useState(null)
  const [copied, setCopied]                 = useState(false)
  const [editMode, setEditMode]             = useState(false)
  const [editedSolution, setEditedSolution] = useState(cachedSolution || '')

  const [chatMessages, setChatMessages]     = useState([])
  const [chatInput, setChatInput]           = useState('')
  const [chatLoading, setChatLoading]       = useState(false)
  const chatEndRef                          = useRef(null)

  const [whatsappSending, setWhatsappSending] = useState(false)
  const [whatsappSent, setWhatsappSent]       = useState(false)

  useEffect(() => {
    if (cachedSolution && !solution) {
      setSolution(cachedSolution)
      setEditedSolution(cachedSolution)
    }
  }, [cachedSolution])

  const { analyzeTask, solveTask, refineAnswer } = useClaudeAI()

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
      const result = await solveTask(task, styleExamples)
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
    onSolutionCopied?.({ task: task.title, answer: text })
  }

  const handleChatSend = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    const current = editedSolution || solution
    if (!current) return

    setChatMessages(prev => [...prev, { role: 'user', text: msg }])
    setChatInput('')
    setChatLoading(true)

    try {
      const updated = await refineAnswer(current, msg)
      setEditedSolution(updated)
      setSolution(updated)
      onSolutionSaved?.(updated)
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Resposta atualizada!' }])
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'ai', text: `Erro: ${err.message}` }])
    } finally {
      setChatLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const handleWhatsApp = async (e) => {
    e.stopPropagation()
    if (!whatsappPhone || whatsappSending) return
    setWhatsappSending(true)
    try {
      const diff = task.dueDate ? task.dueDate - new Date() : null
      const prazo = diff === null ? 'sem prazo' : diff <= 0 ? 'ATRASADA' : `faltam ${Math.round(diff / 3600000)}h`
      await fetch(`${AGENT_URL}/whatsapp/notificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: whatsappPhone,
          mensagem: `📚 *Secretário Escolar*\n\n⚠️ Atividade urgente!\n\n*${task.title}*\n📌 ${task.courseName}\n⏱ ${prazo}\n\n${task.alternateLink ? `🔗 ${task.alternateLink}` : ''}`.trim(),
        }),
      })
      setWhatsappSent(true)
      setTimeout(() => setWhatsappSent(false), 3000)
    } catch { /* silent */ } finally {
      setWhatsappSending(false)
    }
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
      {/* ── Row ── */}
      <div style={styles.row} onClick={() => setExpanded(!expanded)}>
        <div style={{ ...styles.dot, background: courseColor }} />

        <div style={styles.icon}>
          <AssignmentIcon color={courseColor} />
        </div>

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
              <span style={diffBadge(difficulty)} title="Dificuldade estimada">
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

          {/* Quick actions — always visible */}
          <div style={styles.quickActions} onClick={(e) => e.stopPropagation()}>
            {task.alternateLink && (
              <a href={task.alternateLink} target="_blank" rel="noopener noreferrer" style={styles.openBtn}>
                Abrir no Classroom ↗
              </a>
            )}
            {solution && (
              <button style={styles.copyQuickBtn} onClick={handleCopy}>
                {copied ? '✓ Copiado!' : '⎘ Copiar resposta'}
              </button>
            )}
            {urgent && whatsappPhone && (
              <button style={styles.whatsappBtn} onClick={handleWhatsApp} disabled={whatsappSending}>
                {whatsappSent ? '✓ Enviado!' : whatsappSending ? '…' : '📱 WhatsApp'}
              </button>
            )}
          </div>

          {/* Expanded area */}
          {expanded && (
            <div style={styles.expandedArea} onClick={(e) => e.stopPropagation()}>
              {task.description && (
                <p style={styles.description}>{task.description}</p>
              )}
              <div style={styles.actions}>
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

                  {/* ── Chat de refinamento ── */}
                  <div style={styles.chatWrap}>
                    <div style={styles.chatLabel}>✦ Refinar com IA</div>

                    {chatMessages.length > 0 && (
                      <div style={styles.chatHistory}>
                        {chatMessages.map((m, i) => (
                          <div key={i} style={m.role === 'user' ? styles.chatMsgUser : styles.chatMsgAI}>
                            {m.text}
                          </div>
                        ))}
                        {chatLoading && (
                          <div style={styles.chatMsgAI}>
                            <span style={styles.chatTyping}>● ● ●</span>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}

                    <div style={styles.chatInputRow}>
                      <input
                        style={styles.chatInput}
                        placeholder='Ex: "deixa mais curto", "adiciona um exemplo"…'
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                        disabled={chatLoading}
                      />
                      <button
                        style={{ ...styles.chatSendBtn, opacity: chatLoading ? 0.5 : 1 }}
                        onClick={handleChatSend}
                        disabled={chatLoading}
                      >
                        {chatLoading ? '…' : '↑'}
                      </button>
                    </div>
                  </div>
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

// ─── Countdown ─────────────────────────────────────────────────────────────────

function Countdown({ dueDate }) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('var(--se-t4)')

  useEffect(() => {
    const update = () => {
      const diff = dueDate - new Date()
      if (diff <= 0) { setLabel('Prazo encerrado'); setColor('#ea4335'); return }
      const days  = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const mins  = Math.floor((diff % 3600000) / 60000)
      const secs  = Math.floor((diff % 60000) / 1000)

      if (days > 3)       { setLabel(`${days} dias`);            setColor('var(--se-t4)') }
      else if (days >= 1) { setLabel(`${days}d ${hours}h`);      setColor('#f29900') }
      else if (hours >= 1){ setLabel(`${hours}h ${mins}min`);    setColor('#ea4335') }
      else                { setLabel(`${mins}min ${secs}s`);     setColor('#ea4335') }
    }
    update()
    const interval = diff => diff < 3600000 ? 1000 : 60000
    const id = setInterval(update, interval(dueDate - new Date()))
    return () => clearInterval(id)
  }, [dueDate])

  return <span style={{ color, fontWeight: 600, fontSize: 12 }}>⏱ {label}</span>
}

// ─── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownLike({ text }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <br key={i} />

        // Headings: # ## ###
        const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const sizes = { 1: 18, 2: 16, 3: 14 }
          return (
            <p key={i} style={{ marginBottom: 8, fontSize: sizes[level], fontWeight: 700, color: 'var(--se-t1)' }}>
              {headingMatch[2]}
            </p>
          )
        }

        // Bold: ***text*** or **text**
        const parts = line.split(/\*{2,3}(.*?)\*{2,3}/g)
        return (
          <p key={i} style={{ marginBottom: 8 }}>
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          </p>
        )
      })}
    </>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function AssignmentIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" fill={color} opacity="0.15" />
      <rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="9" y1="8"  x2="15" y2="8"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
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

// ─── Styles ─────────────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const styles = {
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 0,
    background: 'var(--se-surface)', cursor: 'pointer',
    padding: '12px 16px 12px 0',
    transition: 'background 0.1s',
    position: 'relative',
  },
  rowDivider: { height: 1, background: 'var(--se-sep)', marginLeft: 56 },

  dot: { width: 4, flexShrink: 0, alignSelf: 'stretch', borderRadius: 2, marginRight: 12 },
  icon: { flexShrink: 0, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 2 },
  content: { flex: 1, minWidth: 0 },

  titleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 },
  title: { fontSize: 14, color: 'var(--se-t1)', fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 },
  solvedBadge: { fontSize: 10, color: '#34a853', background: '#e6f4ea', padding: '1px 6px', borderRadius: 20, fontWeight: 700 },

  meta: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaCourse: { fontSize: 12, fontWeight: 500 },
  metaDot:    { color: 'var(--se-border2)', fontSize: 12 },
  metaDate:   { fontSize: 12, color: 'var(--se-t4)' },

  quickActions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  openBtn: {
    fontSize: 12, color: '#1a73e8', textDecoration: 'none',
    background: '#e8f0fe', padding: '4px 10px',
    borderRadius: 20, border: '1px solid #c5d9fb', fontWeight: 500,
  },
  copyQuickBtn: {
    fontSize: 12, color: '#34a853', cursor: 'pointer',
    background: '#e6f4ea', padding: '4px 10px', borderRadius: 20,
    border: '1px solid #a8d5b5', fontWeight: 500,
  },
  whatsappBtn: {
    fontSize: 12, color: '#fff', cursor: 'pointer',
    background: '#25d366', padding: '4px 10px', borderRadius: 20,
    border: 'none', fontWeight: 500,
  },

  right: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingLeft: 12 },
  statusChip: { fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap' },
  chevron: { color: 'var(--se-t4)', fontSize: 10 },

  expandedArea: { marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--se-sep)' },
  description: { fontSize: 13, color: 'var(--se-t3)', lineHeight: 1.6, marginBottom: 10 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },

  aiBtn: {
    fontSize: 13, color: 'var(--se-t3)', cursor: 'pointer',
    background: 'var(--se-input)', padding: '6px 14px', borderRadius: 20,
    border: '1px solid var(--se-border2)', fontWeight: 400,
  },
  solveBtn: {
    fontSize: 13, color: '#fff', cursor: 'pointer',
    background: '#1a73e8', padding: '6px 16px', borderRadius: 20,
    border: 'none', fontWeight: 500,
    boxShadow: '0 1px 3px rgba(26,115,232,0.3)',
  },
  solveBtnDone: { background: '#34a853', boxShadow: '0 1px 3px rgba(52,168,83,0.3)' },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    zIndex: 1000, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 20,
  },
  modal: {
    background: 'var(--se-surface)', borderRadius: 12,
    width: '100%', maxWidth: 620,
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '18px 24px 0',
  },
  modalCourse: { fontSize: 12, fontWeight: 600, marginBottom: 2 },
  modalTitle:  { fontSize: 17, color: 'var(--se-t1)', fontWeight: 600, lineHeight: 1.4, fontFamily: FONT },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--se-t4)',
    fontSize: 18, cursor: 'pointer', padding: '4px 8px', flexShrink: 0,
  },
  modalDivider: { height: 1, background: 'var(--se-border)', margin: '14px 0 0' },
  modalBody:    { flex: 1, overflowY: 'auto', padding: '18px 24px' },

  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 14, padding: '40px 0',
  },
  loadingText: { color: 'var(--se-t3)', fontSize: 14 },
  errorBox: {
    background: '#fce8e6', border: '1px solid #f28b82',
    borderRadius: 8, padding: 14, color: '#c5221f', fontSize: 14,
  },

  solveToolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  solveToolbarLabel: { fontSize: 12, color: 'var(--se-t4)' },
  editToggleBtn: (active) => ({
    background: active ? '#e8f0fe' : 'var(--se-input)',
    border: `1px solid ${active ? '#c5d9fb' : 'var(--se-border2)'}`,
    color: active ? '#1a73e8' : 'var(--se-t3)',
    borderRadius: 20, padding: '3px 12px', fontSize: 12, cursor: 'pointer',
  }),
  solutionTextarea: {
    width: '100%', minHeight: 220, background: 'var(--se-surface)', border: '1px solid var(--se-border2)',
    borderRadius: 8, color: 'var(--se-t1)', fontSize: 14, lineHeight: 1.7,
    fontFamily: FONT, padding: '12px 14px', resize: 'vertical',
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
  },
  solutionBox: {
    background: 'var(--se-surface2)', border: '1px solid var(--se-border)',
    borderRadius: 8, padding: '14px 16px', marginBottom: 12,
    color: 'var(--se-t2)', fontSize: 14, lineHeight: 1.8,
    whiteSpace: 'pre-wrap', fontFamily: FONT,
  },
  copyBtn: {
    display: 'block', width: '100%', padding: '10px',
    background: '#1a73e8', border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 8,
  },
  solveHint: { fontSize: 12, color: 'var(--se-t4)', textAlign: 'center' },

  chatWrap: {
    marginTop: 16, borderTop: '1px solid var(--se-border)',
    paddingTop: 12,
  },
  chatLabel: { fontSize: 12, color: '#1a73e8', fontWeight: 600, marginBottom: 8 },
  chatHistory: {
    maxHeight: 160, overflowY: 'auto', display: 'flex',
    flexDirection: 'column', gap: 6, marginBottom: 8,
    padding: '8px', background: 'var(--se-surface2)',
    borderRadius: 8, border: '1px solid var(--se-border)',
  },
  chatMsgUser: {
    alignSelf: 'flex-end', background: '#1a73e8', color: '#fff',
    borderRadius: '12px 12px 2px 12px', padding: '6px 10px',
    fontSize: 13, maxWidth: '80%',
  },
  chatMsgAI: {
    alignSelf: 'flex-start', background: 'var(--se-input)', color: 'var(--se-t2)',
    borderRadius: '12px 12px 12px 2px', padding: '6px 10px',
    fontSize: 13, maxWidth: '80%',
  },
  chatTyping: { color: 'var(--se-t4)', letterSpacing: 2 },
  chatInputRow: { display: 'flex', gap: 6 },
  chatInput: {
    flex: 1, padding: '8px 12px', border: '1px solid var(--se-border2)',
    borderRadius: 20, background: 'var(--se-surface)', color: 'var(--se-t1)',
    fontSize: 13, fontFamily: FONT, outline: 'none',
  },
  chatSendBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: '#1a73e8', color: '#fff', border: 'none',
    fontSize: 16, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  analysisText: { color: 'var(--se-t2)', fontSize: 14, lineHeight: 1.7, fontFamily: FONT },
  modalFooter:  { padding: '10px 24px 14px', borderTop: '1px solid var(--se-sep)' },
  footerNote:   { fontSize: 11, color: 'var(--se-t4)', fontStyle: 'italic' },
}

const DIFF_LABEL = { 1: 'Fácil', 2: 'Fácil', 3: 'Médio', 4: 'Difícil', 5: 'Difícil' }

function diffBadge(d) {
  const color = d === null ? 'var(--se-t4)' : d <= 2 ? '#137333' : d === 3 ? '#b06000' : '#c5221f'
  const bg    = d === null ? 'var(--se-input)' : d <= 2 ? '#e6f4ea' : d === 3 ? '#fef0c7' : '#fce8e6'
  return { fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, color, background: bg, letterSpacing: 0.2, flexShrink: 0 }
}

if (typeof document !== 'undefined' && !document.getElementById('tc-styles')) {
  const s = document.createElement('style')
  s.id = 'tc-styles'
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
  document.head.appendChild(s)
}
