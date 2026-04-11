const AGENT_URL = 'https://agente-servidor-production.up.railway.app'

export async function buscarEstilo(userId, materia) {
  if (!userId || !materia) return null
  try {
    const res = await fetch(`${AGENT_URL}/estilo/${encodeURIComponent(userId)}/${encodeURIComponent(materia)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch { return null }
}

export async function salvarEstilo({ userId, materia, resposta, respostaEditada, accessToken }) {
  if (!userId || !materia || !resposta) return
  try {
    // Calculate average word count
    const palavras = resposta.split(/\s+/).length

    // Determine tone heuristically
    const tom = detectarTom(resposta)

    // Extract common vocabulary
    const vocab = extrairVocabulario(resposta)

    // Build approved examples (use edited version if available)
    const textoFinal = respostaEditada || resposta
    const exemplosExistentes = await buscarExemplosExistentes(userId, materia)
    const exemplos = [textoFinal.slice(0, 800), ...exemplosExistentes].slice(0, 5)

    await fetch(`${AGENT_URL}/estilo/salvar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        userId,
        materia,
        exemplosAprovados: exemplos,
        vocabularioComum: vocab,
        tamanhoMedioResposta: palavras,
        tom,
        ...(accessToken ? { accessToken } : {}),
      }),
    })
  } catch { /* silent — style memory is optional */ }
}

async function buscarExemplosExistentes(userId, materia) {
  const data = await buscarEstilo(userId, materia)
  return data?.estilo?.exemplos_aprovados || []
}

function detectarTom(texto) {
  const formal   = /portanto|ademais|outrossim|conforme|destarte|nesse sentido/gi
  const informal = /aí|daí|tipo|né|tá|cara|massa|legal/gi
  const formalCount   = (texto.match(formal)   || []).length
  const informalCount = (texto.match(informal) || []).length
  if (formalCount > informalCount + 1) return 'formal'
  if (informalCount > formalCount + 1) return 'informal'
  return 'neutro'
}

// ─── Feedback Loop ────────────────────────────────────────────────────────────
// Salva o feedback de uma nota recebida para melhorar respostas futuras
export function salvarFeedbackNota(historyItem, nota) {
  try {
    const feedback = JSON.parse(localStorage.getItem('se_feedback') || '[]')
    const entry = {
      id:        historyItem.id,
      title:     historyItem.title,
      course:    historyItem.course,
      result:    historyItem.result || '',
      nota,
      qualidade: nota >= 8 ? 'boa' : nota >= 6 ? 'media' : 'ruim',
      savedAt:   new Date().toISOString(),
    }
    // Atualiza se já existe, senão adiciona
    const idx = feedback.findIndex(f => f.id === historyItem.id)
    if (idx >= 0) feedback[idx] = entry
    else feedback.unshift(entry)
    localStorage.setItem('se_feedback', JSON.stringify(feedback.slice(0, 50)))
  } catch { /* silent */ }
}

// Retorna contexto formatado para injetar no prompt do Claude
export function getFeedbackContexto(materia) {
  try {
    const feedback = JSON.parse(localStorage.getItem('se_feedback') || '[]')
    const daMat = feedback.filter(f => !materia || f.course?.toLowerCase().includes(materia.toLowerCase()))
    if (daMat.length === 0) return ''

    const boas  = daMat.filter(f => f.qualidade === 'boa').slice(0, 3)
    const ruins = daMat.filter(f => f.qualidade === 'ruim').slice(0, 3)
    const media = daMat.filter(f => f.nota != null)
    const notaMedia = media.length > 0
      ? (media.reduce((a, b) => a + b.nota, 0) / media.length).toFixed(1)
      : null

    let ctx = '\n\n--- FEEDBACK DE NOTAS ANTERIORES ---'
    if (notaMedia) ctx += `\nNota média recebida nesta disciplina: ${notaMedia}/10`
    if (ruins.length > 0) {
      ctx += '\nRespostas que receberam notas BAIXAS (evite esse estilo):'
      ruins.forEach(f => { ctx += `\n- "${f.title}" → nota ${f.nota}: ${f.result?.slice(0, 100) || 'sem detalhe'}` })
    }
    if (boas.length > 0) {
      ctx += '\nRespostas que receberam notas ALTAS (mantenha esse estilo):'
      boas.forEach(f => { ctx += `\n- "${f.title}" → nota ${f.nota}: ${f.result?.slice(0, 100) || 'sem detalhe'}` })
    }
    ctx += '\n---'
    return ctx
  } catch { return '' }
}

function extrairVocabulario(texto) {
  const palavras = texto.toLowerCase()
    .replace(/[^a-záéíóúàâêîôûãõç\s]/gi, '')
    .split(/\s+/)
    .filter(p => p.length > 5)
  const freq = {}
  for (const p of palavras) freq[p] = (freq[p] || 0) + 1
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word)
}
