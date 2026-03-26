import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getAgentHistory } from '../hooks/useBrowserAgent'
import { salvarFeedbackNota } from '../hooks/useStyleMemory'

const FONT = "'Google Sans', 'Roboto', sans-serif"

function StatBox({ icon, value, label, color }) {
  return (
    <div style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 120, textAlign: 'center' }}>
      <div style={{ fontSize: 26, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: FONT }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--se-t3)', marginTop: 2, fontFamily: FONT }}>{label}</div>
    </div>
  )
}

function NoteInput({ history, onSave }) {
  const [editing, setEditing] = useState(null)
  const [val, setVal] = useState('')

  function start(id, current) {
    setEditing(id)
    setVal(current ?? '')
  }

  function save(id) {
    onSave(id, val === '' ? null : Number(val))
    setEditing(null)
  }

  return { editing, val, setVal, start, save }
}

export default function Dashboard({ tasks = [] }) {
  const [history, setHistory] = useState([])
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('se_notas') || '{}') } catch { return {} }
  })
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setHistory(getAgentHistory())
  }, [])

  function saveNote(id, nota) {
    const next = { ...notes, [id]: nota }
    if (nota === null) delete next[id]
    setNotes(next)
    localStorage.setItem('se_notas', JSON.stringify(next))
    // Feedback loop — salva para melhorar respostas futuras
    const item = history.find(h => h.id === id)
    if (item && nota !== null) salvarFeedbackNota(item, nota)
  }

  // Stats
  const total      = history.length
  const successos  = history.filter(h => h.status === 'success').length
  const falhas     = history.filter(h => h.status === 'failed' || h.status === 'cancelled').length
  const comNota    = Object.values(notes).filter(n => n !== null && n !== undefined)
  const notaMedia  = comNota.length > 0 ? (comNota.reduce((a, b) => a + b, 0) / comNota.length).toFixed(1) : '—'
  const taxaSucesso = total > 0 ? Math.round((successos / total) * 100) : 0

  const filtered = filter === 'all' ? history
    : filter === 'success' ? history.filter(h => h.status === 'success')
    : filter === 'failed'  ? history.filter(h => h.status !== 'success')
    : history

  const statusLabel = { success: '✅ Concluído', failed: '❌ Falhou', cancelled: '⛔ Cancelado', rejected: '↩ Rejeitado' }
  const statusColor = { success: '#34a853', failed: '#ea4335', cancelled: '#9e9e9e', rejected: '#f29900' }

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatBox icon="🤖" value={total}        label="Execuções totais"  color="#1a73e8" />
        <StatBox icon="✅" value={successos}    label="Concluídas"        color="#34a853" />
        <StatBox icon="📊" value={`${taxaSucesso}%`} label="Taxa de sucesso" color="#9c27b0" />
        <StatBox icon="🏆" value={notaMedia}    label="Nota média"        color="#f29900" />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['all', 'Todos'], ['success', 'Concluídos'], ['failed', 'Falharam']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: FONT,
            border: filter === key ? 'none' : '1px solid var(--se-border)',
            background: filter === key ? '#1a73e8' : 'var(--se-surface)',
            color: filter === key ? '#fff' : 'var(--se-t2)',
            fontWeight: filter === key ? 700 : 400,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--se-t4)', fontFamily: FONT }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
          <div style={{ fontSize: 14 }}>Nenhuma execução registrada ainda.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Use "Executar no Chrome" em uma atividade para começar.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((item, i) => {
            const nota = notes[item.id]
            const analise = item.analise_viabilidade
            return (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.2 }}
                style={{
                  background: 'var(--se-surface)', border: '1px solid var(--se-border)',
                  borderRadius: 12, padding: '14px 16px', fontFamily: FONT,
                  borderLeft: `4px solid ${statusColor[item.status] || '#ccc'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--se-t1)', marginBottom: 3 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--se-t3)', marginBottom: 6 }}>
                      {item.course} · {new Date(item.completedAt).toLocaleString('pt-BR')}
                    </div>
                    {item.result && (
                      <div style={{ fontSize: 12, color: 'var(--se-t2)', marginBottom: 6, lineHeight: 1.5 }}>
                        {item.result}
                      </div>
                    )}
                    {analise && (
                      <div style={{ fontSize: 11, color: 'var(--se-t3)', background: 'var(--se-input)', borderRadius: 6, padding: '4px 8px', marginBottom: 6, display: 'inline-block' }}>
                        🔍 Viabilidade: <strong>{analise.confianca}</strong> — {analise.motivo?.slice(0, 80)}
                      </div>
                    )}
                  </div>

                  {/* Status + Nota */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 110 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10,
                      color: statusColor[item.status] || '#666',
                      background: (statusColor[item.status] || '#ccc') + '20',
                    }}>
                      {statusLabel[item.status] || item.status}
                    </span>

                    {/* Nota */}
                    {editing === item.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number" min="0" max="10" step="0.1"
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          style={{ width: 54, padding: '3px 6px', borderRadius: 6, border: '1px solid #1a73e8', fontSize: 12, fontFamily: FONT }}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') { saveNote(item.id, editVal === '' ? null : Number(editVal)); setEditing(null) } if (e.key === 'Escape') setEditing(null) }}
                        />
                        <button onClick={() => { saveNote(item.id, editVal === '' ? null : Number(editVal)); setEditing(null) }}
                          style={{ background: '#34a853', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 7px', fontSize: 11, cursor: 'pointer' }}>✓</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(item.id); setEditVal(nota ?? '') }}
                        style={{ background: nota != null ? '#e8f5e9' : 'var(--se-input)', border: '1px solid var(--se-border)', borderRadius: 8, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: nota != null ? '#2e7d32' : 'var(--se-t3)', fontFamily: FONT, fontWeight: nota != null ? 700 : 400 }}>
                        {nota != null ? `📝 ${nota}` : '+ nota'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {history.length > 0 && (
        <button onClick={() => {
          localStorage.removeItem('se_agent_history')
          localStorage.removeItem('se_notas')
          setHistory([])
          setNotes({})
        }} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', fontSize: 11, color: 'var(--se-t4)', cursor: 'pointer', fontFamily: FONT }}>
          🗑 Limpar histórico
        </button>
      )}
    </motion.div>
  )
}
