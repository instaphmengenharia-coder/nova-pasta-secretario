import { useState } from 'react'
import { motion } from 'framer-motion'

const FONT = "'Google Sans', 'Roboto', sans-serif"
const AGENT_URL = 'https://agente-servidor-production.up.railway.app'

function formatarTelefone(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  return valor
}

export default function PhoneModal({ userId, accessToken, onSave, onDismiss }) {
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function handleChange(e) {
    setValor(formatarTelefone(e.target.value))
    setErro('')
  }

  async function handleSalvar() {
    const digits = valor.replace(/\D/g, '')
    if (digits.length < 10) {
      setErro('Digite um número válido com DDD.')
      return
    }
    const telefone = digits.startsWith('55') ? digits : `55${digits}`
    setSalvando(true)
    try {
      if (userId && accessToken) {
        await fetch(`${AGENT_URL}/usuario/telefone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({ userId, telefone, accessToken }),
        })
      }
    } catch (_) {
      // silencioso — salva localmente mesmo se backend falhar
    } finally {
      setSalvando(false)
    }
    localStorage.setItem('se_phone', telefone)
    onSave(telefone)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: FONT,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        style={{
          background: 'var(--se-surface, #fff)',
          borderRadius: 22,
          padding: '36px 28px 28px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 16px 64px rgba(0,0,0,0.25)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Ícone WhatsApp */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #25d366, #128c7e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 32,
          boxShadow: '0 4px 16px rgba(37,211,102,0.35)',
        }}>
          💬
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--se-t1, #202124)', marginBottom: 10, lineHeight: 1.3 }}>
          Receba avisos no WhatsApp
        </div>

        <div style={{ fontSize: 14, color: 'var(--se-t2, #5f6368)', lineHeight: 1.65, marginBottom: 22 }}>
          Cadastre seu número e receba <strong>lembretes de prazo</strong> e <strong>confirmações de entrega</strong> direto no WhatsApp — gratuito.
        </div>

        {/* Exemplos de mensagem */}
        <div style={{
          background: 'var(--se-input, #f8f9fa)',
          border: '1px solid var(--se-border, #e8eaed)',
          borderRadius: 12, padding: '12px 14px',
          marginBottom: 22, textAlign: 'left',
          fontSize: 12, color: 'var(--se-t2, #5f6368)',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, color: '#25d366', marginBottom: 6 }}>Você receberá mensagens como:</div>
          <div>📚 <strong>3 dias antes:</strong> "Você tem 3 dias para entregar [atividade]"</div>
          <div style={{ marginTop: 4 }}>⏰ <strong>24h antes:</strong> Aviso antes de entrega automática</div>
          <div style={{ marginTop: 4 }}>✅ <strong>Após entrega:</strong> Confirmação com resumo</div>
        </div>

        {/* Input telefone */}
        <div style={{ marginBottom: 8 }}>
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={valor}
            onChange={handleChange}
            onKeyDown={e => e.key === 'Enter' && handleSalvar()}
            autoFocus
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 16,
              border: `2px solid ${erro ? '#ea4335' : 'var(--se-border, #e8eaed)'}`,
              background: 'var(--se-input, #f8f9fa)', color: 'var(--se-t1, #202124)',
              fontFamily: FONT, boxSizing: 'border-box', outline: 'none',
              textAlign: 'center', letterSpacing: 1,
            }}
          />
          {erro && (
            <div style={{ fontSize: 12, color: '#ea4335', marginTop: 4 }}>{erro}</div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--se-t4, #9aa0a6)', marginBottom: 20 }}>
          Ao cadastrar, você autoriza o envio de mensagens via WhatsApp.
        </div>

        {/* Botão salvar */}
        <button
          onClick={handleSalvar}
          disabled={salvando}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            border: 'none', background: '#25d366', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: salvando ? 'wait' : 'pointer',
            fontFamily: FONT, boxShadow: '0 4px 14px rgba(37,211,102,0.3)',
            opacity: salvando ? 0.8 : 1, marginBottom: 12,
          }}
        >
          {salvando ? 'Salvando...' : '💬 Ativar lembretes no WhatsApp'}
        </button>

        {/* Pular */}
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', fontSize: 13,
            color: 'var(--se-t4, #9aa0a6)', cursor: 'pointer',
            fontFamily: FONT, padding: '4px 0',
          }}
        >
          Agora não
        </button>
      </motion.div>
    </div>
  )
}
