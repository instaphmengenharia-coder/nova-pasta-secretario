import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClassroom } from './hooks/useClassroom'
import { useClaudeAI } from './hooks/useClaudeAI'
import { useML } from './hooks/useML'
import { useAutoAgent } from './hooks/useAutoAgent'
import TaskCard from './components/TaskCard'
import Dashboard from './components/Dashboard'
import Precos from './components/Precos'
import { buscarPlanoUsuario } from './hooks/usePlano'

const COURSE_COLORS = [
  '#1a73e8','#e91e63','#9c27b0','#ff5722',
  '#4caf50','#009688','#ff9800','#795548',
  '#3f51b5','#00bcd4','#8bc34a','#f44336',
]

function getCourseColor(courseId = '') {
  let hash = 0
  for (let i = 0; i < courseId.length; i++)
    hash = courseId.charCodeAt(i) + ((hash << 5) - hash)
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length]
}

function groupByDeadline(tasks) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in7  = new Date(todayStart); in7.setDate(todayStart.getDate() + 7)
  const in14 = new Date(todayStart); in14.setDate(todayStart.getDate() + 14)

  const groups = { overdue: [], noDate: [], thisWeek: [], nextWeek: [], later: [] }

  for (const t of tasks) {
    if (!t.dueDate)                  groups.noDate.push(t)
    else if (t.dueDate < todayStart) groups.overdue.push(t)
    else if (t.dueDate <= in7)       groups.thisWeek.push(t)
    else if (t.dueDate <= in14)      groups.nextWeek.push(t)
    else                             groups.later.push(t)
  }
  return groups
}

const GROUP_DEFS = [
  { key: 'overdue',  label: 'Atrasadas' },
  { key: 'thisWeek', label: 'Esta semana' },
  { key: 'nextWeek', label: 'Próxima semana' },
  { key: 'later',    label: 'Depois' },
  { key: 'noDate',   label: 'Sem data de entrega' },
]

