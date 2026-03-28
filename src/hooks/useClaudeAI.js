import { useState, useCallback } from 'react'

const CLAUDE_API = 'https://agente-servidor-production.up.railway.app/claude/proxy'
const MODEL = import.meta.env.VITE_MODEL_SONNET || 'claude-sonnet-4-20250514'

async function callClaude(prompt) {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const [weeklyPlan, setWeeklyPlan] = useState(null)
  const [weeklyPlanLoading, setWeeklyPlanLoading] = useState(false)
  const [weeklyPlanError, setWeeklyPlanError] = useState(null)

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
  /**
   * Generates a weekly study plan for all pending tasks.
   */
  const generateWeeklyPlan = useCallback(async (tasks) => {
    setWeeklyPlanLoading(true)
    setWeeklyPlanError(null)
    setWeeklyPlan(null)

    try {
      const pending = tasks.filter((t) => t.status !== 'TURNED_IN')
      if (pending.length === 0) {
        setWeeklyPlan('Parabéns! Você não tem atividades pendentes. Aproveite para revisar o conteúdo das suas turmas.')
        return
      }

      const today = new Date()
      const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
      const taskList = pending
        .map((t) => `- ${t.title} | Turma: ${t.courseName} | Prazo: ${t.dueDateStr} | Tipo: ${formatWorkType(t.workType)}`)
        .join('\n')

      const prompt = `Você é um orientador educacional experiente. Crie um plano de estudos semanal para um aluno com as seguintes atividades pendentes.

Hoje é ${dayNames[today.getDay()]}, ${today.toLocaleDateString('pt-BR')}.

ATIVIDADES PENDENTES:
${taskList}

Crie um plano organizado por dia da semana (de hoje até domingo). Para cada dia com estudo:
- Qual atividade focar (priorize as mais urgentes)
- Tempo estimado em horas
- Uma dica prática específica para essa atividade

Use **Dia — data** como cabeçalho de cada dia. Deixe dias sem atividade marcados como "Descanso / revisão livre".
Seja realista, prático e motivador. Máximo 280 palavras.`

      const result = await callClaude(prompt)
      setWeeklyPlan(result)
    } catch (err) {
      setWeeklyPlanError(err.message)
    } finally {
      setWeeklyPlanLoading(false)
    }
  }, [])

  // Resolve with full context: reads attached Docs/PDFs via agente-servidor
  const solveTaskWithContext = useCallback(async (task, accessToken, styleExamples = []) => {
    const SERVER = import.meta.env.VITE_AGENT_SERVER || 'https://agente-servidor-production.up.railway.app'
    const res = await fetch(`${SERVER}/atividade/resolver-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: task.alternateLink,
        courseId: task.courseId,
        workId: task.id,
        accessToken,
        taskTitle: task.title,
        taskDescription: task.description,
        aluno: { nome: 'Aluno', serie: '' },
        estiloExemplos: styleExamples,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err.upgrade) window.dispatchEvent(new CustomEvent('se:upgrade-needed'))
      throw new Error(err.erro || `Erro ${res.status}`)
    }
    const data = await res.json()
    return { text: data.rascunho, materiais: data.materiais || [] }
  }, [])

  const solveTask = useCallback(async (task, styleExamples = []) => {
    const tipo = formatWorkType(task.workType)
    const pontos = task.maxPoints != null ? `${task.maxPoints} pontos` : 'não informada'

    const styleSection = styleExamples.length > 0
      ? `\nEXEMPLOS DO SEU ESTILO DE ESCRITA (respostas anteriores aprovadas — use como referência de estilo, tom e extensão):\n${styleExamples.map((e, idx) => `[Exemplo ${idx + 1} — ${e.task}]\n${e.answer}`).join('\n\n')}\n\n`
      : ''

    const prompt = `Você é um estudante brasileiro do ensino médio/técnico, inteligente e dedicado. Precisa entregar a atividade abaixo com qualidade suficiente para tirar nota máxima.${styleSection}

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

  /**
   * Refines an existing answer based on a user instruction.
   * Returns the updated answer text directly.
   */
  const refineAnswer = useCallback(async (currentAnswer, instruction) => {
    const prompt = `Você é um assistente escolar. Abaixo está uma resposta já escrita para uma atividade escolar e um pedido de alteração do aluno.

RESPOSTA ATUAL:
${currentAnswer}

PEDIDO DO ALUNO:
${instruction}

Reescreva a resposta aplicando o pedido do aluno. Mantenha o conteúdo correto e o estilo de estudante brasileiro.
PROIBIDO: Não escreva preâmbulos como "Claro!", "Aqui está:", etc. Retorne APENAS a resposta reescrita, pronta para entregar.`

    return callClaude(prompt)
  }, [])

  return {
    analyzePriorities,
    analyzeTask,
    solveTask,
    solveTaskWithContext,
    refineAnswer,
    generateWeeklyPlan,
    dashboardAnalysis,
    dashboardLoading,
    dashboardError,
    weeklyPlan,
    weeklyPlanLoading,
    weeklyPlanError,
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
