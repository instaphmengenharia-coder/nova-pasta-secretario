const AGENT_URL = 'https://agente-servidor-production.up.railway.app'

export async function buscarPlanoUsuario(userId) {
  const fallback = { plano: 'free', validade_ate: null, creditos_usados: 0, creditos_limite: 8, trial_usado: false }
  if (!userId) return fallback
  try {
    const res = await fetch(`${AGENT_URL}/plano/${encodeURIComponent(userId)}`)
    if (!res.ok) return fallback
    return await res.json()
  } catch { return fallback }
}

export async function cancelarAssinatura(userId, accessToken) {
  const res = await fetch(`${AGENT_URL}/plano/cancelar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ userId, accessToken }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.erro || 'Erro ao cancelar assinatura')
  return data
}

export async function buscarEntregas(userId, accessToken) {
  if (!userId || !accessToken) return []
  try {
    const res = await fetch(`${AGENT_URL}/entregas/${encodeURIComponent(userId)}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

export async function verificarPagamentoMP(userId) {
  if (!userId) return null
  try {
    const res = await fetch(`${AGENT_URL}/plano/verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export async function assinarPlano({ userId, plano, email }) {
  const res = await fetch(`${AGENT_URL}/assinar/${plano}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, backUrl: window.location.origin }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.erro || 'Erro ao criar assinatura')
  return data // { checkoutUrl, subscriptionId }
}
