import { useState, useCallback, useRef } from 'react'

const CLAUDE_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'
const MAX_STEPS = 20

const SYSTEM_PROMPT = `Você é um agente de automação de browser escolar. Você controla o Chrome do aluno para fazer atividades do Google Classroom automaticamente.

Você DEVE responder SEMPRE com JSON válido e nada mais. Formato:
{"action": "<ação>", ...parâmetros}

Ações disponíveis:
- {"action": "navigate", "url": "https://..."}
- {"action": "read_page"}
- {"action": "click", "selector": "seletor CSS ou texto visível do botão"}
- {"action": "fill", "selector": "seletor CSS", "value": "texto a preencher"}
- {"action": "evaluate", "code": "javascript a executar na página"}
- {"action": "wait", "ms": 2000}
- {"action": "screenshot"}
- {"action": "done", "result": "resumo do que foi feito"}

Estratégia:
1. Navegue para a URL da atividade
2. Leia a página para entender o que precisa ser feito
3. Execute a atividade (preencha campos, clique em botões)
4. Confirme que foi enviado
5. Use "done" com resumo

Responda APENAS com JSON. Sem texto, sem markdown, sem explicações.`

function sendExtCmd(cmd) {
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

async function callClaude(apiKey, messages) {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || `Erro HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text
}

function parseAction(text) {
  try { return JSON.parse(text.trim()) } catch { /* ignore */ }
  const match = text.match(/\{[\s\S]*?\}/)
  if (match) { try { return JSON.parse(match[0]) } catch { /* ignore */ } }
  throw new Error(`IA retornou resposta inválida: ${text.slice(0, 100)}`)
}

function actionLabel(action) {
  const labels = {
    navigate:   `🌐 Navegando para: ${action.url}`,
    read_page:  '📄 Lendo página...',
    click:      `🖱️ Clicando em: ${action.selector}`,
    fill:       `✏️ Preenchendo campo com: "${String(action.value || '').slice(0, 60)}"`,
    evaluate:   `⚡ Executando JS`,
    wait:       `⏳ Aguardando ${action.ms}ms`,
    screenshot: '📸 Capturando screenshot',
    done:       `✅ ${action.result}`,
  }
  return labels[action.action] || `Executando: ${action.action}`
}

export function useBrowserAgent() {
  const [running, setRunning]   = useState(false)
  const [log, setLog]           = useState([])
  const [done, setDone]         = useState(null)
  const abortRef                = useRef(false)

  const addLog = useCallback((type, text) => {
    setLog(prev => [...prev, { type, text, id: Math.random() }])
  }, [])

  const runAgent = useCallback(async (task) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { addLog('error', 'VITE_ANTHROPIC_API_KEY não configurada'); return }

    setRunning(true)
    setLog([])
    setDone(null)
    abortRef.current = false

    const messages = []
    messages.push({
      role: 'user',
      content: [
        `Atividade escolar para executar no Chrome:`,
        `Título: ${task.title}`,
        `Disciplina: ${task.courseName}`,
        `Descrição: ${task.description || 'Sem descrição adicional'}`,
        `URL: ${task.alternateLink}`,
        task.dueDate ? `Prazo: ${new Date(task.dueDate).toLocaleString('pt-BR')}` : '',
        ``,
        `Comece navegando para a URL da atividade.`,
      ].filter(Boolean).join('\n'),
    })

    addLog('info', `🤖 Agente iniciado: "${task.title}"`)

    let steps = 0
    let finished = false
    try {
      while (steps < MAX_STEPS && !abortRef.current && !finished) {
        steps++
        addLog('thinking', 'Pensando...')

        const aiText = await callClaude(apiKey, messages)
        messages.push({ role: 'assistant', content: aiText })

        const action = parseAction(aiText)

        if (action.action === 'done') {
          addLog('success', actionLabel(action))
          setDone(action.result)
          finished = true
          break
        }

        addLog('action', actionLabel(action))

        let result
        try {
          result = await sendExtCmd(action)
          const preview = typeof result === 'string'
            ? result.slice(0, 300)
            : JSON.stringify(result).slice(0, 300)
          addLog('result', preview)
        } catch (err) {
          result = { error: err.message }
          addLog('error', `Erro: ${err.message}`)
        }

        messages.push({ role: 'user', content: `Resultado da ação: ${JSON.stringify(result)}` })
      }

      if (steps >= MAX_STEPS && !finished) {
        addLog('error', `Limite de ${MAX_STEPS} passos atingido`)
      }
    } catch (err) {
      addLog('error', `Erro fatal: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }, [addLog])

  const stop = useCallback(() => {
    abortRef.current = true
    setRunning(false)
    addLog('info', '⛔ Agente parado pelo usuário')
  }, [addLog])

  const reset = useCallback(() => {
    setLog([])
    setDone(null)
    setRunning(false)
    abortRef.current = false
  }, [])

  return { running, log, done, runAgent, stop, reset }
}
