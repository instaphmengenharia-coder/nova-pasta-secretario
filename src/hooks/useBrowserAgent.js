import { useState, useCallback, useRef } from 'react'
import { buscarEstilo, getFeedbackContexto } from './useStyleMemory'

const CLAUDE_API  = 'https://api.anthropic.com/v1/messages'
const AGENT_URL   = 'https://agente-servidor-production.up.railway.app'
const MODEL       = import.meta.env.VITE_MODEL_SONNET || 'claude-sonnet-4-20250514'
const MODEL_HAIKU = import.meta.env.VITE_MODEL_HAIKU  || 'claude-haiku-4-5-20251001'
const MAX_STEPS   = 30
const MAX_RETRIES = 3
const RETRY_DELAY = 3000

// Global mutex — only one agent can call Claude at a time
let globalAgentLock = false
async function acquireLock() {
  while (globalAgentLock) await new Promise(r => setTimeout(r, 500))
  globalAgentLock = true
}
function releaseLock() { globalAgentLock = false }

// ─── Viability Analysis ───────────────────────────────────────────────────────
export async function analisarViabilidade(task, apiKey) {
  const materiais = task.materials?.length
    ? `Materiais: ${task.materials.map(m => m.title || m.driveFile?.title || 'arquivo').join(', ')}`
    : 'Sem materiais anexados'

  const enunciado = [
    `Título: ${task.title}`,
    `Disciplina: ${task.courseName || ''}`,
    `Descrição: ${(task.description || 'Sem descrição').slice(0, 600)}`,
    materiais,
  ].filter(Boolean).join('\n')

  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL_HAIKU,
      max_tokens: 350,
      messages: [{
        role: 'user',
        content: `Analisa essa atividade escolar e diz se é possível fazer automaticamente por um agente de IA que controla o Chrome.\n\n${enunciado}\n\nIMPOSSÍVEL: livro físico sem PDF, pesquisa de campo, entrevista presencial, foto/vídeo do aluno, prova presencial, enunciado vazio.\nPOSSÍVEL COM AVISO: PDF/Doc anexado, site externo, matemática complexa.\n\nResponde APENAS com JSON válido, sem markdown:\n{"possivel":true,"confianca":"alta","motivo":"explicação em 1-2 frases","precisa_de":[],"estrategia":"como resolver"}`,
      }],
    }),
  })

  if (!res.ok) throw new Error(`Erro ao analisar: ${res.status}`)
  const data = await res.json()
  const text = data.content[0].text.trim()
  try { return JSON.parse(text) } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Resposta inválida')
  }
}

// ─── History ──────────────────────────────────────────────────────────────────
export function getAgentHistory() {
  try { return JSON.parse(localStorage.getItem('se_agent_history') || '[]') } catch { return [] }
}
function saveHistory(task, status, result, analise_viabilidade) {
  const history = getAgentHistory()
  history.unshift({
    id: Math.random().toString(36).slice(2),
    taskId: task.id,
    title: task.title,
    course: task.courseName,
    completedAt: new Date().toISOString(),
    status,
    result,
    analise_viabilidade,
  })
  localStorage.setItem('se_agent_history', JSON.stringify(history.slice(0, 100)))
}

// ─── Prompts especializados por tipo ─────────────────────────────────────────
const BASE_RULES = `
Responda SEMPRE com JSON válido e nada mais.

AÇÕES DISPONÍVEIS:
- {"action": "navigate", "url": "https://..."}
- {"action": "read_page"}
- {"action": "screenshot"}
- {"action": "click", "selector": "texto visível ou seletor CSS"}
- {"action": "fill", "selector": "seletor CSS", "value": "texto"}
- {"action": "evaluate", "code": "javascript"}
- {"action": "wait", "ms": 1500}
- {"action": "review", "answer": "resposta completa", "summary": "resumo"}
- {"action": "done", "result": "resumo do que foi feito"}
- {"action": "login_required"}

REGRAS:
- screenshot após cada navigate (para ver o que abriu)
- use "review" OBRIGATORIAMENTE antes de submeter qualquer resposta
- se detectar login do Google: use "login_required"
- após ação falhar: tente seletor alternativo antes de desistir
- Responda APENAS com JSON. Sem markdown, sem texto.`

