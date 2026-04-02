import { useState, useEffect, useRef, useCallback } from 'react'
import { useBrowserAgent } from './useBrowserAgent'

const AGENT_URL = 'https://agente-servidor-production.up.railway.app'

async function notifyWhatsApp(phone, taskTitle, courseName, result) {
  if (!phone) return
  try {
    await fetch(`${AGENT_URL}/whatsapp/notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefone: phone,
        mensagem: `✅ *Secretário Escolar — AUTO*\n\nAtividade entregue automaticamente!\n\n📚 *${taskTitle}*\n🏫 ${courseName}\n\n${result || 'Concluído com sucesso.'}`,
      }),
    })
  } catch { /* silent */ }
}

export function useAutoAgent({ tasks, autoMode, extConnected, whatsappPhone }) {
  const [currentTask, setCurrentTask]   = useState(null)
  const [queueSize, setQueueSize]       = useState(0)
  const [processedIds, setProcessedIds] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('se_auto_processed') || '[]')) } catch { return new Set() }
  })

  const processingRef = useRef(false)
  const queueRef      = useRef([])

  const { running, log, done, runAgent, stop, reset } = useBrowserAgent()

  // Build queue whenever tasks change
  useEffect(() => {
    if (!autoMode || !extConnected) {
      queueRef.current = []
      setQueueSize(0)
      return
    }
    const pending = tasks.filter(t =>
      t.status !== 'TURNED_IN' &&
      t.alternateLink &&
      !processedIds.has(t.id)
    )
    queueRef.current = pending
    setQueueSize(pending.length)
  }, [tasks, autoMode, extConnected, processedIds])

  // Process next task in queue
  const processNext = useCallback(() => {
    if (processingRef.current || running) return
    if (!autoMode || !extConnected) return
    if (queueRef.current.length === 0) return

    const task = queueRef.current[0]
    processingRef.current = true
    setCurrentTask(task)
    runAgent(task, { autoApprove: true })
  }, [running, autoMode, extConnected, runAgent])

  // Start processing when conditions are met
  useEffect(() => {
    if (!autoMode || !extConnected || running || processingRef.current) return
    if (queueRef.current.length === 0) return
    const t = setTimeout(processNext, 2000) // 2s delay between tasks
    return () => clearTimeout(t)
  }, [autoMode, extConnected, running, processNext, queueSize])

  // When agent finishes a task
  useEffect(() => {
    if (!done || !currentTask) return

    // Mark as processed
    const newProcessed = new Set([...processedIds, currentTask.id])
    setProcessedIds(newProcessed)
    sessionStorage.setItem('se_auto_processed', JSON.stringify([...newProcessed]))

    // WhatsApp notification
    notifyWhatsApp(whatsappPhone, currentTask.title, currentTask.courseName, done)

    // Cleanup and move to next
    const task = currentTask
    setCurrentTask(null)
    processingRef.current = false
    reset()

    // Remove from queue
    queueRef.current = queueRef.current.filter(t => t.id !== task.id)
    setQueueSize(queueRef.current.length)
  }, [done, currentTask, whatsappPhone, processedIds, reset])

  const stopAuto = useCallback(() => {
    stop()
    processingRef.current = false
    setCurrentTask(null)
  }, [stop])

  return { currentTask, queueSize, running, log, done, stopAuto }
}
