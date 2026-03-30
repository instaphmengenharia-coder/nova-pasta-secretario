import { useState } from 'react'
import { motion } from 'framer-motion'

const FONT = "'Google Sans', 'Roboto', sans-serif"

const FEATURES = [
  {
    icon: '🤖',
    titulo: 'IA gera a resposta',
    desc: 'Cole a atividade, clique em Gerar — a IA lê o enunciado, os materiais em PDF e escreve a resposta completa.',
  },
  {
    icon: '📬',
    titulo: 'Entrega automática',
    desc: 'Sem copiar e colar. A IA entrega direto no Google Classroom por você, com um clique.',
  },
  {
    icon: '⏰',
    titulo: 'Modo automático 24h',
    desc: 'Ative e vá dormir. O agente monitora seus prazos e entrega tudo antes de vencer — sozinho.',
  },
  {
    icon: '📱',
    titulo: 'Aviso no WhatsApp',
    desc: 'Receba uma mensagem no WhatsApp confirmando cada entrega, com o resumo do que foi feito.',
  },
  {
    icon: '📊',
    titulo: 'Dashboard de notas',
    desc: 'Veja todas as suas entregas, histórico de notas e quais atividades estão em aberto.',
  },
  {
    icon: '🔒',
    titulo: 'Seguro e privado',
    desc: 'Seu login é via Google. Não armazenamos sua senha. Os dados ficam criptografados.',
  },
]

const STEPS = [
  { n: '1', label: 'Instale a extensão no Chrome' },
  { n: '2', label: 'Entre com sua conta Google' },
  { n: '3', label: 'A IA faz o resto' },
]

export default function LandingPage({ onSignIn, error, loading }) {
  const [videoPlaying, setVideoPlaying] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: FONT, color: '#202124', overflowX: 'hidden' }}>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e8eaed', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>📚</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#202124' }}>Secretário Escolar</span>
        </div>
        <button
          onClick={onSignIn}
          disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 24, border: 'none', background: '#1a73e8', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Entrando...' : 'Entrar com Google'}
        </button>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '72px 24px 48px', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ display: 'inline-block', background: '#e8f0fe', color: '#1a73e8', fontSize: 13, fontWeight: 700, borderRadius: 20, padding: '4px 14px', marginBottom: 20 }}>
            IA para estudantes do Google Classroom
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 20, color: '#202124' }}>
            Suas atividades entregues.<br />
            <span style={{ color: '#1a73e8' }}>Sem estresse. Com IA.</span>
          </h1>
          <p style={{ fontSize: 18, color: '#5f6368', maxWidth: 580, margin: '0 auto 36px', lineHeight: 1.6 }}>
            O Secretário Escolar lê o enunciado, gera a resposta e entrega direto no Google Classroom — tudo em menos de 30 segundos.
          </p>
          {error && (
            <div style={{ background: '#fce8e6', color: '#c62828', padding: '10px 18px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onSignIn}
              disabled={loading}
              style={{ padding: '14px 32px', borderRadius: 30, border: 'none', background: '#1a73e8', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,115,232,0.35)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Entrando...' : '🚀 Começar grátis — Entrar com Google'}
            </button>
          </div>
          <p style={{ fontSize: 13, color: '#9aa0a6', marginTop: 12 }}>8 créditos grátis por mês · Sem cartão</p>
        </motion.div>
      </section>

      {/* ── Vídeo ── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 64px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.15)', background: '#000', position: 'relative', aspectRatio: '16/9' }}
        >
          {!videoPlaying ? (
            <div
              onClick={() => setVideoPlaying(true)}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
            >
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, backdropFilter: 'blur(8px)', border: '2px solid rgba(255,255,255,0.3)', transition: 'transform 0.2s' }}>
                <span style={{ fontSize: 32, marginLeft: 4 }}>▶</span>
              </div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Ver a IA fazendo uma atividade real</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Do enunciado à entrega em 30 segundos</div>
            </div>
          ) : (
            <iframe
              src="https://www.youtube.com/embed/?autoplay=1"
              style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
              allow="autoplay; fullscreen"
              title="Demo Secretário Escolar"
            />
          )}
        </motion.div>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#9aa0a6', marginTop: 12 }}>
          Vídeo demonstração — IA resolvendo atividade real do zero ao fim
        </p>
      </section>

      {/* ── Como funciona ── */}
      <section style={{ background: '#f8f9fa', padding: '56px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Como funciona</h2>
          <p style={{ fontSize: 15, color: '#5f6368', marginBottom: 40 }}>3 passos. Menos de 1 minuto.</p>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 + 0.2 }}
                style={{ flex: '1 1 180px', maxWidth: 220, textAlign: 'center' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1a73e8', color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  {s.n}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#202124' }}>{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>Tudo que você precisa</h2>
        <p style={{ fontSize: 15, color: '#5f6368', textAlign: 'center', marginBottom: 48 }}>Do básico ao automático</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.titulo}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              style={{ background: '#f8f9fa', borderRadius: 16, padding: '24px 20px' }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.titulo}</div>
              <div style={{ fontSize: 13, color: '#5f6368', lineHeight: 1.6 }}>{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Preços resumo ── */}
      <section style={{ background: '#f8f9fa', padding: '56px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Preços simples</h2>
          <p style={{ fontSize: 15, color: '#5f6368', marginBottom: 40 }}>Comece grátis. Assine quando precisar de mais.</p>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { nome: 'Free', preco: 'Grátis', cor: '#9e9e9e', desc: '8 créditos/mês', sub: 'Para experimentar' },
              { nome: 'Pro', preco: 'R$39,90', cor: '#1a73e8', desc: '80 créditos/mês', sub: 'Para estudantes sérios', destaque: true },
              { nome: 'Premium', preco: 'R$59,90', cor: '#9c27b0', desc: '120 créditos/mês', sub: 'Para máxima eficiência' },
            ].map((p) => (
              <div key={p.nome} style={{ flex: '1 1 160px', maxWidth: 200, background: '#fff', borderRadius: 16, padding: '24px 16px', border: p.destaque ? `2px solid ${p.cor}` : '1px solid #e8eaed', boxShadow: p.destaque ? `0 4px 20px ${p.cor}22` : 'none' }}>
                {p.destaque && <div style={{ fontSize: 10, fontWeight: 700, color: p.cor, marginBottom: 8, letterSpacing: 1 }}>MAIS POPULAR</div>}
                <div style={{ fontSize: 16, fontWeight: 800, color: p.cor, marginBottom: 4 }}>{p.nome}</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{p.preco}</div>
                <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 4 }}>{p.desc}</div>
                <div style={{ fontSize: 11, color: '#9aa0a6' }}>{p.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#9aa0a6' }}>
            PIX tem 2% de desconto · Cancele quando quiser
          </div>
          <button
            onClick={onSignIn}
            disabled={loading}
            style={{ marginTop: 32, padding: '14px 36px', borderRadius: 30, border: 'none', background: '#1a73e8', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,115,232,0.35)', opacity: loading ? 0.7 : 1 }}
          >
            Começar grátis agora
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '32px 24px', textAlign: 'center', borderTop: '1px solid #e8eaed' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📚 Secretário Escolar</div>
        <div style={{ fontSize: 12, color: '#9aa0a6' }}>
          Pagamento seguro via Mercado Pago · Não é afiliado ao Google
        </div>
      </footer>

    </div>
  )
}