const PROMPTS = {
  dissertativa: `Você é um agente especializado em atividades dissertativas e redações escolares.
${BASE_RULES}

ESTRATÉGIA DISSERTATIVA:
1. navigate → screenshot → read_page para entender o enunciado completo
2. Elabore mentalmente uma resposta dissertativa bem estruturada (introdução, desenvolvimento, conclusão)
3. review com a resposta completa para o aluno aprovar
4. Após aprovação: fill no campo de texto, screenshot para confirmar, submit`,

  multipla_escolha: `Você é um agente especializado em questões de múltipla escolha e quiz.
${BASE_RULES}

ESTRATÉGIA MÚLTIPLA ESCOLHA:
1. navigate → screenshot → read_page
2. Identifique TODAS as alternativas antes de responder
3. Analise cada alternativa com cuidado
4. review indicando qual alternativa escolheu e por quê
5. Após aprovação: click na alternativa correta, screenshot, submit`,

  formulario: `Você é um agente especializado em Google Forms e formulários.
${BASE_RULES}

ESTRATÉGIA FORMULÁRIO:
1. navigate → screenshot → read_page para mapear todos os campos
2. Liste TODOS os campos antes de preencher
3. review com um resumo de todas as respostas planejadas
4. Após aprovação: preencha campo por campo, screenshot, submit`,

  calculo: `Você é um agente especializado em atividades matemáticas e de cálculo.
${BASE_RULES}

ESTRATÉGIA CÁLCULO:
1. navigate → screenshot → read_page
2. Resolva o problema passo a passo matematicamente
3. Verifique o resultado
4. review com a solução detalhada mostrando os passos
5. Após aprovação: fill com a resposta, screenshot, submit`,

  pesquisa: `Você é um agente especializado em trabalhos de pesquisa e resumos.
${BASE_RULES}

ESTRATÉGIA PESQUISA:
1. navigate → screenshot → read_page para entender o tema
2. Elabore uma resposta baseada no conhecimento disponível
3. Estruture com: introdução, desenvolvimento com dados relevantes, conclusão
4. review com o texto completo
5. Após aprovação: fill, screenshot, submit`,

  redacao: `Você é um agente especializado em redações e produções textuais.
${BASE_RULES}

ESTRATÉGIA REDAÇÃO:
1. navigate → screenshot → read_page
2. Identifique: tema, gênero textual, extensão esperada
3. Elabore texto com: título, introdução, 2-3 parágrafos de desenvolvimento, conclusão
4. review com o texto completo formatado
5. Após aprovação: fill, screenshot, submit`,

  default: `Você é um agente de automação de browser escolar que controla o Chrome para fazer atividades.
${BASE_RULES}

ESTRATÉGIA GERAL:
1. navigate → screenshot → read_page
2. Entenda o que precisa ser feito
3. Gere a melhor resposta possível
4. review antes de submeter
5. Após aprovação: execute a entrega, screenshot, done`,
}

function getPrompt(tipo) {
  return PROMPTS[tipo] || PROMPTS.default
}

