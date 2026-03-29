import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { assinarPlano, cancelarAssinatura, buscarEntregas } from '../hooks/usePlano'

const FONT = "'Google Sans', 'Roboto', sans-serif"

const PLANOS = [
  {
    id: 'free',
    nome: 'Free',
    preco: 'Grátis',
    cor: '#9e9e9e',
    descricao: 'Para experimentar',
    recursos: [
      '2 atividades por mês',
      'Geração de resposta com IA',
      'Chat com IA',
      'Plano semanal básico',
    ],
    bloqueios: ['Agente no Chrome', 'WhatsApp', 'Modo automático', 'Histórico'],
    btn: 'Plano atual',
    disabled: true,
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 'R$ 39,90',
    periodo: '/mês',
    cor: '#1a73e8',
    destaque: true,
    descricao: 'Para estudantes sérios',
    recursos: [
      '30 atividades por mês',
      'Agente no Chrome (automação total)',
      'Notificações WhatsApp',
      'Dashboard de histórico e notas',
      'Feedback loop com IA',
      'Suporte prioritário',
    ],
    btn: 'Assinar Pro',
  },
  {
    id: 'premium',
    nome: 'Premium',
    preco: 'R$ 59,90',
    periodo: '/mês',
    cor: '#9c27b0',
    descricao: 'Para máxima eficiência',
    recursos: [
      'Tudo do Pro',
      '80 atividades por mês',
      'Modo automático (faz tudo sozinho)',
      'WhatsApp com resumo diário',
      'Análise de viabilidade avançada',
      'Acesso antecipado a novidades',
    ],
    btn: 'Assinar Premium',
  },
]

