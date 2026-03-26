import { useState } from 'react'
import { motion } from 'framer-motion'
import { assinarPlano } from '../hooks/usePlano'

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
    preco: 'R$ 19',
    periodo: '/mês',
    cor: '#1a73e8',
    destaque: true,
    descricao: 'Para estudantes sérios',
    recursos: [
      'Atividades ilimitadas',
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
    preco: 'R$ 39',
    periodo: '/mês',
    cor: '#9c27b0',
    descricao: 'Para máxima eficiência',
    recursos: [
      'Tudo do Pro',
      'Modo automático (faz tudo sozinho)',
      'WhatsApp com resumo diário',
      'Análise de viabilidade avançada',
      'Múltiplas contas Google',
      'Acesso antecipado a novidades',
    ],
    btn: 'Assinar Premium',
  },
]

export default function Precos({ user, planoAtual = 'free', onVoltar }) {
  const [loading, setLoading] = useState(null)
  const [erro, setErro] = useState('')

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
            </motion.div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--se-t4)' }}>
        Pagamento seguro via Mercado Pago · Cancele pelo email a qualquer momento
      </div>
    </motion.div>
  )
}
