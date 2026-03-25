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

export async function salvarEstilo({ userId, materia, resposta, respostaEditada }) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        materia,
        exemplosAprovados: exemplos,
        vocabularioComum: vocab,
        tamanhoMedioResposta: palavras,
        tom,
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
