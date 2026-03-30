import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const FONT = "'Google Sans', 'Roboto', sans-serif"

const STEPS = [
  {
    emoji: '👋',
    titulo: 'Bem-vindo ao Secretário Escolar!',
    desc: 'Seu assistente de IA para o Google Classroom. Em menos de 1 minuto você vai entender tudo — e já pode usar.',
    dica: null,
  },
  {
    emoji: '📋',
    titulo: 'Suas atividades, organizadas',
    desc: 'Todas as tarefas do Google Classroom aparecem aqui, agrupadas por prazo: esta semana, próxima semana e atrasadas.',
    dica: '💡 Use o filtro por disciplina para focar no que importa agora.',
  },
  {
    emoji: '✨',
    titulo: 'IA gera a resposta',
    desc: 'Clique em qualquer atividade → botão "Gerar com IA". Em segundos você tem uma resposta completa, pronta para entregar.',
    dica: '💡 A IA lê o enunciado, os PDFs e os materiais anexados automaticamente.',
  },
  {
    emoji: '📬',
    titulo: 'Entregue com um clique',
    desc: 'Depois de revisar a resposta, clique em "Entregar". A IA manda direto para o Classroom — sem copiar e colar.',
    dica: '💡 Você pode editar a resposta antes de entregar — é sempre sua decisão final.',
  },
  {
    emoji: '🤖',
    titulo: 'Modo automático (Pro)',
    desc: 'No plano Pro, ative o Modo Auto e o agente monitora seus prazos e entrega tudo sozinho — inclusive de madrugada.',
    dica: '💡 Você recebe um aviso no WhatsApp a cada entrega feita pelo agente.',
  },
]

const STORAGE_KEY = 'se_onboarding_done'

export function marcarOnboardingFeito() {
  localStorage.setItem(STORAGE_KEY, '1')
}

export function onboardingPendente() {
  return !localStorage.getItem(STORAGE_KEY)
}

export default function Onboarding({ onClose }) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1

  function avancar() {
    if (isLast) {
      marcarOnboardingFeito()
      onClose()
    } else {
      setStep(s => s + 1)
    }
  }

  function pular() {
    marcarOnboardingFeito()
    onClose()
  }

  const s = STEPS[step]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: FONT,
    }}>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.97 }}
        transition={{ duration: 0.25 }}
        style={{
          background: 'var(--se-surface, #fff)',
          borderRadius: 22,
          padding: '36px 28px 28px',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 16px 64px rgba(0,0,0,0.25)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Pular */}
        <button
          onClick={pular}
          style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: 12, color: 'var(--se-t4, #9aa0a6)', cursor: 'pointer', fontFamily: FONT }}
        >
          Pular
        </button>

        {/* Emoji */}
        <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>{s.emoji}</div>

        {/* Título */}
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--se-t1, #202124)', marginBottom: 12, lineHeight: 1.3 }}>
          {s.titulo}
        </div>

        {/* Descrição */}
        <div style={{ fontSize: 14, color: 'var(--se-t2, #5f6368)', lineHeight: 1.65, marginBottom: s.dica ? 14 : 28 }}>
          {s.desc}
        </div>

        {/* Dica */}
        {s.dica && (
          <div style={{ background: '#e8f0fe', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#1a73e8', marginBottom: 28, textAlign: 'left' }}>
            {s.dica}
          </div>
        )}

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 8, height: 8,
                borderRadius: 4, transition: 'all 0.25s',
                background: i === step ? '#1a73e8' : 'var(--se-border, #e8eaed)',
              }}
            />
          ))}
        </div>

        {/* Botão principal */}
        <button
          onClick={avancar}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            border: 'none', background: '#1a73e8', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
            boxShadow: '0 4px 14px rgba(26,115,232,0.3)',
          }}
        >
          {isLast ? '🚀 Começar' : 'Próximo →'}
        </button>

        {/* Contador */}
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--se-t4, #9aa0a6)' }}>
          {step + 1} de {STEPS.length}
        </div>
      </motion.div>
    </div>
  )
}
