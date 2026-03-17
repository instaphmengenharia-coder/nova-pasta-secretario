import { useState, useCallback } from 'react'

const CLAUDE_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

async function callClaude(prompt) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY não configurada no .env')

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
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.error?.message || `Erro HTTP ${res.status}`
    throw new Error(`Claude API: ${msg}`)
  }

  const data = await res.json()
  return data.content[0].text
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useClaudeAI() {
  const [dashboardAnalysis, setDashboardAnalysis] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState(null)

  /**
   * Generates a priority summary for all pending tasks.
   * Stores the result in `dashboardAnalysis`.
   */
  const analyzePriorities = useCallback(async (tasks) => {
    setDashboardLoading(true)
    setDashboardError(null)
    setDashboardAnalysis(null)

    try {
      const pending = tasks.filter((t) => t.status !== 'TURNED_IN')
      if (pending.length === 0) {
        setDashboardAnalysis(
          'Parabéns! Você não tem nenhuma atividade pendente no momento. Aproveite para revisar o conteúdo das suas turmas.',
        )
        return
      }

      const list = pending
        .map(
          (t) =>
            `• ${t.title} — Turma: ${t.courseName} | Prazo: ${t.dueDateStr} | Status: ${
              t.status === 'NEW' ? 'Novo' : 'Iniciado'
            }`,
        )
        .join('\n')

      const prompt = `Você é um secretário escolar inteligente e motivador. Analise a lista de atividades pendentes de um aluno e forneça um resumo conciso (máximo 160 palavras) com:

1. As 2-3 atividades mais urgentes e por que priorizá-las
2. Uma dica prática de gestão do tempo
3. Uma mensagem encorajadora

Atividades pendentes:
${list}

Responda em português, de forma amigável e direta, sem listas ou marcadores — apenas texto corrido.`

      const result = await callClaude(prompt)
      setDashboardAnalysis(result)
    } catch (err) {
      setDashboardError(err.message)
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  /**
   * Generates a focused analysis for a single task.
   * Returns the text directly (caller manages local state).
   */
  const analyzeTask = useCallback(async (task) => {
    const prompt = `Você é um professor assistente experiente. Um aluno precisa de ajuda com a seguinte atividade escolar:

**Atividade:** ${task.title}
**Turma:** ${task.courseName}
**Tipo:** ${formatWorkType(task.workType)}
**Pontuação máxima:** ${task.maxPoints != null ? task.maxPoints + ' pontos' : 'Não informada'}
**Prazo:** ${task.dueDateStr}
**Descrição:** ${task.description || 'Nenhuma descrição fornecida.'}

Forneça uma resposta estruturada com:

1. **Entendendo a atividade** — explique com suas palavras o que é pedido (2-3 frases)
2. **Como abordar** — passo a passo prático de como começar e desenvolver a atividade
3. **Dicas para se destacar** — 3 sugestões objetivas para fazer um trabalho excelente
4. **Recursos úteis** — conceitos, ferramentas ou tipos de fontes relevantes para pesquisar

Responda em português, de forma clara e encorajadora, em no máximo 300 palavras.`

    return callClaude(prompt)
  }, [])

  /**
   * Reads the task and generates a complete ready-to-submit answer.
   * Returns the text directly (caller manages local state).
   */
  const solveTask = useCallback(async (task) => {
    const tipo = formatWorkType(task.workType)
    const pontos = task.maxPoints != null ? `${task.maxPoints} pontos` : 'não informada'

    const prompt = `Você é um estudante brasileiro do ensino médio/técnico, inteligente e dedicado. Precisa entregar a atividade abaixo com qualidade suficiente para tirar nota máxima.

═══════════════════════════════
DADOS DA ATIVIDADE
═══════════════════════════════
Título: ${task.title}
Disciplina/Turma: ${task.courseName}
Tipo: ${tipo}
Pontuação: ${pontos}
Descrição fornecida pelo professor:
${task.description || '(nenhuma descrição — use o título como guia)'}
═══════════════════════════════

REGRAS PARA ESCREVER A RESPOSTA:

1. LINGUAGEM: Natural de estudante brasileiro — clara, correta gramaticalmente, sem ser excessivamente formal nem informal. Sem gírias. Sem palavras em inglês desnecessárias.

2. ESTRUTURA dependendo do tipo:
   - Dissertação/Texto: introdução (contextualize o tema), desenvolvimento (2-3 parágrafos com argumentos e exemplos concretos), conclusão (retome a ideia central e finalize com reflexão).
   - Questão aberta: responda direto ao ponto, depois explique o raciocínio com 1-2 frases de embasamento.
   - Tarefa prática / pesquisa: apresente o conteúdo de forma organizada com subtítulos se necessário.
   - Se houver múltiplas partes: responda cada uma separadamente com sua numeração.

3. CONTEÚDO: Use conhecimentos reais e corretos sobre o tema. Se for ciências, matemática, história, português etc., aplique os conceitos corretos. Não invente dados ou datas — se não souber algo específico, generalize com precisão.

4. TAMANHO: Adequado ao que foi pedido. Textos dissertativos: mínimo 15 linhas. Questões: 3-8 linhas. Não seja prolixo, não seja curto demais.

5. PROIBIDO: Não escreva "Aqui está minha resposta:", "Claro!", "Certamente!" nem qualquer preâmbulo. Comece direto com o conteúdo da resposta. Não mencione que é IA.

Escreva APENAS a resposta final, pronta para ser colada no campo de entrega do Google Classroom.`

    return callClaude(prompt)
  }, [])

  return {
    analyzePriorities,
    analyzeTask,
    solveTask,
    dashboardAnalysis,
    dashboardLoading,
    dashboardError,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatWorkType(type) {
  const map = {
    ASSIGNMENT: 'Tarefa',
    SHORT_ANSWER_QUESTION: 'Questão dissertativa',
    MULTIPLE_CHOICE_QUESTION: 'Questão de múltipla escolha',
  }
  return map[type] || type || 'Atividade'
}