export default function App() {
  const {
    isAuthenticated, user, courses, tasks, announcements, loading, error,
    stats, signIn, signOut, isUrgent, isNotice, refresh, accessToken, refreshToken,
  } = useClassroom()

  const {
    analyzePriorities, dashboardAnalysis, dashboardLoading, dashboardError, solveTask,
    solveTaskWithContext, generateWeeklyPlan, weeklyPlan, weeklyPlanLoading, weeklyPlanError,
  } = useClaudeAI()

  const {
    difficulty, patterns, classifying,
    classifyBatch, recordSubmission, analyzePatterns,
    sortByPriority, canAnalyzePatterns, patternsLoading, patternsError,
    submissionCount, clearMLData,
  } = useML()

  const [tab, setTab]                   = useState('ASSIGNED')
  const [readNotices, setReadNotices]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('se_read') || '[]')) } catch { return new Set() }
  })
  const markRead = (id) => {
    setReadNotices((prev) => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('se_read', JSON.stringify([...next]))
      return next
    })
  }
  const [courseFilter, setCourseFilter] = useState('')
  const [search, setSearch]             = useState('')
  const [showSearch, setShowSearch]     = useState(false)
  const [openGroups, setOpenGroups]     = useState({ overdue: true, thisWeek: true, nextWeek: true, later: true, noDate: false })
  const [dark, setDark]                 = useState(() => localStorage.getItem('se_dark') === '1')
  const [whatsappPhone, setWhatsappPhone] = useState(() => localStorage.getItem('se_phone') || '5511938096314')
  const [showPhoneInput, setShowPhoneInput] = useState(false)
  const [phoneInputVal, setPhoneInputVal] = useState(() => localStorage.getItem('se_phone') || '5511938096314')
  const [autoMode, setAutoMode] = useState(() => localStorage.getItem('se_auto') === '1')
  const [extConnected, setExtConnected] = useState(false)
  const [showExtModal, setShowExtModal] = useState(false)
  const [planoInfo, setPlanoInfo] = useState({ plano: 'free', atividades_mes: 0, validade_ate: null })
  const [verificandoPagamento, setVerificandoPagamento] = useState(false)

  const [solutions, setSolutions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('se_solutions') || '{}') } catch { return {} }
  })
  const saveSolution = (taskId, text) => {
    setSolutions((prev) => {
      const next = { ...prev, [taskId]: text }
      localStorage.setItem('se_solutions', JSON.stringify(next))
      return next
    })
  }

  // Style examples: up to 3 recent approved answers used as writing style context
  const [styleExamples, setStyleExamples] = useState(() => {
    try { return JSON.parse(localStorage.getItem('se_style') || '[]') } catch { return [] }
  })
  const saveStyleExample = ({ task: taskTitle, answer }) => {
    setStyleExamples((prev) => {
      const filtered = prev.filter((e) => e.task !== taskTitle)
      const next = [{ task: taskTitle, answer: answer.slice(0, 600) }, ...filtered].slice(0, 3)
      localStorage.setItem('se_style', JSON.stringify(next))
      return next
    })
  }

  const [resolveAllOpen, setResolveAllOpen]       = useState(false)
  const [resolveAllProgress, setResolveAllProgress] = useState({ done: 0, total: 0, current: '' })
  const [resolveAllRunning, setResolveAllRunning] = useState(false)
  const resolveAllAbortRef = useRef(false)
  const prevTasksRef       = useRef([])

  // ── Auto Agent ────────────────────────────────────────────────────────────
  const {
    currentTask: autoCurrentTask,
    queueSize: autoQueueSize,
    running: autoRunning,
    log: autoLog,
    done: autoDone,
    stopAuto,
  } = useAutoAgent({ tasks, autoMode, extConnected, whatsappPhone })

  const [autoCompleted, setAutoCompleted] = useState(0)
  const prevAutoDone = useRef(null)
  useEffect(() => {
    if (autoDone && autoDone !== prevAutoDone.current) {
      prevAutoDone.current = autoDone
      setAutoCompleted(c => c + 1)
    }
  }, [autoDone])

  // ── Plano do usuário — busca inicial + refresh a cada 5 min ───────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return
    buscarPlanoUsuario(user.id).then(setPlanoInfo).catch(() => {})
    const iv = setInterval(() => {
      buscarPlanoUsuario(user.id).then(setPlanoInfo).catch(() => {})
    }, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [isAuthenticated, user?.id])

  // ── Detecta retorno do Mercado Pago e atualiza plano ───────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('collection_status') || params.get('status')
    if (!status) return
    window.history.replaceState({}, '', window.location.pathname)
    if (status === 'approved' && user?.id) {
      setTab('PRECOS')
      setVerificandoPagamento(true)
      setTimeout(() => {
        buscarPlanoUsuario(user.id)
          .then(data => { setPlanoInfo(data); setVerificandoPagamento(false) })
          .catch(() => setVerificandoPagamento(false))
      }, 4000)
    }
  }, [user?.id])

  // ── Redireciona para Planos quando limite free é atingido ──────────────────
  useEffect(() => {
    const handler = () => setTab('PRECOS')
    window.addEventListener('se:upgrade-needed', handler)
    return () => window.removeEventListener('se:upgrade-needed', handler)
  }, [])

  // ── Dark mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('se_dark', dark ? '1' : '0')
  }, [dark])

  // ── Extensão Chrome: detectar status via ping direto ─────────────────────
  useEffect(() => {
    if (!isAuthenticated) return

    let pendingTimeout = null

    function checkExt() {
      // Se não responder em 1.5s, considera desconectado
      clearTimeout(pendingTimeout)
      pendingTimeout = setTimeout(() => setExtConnected(false), 1500)
      window.postMessage({ type: 'SE_GET_STATUS' }, '*')
    }

    function onMessage(e) {
      if (e.data?.type === 'SE_EXT_PRESENT') checkExt()
      if (e.data?.type === 'SE_STATUS') {
        clearTimeout(pendingTimeout)
        setExtConnected(!!e.data.connected)
      }
    }

    window.addEventListener('message', onMessage)
    checkExt()
    const iv = setInterval(checkExt, 2000)
    return () => {
      window.removeEventListener('message', onMessage)
      clearInterval(iv)
      clearTimeout(pendingTimeout)
    }
  }, [isAuthenticated])

  // ── Notifications: request permission on login ─────────────────────────────
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [isAuthenticated])

  // ── Notifications: alert for tasks due in < 24h or overdue ────────────────
  useEffect(() => {
    if (!isAuthenticated || tasks.length === 0) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const notified = new Set(JSON.parse(sessionStorage.getItem('se_notified') || '[]'))
    const toNotify = tasks.filter(t => {
      if (t.status === 'TURNED_IN' || notified.has(t.id) || !t.dueDate) return false
      return t.dueDate - new Date() < 24 * 3600000
    })

    toNotify.forEach(t => {
      const diff = t.dueDate - new Date()
      const label = diff <= 0
        ? '⚠️ Atrasada'
        : `⏱ Faltam ${Math.max(1, Math.round(diff / 3600000))}h`
      new Notification(`${label}: ${t.title}`, { body: t.courseName })
      notified.add(t.id)
    })

    if (toNotify.length > 0) {
      sessionStorage.setItem('se_notified', JSON.stringify([...notified]))
    }
  }, [tasks])

  const handleResolveAll = async () => {
    const pending = tasks.filter((t) => t.status !== 'TURNED_IN' && !solutions[t.id])
    if (pending.length === 0) { setResolveAllOpen(true); return }

    setResolveAllOpen(true)
    setResolveAllRunning(true)
    resolveAllAbortRef.current = false
    setResolveAllProgress({ done: 0, total: pending.length, current: pending[0]?.title || '' })

    for (let i = 0; i < pending.length; i++) {
      if (resolveAllAbortRef.current) break
      const task = pending[i]
      setResolveAllProgress({ done: i, total: pending.length, current: task.title })
      try {
        const result = await solveTask(task)
        saveSolution(task.id, result)
      } catch { /* skip */ }
    }

    setResolveAllProgress((p) => ({ ...p, done: pending.length, current: '' }))
    setResolveAllRunning(false)
  }

  useEffect(() => {
    if (isAuthenticated && tasks.length > 0 && !dashboardAnalysis && !dashboardLoading)
      analyzePriorities(tasks)
  }, [isAuthenticated, tasks.length])

  const AGENT_URL = 'https://agente-servidor-production.up.railway.app'

  // ── Modo automático: registrar/desregistrar no scheduler ──────────────────
  useEffect(() => {
    if (!isAuthenticated || !user) return
    localStorage.setItem('se_auto', autoMode ? '1' : '0')
    if (autoMode) {
      fetch(`${AGENT_URL}/scheduler/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          accessToken,
          refreshToken,
          phone: whatsappPhone,
          userName: user.name,
          tasks: assignedTasks.map(t => ({
            id: t.id, courseId: t.courseId, courseName: t.courseName,
            title: t.title, description: t.description,
            dueDate: t.dueDate, status: t.status, alternateLink: t.alternateLink,
          })),
        }),
      }).catch(() => {})
    } else {
      fetch(`${AGENT_URL}/scheduler/desregistrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {})
    }
  }, [autoMode, isAuthenticated, tasks.length])

  useEffect(() => {
    if (!isAuthenticated || tasks.length === 0) return
    const unclassified = tasks.filter(
      (t) => t.status !== 'TURNED_IN' && difficulty[t.id] === undefined,
    )
    if (unclassified.length > 0) classifyBatch(unclassified)
  }, [isAuthenticated, tasks.length])

  useEffect(() => {
    const prev = prevTasksRef.current
    if (prev.length > 0 && tasks.length > 0) {
      const prevStatus = Object.fromEntries(prev.map((t) => [t.id, t.status]))
      for (const task of tasks) {
        if (task.status === 'TURNED_IN' && prevStatus[task.id] && prevStatus[task.id] !== 'TURNED_IN')
          recordSubmission(task)
      }
    }
    prevTasksRef.current = tasks
  }, [tasks])

  const regularTasks    = tasks.filter((t) => !isNotice(t))
  const assignedTasks   = regularTasks.filter((t) => t.status !== 'TURNED_IN')
  const doneTasks       = regularTasks.filter((t) => t.status === 'TURNED_IN')
  const urgentTasks     = assignedTasks.filter((t) => {
    if (!t.dueDate) return false
    const diff = t.dueDate - new Date()
    return diff >= 0 && diff <= 3 * 86400000
  })

  // Unified notices: notice-type tasks + professor announcements
  const noticeTasks = tasks.filter((t) => isNotice(t))
  const allNotices = [
    ...noticeTasks.map((t) => ({
      id: `task-${t.id}`,
      courseId: t.courseId,
      courseName: t.courseName,
      title: t.title,
      text: t.description,
      creationTime: t.dueDate,
      alternateLink: t.alternateLink,
    })),
    ...announcements.map((a) => ({
      id: `ann-${a.courseId}-${a.id}`,
      courseId: a.courseId,
      courseName: a.courseName,
      title: null,
      text: a.text,
      creationTime: a.creationTime,
      alternateLink: a.alternateLink,
    })),
  ].filter((n) => !readNotices.has(n.id))

  const applyFilters = (list) => list.filter((t) => {
    if (courseFilter && t.courseId !== courseFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return t.title.toLowerCase().includes(q) || t.courseName.toLowerCase().includes(q)
    }
    return true
  })

  const visibleAssigned = applyFilters(assignedTasks)
  const visibleDone     = applyFilters(doneTasks)

  const rawGroups = groupByDeadline(visibleAssigned)
  const groups    = Object.fromEntries(
    Object.entries(rawGroups).map(([key, arr]) => [key, sortByPriority(arr)]),
  )

  const toggleGroup = (key) => setOpenGroups((p) => ({ ...p, [key]: !p[key] }))

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div style={s.loginPage}>
        <motion.div style={s.loginCard}
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <ClassroomLogo size={56} />
          <h1 style={s.loginTitle}>Secretário Escolar</h1>
          <p style={s.loginSub}>
            Organize suas tarefas do Google Classroom com ajuda da inteligência artificial.
          </p>
          {error && <div style={s.errorAlert}>{error}</div>}
          <button style={s.googleBtn} onClick={signIn}>
            <GoogleIcon />
            Entrar com Google
          </button>
          <p style={s.loginHint}>Requer acesso ao Google Classroom</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={s.app}>

      {/* ── Auto Agent Banner ─────────────────────────────────────────────── */}
      <AnimatePresence>
      {autoMode && extConnected && (autoRunning || autoQueueSize > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -80 }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: autoRunning ? '#0f9d58' : '#1565c0',
            color: '#fff', padding: '8px 20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Left: status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{autoRunning ? '🤖' : '⏳'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {autoRunning && autoCurrentTask
                    ? <><strong>{autoCurrentTask.title}</strong> <span style={{ opacity: 0.85, fontWeight: 400 }}>— {autoCurrentTask.courseName}</span></>
                    : <>{autoQueueSize} atividade{autoQueueSize !== 1 ? 's' : ''} na fila — aguardando extensão...</>
                  }
                </div>
                {/* Last log entry */}
                {autoRunning && autoLog?.length > 0 && (() => {
                  const last = [...autoLog].reverse().find(e => e.type !== 'screenshot' && e.type !== 'thinking')
                  return last ? <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>{last.content}</div> : null
                })()}
              </div>
            </div>
            {/* Right: counters + stop */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {autoCompleted > 0 && (
                <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '2px 10px' }}>
                  ✅ {autoCompleted} entregue{autoCompleted !== 1 ? 's' : ''}
                </span>
              )}
              {autoQueueSize > 0 && (
                <span style={{ fontSize: 12, opacity: 0.85 }}>
                  {autoQueueSize} restante{autoQueueSize !== 1 ? 's' : ''}
                </span>
              )}
              {autoRunning && (
                <button onClick={stopAuto} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  ⏹ Parar
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.headerLeft}>
            <ClassroomLogo size={26} />
            <span style={s.headerTitle}>Secretário Escolar</span>
          </div>

          <div style={s.headerRight}>
            {showSearch && (
              <div style={s.searchWrap}>
                <span style={s.searchIcon}>⌕</span>
                <input
                  autoFocus
                  style={s.searchInput}
                  type="text"
                  placeholder="Pesquisar…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && <button style={s.searchClear} onClick={() => setSearch('')}>✕</button>}
              </div>
            )}
            {/* Badge extensão */}
            <div
              style={{
                ...s.iconBtn,
                display: 'flex', alignItems: 'center', gap: 4,
                background: extConnected ? '#34a85322' : 'transparent',
                color: extConnected ? '#34a853' : 'var(--se-t4)',
                border: `1px solid ${extConnected ? '#34a853' : 'var(--se-border)'}`,
                borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                cursor: extConnected ? 'default' : 'pointer',
              }}
              title={extConnected ? 'Extensão Chrome conectada e ativa' : 'Clique para instalar a extensão'}
              onClick={() => { if (!extConnected) setShowExtModal(true) }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: extConnected ? '#34a853' : '#9aa0a6', display: 'inline-block', flexShrink: 0 }} />
              {extConnected ? 'EXT ON' : 'EXT OFF'}
            </div>
            <button style={s.iconBtn} title="Pesquisar" onClick={() => { setShowSearch(!showSearch); setSearch('') }}>⌕</button>
            <button style={s.iconBtn} title="Atualizar" onClick={refresh} disabled={loading}>{loading ? '…' : '↺'}</button>
            <button style={s.iconBtn} title={dark ? 'Modo claro' : 'Modo escuro'} onClick={() => setDark(!dark)}>
              {dark ? '☀' : '🌙'}
            </button>
            <button
              style={{ ...s.iconBtn, color: whatsappPhone ? '#25d366' : 'var(--se-t3)' }}
              title="Configurar WhatsApp"
              onClick={() => setShowPhoneInput(!showPhoneInput)}
            >
              📱
            </button>
            <button
              style={{
                ...s.iconBtn,
                background: autoMode ? '#4caf5022' : 'transparent',
                color: autoMode ? '#4caf50' : 'var(--se-t3)',
                border: `1px solid ${autoMode ? '#4caf50' : 'var(--se-border)'}`,
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
              }}
              title={autoMode ? 'Modo automático ligado — clique para desligar' : 'Modo automático desligado — clique para ligar'}
              onClick={() => setAutoMode(!autoMode)}
            >
              {autoMode ? '🤖 AUTO ON' : '🤖 AUTO'}
            </button>
            {/* Indicador de plano */}
            {planoInfo.plano === 'free' ? (
              <button onClick={() => setTab('PRECOS')} style={{
                background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 20,
                padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#e65100',
                cursor: 'pointer', fontFamily: FONT,
              }}>
                {2 - (planoInfo.atividades_mes || 0) <= 0 ? '0/2 — Fazer upgrade' : `${2 - (planoInfo.atividades_mes || 0)}/2 restantes`}
              </button>
            ) : (
              <button onClick={() => setTab('PRECOS')} style={{
                background: planoInfo.plano === 'premium' ? '#f3e5f5' : '#e8f0fe',
                border: `1px solid ${planoInfo.plano === 'premium' ? '#ce93d8' : '#90caf9'}`,
                borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700,
                color: planoInfo.plano === 'premium' ? '#7b1fa2' : '#1565c0',
                cursor: 'pointer', fontFamily: FONT,
              }}>
                {planoInfo.plano === 'premium'
                  ? `💎 ${planoInfo.atividades_mes || 0}/80`
                  : `⭐ ${planoInfo.atividades_mes || 0}/30`}
              </button>
            )}
            {user && (
              <div style={s.userInfo}>
                {user.photo
                  ? <img src={user.photo} alt={user.name} style={s.userPhoto} referrerPolicy="no-referrer" title={user.name} />
                  : <div style={s.userPhotoFallback} title={user.name}>{user.name[0]}</div>
                }
              </div>
            )}
            <button style={s.signOutBtn} onClick={signOut}>Sair</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabRow}>
          {[
            ['ASSIGNED', 'Pendentes', assignedTasks.length],
            ['DONE', 'Entregues', doneTasks.length],
            ['NOTICES', '📢 Avisos', allNotices.length],
            ['PLAN', 'Plano Semanal', null],
            ['DASHBOARD', '📊 Histórico', null],
            ['PRECOS', '💎 Planos', null],
          ].map(([key, label, count]) => (
            <button key={key} style={s.tab(tab === key)} onClick={() => setTab(key)}>
              {label}
              {count !== null && (
                <span style={s.tabCount(tab === key)}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Modal instalação da extensão */}
      {showExtModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowExtModal(false)}
        >
          <div
            style={{ background: 'var(--se-card)', borderRadius: 14, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.25)', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowExtModal(false)}
              style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--se-t4)' }}
            >✕</button>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧩</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 17, color: 'var(--se-t1)' }}>Instalar Extensão Chrome</h2>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--se-t3)', lineHeight: 1.6 }}>
              A extensão permite que a IA controle seu Chrome e faça atividades automaticamente.
            </p>

            {/* Opção fácil */}
            <div style={{ background: '#e8f5e9', border: '1px solid #34a853', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e7e34', marginBottom: 6 }}>⚡ Jeito Fácil — Instalador Automático (Windows)</div>
              <ol style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12, color: '#2d6a4f', lineHeight: 2 }}>
                <li>Baixe o instalador abaixo</li>
                <li>Clique duas vezes no arquivo <code>instalar.bat</code></li>
                <li>Ele abre o Chrome automaticamente — siga as instruções na tela</li>
              </ol>
              <a
                href="/api/download-ext"
                download="instalar.bat"
                style={{ display: 'block', background: '#0f9d58', color: '#fff', borderRadius: 7, padding: '9px 0', textAlign: 'center', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
              >
                ⬇ Baixar Instalador (.bat)
              </a>
            </div>

            {/* Opção manual */}
            <details style={{ marginBottom: 12 }}>
              <summary style={{ fontSize: 12, color: 'var(--se-t4)', cursor: 'pointer', marginBottom: 8 }}>Instalar manualmente (avançado)</summary>
              <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--se-t2)', lineHeight: 2 }}>
                <li>Baixe o ZIP abaixo e extraia</li>
                <li>Abra <strong>chrome://extensions</strong>, ative <strong>Modo do desenvolvedor</strong></li>
                <li>Clique em <strong>"Carregar sem compactação"</strong></li>
                <li>Selecione a pasta <strong>interna</strong> que contém <code>manifest.json</code></li>
              </ol>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexDirection: 'column' }}>
                <a href="https://github.com/instaphmengenharia-coder/secretario-extension/archive/refs/heads/master.zip" target="_blank" rel="noreferrer"
                  style={{ background: '#1a73e8', color: '#fff', borderRadius: 7, padding: '8px 0', textAlign: 'center', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                  ⬇ Baixar ZIP
                </a>
                <button onClick={() => navigator.clipboard.writeText('chrome://extensions')}
                  style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)', borderRadius: 7, padding: '8px 0', fontSize: 12, color: 'var(--se-t2)', cursor: 'pointer' }}>
                  📋 Copiar chrome://extensions
                </button>
              </div>
            </details>
          </div>
        </div>
      )}

      {showPhoneInput && (
        <div style={s.phoneBanner}>
          <span style={s.phoneBannerLabel}>📱 Número WhatsApp (com DDD, sem espaços):</span>
          <input
            style={s.phoneInput}
            type="tel"
            placeholder="Ex: 5531998202726"
            value={phoneInputVal}
            onChange={e => setPhoneInputVal(e.target.value)}
          />
          <button style={s.phoneSaveBtn} onClick={() => {
            localStorage.setItem('se_phone', phoneInputVal)
            setWhatsappPhone(phoneInputVal)
            setShowPhoneInput(false)
          }}>Salvar</button>
          {whatsappPhone && (
            <button style={s.phoneClearBtn} onClick={() => {
              localStorage.removeItem('se_phone')
              setWhatsappPhone('')
              setPhoneInputVal('')
              setShowPhoneInput(false)
            }}>Remover</button>
          )}
        </div>
      )}

      <main style={s.main}>
        {error && <div style={s.errorAlert}>{error}</div>}
        {loading && tasks.length === 0 && (
          <div style={s.loadingBanner}><LoadingDots /><span>Carregando turmas e atividades…</span></div>
        )}

        {/* Toolbar */}
        <div style={s.toolbar}>
          <div style={s.toolbarLeft}>
            <select
              style={s.courseSelect}
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="">Todas as turmas</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={s.toolbarRight}>
            {tab === 'ASSIGNED' && assignedTasks.length > 0 && (
              <button style={s.resolveAllBtn} onClick={handleResolveAll}>
                ✦ Resolver Todas
              </button>
            )}
          </div>
        </div>

        {/* ── Stats Cards ── */}
        {tasks.length > 0 && (
          <motion.div style={s.statsRow}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <StatCard icon="🎓" value={courses.length}       label="Turmas ativas"    color="#1a73e8" onClick={() => {}} />
            <StatCard icon="📋" value={assignedTasks.length} label="Pendentes"         color="#f29900" onClick={() => setTab('ASSIGNED')} active={tab === 'ASSIGNED'} />
            <StatCard icon="⚡" value={urgentTasks.length}   label="Urgente (≤3 dias)" color="#ea4335" onClick={() => setTab('ASSIGNED')} highlight={urgentTasks.length > 0} />
            <StatCard icon="✓"  value={doneTasks.length}     label="Entregas"          color="#34a853" onClick={() => setTab('DONE')} active={tab === 'DONE'} />
          </motion.div>
        )}

        {/* ── Urgent banner ── */}
        {urgentTasks.length > 0 && tab !== 'DONE' && (
          <motion.div style={s.urgentBanner}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <span style={s.urgentBannerIcon}>⚡</span>
            <span>
              <strong>{urgentTasks.length} atividade{urgentTasks.length !== 1 ? 's' : ''}</strong> com prazo em até 3 dias!
              {courseFilter === '' && ' Clique em um card acima para filtrar.'}
            </span>
          </motion.div>
        )}

        {/* AI panel */}
        <div style={s.aiPanel}>
          <div style={s.aiPanelHeader}>
            <div style={s.aiPanelTitleRow}>
              <span style={s.aiPanelIcon}>✦</span>
              <span style={s.aiPanelLabel}>Análise de Prioridades — IA</span>
            </div>
            {!dashboardLoading && (
              <button style={s.reanalyzeBtn} onClick={() => analyzePriorities(tasks)}>
                {dashboardAnalysis ? 'Reanalisar' : 'Analisar'}
              </button>
            )}
          </div>
          {dashboardLoading && (
            <div style={s.aiLoading}><MiniSpinner /><span>Analisando suas atividades…</span></div>
          )}
          {dashboardError && !dashboardLoading && <p style={s.aiError}>{dashboardError}</p>}
          {dashboardAnalysis && !dashboardLoading && <p style={s.aiText}>{dashboardAnalysis}</p>}
          {!dashboardAnalysis && !dashboardLoading && !dashboardError && tasks.length === 0 && !loading && (
            <p style={s.aiPlaceholder}>Nenhuma atividade encontrada nas suas turmas ativas.</p>
          )}
        </div>

        {/* ML Patterns panel */}
        <div style={s.aiPanel}>
          <div style={s.aiPanelHeader}>
            <div style={s.aiPanelTitleRow}>
              <span style={s.aiPanelIcon}>◈</span>
              <span style={{ ...s.aiPanelLabel, color: '#137333' }}>Padrões de Entrega — ML</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {submissionCount > 0 && (
                <span style={s.aiPlaceholder}>{submissionCount} entrega{submissionCount !== 1 ? 's' : ''} registrada{submissionCount !== 1 ? 's' : ''}</span>
              )}
              {!patternsLoading && canAnalyzePatterns && (
                <button style={s.reanalyzeBtn} onClick={analyzePatterns}>
                  {patterns ? 'Reanalisar' : 'Analisar padrões'}
                </button>
              )}
            </div>
          </div>
          {patternsLoading && (
            <div style={s.aiLoading}><MiniSpinner /><span>Analisando seus padrões…</span></div>
          )}
          {patternsError && !patternsLoading && <p style={s.aiError}>{patternsError}</p>}
          {patterns && !patternsLoading && <p style={s.aiText}>{patterns.insights}</p>}
          {!patterns && !patternsLoading && !patternsError && (
            <p style={s.aiPlaceholder}>
              {canAnalyzePatterns
                ? 'Clique em "Analisar padrões" para ver insights sobre seu histórico de entregas.'
                : `Aguardando mais entregas para ativar o aprendizado (${submissionCount}/3).`}
            </p>
          )}
        </div>


        {/* Tabs with animation */}
        <AnimatePresence mode="wait">
        {/* Assigned tab */}
        {tab === 'ASSIGNED' && (
          <motion.div key="assigned" style={s.groupsContainer}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          >
            {GROUP_DEFS.map(({ key, label }) => {
              const items = groups[key]
              const isOpen = openGroups[key]
              return (
                <div key={key} style={s.group}>
                  <button style={s.groupHeader} onClick={() => toggleGroup(key)}>
                    <span style={s.groupLabel}>{label}</span>
                    <div style={s.groupRight}>
                      <span style={{
                        ...s.groupCount,
                        color: items.length > 0
                          ? (key === 'overdue' ? '#ea4335' : '#1a73e8')
                          : 'var(--se-t4)',
                        fontWeight: items.length > 0 ? 700 : 400,
                      }}>
                        {items.length}
                      </span>
                      <span style={{ ...s.chevron, color: 'var(--se-t4)' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  <div style={s.groupDivider} />

                  {isOpen && items.length > 0 && (
                    <div style={s.groupItems}>
                      {items.map((task, i) => (
                        <motion.div
                          key={`${task.courseId}-${task.id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.05, 0.35), duration: 0.22 }}
                        >
                          <TaskCard
                            task={task}
                            isUrgent={isUrgent(task)}
                            courseColor={getCourseColor(task.courseId)}
                            cachedSolution={solutions[task.id] || null}
                            onSolutionSaved={(text) => saveSolution(task.id, text)}
                            onSolutionCopied={saveStyleExample}
                            styleExamples={styleExamples}
                            difficulty={difficulty[task.id] ?? null}
                            classifyingDifficulty={classifying.has(task.id)}
                            whatsappPhone={whatsappPhone}
                            accessToken={accessToken}
                            solveTaskWithContext={solveTaskWithContext}
                            extConnected={extConnected}
                            userId={user?.id || null}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {isOpen && items.length === 0 && (
                    <div style={s.groupEmpty}>Nenhuma atividade.</div>
                  )}
                </div>
              )
            })}

            {visibleAssigned.length === 0 && !loading && (
              <div style={s.emptyState}>
                <p style={s.emptyIcon}>📭</p>
                <p style={s.emptyText}>Nenhuma atividade pendente.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Done tab */}
        {tab === 'DONE' && (
          <motion.div key="done" style={s.groupsContainer}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          >
            {visibleDone.length === 0 && !loading ? (
              <div style={s.emptyState}>
                <p style={s.emptyIcon}>✓</p>
                <p style={s.emptyText}>Nenhuma atividade entregue ainda.</p>
              </div>
            ) : (
              <div style={s.groupItems}>
                {visibleDone.map((task, i) => (
                  <motion.div
                    key={`${task.courseId}-${task.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.05, 0.35), duration: 0.22 }}
                  >
                    <TaskCard
                      task={task}
                      isUrgent={false}
                      courseColor={getCourseColor(task.courseId)}
                      cachedSolution={solutions[task.id] || null}
                      onSolutionSaved={(text) => saveSolution(task.id, text)}
                      onSolutionCopied={saveStyleExample}
                      styleExamples={styleExamples}
                      difficulty={difficulty[task.id] ?? null}
                      classifyingDifficulty={false}
                      whatsappPhone={whatsappPhone}
                      accessToken={accessToken}
                      solveTaskWithContext={solveTaskWithContext}
                      extConnected={extConnected}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Notices tab */}
        {tab === 'NOTICES' && (
          <motion.div key="notices" style={s.groupsContainer}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          >
            {allNotices.length === 0 ? (
              <div style={s.emptyState}>
                <p style={s.emptyIcon}>📭</p>
                <p style={s.emptyText}>Nenhum aviso no momento.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allNotices.map((notice, i) => (
                  <motion.div key={notice.id}
                    style={{ ...s.noticeCard, borderLeft: `4px solid ${getCourseColor(notice.courseId)}` }}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.06, 0.3), duration: 0.22 }}
                  >
                    <div style={s.noticeTop}>
                      <div>
                        <span style={{ color: getCourseColor(notice.courseId), fontSize: 12, fontWeight: 600 }}>
                          {notice.courseName}
                        </span>
                        {notice.title && <p style={s.noticeTitle}>{notice.title}</p>}
                      </div>
                      {notice.creationTime && (
                        <span style={s.annDate}>{notice.creationTime.toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                    {notice.text && (
                      <p style={s.noticeText}>
                        {notice.text.length > 300 ? notice.text.slice(0, 300) + '…' : notice.text}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                      {notice.alternateLink && (
                        <a href={notice.alternateLink} target="_blank" rel="noopener noreferrer" style={s.annLink}>
                          Ver no Classroom →
                        </a>
                      )}
                      <button style={s.markReadBtn} onClick={() => markRead(notice.id)}>
                        ✓ Marcar como lido
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Plan tab */}
        {tab === 'PLAN' && (
          <motion.div key="plan" style={s.groupsContainer}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          >
            <div style={s.aiPanel}>
              <div style={s.aiPanelHeader}>
                <div style={s.aiPanelTitleRow}>
                  <span style={s.aiPanelIcon}>📅</span>
                  <span style={{ ...s.aiPanelLabel, color: '#9c27b0' }}>Planejamento Semanal — IA</span>
                </div>
                {!weeklyPlanLoading && (
                  <button style={s.reanalyzeBtn} onClick={() => generateWeeklyPlan(tasks)}>
                    {weeklyPlan ? 'Regerar plano' : 'Gerar plano'}
                  </button>
                )}
              </div>
              {weeklyPlanLoading && (
                <div style={s.aiLoading}><MiniSpinner /><span>Montando seu plano de estudos…</span></div>
              )}
              {weeklyPlanError && !weeklyPlanLoading && <p style={s.aiError}>{weeklyPlanError}</p>}
              {weeklyPlan && !weeklyPlanLoading && (
                <div style={{ ...s.aiText, marginTop: 4 }}>
                  {weeklyPlan.split('\n').map((line, i) => {
                    if (!line.trim()) return <br key={i} />
                    const boldParts = line.split(/\*\*(.*?)\*\*/g)
                    return (
                      <p key={i} style={{ marginBottom: 6, lineHeight: 1.7 }}>
                        {boldParts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
                      </p>
                    )
                  })}
                </div>
              )}
              {!weeklyPlan && !weeklyPlanLoading && !weeklyPlanError && (
                <p style={s.aiPlaceholder}>
                  Clique em "Gerar plano" para criar um cronograma de estudos personalizado para esta semana.
                </p>
              )}
            </div>

            {styleExamples.length > 0 && (
              <div style={s.aiPanel}>
                <div style={s.aiPanelHeader}>
                  <div style={s.aiPanelTitleRow}>
                    <span style={s.aiPanelIcon}>✍</span>
                    <span style={{ ...s.aiPanelLabel, color: '#e8710a' }}>Estilo Aprendido</span>
                  </div>
                  <button style={s.reanalyzeBtn} onClick={() => {
                    setStyleExamples([])
                    localStorage.removeItem('se_style')
                  }}>Limpar</button>
                </div>
                <p style={s.aiPlaceholder}>
                  {styleExamples.length} resposta{styleExamples.length !== 1 ? 's' : ''} aprovada{styleExamples.length !== 1 ? 's' : ''} salva{styleExamples.length !== 1 ? 's' : ''} como referência de estilo.
                  A IA usará esses exemplos para manter consistência nas próximas respostas.
                </p>
                <ul style={{ marginTop: 6, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {styleExamples.map((e, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--se-t3)', background: 'var(--se-input)', padding: '4px 10px', borderRadius: 6 }}>
                      ✓ {e.task}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
        {/* Dashboard tab */}
        {tab === 'DASHBOARD' && (
          <Dashboard tasks={tasks} />
        )}
        {/* Precos tab */}
        {tab === 'PRECOS' && (
          <Precos user={user} planoAtual={planoInfo.plano} verificandoPagamento={verificandoPagamento} onVoltar={() => setTab('ASSIGNED')} />
        )}
        </AnimatePresence>

        {/* Resolve-all modal */}
        <AnimatePresence>
        {resolveAllOpen && (
          <motion.div style={s.overlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !resolveAllRunning && setResolveAllOpen(false)}
          >
            <motion.div style={s.resolveAllModal}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={s.resolveAllHeader}>
                <h2 style={s.resolveAllTitle}>✦ Resolver Todas as Atividades</h2>
                {!resolveAllRunning && (
                  <button style={s.closeBtn} onClick={() => setResolveAllOpen(false)}>✕</button>
                )}
              </div>
              {resolveAllRunning ? (
                <div style={s.resolveAllBody}>
                  <div style={s.progressBar}>
                    <div style={{
                      ...s.progressFill,
                      width: `${resolveAllProgress.total > 0 ? (resolveAllProgress.done / resolveAllProgress.total) * 100 : 0}%`
                    }} />
                  </div>
                  <p style={s.progressText}>{resolveAllProgress.done} de {resolveAllProgress.total} resolvidas</p>
                  {resolveAllProgress.current && (
                    <p style={s.progressCurrent}>Resolvendo: {resolveAllProgress.current}</p>
                  )}
                  <button style={s.abortBtn} onClick={() => { resolveAllAbortRef.current = true }}>Parar</button>
                </div>
              ) : (
                <div style={s.resolveAllBody}>
                  {resolveAllProgress.done > 0 && (
                    <p style={s.progressDone}>✓ {resolveAllProgress.done} atividades resolvidas!</p>
                  )}
                  {tasks.filter((t) => t.status !== 'TURNED_IN' && !solutions[t.id]).length === 0 ? (
                    <p style={s.progressDone}>✓ Todas as atividades já têm respostas salvas.</p>
                  ) : (
                    <p style={s.resolveAllInfo}>
                      {tasks.filter((t) => t.status !== 'TURNED_IN' && !solutions[t.id]).length} atividades
                      pendentes serão resolvidas pela IA. As respostas ficam salvas automaticamente.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button style={s.resolveAllStartBtn} onClick={handleResolveAll}>
                      ✦ {resolveAllProgress.done > 0 ? 'Resolver restantes' : 'Iniciar'}
                    </button>
                    <button style={s.clearCacheBtn} onClick={() => {
                      setSolutions({})
                      localStorage.removeItem('se_solutions')
                    }}>
                      Limpar respostas salvas
                    </button>
                    <button style={s.clearCacheBtn} onClick={clearMLData}>
                      Limpar dados ML
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color, onClick, active = false, highlight = false }) {
  return (
    <motion.button
      style={{
        ...s.statCard,
        borderColor: highlight ? color : active ? color + '55' : 'var(--se-border)',
        boxShadow: highlight
          ? `0 0 0 1px ${color}44, 0 4px 16px ${color}22`
          : active ? `0 0 0 1px ${color}33` : 'none',
      }}
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ ...s.statValue, color }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
      {highlight && <span style={{ ...s.statPulse, background: color }} />}
    </motion.button>
  )
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginRight: 10 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#1a73e8',
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, display: 'inline-block',
        }} />
      ))}
    </span>
  )
}

function MiniSpinner() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%',
      border: '2px solid rgba(26,115,232,0.2)', borderTopColor: '#1a73e8',
      animation: 'spin 0.8s linear infinite', marginRight: 8, flexShrink: 0,
    }} />
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 10, flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function ClassroomLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <rect width="40" height="40" rx="6" fill="#0f9d58" />
      <rect x="8" y="10" width="24" height="18" rx="2" fill="white" opacity="0.95" />
      <rect x="8" y="10" width="24" height="6" rx="2" fill="#f4b400" />
      <circle cx="20" cy="23" r="4" fill="#0f9d58" />
      <rect x="14" y="28" width="12" height="2" rx="1" fill="#0f9d58" />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const s = {
  loginPage: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 20, background: 'var(--se-bg)',
  },
  loginCard: {
    background: 'var(--se-surface)', borderRadius: 12, padding: '48px 40px', textAlign: 'center',
    maxWidth: 400, width: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  loginTitle: {
    fontSize: 24, color: 'var(--se-t1)', fontFamily: FONT, fontWeight: 600,
    marginBottom: 8, marginTop: 16,
  },
  loginSub: {
    fontSize: 14, color: 'var(--se-t3)', lineHeight: 1.6, marginBottom: 32, fontFamily: FONT,
  },
  googleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '10px 20px', borderRadius: 6,
    background: '#1a73e8', color: '#fff', border: 'none',
    fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
    boxShadow: '0 2px 6px rgba(26,115,232,0.4)', marginBottom: 12,
  },
  loginHint: { fontSize: 12, color: 'var(--se-t4)', fontFamily: FONT },

  app: { minHeight: '100vh', background: 'var(--se-bg)', fontFamily: FONT, color: 'var(--se-t1)' },

  header: {
    background: 'var(--se-surface)', borderBottom: '1px solid var(--se-divider)',
    position: 'sticky', top: 0, zIndex: 100,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  headerInner: {
    maxWidth: 900, margin: '0 auto', padding: '0 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56,
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: 600, color: 'var(--se-t1)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 6 },

  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 10, fontSize: 16, color: 'var(--se-t4)', pointerEvents: 'none' },
  searchInput: {
    width: 220, padding: '7px 30px 7px 28px',
    background: 'var(--se-input)', border: '1px solid var(--se-border2)',
    borderRadius: 24, color: 'var(--se-t1)', fontSize: 14, fontFamily: FONT, outline: 'none',
  },
  searchClear: {
    position: 'absolute', right: 8, background: 'none', border: 'none',
    color: 'var(--se-t4)', cursor: 'pointer', fontSize: 12, padding: 2,
  },
  iconBtn: {
    background: 'none', border: 'none', color: 'var(--se-t3)',
    width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
    fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  userInfo: { display: 'flex', alignItems: 'center' },
  userPhoto: { width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' },
  userPhotoFallback: {
    width: 32, height: 32, borderRadius: '50%', background: '#1a73e8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  signOutBtn: {
    background: 'none', border: '1px solid var(--se-border2)',
    color: 'var(--se-t2)', borderRadius: 6, padding: '5px 12px',
    cursor: 'pointer', fontSize: 13, fontFamily: FONT,
  },

  tabRow: {
    maxWidth: 900, margin: '0 auto', padding: '0 20px',
    display: 'flex', gap: 0, borderTop: '1px solid var(--se-sep)',
  },
  tab: (active) => ({
    padding: '12px 20px', background: 'none', border: 'none',
    borderBottom: active ? '3px solid #1a73e8' : '3px solid transparent',
    color: active ? '#1a73e8' : 'var(--se-t3)',
    fontWeight: active ? 600 : 400, fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT,
    transition: 'color 0.15s',
  }),
  tabCount: (active) => ({
    background: active ? '#e8f0fe' : 'var(--se-input)',
    color: active ? '#1a73e8' : 'var(--se-t4)',
    fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 600,
  }),

  main: { maxWidth: 900, margin: '0 auto', padding: '20px 20px 60px' },

  loadingBanner: { display: 'flex', alignItems: 'center', color: 'var(--se-t3)', fontSize: 14, marginBottom: 16 },
  errorAlert: {
    background: '#fce8e6', border: '1px solid #f28b82',
    color: '#c5221f', borderRadius: 8, padding: '12px 16px', fontSize: 14, marginBottom: 16,
  },

  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14,
  },
  statCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: '16px 10px', borderRadius: 12,
    background: 'var(--se-surface)', border: '1px solid var(--se-border)',
    cursor: 'pointer', position: 'relative', overflow: 'hidden',
    fontFamily: FONT, transition: 'border-color 0.2s',
  },
  statValue: {
    fontSize: 26, fontWeight: 700, lineHeight: 1,
  },
  statLabel: {
    fontSize: 11, color: 'var(--se-t4)', fontWeight: 500, textAlign: 'center',
  },
  statPulse: {
    position: 'absolute', top: 6, right: 6,
    width: 7, height: 7, borderRadius: '50%',
    animation: 'pulse 2s ease-in-out infinite',
  },

  urgentBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--se-urgent-bg)', border: '1px solid var(--se-urgent-border)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: 'var(--se-urgent-color)', marginBottom: 14,
  },
  urgentBannerIcon: { fontSize: 16, flexShrink: 0 },

  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, gap: 10, flexWrap: 'wrap',
  },
  toolbarLeft:  { display: 'flex', gap: 8, alignItems: 'center' },
  toolbarRight: { display: 'flex', gap: 8 },
  courseSelect: {
    padding: '8px 14px', border: '1px solid var(--se-border2)', borderRadius: 6,
    background: 'var(--se-surface)', color: 'var(--se-t2)', fontSize: 14, fontFamily: FONT,
    cursor: 'pointer', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  resolveAllBtn: {
    background: '#1a73e8', border: 'none', borderRadius: 6,
    color: '#fff', padding: '8px 18px', fontSize: 13, cursor: 'pointer',
    fontWeight: 500, boxShadow: '0 1px 4px rgba(26,115,232,0.35)',
  },

  aiPanel: {
    background: 'var(--se-surface)', border: '1px solid var(--se-border)',
    borderRadius: 10, padding: '14px 18px', marginBottom: 16,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  aiPanelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  aiPanelTitleRow: { display: 'flex', alignItems: 'center', gap: 7 },
  aiPanelIcon:  { fontSize: 14, color: '#1a73e8' },
  aiPanelLabel: { fontSize: 13, color: '#1a73e8', fontWeight: 600 },
  reanalyzeBtn: {
    background: 'none', border: '1px solid var(--se-border2)',
    color: 'var(--se-t3)', borderRadius: 20, padding: '3px 12px', fontSize: 12, cursor: 'pointer',
  },
  aiLoading:     { display: 'flex', alignItems: 'center', color: 'var(--se-t3)', fontSize: 14 },
  aiText:        { color: 'var(--se-t2)', fontSize: 14, lineHeight: 1.7 },
  aiError:       { color: '#c5221f', fontSize: 13 },
  aiPlaceholder: { color: 'var(--se-t4)', fontSize: 13, fontStyle: 'italic' },

  annPanel: {
    background: 'var(--se-surface)', border: '1px solid var(--se-border)',
    borderRadius: 10, marginBottom: 16, overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  annToggle: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    background: 'none', border: 'none', padding: '12px 18px',
    cursor: 'pointer', textAlign: 'left',
  },
  annToggleText: {
    display: 'flex', alignItems: 'center', gap: 8, flex: 1,
    color: 'var(--se-t2)', fontSize: 14, fontWeight: 500,
  },
  annCount: { background: 'var(--se-input)', color: 'var(--se-t3)', fontSize: 11, padding: '1px 7px', borderRadius: 20 },
  chevron:  { color: 'var(--se-t4)', fontSize: 11 },
  annList:  { borderTop: '1px solid var(--se-border)', display: 'flex', flexDirection: 'column' },
  annItem:  { padding: '12px 18px', borderBottom: '1px solid var(--se-sep)' },
  annItemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  annDate:  { fontSize: 11, color: 'var(--se-t4)' },
  annText:  { fontSize: 13, color: 'var(--se-t2)', lineHeight: 1.6, marginBottom: 4 },
  annLink:  { fontSize: 12, color: '#1a73e8', textDecoration: 'none' },

  groupsContainer: { display: 'flex', flexDirection: 'column', gap: 0 },
  group: { marginBottom: 0 },
  groupHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', background: 'none', border: 'none',
    padding: '16px 4px 10px', cursor: 'pointer', textAlign: 'left',
  },
  groupLabel: { fontSize: 16, color: 'var(--se-t1)', fontWeight: 400 },
  groupRight: { display: 'flex', alignItems: 'center', gap: 12 },
  groupCount: { fontSize: 16 },
  groupDivider: { height: 1, background: 'var(--se-divider)', marginBottom: 0 },
  groupItems:   { display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 8 },
  groupEmpty:   { padding: '12px 0', color: 'var(--se-t4)', fontSize: 13 },

  emptyState: { textAlign: 'center', padding: '60px 0' },
  emptyIcon:  { fontSize: 36, marginBottom: 10, color: 'var(--se-t4)' },
  emptyText:  { color: 'var(--se-t4)', fontSize: 14 },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  resolveAllModal: {
    background: 'var(--se-surface)', borderRadius: 12, width: '100%', maxWidth: 480,
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
  },
  resolveAllHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px 16px', borderBottom: '1px solid var(--se-border)',
  },
  resolveAllTitle: { fontSize: 17, color: 'var(--se-t1)', fontWeight: 600 },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--se-t4)', fontSize: 18, cursor: 'pointer', padding: '4px 8px',
  },
  resolveAllBody:  { padding: '20px 24px 24px' },
  progressBar:     { height: 4, background: 'var(--se-border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  progressFill:    { height: '100%', background: '#1a73e8', borderRadius: 10, transition: 'width 0.4s ease' },
  progressText:    { color: 'var(--se-t2)', fontSize: 14, marginBottom: 4 },
  progressCurrent: { color: 'var(--se-t4)', fontSize: 12, fontStyle: 'italic', marginBottom: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  progressDone:    { color: '#34a853', fontSize: 14, marginBottom: 16 },
  resolveAllInfo:  { color: 'var(--se-t3)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 },
  resolveAllStartBtn: {
    background: '#1a73e8', border: 'none', borderRadius: 6,
    color: '#fff', padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 500,
  },
  abortBtn: {
    background: '#fce8e6', border: '1px solid #f28b82',
    color: '#c5221f', borderRadius: 6, padding: '8px 20px', fontSize: 13, cursor: 'pointer',
  },
  clearCacheBtn: {
    background: 'none', border: '1px solid var(--se-border2)',
    color: 'var(--se-t3)', borderRadius: 6, padding: '10px 16px', fontSize: 12, cursor: 'pointer',
  },

  noticeCard: {
    background: 'var(--se-surface)', borderRadius: 10, padding: '14px 18px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  noticeTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  noticeTitle: { fontSize: 14, fontWeight: 600, color: 'var(--se-t1)', marginTop: 2 },
  noticeText: { fontSize: 13, color: 'var(--se-t2)', lineHeight: 1.6 },
  markReadBtn: {
    background: 'none', border: '1px solid var(--se-border2)',
    color: 'var(--se-t3)', borderRadius: 20, padding: '4px 12px',
    fontSize: 12, cursor: 'pointer', fontWeight: 500,
  },

  phoneBanner: {
    background: '#e6f9ee', borderBottom: '1px solid #a8d5b5',
    padding: '10px 20px', display: 'flex', alignItems: 'center',
    gap: 10, flexWrap: 'wrap',
  },
  phoneBannerLabel: { fontSize: 13, color: '#1a5c34', fontFamily: FONT },
  phoneInput: {
    padding: '6px 12px', border: '1px solid #a8d5b5', borderRadius: 6,
    fontSize: 13, fontFamily: FONT, background: '#fff', color: '#202124',
    outline: 'none', width: 200,
  },
  phoneSaveBtn: {
    background: '#25d366', border: 'none', borderRadius: 6,
    color: '#fff', padding: '6px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500,
  },
  phoneClearBtn: {
    background: 'none', border: '1px solid #a8d5b5', borderRadius: 6,
    color: '#1a5c34', padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  },
}

if (typeof document !== 'undefined' && !document.getElementById('app-styles')) {
  const el = document.createElement('style')
  el.id = 'app-styles'
  el.textContent = `
    :root {
      --se-bg: #f1f3f4;
      --se-surface: #ffffff;
      --se-surface2: #f8f9fa;
      --se-surface-hover: rgba(0,0,0,0.03);
      --se-input: #f1f3f4;
      --se-border: #e8eaed;
      --se-border2: #dadce0;
      --se-divider: #e0e0e0;
      --se-sep: #f1f3f4;
      --se-t1: #202124;
      --se-t2: #3c4043;
      --se-t3: #5f6368;
      --se-t4: #9aa0a6;
      --se-urgent-bg: #fff3cd;
      --se-urgent-border: #f0c040;
      --se-urgent-color: #7a4f00;
    }
    html.dark {
      --se-bg: #111111;
      --se-surface: #1e1e1e;
      --se-surface2: #252525;
      --se-surface-hover: rgba(255,255,255,0.04);
      --se-input: #292929;
      --se-border: #363636;
      --se-border2: #363636;
      --se-divider: #2d2d2d;
      --se-sep: #252525;
      --se-t1: #e8eaed;
      --se-t2: #bdc1c6;
      --se-t3: #9aa0a6;
      --se-t4: #5f6368;
      --se-urgent-bg: #2d1f00;
      --se-urgent-border: #b07d00;
      --se-urgent-color: #ffd860;
    }
    @keyframes spin  { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    input::placeholder { color: var(--se-t4); }
    select { appearance: auto; }
    select option { background: var(--se-surface); color: var(--se-t1); }
  `
  document.head.appendChild(el)
}