// ─── Task Classification ──────────────────────────────────────────────────────
async function classificarTarefa(task) {
  try {
    const res = await fetch(`${AGENT_URL}/atividade/detectar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task }),
    })
    if (!res.ok) return 'default'
    const data = await res.json()
    // Map Railway types to our prompt types
    const mapa = {
      formulario:      'formulario',
      redacao:         'redacao',
      questao_simples: 'multipla_escolha',
      quiz:            'multipla_escolha',
      doc_criar:       'dissertativa',
      doc_editar:      'dissertativa',
      desconhecido:    'default',
    }
    return mapa[data.tipo] || 'default'
  } catch { return 'default' }
}

// ─── Extension communication with retry ──────────────────────────────────────
function sendExtCmdOnce(cmd) {
  return new Promise((resolve, reject) => {
    const reqId = Math.random().toString(36).slice(2)
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error('Timeout: extensão não respondeu em 30s'))
    }, 30000)
    function handler(e) {
      if (e.data?.type === 'SE_RESULT' && e.data.reqId === reqId) {
        clearTimeout(timeout)
        window.removeEventListener('message', handler)
        resolve(e.data.result)
      }
    }
    window.addEventListener('message', handler)
    window.postMessage({ type: 'SE_COMMAND', reqId, cmd }, '*')
  })
}

async function sendExtCmd(cmd, addLog, attempt = 1) {
  try {
    return await sendExtCmdOnce(cmd)
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err

    // Log retry attempt
    addLog('warn', `⚠️ Tentativa ${attempt} falhou: ${err.message}. Tentando novamente em 3s...`)
    await new Promise(r => setTimeout(r, RETRY_DELAY))

    // Try alternative strategy on 2nd retry
    if (attempt === 2 && cmd.action === 'click' && cmd.selector) {
      const altCmd = { ...cmd }
      // If selector looks like text, try CSS; if CSS, try evaluate click
      if (!cmd.selector.startsWith('.') && !cmd.selector.startsWith('#')) {
        altCmd.selector = `button, a, input[type="submit"]` // broader fallback
        addLog('warn', `🔄 Tentando seletor alternativo: ${altCmd.selector}`)
      } else {
        // Try via JS evaluate
        addLog('warn', `🔄 Tentando via JavaScript evaluate`)
        return sendExtCmd({ action: 'evaluate', code: `document.querySelector(${JSON.stringify(cmd.selector)})?.click()` }, addLog, attempt + 1)
      }
      return sendExtCmd(altCmd, addLog, attempt + 1)
    }

    if (attempt === 2 && cmd.action === 'fill' && cmd.selector) {
      addLog('warn', `🔄 Tentando fill via JavaScript`)
      return sendExtCmd({
        action: 'evaluate',
        code: `
          const el = document.querySelector(${JSON.stringify(cmd.selector)})
          if (el) { el.value = ${JSON.stringify(cmd.value)}; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})) }
        `,
      }, addLog, attempt + 1)
    }

    return sendExtCmd(cmd, addLog, attempt + 1)
  }
}

// ─── Claude API ───────────────────────────────────────────────────────────────
async function callClaude(apiKey, messages, systemPrompt, retry = 0) {
  await acquireLock()
  // Keep only last 8 messages to avoid token bloat
  const trimmed = messages.length > 8 ? messages.slice(-8) : messages
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 512, system: systemPrompt, messages: trimmed }),
  })
  if (res.status === 429 && retry < 3) {
    releaseLock()
    await new Promise(r => setTimeout(r, 20000)) // wait 20s on rate limit
    return callClaude(apiKey, messages, systemPrompt, retry + 1)
  }
  if (!res.ok) {
    releaseLock()
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || `Erro HTTP ${res.status}`)
  }
  const data = await res.json()
  releaseLock()
  await new Promise(r => setTimeout(r, 1500)) // 1.5s between calls
  return data.content[0].text
}

function parseAction(text) {
  try { return JSON.parse(text.trim()) } catch { /* ignore */ }
  const match = text.match(/\{[\s\S]*\}/)
  if (match) { try { return JSON.parse(match[0]) } catch { /* ignore */ } }
  throw new Error(`IA retornou resposta inválida: ${text.slice(0, 100)}`)
}

function actionLabel(action) {
  const labels = {
    navigate:       `🌐 Navegando para: ${action.url}`,
    read_page:      '📄 Lendo página...',
    click:          `🖱️ Clicando em: ${String(action.selector || '').slice(0, 50)}`,
    fill:           `✏️ Preenchendo: "${String(action.value || '').slice(0, 60)}"`,
    evaluate:       '⚡ Executando JS na página',
    wait:           `⏳ Aguardando ${action.ms}ms`,
    screenshot:     '📸 Capturando screenshot',
    review:         '👁️ Aguardando aprovação do aluno...',
    login_required: '🔐 Login necessário — verifique o Chrome',
    done:           `✅ ${action.result}`,
  }
  return labels[action.action] || `Executando: ${action.action}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBrowserAgent() {
  const [running, setRunning]             = useState(false)
  const [paused, setPaused]               = useState(false)
  const [log, setLog]                     = useState([])
  const [done, setDone]                   = useState(null)
  const [taskType, setTaskType]           = useState(null)
  const [pendingReview, setPendingReview] = useState(null)
  const abortRef  = useRef(false)
  const pauseRef  = useRef(false)
  const reviewRef = useRef(null)

  const addLog = useCallback((type, content) => {
    setLog(prev => [...prev, { type, content, id: Math.random() }])
  }, [])

  async function waitIfPaused() {
    while (pauseRef.current && !abortRef.current) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  const approveReview = useCallback(() => {
    reviewRef.current?.resolve('approved')
    reviewRef.current = null
    setPendingReview(null)
  }, [])

  const rejectReview = useCallback(() => {
    reviewRef.current?.reject(new Error('Aluno rejeitou a resposta'))
    reviewRef.current = null
    setPendingReview(null)
  }, [])

  const runAgent = useCallback(async (task, opts = {}, viabilidade = null) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { addLog('error', 'VITE_ANTHROPIC_API_KEY não configurada'); return }

    setRunning(true)
    setPaused(false)
    setLog([])
    setDone(null)
    setTaskType(null)
    setPendingReview(null)
    abortRef.current = false
    pauseRef.current = false

    let agentStatus = 'failed'
    let agentResult = ''

    try {
      // ── 1. Classificar tipo da tarefa ──────────────────────────────────────
      addLog('info', '🔍 Analisando tipo de atividade...')
      const tipo = await classificarTarefa(task)
      setTaskType(tipo)
      const tipoLabel = { dissertativa: 'Dissertativa', multipla_escolha: 'Múltipla escolha', formulario: 'Formulário', calculo: 'Cálculo', pesquisa: 'Pesquisa', redacao: 'Redação', default: 'Geral' }
      addLog('info', `📊 Tipo detectado: ${tipoLabel[tipo] || tipo} — usando estratégia especializada`)

      // ── 2. Buscar estilo do aluno ──────────────────────────────────────────
      let estiloContexto = ''
      const userId = opts.userId
      if (userId && task.courseName) {
        const estiloData = await buscarEstilo(userId, task.courseName)
        if (estiloData?.contexto) {
          estiloContexto = estiloData.contexto
          addLog('info', '🎨 Estilo do aluno carregado — resposta será personalizada')
        }
      }

      // Feedback de notas anteriores
      const feedbackContexto = getFeedbackContexto(task.courseName)
      if (feedbackContexto) addLog('info', '📊 Feedback de notas anteriores carregado')

      // ── 3. Montar system prompt especializado ──────────────────────────────
      const systemPrompt = getPrompt(tipo) + estiloContexto + feedbackContexto

      const messages = [{
        role: 'user',
        content: [
          `Atividade escolar para executar no Chrome:`,
          `Título: ${task.title}`,
          `Disciplina: ${task.courseName}`,
          `Descrição: ${(task.description || 'Sem descrição').slice(0, 400)}`,
          `URL: ${task.alternateLink}`,
          task.dueDate ? `Prazo: ${new Date(task.dueDate).toLocaleString('pt-BR')}` : '',
          `Tipo: ${tipo}`,
          `Comece navegando para a URL. Use "review" antes de submeter.`,
        ].filter(Boolean).join('\n'),
      }]

      addLog('info', `🤖 Agente iniciado: "${task.title}"`)

      let steps = 0
      let finished = false

      // ── 4. Loop principal ──────────────────────────────────────────────────
      while (steps < MAX_STEPS && !abortRef.current && !finished) {
        await waitIfPaused()
        if (abortRef.current) break
        steps++

        addLog('thinking', 'Pensando...')
        const aiText = await callClaude(apiKey, messages, systemPrompt)
        messages.push({ role: 'assistant', content: aiText })

        const action = parseAction(aiText)

        if (action.action === 'done') {
          addLog('success', `✅ ${action.result}`)
          setDone(action.result)
          agentStatus = 'success'
          agentResult = action.result
          finished = true
          break
        }

        if (action.action === 'login_required') {
          addLog('warn', '🔐 Login necessário! Faça login no Google no Chrome e clique em Continuar.')
          setPaused(true)
          pauseRef.current = true
          messages.push({ role: 'user', content: 'Resultado: login_required — aguardando usuário fazer login.' })
          continue
        }

        if (action.action === 'review') {
          addLog('review', actionLabel(action))
          if (opts?.autoApprove) {
            for (let i = 5; i >= 1; i--) {
              if (abortRef.current) break
              addLog('info', `🤖 AUTO: enviando em ${i}s... (pare para cancelar)`)
              await new Promise(r => setTimeout(r, 1000))
            }
            if (!abortRef.current) {
              addLog('info', '✅ AUTO: resposta aprovada automaticamente')
              messages.push({ role: 'user', content: 'Resultado: review_approved — modo automático aprovou. Continue.' })
            }
          } else {
            try {
              await new Promise((resolve, reject) => {
                reviewRef.current = { resolve, reject }
                setPendingReview({ answer: action.answer, summary: action.summary })
              })
              addLog('info', '✅ Aluno aprovou — enviando resposta...')
              messages.push({ role: 'user', content: 'Resultado: review_approved — aluno aprovou. Continue preenchendo e submetendo.' })
            } catch (err) {
              if (err.message === 'Aluno rejeitou a resposta') {
                addLog('warn', '❌ Aluno rejeitou a resposta — agente parado.')
                agentStatus = 'rejected'
              } else if (err.message === 'Parado') {
                agentStatus = 'cancelled'
              } else {
                addLog('error', `❌ Erro inesperado na revisão: ${err.message}`)
                agentStatus = 'failed'
              }
              finished = true
            }
          }
          continue
        }

        // ── Executar ação com retry ──────────────────────────────────────────
        addLog('action', actionLabel(action))

        let result
        try {
          result = await sendExtCmd(action, addLog)

          if (action.action === 'screenshot' && result?.screenshot) {
            addLog('screenshot', result.screenshot)
            messages.push({ role: 'user', content: 'Resultado: screenshot capturado.' })
            continue
          }

          const preview = typeof result === 'string'
            ? result.slice(0, 300)
            : JSON.stringify(result).slice(0, 300)
          addLog('result', preview)

          if (action.action === 'navigate') {
            await new Promise(r => setTimeout(r, 1500))
            try {
              const ss = await sendExtCmdOnce({ action: 'screenshot' })
              if (ss?.screenshot) addLog('screenshot', ss.screenshot)
            } catch { /* silent */ }
          }
        } catch (err) {
          result = { error: err.message }
          addLog('error', `❌ Falhou após ${MAX_RETRIES} tentativas: ${err.message}`)
        }

        const resultStr = JSON.stringify(result)
        messages.push({ role: 'user', content: `Resultado: ${resultStr.slice(0, 800)}` })
      }

      if (steps >= MAX_STEPS && !finished) {
        addLog('error', `Limite de ${MAX_STEPS} passos atingido`)
      }
      if (abortRef.current && !finished) {
        agentStatus = 'cancelled'
        addLog('info', '⛔ Agente parado pelo usuário')
      }
    } catch (err) {
      addLog('error', `Erro fatal: ${err.message}`)
    } finally {
      setRunning(false)
      setPaused(false)
      saveHistory(task, agentStatus, agentResult || done, viabilidade)
    }
  }, [addLog])

  const stop = useCallback(() => {
    abortRef.current = true
    pauseRef.current = false
    reviewRef.current?.reject(new Error('Parado'))
    reviewRef.current = null
    setPendingReview(null)
    setPaused(false)
    setRunning(false)
  }, [])

  const pause = useCallback(() => {
    pauseRef.current = true
    setPaused(true)
    addLog('info', '⏸️ Agente pausado')
  }, [addLog])

  const resume = useCallback(() => {
    pauseRef.current = false
    setPaused(false)
    addLog('info', '▶️ Agente retomado')
  }, [addLog])

  const reset = useCallback(() => {
    setLog([])
    setDone(null)
    setRunning(false)
    setPaused(false)
    setTaskType(null)
    setPendingReview(null)
    abortRef.current = false
    pauseRef.current = false
    reviewRef.current = null
  }, [])

  return { running, paused, log, done, taskType, pendingReview, runAgent, stop, pause, resume, reset, approveReview, rejectReview }
}
