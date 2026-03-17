import { useState, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const HAIKU_MODEL = 'claude-haiku-4-5'
const LS_DIFFICULTY = 'se_difficulty'
const LS_HISTORY    = 'se_history'
const LS_PATTERNS   = 'se_patterns'
const MAX_HISTORY   = 200

// ─── Claude Haiku helper ──────────────────────────────────────────────────────

async function callHaiku(messages, maxTokens = 200) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY não configurada')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: HAIKU_MODEL, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text
}

// ─── Priority score formula ───────────────────────────────────────────────────
// Returns a number; higher = show first (within the same deadline group)

function calcPriorityScore(task, difficulty, courseBoosts = {}) {
  const d = difficulty[task.id] ?? 3

  // difficulty component: 0 (d=1) → 20 (d=5)
  const diffPart = (d - 1) * 5

  // urgency component based on days until due
  let urgencyPart = 0
  if (task.dueDate) {
    const daysLeft = (task.dueDate - Date.now()) / 86400000
    if (daysLeft < 0)     urgencyPart = 50
    else if (daysLeft < 1) urgencyPart = 40
    else if (daysLeft < 3) urgencyPart = 30
    else if (daysLeft < 7) urgencyPart = 20
    else if (daysLeft < 14) urgencyPart = 10
    else urgencyPart = Math.max(0, 10 - Math.floor(daysLeft / 7))
  } else {
    urgencyPart = 5 // no deadline: small constant
  }

  // pattern boost: courses where user is historically late score higher
  const lateRate = courseBoosts[task.courseId] ?? 0
  const patternPart = Math.round(lateRate * 15)

  return diffPart + urgencyPart + patternPart
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useML() {
  // difficulty: { [taskId]: 1-5 }
  const [difficulty, setDifficulty] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_DIFFICULTY) || '{}') } catch { return {} }
  })

  // history: { [taskId]: { courseId, courseName, submittedAt, hoursBeforeDue } }
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '{}') } catch { return {} }
  })

  // patterns: { generatedAt, insights, courseBoosts } | null
  const [patterns, setPatterns] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_PATTERNS) || 'null') } catch { return null }
  })

  // Set of taskIds currently being classified
  const [classifying, setClassifying] = useState(new Set())
  const [patternsLoading, setPatternsLoading] = useState(false)
  const [patternsError, setPatternsError]     = useState(null)

  // ── Persistence helpers ──────────────────────────────────────────────────────

  const saveDifficulty = useCallback((taskId, value) => {
    setDifficulty((prev) => {
      const next = { ...prev, [taskId]: value }
      localStorage.setItem(LS_DIFFICULTY, JSON.stringify(next))
      return next
    })
  }, [])

  const saveHistory = useCallback((taskId, entry) => {
    setHistory((prev) => {
      if (prev[taskId]) return prev // already recorded
      const next = { ...prev, [taskId]: entry }
      // cap at MAX_HISTORY (drop oldest by submittedAt)
      const entries = Object.entries(next)
      if (entries.length > MAX_HISTORY) {
        entries.sort((a, b) => a[1].submittedAt.localeCompare(b[1].submittedAt))
        const trimmed = Object.fromEntries(entries.slice(-MAX_HISTORY))
        localStorage.setItem(LS_HISTORY, JSON.stringify(trimmed))
        return trimmed
      }
      localStorage.setItem(LS_HISTORY, JSON.stringify(next))
      return next
    })
  }, [])

  const savePatterns = useCallback((data) => {
    setPatterns(data)
    localStorage.setItem(LS_PATTERNS, JSON.stringify(data))
  }, [])

  // ── Classify a single task ───────────────────────────────────────────────────

  const classifyTask = useCallback(async (task) => {
    // Skip if already cached or in-flight
    if (difficulty[task.id] !== undefined) return
    if (classifying.has(task.id)) return

    setClassifying((prev) => new Set(prev).add(task.id))
    try {
      const prompt = `Rate the difficulty of this school assignment from 1 to 5.
1=very easy (simple reading/quiz), 2=easy (short exercise), 3=medium (research/multiple steps), 4=hard (complex project), 5=very hard (extensive work, high creativity or technical skill).

Title: ${task.title}
Subject: ${task.courseName}
Type: ${task.workType || 'ASSIGNMENT'}
Description: ${task.description?.slice(0, 300) || 'none'}

Reply with ONLY a single digit 1-5. No other text.`

      const text = await callHaiku([{ role: 'user', content: prompt }], 5)
      const d = parseInt(text.trim().charAt(0), 10)
      saveDifficulty(task.id, d >= 1 && d <= 5 ? d : 3)
    } catch {
      // silent: unclassified tasks default to 3 in priority score
    } finally {
      setClassifying((prev) => { const s = new Set(prev); s.delete(task.id); return s })
    }
  }, [difficulty, classifying, saveDifficulty])

  // ── Classify a batch (sequential, rate-limited) ──────────────────────────────

  const classifyBatch = useCallback(async (tasks) => {
    const toClassify = tasks
      .filter((t) => difficulty[t.id] === undefined && !classifying.has(t.id))
      .slice(0, 8) // max 8 per batch call

    for (const task of toClassify) {
      await classifyTask(task)
      await new Promise((r) => setTimeout(r, 400))
    }
  }, [difficulty, classifying, classifyTask])

  // ── Record a submission ──────────────────────────────────────────────────────

  const recordSubmission = useCallback((task) => {
    const hoursBeforeDue = task.dueDate
      ? (task.dueDate - Date.now()) / 3600000
      : null
    saveHistory(task.id, {
      courseId:      task.courseId,
      courseName:    task.courseName,
      submittedAt:   new Date().toISOString(),
      hoursBeforeDue,
    })
  }, [saveHistory])

  // ── Analyze patterns with Claude Haiku ──────────────────────────────────────

  const analyzePatterns = useCallback(async () => {
    const entries = Object.values(history)
    if (entries.length < 3) return

    setPatternsLoading(true)
    setPatternsError(null)
    try {
      // compute per-course late rates for courseBoosts
      const courseStats = {}
      for (const e of entries) {
        if (!courseStats[e.courseId])
          courseStats[e.courseId] = { name: e.courseName, total: 0, late: 0 }
        courseStats[e.courseId].total++
        if (e.hoursBeforeDue !== null && e.hoursBeforeDue < 0)
          courseStats[e.courseId].late++
      }
      const courseBoosts = {}
      for (const [id, s] of Object.entries(courseStats))
        courseBoosts[id] = s.total > 0 ? s.late / s.total : 0

      // build summary for Haiku
      const lines = entries.slice(-30).map((e) => {
        const timing =
          e.hoursBeforeDue === null  ? 'sem prazo definido'
          : e.hoursBeforeDue >= 0   ? `${Math.round(e.hoursBeforeDue)}h antes do prazo`
          :                           `${Math.abs(Math.round(e.hoursBeforeDue))}h após o prazo`
        return `• ${e.courseName}: entregue ${timing}`
      }).join('\n')

      const prompt = `Analise o histórico de entregas deste estudante e forneça 2-3 insights práticos em no máximo 80 palavras. Seja direto e encorajador.

Histórico:
${lines}

Responda em português.`

      const insights = await callHaiku([{ role: 'user', content: prompt }], 300)
      savePatterns({ generatedAt: new Date().toISOString(), insights, courseBoosts })
    } catch (err) {
      setPatternsError(err.message)
    } finally {
      setPatternsLoading(false)
    }
  }, [history, savePatterns])

  // ── Derived helpers ──────────────────────────────────────────────────────────

  const getPriorityScore = useCallback((task) =>
    calcPriorityScore(task, difficulty, patterns?.courseBoosts ?? {}),
  [difficulty, patterns])

  const sortByPriority = useCallback((tasks) =>
    [...tasks].sort((a, b) => getPriorityScore(b) - getPriorityScore(a)),
  [getPriorityScore])

  const submissionCount  = Object.keys(history).length
  const canAnalyzePatterns = submissionCount >= 3

  const clearMLData = useCallback(() => {
    localStorage.removeItem(LS_DIFFICULTY)
    localStorage.removeItem(LS_HISTORY)
    localStorage.removeItem(LS_PATTERNS)
    setDifficulty({})
    setHistory({})
    setPatterns(null)
  }, [])

  return {
    difficulty,
    history,
    patterns,
    classifying,
    patternsLoading,
    patternsError,
    classifyTask,
    classifyBatch,
    recordSubmission,
    analyzePatterns,
    getPriorityScore,
    sortByPriority,
    submissionCount,
    canAnalyzePatterns,
    clearMLData,
  }
}
