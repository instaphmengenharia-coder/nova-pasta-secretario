import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClaudeAI } from '../hooks/useClaudeAI'
import { useBrowserAgent, getAgentHistory, analisarViabilidade } from '../hooks/useBrowserAgent'
import { salvarEstilo } from '../hooks/useStyleMemory'

const STATUS_CONFIG = {
  TURNED_IN: { label: 'Entregue',     color: '#34a853', bg: '#e6f4ea' },
  PENDING:   { label: 'Em andamento', color: '#f29900', bg: '#fef7e0' },
  NEW:       { label: 'Atribuída',    color: '#1a73e8', bg: '#e8f0fe' },
}

const AGENT_URL = 'https://agente-servidor-production.up.railway.app'

export default function TaskCard({ task, isUrgent, courseColor = '#1a73e8', cachedSolution, onSolutionSaved, onSolutionCopied, styleExamples = [], difficulty = null, classifyingDifficulty = false, whatsappPhone = '', accessToken = null, solveTaskWithContext = null, extConnected = false, userId = null }) {
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

  const [delivering, setDelivering]   = useState(false)
  const [delivered, setDelivered]     = useState(false)
  const [deliverError, setDeliverError] = useState(null)

  const [agentOpen, setAgentOpen]                 = useState(false)
  const [permissionOpen, setPermissionOpen]       = useState(false)
  const [historyOpen, setHistoryOpen]             = useState(false)
  const [agentHistory, setAgentHistory]           = useState([])
  const [viabilidade, setViabilidade]             = useState(null)
  const [viabilidadeOpen, setViabilidadeOpen]     = useState(false)
  const [viabilidadeLoading, setViabilidadeLoading] = useState(false)

  // ── Pre-chat states ──────────────────────────────────────────────────────
  const [preChatOpen, setPreChatOpen]       = useState(false)
  const [preChatMsgs, setPreChatMsgs]       = useState([])
  const [preChatInput, setPreChatInput]     = useState('')
  const [preChatLoading, setPreChatLoading] = useState(false)
  const [preChatPlan, setPreChatPlan]       = useState(null)
  const preChatObjetivoRef                  = useRef('')
  const preChatEndRef                       = useRef(null)

  const { running, paused, log, done, pendingReview, elapsed, runAgent, stop, pause, resume, reset, approveReview, rejectReview } = useBrowserAgent()

  function fmtElapsed(s) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }
  const agentLogRef = useRef(null)

  function hasPermission() {
    try {
      const ts = localStorage.getItem('se_agent_permission')
      if (!ts) return false
      return Date.now() - Number(ts) < 30 * 24 * 3600 * 1000
    } catch { return false }
  }

  // ── Pre-chat helpers ──────────────────────────────────────────────────────
  const PC_API  = 'https://agente-servidor-production.up.railway.app/claude/proxy'
  const PC_MODEL = import.meta.env.VITE_MODEL_HAIKU || 'claude-haiku-4-5-20251001'
  const PC_SYSTEM = `Você prepara um agente de IA para executar atividades escolares automaticamente no Chrome.
Atividade — Título: ${task.title} | Disciplina: ${task.courseName || ''} | Descrição: ${(task.description || 'Sem descrição').slice(0, 400)}

TAREFA: Faça no MÁXIMO 2 perguntas curtas (em português) para entender como o aluno quer que a atividade seja feita. Se já estiver claro, vá direto para o plano.
Responda APENAS com JSON válido:
- Pergunta: {"fase":"pergunta","texto":"sua pergunta"}
- Plano final: {"fase":"plano","texto":"Vou [descrição do que farei]. Posso começar?","objetivo":"objetivo em 1 frase para o agente","tokens_estimados":7000}`

  function parsePCJson(raw) {
    try { return JSON.parse(raw.trim()) } catch {}
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) { try { return JSON.parse(m[0]) } catch {} }
    return { fase: 'pergunta', texto: raw }
  }

  function addPCMsg(role, texto, raw) {
    setPreChatMsgs(prev => [...prev, { role, texto, raw }])
    setTimeout(() => preChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function callHaikuPC(history) {
    const res = await fetch(PC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: PC_MODEL, max_tokens: 400, system: PC_SYSTEM, messages: history }),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json()
    return data.content[0].text
  }

  async function abrirPreChat() {
    setPreChatOpen(true)
    setPreChatMsgs([])
    setPreChatPlan(null)
    setPreChatInput('')
    preChatObjetivoRef.current = ''
    setPreChatLoading(true)
    try {
      const text = await callHaikuPC([{ role: 'user', content: 'Analise a atividade e comece.' }])
      const parsed = parsePCJson(text)
      addPCMsg('assistant', parsed.texto || text, parsed)
      if (parsed.fase === 'plano') setPreChatPlan(parsed)
    } catch {
      addPCMsg('assistant', 'Entendido! Posso começar a executar agora. Tem alguma instrução especial?', null)
    } finally {
      setPreChatLoading(false)
    }
  }

  async function enviarMensagemPC() {
    if (!preChatInput.trim() || preChatLoading) return
    const txt = preChatInput.trim()
    setPreChatInput('')
    addPCMsg('user', txt, null)
    setPreChatLoading(true)
    const history = [...preChatMsgs, { role: 'user', texto: txt }].map(m => ({
      role: m.role,
      content: m.role === 'assistant' && m.raw ? JSON.stringify(m.raw) : m.texto,
    }))
    try {
      const text = await callHaikuPC(history)
      const parsed = parsePCJson(text)
      addPCMsg('assistant', parsed.texto || text, parsed)
      if (parsed.fase === 'plano') setPreChatPlan(parsed)
    } catch {
      addPCMsg('assistant', 'Entendido! Confirme para começar.', { fase: 'plano', texto: 'Pronto para executar a atividade.', objetivo: txt, tokens_estimados: 6000 })
    } finally {
      setPreChatLoading(false)
    }
  }

  function confirmarPlanoPC() {
    preChatObjetivoRef.current = preChatPlan?.objetivo || ''
    setPreChatOpen(false)
    if (hasPermission()) setAgentOpen(true)
    else setPermissionOpen(true)
  }

  function ajustarPlanoPC() {
    setPreChatPlan(null)
    addPCMsg('assistant', 'Claro! O que você gostaria de ajustar?', null)
  }

  async function handleAgentClick(e) {
    e.stopPropagation()
    reset()
    if (!hasPermission()) { setPermissionOpen(true); return }
    setViabilidadeLoading(true)
    setViabilidade(null)
    try {
      // Cache por 24h — evita chamar Haiku toda vez
      const cacheKey = `se_viability_${task.id}`
      let analise = null
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
        if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) analise = cached.data
      } catch {}
      if (!analise) {
        analise = await analisarViabilidade(task)
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: analise, ts: Date.now() })) } catch {}
      }
      setViabilidade(analise)
      if (!analise.possivel && analise.confianca === 'alta') {
        setViabilidadeOpen(true)
      } else {
        await abrirPreChat()
      }
    } catch {
      await abrirPreChat()
    } finally {
      setViabilidadeLoading(false)
    }
  }

  function handleExecutarMesmoAssim() {
    setViabilidadeOpen(false)
    abrirPreChat()
  }

  function grantPermission() {
    localStorage.setItem('se_agent_permission', String(Date.now()))
    setPermissionOpen(false)
    setAgentOpen(true)
  }

  const handleDeliver = async () => {
    if (!accessToken || delivering || delivered) return
    const text = editedSolution || solution
    if (!text) return
    setDelivering(true)
    setDeliverError(null)
    try {
      const res = await fetch(`${AGENT_URL}/atividade/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: task.courseId,
          workId: task.id,
          resposta: text,
          tipoResposta: task.workType,
          accessToken,
        }),
      })
      const data = await res.json()
      if (data.upgrade) window.dispatchEvent(new CustomEvent('se:upgrade-needed'))
      if (!res.ok || data.erro) throw new Error(data.erro || data.message || 'Erro ao entregar')
      setDelivered(true)
    } catch (err) {
      setDeliverError(err.message)
    } finally {
      setDelivering(false)
    }
  }

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

  const [contextMateriais, setContextMateriais] = useState([])
  const [aiInsights, setAiInsights] = useState(null) // { raciocinio, pontos, confianca }
  const [showInsights, setShowInsights] = useState(false)

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

  const handleSolveWithContext = async (e) => {
    e.stopPropagation()
    if (!solveTaskWithContext || !accessToken) return
    setSolveOpen(true)
    setSolveLoading(true)
    setSolveError(null)
    setContextMateriais([])
    try {
      const { text, raciocinio, pontos, confianca, materiais } = await solveTaskWithContext(task, accessToken, styleExamples, userId)
      setSolution(text)
      setEditedSolution(text)
      setContextMateriais(materiais)
      if (raciocinio || pontos?.length) setAiInsights({ raciocinio, pontos, confianca })
      onSolutionSaved?.(text)
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

  useEffect(() => {
    if (agentLogRef.current) agentLogRef.current.scrollTop = agentLogRef.current.scrollHeight
  }, [log])

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
      <motion.div style={styles.row} onClick={() => setExpanded(!expanded)}
        whileHover={{ backgroundColor: 'var(--se-surface-hover)' }}
        transition={{ duration: 0.12 }}
      >
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
          <AnimatePresence initial={false}>
          {expanded && (
            <motion.div style={styles.expandedArea} onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
              animate={{ opacity: 1, height: 'auto', overflow: 'hidden' }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {task.description && (
                <p style={styles.description}>{task.description}</p>
              )}
              <div style={styles.actions}>
                <button style={styles.aiBtn} onClick={handleAIClick}>
                  ✦ Dicas da IA
                </button>
                {task.status !== 'TURNED_IN' && (
                  <>
                    <button
                      style={{ ...styles.solveBtn, ...(solution ? styles.solveBtnDone : {}) }}
                      onClick={handleSolveClick}
                    >
                      {solution ? '✓ Ver Resposta' : '✎ Resolver com IA'}
                    </button>
                    {solveTaskWithContext && accessToken && !solution && (
                      <button
                        style={{ ...styles.solveBtn, background: '#7c3aed', marginLeft: 6 }}
                        onClick={handleSolveWithContext}
                        title="Lê os documentos e PDFs anexados antes de responder"
                      >
                        ✦ Resolver com Contexto
                      </button>
                    )}
                    {extConnected && task.alternateLink && (
                      <button
                        style={{ ...styles.solveBtn, background: viabilidadeLoading ? '#777' : '#0f9d58', marginLeft: 6 }}
                        onClick={handleAgentClick}
                        disabled={viabilidadeLoading}
                        title="A IA analisa e executa a atividade no Chrome"
                      >
                        {viabilidadeLoading ? '🔍 Analisando...' : '🤖 Executar no Chrome'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        <div style={styles.right}>
          <span style={{ ...styles.statusChip, color: cfg.color, background: cfg.bg }}>
            {cfg.label}
          </span>
          <span style={styles.chevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </motion.div>

      <div style={styles.rowDivider} />

      {/* ── Modal de Permissão ── */}
      <AnimatePresence>
      {permissionOpen && (
        <motion.div style={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setPermissionOpen(false)}
        >
          <motion.div style={{ ...styles.modal, maxWidth: 460 }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 38, marginBottom: 10, textAlign: 'center' }}>🤖</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, textAlign: 'center' }}>A IA vai agir no seu Chrome</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 1.6 }}>
              Para realizar a atividade automaticamente, a IA vai:
            </p>
            <ul style={{ margin: '0 0 16px', paddingLeft: 0, listStyle: 'none', fontSize: 13, lineHeight: 2 }}>
              <li>📂 Abrir a atividade no Google Classroom</li>
              <li>📖 Ler o enunciado completo</li>
              <li>✏️ Preencher a resposta gerada pela IA</li>
              <li>📤 Clicar em Entregar</li>
            </ul>

            <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#333' }}>Acessos da extensão:</div>
              <div style={{ color: '#1e7e34' }}>✅ Abrir abas no seu Chrome</div>
              <div style={{ color: '#1e7e34' }}>✅ Ler conteúdo das páginas abertas</div>
              <div style={{ color: '#1e7e34' }}>✅ Preencher campos de texto</div>
              <div style={{ color: '#1e7e34' }}>✅ Clicar em botões</div>
              <div style={{ color: '#c0392b', marginTop: 6 }}>❌ Acessar senhas salvas</div>
              <div style={{ color: '#c0392b' }}>❌ Ver histórico de navegação</div>
              <div style={{ color: '#c0392b' }}>❌ Acessar outras abas abertas</div>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 11, color: '#888', textAlign: 'center' }}>
              Permissão válida por 30 dias. &nbsp;
              <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: '#1a73e8' }}>
                Ver política de privacidade
              </a>
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setPermissionOpen(false)}
                style={{ flex: 1, background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: 8, padding: '10px 0', fontSize: 14, cursor: 'pointer', color: '#444' }}
              >
                ❌ Cancelar
              </button>
              <button
                onClick={grantPermission}
                style={{ flex: 1, background: '#0f9d58', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                ✅ Permitir e continuar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Modal de Viabilidade ── */}
      <AnimatePresence>
      {viabilidadeOpen && viabilidade && (
        <motion.div style={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setViabilidadeOpen(false)}
        >
          <motion.div style={{ ...styles.modal, maxWidth: 460 }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 38, textAlign: 'center', marginBottom: 10 }}>
              {viabilidade.possivel ? '⚠️' : '🚫'}
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, textAlign: 'center' }}>
              {viabilidade.possivel ? 'Atenção antes de executar' : 'Atividade não pode ser feita automaticamente'}
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#555', lineHeight: 1.6 }}>
              {viabilidade.motivo}
            </p>

            {viabilidade.precisa_de?.length > 0 && (
              <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: '#333' }}>
                  {viabilidade.possivel ? 'Atenção para:' : 'Por que não é possível:'}
                </div>
                {viabilidade.precisa_de.map((item, i) => (
                  <div key={i} style={{ color: viabilidade.possivel ? '#f29900' : '#c0392b', marginBottom: 3 }}>
                    {viabilidade.possivel ? '⚠️' : '❌'} {item}
                  </div>
                ))}
              </div>
            )}

            {viabilidade.possivel && viabilidade.estrategia && (
              <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#2e7d32' }}>
                <strong>Estratégia:</strong> {viabilidade.estrategia}
              </div>
            )}

            {!viabilidade.possivel && (
              <div style={{ background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#e65100' }}>
                <strong>Mesmo assim:</strong> Você pode forçar a execução — o agente vai tentar e mostrará a resposta para você aprovar antes de entregar.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setViabilidadeOpen(false)}
                style={{ flex: 1, background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: 8, padding: '10px 0', fontSize: 14, cursor: 'pointer', color: '#444' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleExecutarMesmoAssim}
                style={{ flex: 1, background: viabilidade.possivel ? '#f29900' : '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                {viabilidade.possivel ? 'Tentar mesmo assim' : '🤖 Forçar execução'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Pre-Chat Modal ── */}
      <AnimatePresence>
      {preChatOpen && (
        <motion.div style={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setPreChatOpen(false)}
        >
          <motion.div style={{ ...styles.modal, maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15 }}>💬 Antes de começar...</h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>{task.title}</p>
              </div>
              <button onClick={() => setPreChatOpen(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>

            {/* Chat messages */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120, maxHeight: 300 }}>
              {preChatMsgs.length === 0 && preChatLoading && (
                <div style={{ color: '#888', fontSize: 13, fontStyle: 'italic', padding: 8 }}>Analisando a atividade...</div>
              )}
              {preChatMsgs.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    background: msg.role === 'user' ? '#1a73e8' : '#f1f3f4',
                    color: msg.role === 'user' ? '#fff' : '#222',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '8px 12px', fontSize: 13, maxWidth: '85%', lineHeight: 1.5,
                  }}>
                    {msg.texto}
                  </div>
                </div>
              ))}
              {preChatLoading && preChatMsgs.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: '#f1f3f4', borderRadius: '16px 16px 16px 4px', padding: '8px 14px', fontSize: 18, color: '#888' }}>···</div>
                </div>
              )}
              <div ref={preChatEndRef} />
            </div>

            {/* Plan card */}
            {preChatPlan && (
              <div style={{ background: '#e8f0fe', border: '1px solid #1a73e8', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a73e8', marginBottom: 6 }}>📋 Plano de execução</div>
                <div style={{ fontSize: 13, color: '#1a1a2e', lineHeight: 1.5, marginBottom: 8 }}>{preChatPlan.texto}</div>
                {preChatPlan.tokens_estimados && (
                  <div style={{ fontSize: 11, color: '#555' }}>
                    ~{preChatPlan.tokens_estimados.toLocaleString()} tokens estimados
                    {' '}(≈ USD ${((preChatPlan.tokens_estimados / 1000000) * 3).toFixed(4)})
                  </div>
                )}
              </div>
            )}

            {/* Confirm buttons (when plan ready) */}
            {preChatPlan ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={ajustarPlanoPC}
                  style={{ flex: 1, background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: 8, padding: '10px 0', fontSize: 13, cursor: 'pointer', color: '#444', fontWeight: 600 }}>
                  ✏️ Quero ajustar
                </button>
                <button onClick={confirmarPlanoPC}
                  style={{ flex: 2, background: '#0f9d58', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  ✅ Sim, pode começar
                </button>
              </div>
            ) : (
              /* Input */
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={preChatInput}
                  onChange={e => setPreChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && enviarMensagemPC()}
                  placeholder="Responda aqui..."
                  disabled={preChatLoading}
                  style={{ flex: 1, border: '1px solid #dadce0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }}
                />
                <button onClick={enviarMensagemPC} disabled={preChatLoading || !preChatInput.trim()}
                  style={{ background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: preChatLoading || !preChatInput.trim() ? 0.5 : 1 }}>
                  →
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Agente Chrome Modal ── */}
      <AnimatePresence>
      {agentOpen && (
        <motion.div style={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => { if (!running) setAgentOpen(false) }}
        >
          <motion.div style={{ ...styles.modal, maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>🤖 Agente Chrome</h3>
                {running && !paused && <span style={{ fontSize: 11, background: '#e8f5e9', color: '#1e7e34', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>⚙️ Executando há {fmtElapsed(elapsed)}</span>}
                {paused && <span style={{ fontSize: 11, background: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>⏸ Pausado</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setHistoryOpen(true); setAgentHistory(getAgentHistory().filter(h => h.taskId === task.id)) }} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#666' }}>📋 Histórico</button>
                <button onClick={() => { if (!running) setAgentOpen(false) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
              </div>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#666' }}>
              <strong>{task.title}</strong> · <span style={{ color: '#999' }}>{task.courseName}</span>
            </p>

            {/* Review Banner */}
            {pendingReview && (
              <div style={{ background: '#fff8e1', border: '2px solid #f9a825', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#e65100', marginBottom: 8 }}>👁️ Revisar resposta antes de enviar</div>
                <div style={{ background: '#fff', border: '1px solid #ffe082', borderRadius: 6, padding: 10, fontSize: 12, color: '#333', lineHeight: 1.6, maxHeight: 120, overflowY: 'auto', marginBottom: 10 }}>
                  {pendingReview.summary && <div style={{ color: '#666', marginBottom: 6, fontStyle: 'italic' }}>{pendingReview.summary}</div>}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{pendingReview.answer}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={rejectReview} style={{ flex: 1, background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 7, padding: '8px 0', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>❌ Rejeitar</button>
                  <button onClick={() => {
                    // Salvar estilo antes de aprovar
                    if (userId && pendingReview?.answer) {
                      salvarEstilo({ userId, materia: task.courseName, resposta: pendingReview.answer })
                    }
                    approveReview()
                  }} style={{ flex: 1, background: '#0f9d58', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>✅ Aprovar e Enviar</button>
                </div>
              </div>
            )}

            {/* Log */}
            {log.length > 0 && (
              <div ref={agentLogRef} style={{ background: '#0d1117', borderRadius: 8, padding: 10, flex: 1, overflowY: 'auto', marginBottom: 12, minHeight: 120, maxHeight: 320 }}>
                {log.map(entry => {
                  if (entry.type === 'screenshot') {
                    return (
                      <div key={entry.id} style={{ margin: '6px 0' }}>
                        <img src={entry.content} alt="screenshot" style={{ width: '100%', borderRadius: 4, border: '1px solid #30363d' }} />
                      </div>
                    )
                  }
                  const colors = { info: '#8b949e', thinking: '#79c0ff', action: '#d2a8ff', result: '#56d364', error: '#f85149', success: '#3fb950', warn: '#f0a83b', review: '#ffa657' }
                  return (
                    <div key={entry.id} style={{ color: colors[entry.type] || '#c9d1d9', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7 }}>
                      {entry.content}
                    </div>
                  )
                })}
                {running && !paused && <div style={{ color: '#79c0ff', fontFamily: 'monospace', fontSize: 11 }}>▌</div>}
              </div>
            )}

            {done && (
              <div style={{ background: '#e6f4ea', border: '1px solid #34a853', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#1e7e34' }}>
                ✅ {done}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!running && !done && (
                <button style={{ flex: 1, background: '#0f9d58', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  onClick={() => runAgent(task, { userId, objetivo: preChatObjetivoRef.current, whatsappPhone, nomeAluno: task.studentName || '' }, viabilidade)}>▶ Iniciar Agente</button>
              )}
              {running && !paused && (
                <>
                  <button style={{ flex: 1, background: '#f57c00', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    onClick={pause}>⏸ Pausar</button>
                  <button style={{ flex: 1, background: '#d93025', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    onClick={stop}>⏹ Parar</button>
                </>
              )}
              {paused && (
                <>
                  <button style={{ flex: 1, background: '#0f9d58', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    onClick={resume}>▶ Continuar</button>
                  <button style={{ flex: 1, background: '#d93025', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    onClick={stop}>⏹ Parar</button>
                </>
              )}
              {(done || (!running && log.length > 0)) && (
                <button style={{ flex: 1, background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  onClick={reset}>↺ Executar Novamente</button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Histórico Modal ── */}
      <AnimatePresence>
      {historyOpen && (
        <motion.div style={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setHistoryOpen(false)}
        >
          <motion.div style={{ ...styles.modal, maxWidth: 500 }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>📋 Histórico do Agente</h3>
              <button onClick={() => setHistoryOpen(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            {agentHistory.length === 0 ? (
              <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nenhuma execução registrada para esta atividade.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {agentHistory.map(h => {
                  const statusConfig = { success: { color: '#1e7e34', bg: '#e6f4ea', icon: '✅' }, failed: { color: '#c62828', bg: '#fce4ec', icon: '❌' }, cancelled: { color: '#666', bg: '#f5f5f5', icon: '⛔' }, rejected: { color: '#e65100', bg: '#fff3e0', icon: '🚫' } }
                  const sc = statusConfig[h.status] || statusConfig.failed
                  return (
                    <div key={h.id} style={{ background: sc.bg, border: `1px solid ${sc.color}33`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: sc.color }}>{sc.icon} {h.status.toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: '#999' }}>{new Date(h.completedAt).toLocaleString('pt-BR')}</span>
                      </div>
                      {h.result && <div style={{ fontSize: 12, color: '#444' }}>{h.result}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Resolver Modal ── */}
      <AnimatePresence>
      {solveOpen && (
        <motion.div style={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setSolveOpen(false)}
        >
          <motion.div style={styles.modal}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
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
                  <p style={styles.loadingText}>Claude está lendo os materiais e resolvendo…</p>
                </div>
              )}
              {contextMateriais.length > 0 && !solveLoading && (
                <div style={{ fontSize: 11, color: 'var(--se-t3)', marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>Lidos:</span>
                  {contextMateriais.map((m, i) => (
                    <span key={i} style={{ background: 'var(--se-border)', borderRadius: 4, padding: '1px 6px' }}>
                      {m.tipo}: {m.titulo}
                    </span>
                  ))}
                </div>
              )}
              {solveError && !solveLoading && (
                /gratuitas|upgrade/i.test(solveError) ? (
                  <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                    <strong style={{ color: '#e65100' }}>Limite atingido</strong>
                    <p style={{ margin: '6px 0 10px', color: 'var(--se-t2)' }}>Você usou suas 2 atividades gratuitas este mês. Assine o Pro para continuar sem limites.</p>
                    <button onClick={() => window.dispatchEvent(new CustomEvent('se:upgrade-needed'))} style={{ background: '#e65100', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                      Ver planos
                    </button>
                  </div>
                ) : (
                  <div style={styles.errorBox}><strong>Erro:</strong> {solveError}</div>
                )
              )}
              {solution && !solveLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
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

                  {/* Raciocínio e pontos de atenção */}
                  {aiInsights && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        onClick={() => setShowInsights(!showInsights)}
                        style={{ background: 'none', border: '1px solid var(--se-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--se-t3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT }}
                      >
                        {showInsights ? '▾' : '▸'} Ver raciocínio da IA
                        {aiInsights.confianca && (
                          <span style={{ marginLeft: 4, padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: aiInsights.confianca === 'alta' ? '#e6f4ea' : aiInsights.confianca === 'media' ? '#fff3e0' : '#fce8e6', color: aiInsights.confianca === 'alta' ? '#2e7d32' : aiInsights.confianca === 'media' ? '#e65100' : '#c62828' }}>
                            {aiInsights.confianca === 'alta' ? 'Alta confiança' : aiInsights.confianca === 'media' ? 'Média confiança' : 'Baixa confiança'}
                          </span>
                        )}
                      </button>
                      {showInsights && (
                        <div style={{ marginTop: 8, background: 'var(--se-input)', borderRadius: 8, padding: '12px 14px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {aiInsights.raciocinio && (
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--se-t2)', marginBottom: 4, fontSize: 12 }}>💡 Como a IA chegou nessa resposta</div>
                              <div style={{ color: 'var(--se-t2)', lineHeight: 1.5 }}>{aiInsights.raciocinio}</div>
                            </div>
                          )}
                          {aiInsights.pontos?.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--se-t2)', marginBottom: 4, fontSize: 12 }}>⚠️ O que revisar antes de entregar</div>
                              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {aiInsights.pontos.map((p, i) => (
                                  <li key={i} style={{ color: 'var(--se-t2)', lineHeight: 1.5 }}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {accessToken && task.status !== 'TURNED_IN' && (
                    <>
                      <button
                        style={{
                          ...styles.copyBtn,
                          background: delivered ? '#34a853' : delivering ? '#999' : '#1a73e8',
                          marginTop: 6,
                        }}
                        onClick={handleDeliver}
                        disabled={delivering || delivered}
                      >
                        {delivered ? '✓ Entregue no Classroom!' : delivering ? '⏳ Entregando…' : '🚀 Enviar atividade'}
                      </button>
                      {deliverError && (
                        /gratuitas|upgrade/i.test(deliverError) ? (
                          <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 8, padding: '10px 14px', marginTop: 6, fontSize: 12 }}>
                            <strong style={{ color: '#e65100' }}>Limite atingido</strong>
                            <p style={{ margin: '4px 0 8px', color: 'var(--se-t2)' }}>Você usou suas 2 atividades gratuitas este mês. Assine o Pro para continuar.</p>
                            <button onClick={() => window.dispatchEvent(new CustomEvent('se:upgrade-needed'))} style={{ background: '#e65100', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                              Ver planos
                            </button>
                          </div>
                        ) : (
                          <div style={{ ...styles.errorBox, marginTop: 6, fontSize: 12 }}>
                            {deliverError}
                          </div>
                        )
                      )}
                    </>
                  )}

                  <p style={styles.solveHint}>Edite se necessário, depois copie ou envie direto no Classroom.</p>

                  {/* ── Chat de refinamento ── */}
                  <div style={styles.chatWrap}>
                    <div style={styles.chatLabel}>✦ Refinar com IA</div>

                    {chatMessages.length > 0 && (
                      <div style={styles.chatHistory}>
                        {chatMessages.map((m, i) => (
                          <motion.div key={i}
                            style={m.role === 'user' ? styles.chatMsgUser : styles.chatMsgAI}
                            initial={{ opacity: 0, y: 6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.18 }}
                          >
                            {m.text}
                          </motion.div>
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
                </motion.div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <span style={styles.footerNote}>Gerado por Claude AI · Secretário Escolar</span>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── IA Modal ── */}
      <AnimatePresence>
      {modalOpen && (
        <motion.div style={styles.overlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setModalOpen(false)}
        >
          <motion.div style={styles.modal}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
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
                /gratuitas|upgrade/i.test(aiError) ? (
                  <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                    <strong style={{ color: '#e65100' }}>Limite atingido</strong>
                    <p style={{ margin: '6px 0 10px', color: 'var(--se-t2)' }}>Você usou suas 2 atividades gratuitas este mês. Assine o Pro para continuar sem limites.</p>
                    <button onClick={() => window.dispatchEvent(new CustomEvent('se:upgrade-needed'))} style={{ background: '#e65100', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                      Ver planos
                    </button>
                  </div>
                ) : (
                  <div style={styles.errorBox}><strong>Erro:</strong> {aiError}</div>
                )
              )}
              {analysis && !loading && (
                <div style={styles.analysisText}><MarkdownLike text={analysis} /></div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <span style={styles.footerNote}>Gerado por Claude AI · Secretário Escolar</span>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
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
