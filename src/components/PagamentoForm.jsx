import { useEffect, useRef, useState } from 'react'

const AGENT_URL = 'https://agente-servidor-production.up.railway.app'
const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || ''
const FONT = "'Google Sans', 'Roboto', sans-serif"

const INFO_PLANO = {
  pro:       { nome: 'Pro',                   preco: 39.90, cor: '#1a73e8' },
  pro_trial: { nome: 'Pro — 3 dias grátis',   preco: 0,     cor: '#1a73e8' },
  premium:   { nome: 'Premium',               preco: 59.90, cor: '#9c27b0' },
}

const iframeContainer = {
  border: '1px solid var(--se-border)',
  borderRadius: 8,
  padding: '10px 12px',
  background: 'var(--se-input)',
  minHeight: 40,
  marginBottom: 10,
}

export default function PagamentoForm({ plano, user, onSuccess, onCancel }) {
  const [sdkPronto, setSdkPronto] = useState(false)
  const [formPronto, setFormPronto] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const cardFormRef = useRef(null)
  const info = INFO_PLANO[plano] || INFO_PLANO.pro

  // 1. Carrega SDK do MP
  useEffect(() => {
    if (window.MercadoPago) { setSdkPronto(true); return }
    const s = document.createElement('script')
    s.src = 'https://sdk.mercadopago.com/js/v2'
    s.onload = () => setSdkPronto(true)
    s.onerror = () => setErro('Falha ao carregar SDK do Mercado Pago')
    document.head.appendChild(s)
  }, [])

  // 2. Monta CardForm quando SDK estiver pronto
  useEffect(() => {
    if (!sdkPronto || !MP_PUBLIC_KEY) return

    const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })

    cardFormRef.current = mp.cardForm({
      amount: String(info.preco || 39.90),
      iframe: true,
      form: {
        id: 'se-card-form',
        cardNumber:         { id: 'se-cardNumber',   placeholder: 'Número do cartão' },
        expirationDate:     { id: 'se-expiry',       placeholder: 'MM/AA' },
        securityCode:       { id: 'se-cvv',          placeholder: 'CVV' },
        cardholderName:     { id: 'se-name',         placeholder: 'Nome como no cartão' },
        issuer:             { id: 'se-issuer' },
        installments:       { id: 'se-installments' },
        identificationType: { id: 'se-doc-type' },
        identificationNumber:{ id: 'se-doc-number', placeholder: 'CPF' },
        cardholderEmail:    { id: 'se-email',        placeholder: 'E-mail' },
      },
      callbacks: {
        onFormMounted: (err) => {
          if (err) { setErro('Erro ao montar formulário do cartão'); return }
          setFormPronto(true)
        },
        onSubmit: async (e) => {
          e.preventDefault()
          setProcessando(true)
          setErro('')
          try {
            const fd = cardFormRef.current.getCardFormData()
            if (!fd.token) throw new Error('Token do cartão não gerado — verifique os dados')

            const res = await fetch(`${AGENT_URL}/assinar-cartao`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                plano,
                email: user.email,
                cardToken: fd.token,
                issuerId: fd.issuerId,
                paymentMethodId: fd.paymentMethodId,
              }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.erro || 'Erro ao processar assinatura')
            onSuccess(data)
          } catch (err) {
            setErro(err.message)
            setProcessando(false)
          }
        },
        onError: (err) => console.error('[MP CardForm]', err),
      },
    })

    return () => { try { cardFormRef.current?.unmount?.() } catch {} }
  }, [sdkPronto, plano])

  if (!MP_PUBLIC_KEY) {
    return (
      <div style={{ padding: 20, fontFamily: FONT, color: '#c62828', background: '#fce8e6', borderRadius: 10 }}>
        ⚠️ Chave pública do Mercado Pago não configurada.<br />
        Adicione <code>VITE_MP_PUBLIC_KEY</code> nas variáveis de ambiente do Vercel.
      </div>
    )
  }

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--se-t3)', fontSize: 18, padding: 0 }}>←</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--se-t1)' }}>Assinar {info.nome}</div>
          {info.preco > 0
            ? <div style={{ fontSize: 13, color: 'var(--se-t3)' }}>R$ {info.preco.toFixed(2)}/mês · Cancele quando quiser</div>
            : <div style={{ fontSize: 13, color: '#2e7d32' }}>3 dias grátis · depois R$ 39,90/mês</div>
          }
        </div>
      </div>

      {/* Loading SDK */}
      {!sdkPronto && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--se-t3)', fontSize: 13 }}>
          Carregando formulário...
        </div>
      )}

      {/* Card Form */}
      <form id="se-card-form" style={{ display: sdkPronto ? 'block' : 'none' }}>
        <label style={labelStyle}>Número do cartão</label>
        <div id="se-cardNumber" style={iframeContainer} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Validade</label>
            <div id="se-expiry" style={iframeContainer} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>CVV</label>
            <div id="se-cvv" style={iframeContainer} />
          </div>
        </div>

        <label style={labelStyle}>Nome no cartão</label>
        <div id="se-name" style={iframeContainer} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: '0 0 110px' }}>
            <label style={labelStyle}>Documento</label>
            <select id="se-doc-type" style={{ ...iframeContainer, width: '100%', cursor: 'pointer' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Número</label>
            <div id="se-doc-number" style={iframeContainer} />
          </div>
        </div>

        <label style={labelStyle}>E-mail</label>
        <div id="se-email" style={iframeContainer} />

        {/* Ocultos — necessários para o CardForm */}
        <select id="se-issuer" style={{ display: 'none' }} />
        <select id="se-installments" style={{ display: 'none' }} />

        {erro && (
          <div style={{ background: '#fce8e6', color: '#c62828', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={!formPronto || processando}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
            background: !formPronto || processando ? '#ccc' : info.cor,
            color: '#fff', fontWeight: 700, fontSize: 15, cursor: !formPronto || processando ? 'default' : 'pointer',
            fontFamily: FONT, marginBottom: 10,
          }}
        >
          {processando ? 'Processando...' : !formPronto ? 'Carregando...' : info.preco > 0
            ? `Assinar por R$ ${info.preco.toFixed(2)}/mês`
            : 'Iniciar 3 dias grátis'
          }
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--se-t3)', marginBottom: 4 }}>
          🔒 Pagamento seguro via Mercado Pago · Dados criptografados
        </div>
      </form>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--se-t2)', marginBottom: 4,
}