export default function Precos({ user, planoAtual = 'free', custoAcumulado = 0, creditoUsado = 0, creditoLimite = 2, trialUsado = false, verificandoPagamento = false, accessToken = null, onVoltar }) {
  const [loading, setLoading] = useState(null)
  const [erro, setErro] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [entregas, setEntregas] = useState([])

  useEffect(() => {
    if (user?.id && accessToken) buscarEntregas(user.id, accessToken).then(setEntregas).catch(() => {})
  }, [user?.id, accessToken])

  async function handleCancelar() {
    if (!window.confirm('Cancelar sua assinatura? Você perderá o acesso ao final do período pago.')) return
    setCancelando(true)
    setErro('')
    try {
      await cancelarAssinatura(user?.id, accessToken)
      setCancelado(true)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCancelando(false)
    }
  }

  async function handleAssinar(planoId) {
    if (planoId === 'free') return
    setLoading(planoId)
    setErro('')
    try {
      const { checkoutUrl } = await assinarPlano({
        userId: user?.id,
        plano: planoId,
        email: user?.email,
      })
      window.location.href = checkoutUrl
    } catch (err) {
      setErro(err.message)
      setLoading(null)
    }
  }

  return (
    <motion.div
      key="precos"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ padding: '8px 0', fontFamily: FONT }}
    >
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--se-t1)', marginBottom: 6 }}>
          Escolha seu plano
        </div>
        <div style={{ fontSize: 14, color: 'var(--se-t3)' }}>
          Cancele quando quiser · Cobrado via Mercado Pago
        </div>
      </div>

      {/* Barra de crédito do mês */}
      {(() => {
        const pct = Math.min(100, Math.round((creditoUsado / creditoLimite) * 100))
        const esgotado = creditoUsado >= creditoLimite
        return (
          <div style={{ background: 'var(--se-input)', border: `1px solid ${esgotado ? '#ffb74d' : 'var(--se-border)'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--se-t2)', fontWeight: 600 }}>💳 Créditos de IA usados este mês</span>
              <span style={{ color: esgotado ? '#e65100' : 'var(--se-t2)', fontWeight: 700 }}>
                R$ {creditoUsado.toFixed(2)} <span style={{ fontWeight: 400, color: 'var(--se-t3)' }}>de R$ {creditoLimite.toFixed(2)}</span>
              </span>
            </div>
            <div style={{ width: '100%', height: 8, borderRadius: 6, background: 'var(--se-border)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: esgotado ? '#e65100' : pct > 80 ? '#ff9800' : '#1a73e8', transition: 'width 0.4s' }} />
            </div>
            {esgotado && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#e65100' }}>
                Créditos esgotados — faça upgrade para continuar usando a IA este mês.
              </div>
            )}
            {custoAcumulado > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--se-t3)' }}>
                Total acumulado desde sempre: US$ {custoAcumulado.toFixed(4)}
              </div>
            )}
          </div>
        )
      })()}

      {verificandoPagamento && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, color: '#2e7d32' }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #2e7d32', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Verificando seu pagamento… isso pode levar alguns segundos.
        </div>
      )}

      {cancelado && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#e65100' }}>
          Assinatura cancelada. Seu acesso continua até o fim do período já pago.
        </div>
      )}

      {erro && (
        <div style={{ background: '#fce8e6', color: '#c62828', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {PLANOS.map((p) => {
          const isAtual = planoAtual === p.id
          const isLoading = loading === p.id
          return (
            <motion.div
              key={p.id}
              whileHover={!p.disabled ? { y: -3 } : {}}
              style={{
                background: 'var(--se-surface)',
                border: p.destaque ? `2px solid ${p.cor}` : '1px solid var(--se-border)',
                borderRadius: 16,
                padding: '24px 22px',
                minWidth: 220,
                flex: 1,
                maxWidth: 280,
                position: 'relative',
                boxShadow: p.destaque ? `0 4px 20px ${p.cor}22` : 'none',
              }}
            >
              {p.destaque && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: p.cor, color: '#fff', fontSize: 11, fontWeight: 700,
                  padding: '3px 14px', borderRadius: 20,
                }}>
                  MAIS POPULAR
                </div>
              )}

              <div style={{ fontSize: 18, fontWeight: 700, color: p.cor, marginBottom: 4 }}>{p.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--se-t3)', marginBottom: 12 }}>{p.descricao}</div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--se-t1)' }}>{p.preco}</span>
                {p.periodo && <span style={{ fontSize: 13, color: 'var(--se-t3)' }}>{p.periodo}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {p.recursos.map((r) => (
                  <div key={r} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--se-t2)' }}>
                    <span style={{ color: '#34a853', flexShrink: 0 }}>✓</span> {r}
                  </div>
                ))}
                {p.bloqueios?.map((r) => (
                  <div key={r} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--se-t4)' }}>
                    <span style={{ flexShrink: 0 }}>✗</span> {r}
                  </div>
                ))}
              </div>

              {/* Botão trial 3 dias — só Pro, só free, só quem não usou trial */}
              {p.id === 'pro' && planoAtual === 'free' && !trialUsado && (
                <button
                  onClick={() => handleAssinar('pro_trial')}
                  disabled={loading === 'pro_trial'}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 14,
                    fontWeight: 700, cursor: 'pointer', border: '2px solid #1a73e8',
                    background: 'transparent', color: '#1a73e8', fontFamily: FONT,
                    marginBottom: 8, opacity: loading === 'pro_trial' ? 0.7 : 1,
                  }}
                >
                  {loading === 'pro_trial' ? 'Redirecionando...' : '🎁 3 dias grátis — depois R$ 39,90/mês'}
                </button>
              )}

              <button
                onClick={() => handleAssinar(p.id)}
                disabled={p.disabled || isAtual || isLoading}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 14,
                  fontWeight: 700, cursor: (p.disabled || isAtual) ? 'default' : 'pointer',
                  border: 'none', fontFamily: FONT,
                  background: isAtual ? '#e8f5e9' : p.disabled ? 'var(--se-input)' : p.cor,
                  color: isAtual ? '#2e7d32' : p.disabled ? 'var(--se-t3)' : '#fff',
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? 'Redirecionando...' : isAtual ? '✓ Plano atual' : p.btn}
              </button>
              {isAtual && p.id !== 'free' && !cancelado && (
                <button
                  onClick={handleCancelar}
                  disabled={cancelando}
                  style={{ width: '100%', marginTop: 8, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid #ffcdd2', background: 'transparent', color: '#c62828', fontFamily: FONT, opacity: cancelando ? 0.6 : 1 }}
                >
                  {cancelando ? 'Cancelando...' : 'Cancelar assinatura'}
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--se-t4)' }}>
        Pagamento seguro via Mercado Pago · Cancele quando quiser pelo app
      </div>

      {/* Histórico de entregas */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--se-t1)', marginBottom: 12 }}>
          Histórico de entregas
        </div>
        {entregas.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--se-t4)', textAlign: 'center', padding: '16px 0' }}>
            Nenhuma entrega registrada ainda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entregas.map((e, i) => (
              <div key={i} style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--se-t1)' }}>✅ {e.titulo}</div>
                  {e.disciplina && <div style={{ fontSize: 11, color: 'var(--se-t3)', marginTop: 2 }}>{e.disciplina}</div>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--se-t4)', whiteSpace: 'nowrap' }}>
                  {new Date(e.entregue_em).toLocaleDateString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
