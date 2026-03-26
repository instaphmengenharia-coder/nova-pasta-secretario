const AGENT_URL = 'https://agente-servidor-production.up.railway.app'

export async function buscarPlanoUsuario(userId) {
  if (!userId) return { plano: 'free', atividades_mes: 0, validade_ate: null }
  try {
    const res = await fetch(`${AGENT_URL}/plano/${encodeURIComponent(userId)}`)
    if (!res.ok) return { plano: 'free', atividades_mes: 0, validade_ate: null }
    return await res.json()
  } catch { return { plano: 'free', atividades_mes: 0, validade_ate: null } }
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
