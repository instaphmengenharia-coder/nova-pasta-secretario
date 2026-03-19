import { useState, useEffect, useRef } from 'react'

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

const SERVER = 'https://agente-servidor-production.up.railway.app'

const BASE = 'https://classroom.googleapis.com/v1'

export function useClassroom() {
  const [accessToken, setAccessToken] = useState(null)
  const [refreshToken, setRefreshToken] = useState(null)
  const [user, setUser] = useState(null) // { id, name, photo }
  const [courses, setCourses] = useState([])
  const [tasks, setTasks] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const codeClientRef = useRef(null)
  const gsiReadyRef   = useRef(false)

  // Load Google Identity Services script once
  useEffect(() => {
    if (document.getElementById('gsi-script')) return

    const script = document.createElement('script')
    script.id = 'gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      gsiReadyRef.current = true
      initCodeClient()
    }
    document.head.appendChild(script)
  }, [])

  const initCodeClient = () => {
    if (!window.google?.accounts?.oauth2) return
    codeClientRef.current = window.google.accounts.oauth2.initCodeClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      ux_mode: 'popup',
      callback: handleCodeResponse,
    })
  }

  const handleCodeResponse = async (response) => {
    if (response.error) {
      setError(`Erro de autenticação: ${response.error}`)
      return
    }
    try {
      // Server exchanges code for tokens and stores refresh_token
      const res = await fetch(`${SERVER}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: response.code }),
      })
      if (!res.ok) throw new Error(`Servidor retornou ${res.status}`)
      const { accessToken: token, refreshToken: rToken, userId, name, photo } = await res.json()
      setAccessToken(token)
      if (rToken) setRefreshToken(rToken)
      setUser({ id: userId, name, photo })
      await fetchAllData(token)
    } catch (err) {
      setError(`Erro ao fazer login: ${err.message}`)
    }
  }

  const signIn = () => {
    setError(null)
    if (codeClientRef.current) {
      codeClientRef.current.requestCode()
    } else {
      initCodeClient()
      setTimeout(() => {
        if (codeClientRef.current) codeClientRef.current.requestCode()
        else setError('Google Identity Services ainda não carregou. Aguarde e tente novamente.')
      }, 1000)
    }
  }

  const signOut = () => {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {})
    }
    setAccessToken(null)
    setUser(null)
    setCourses([])
    setTasks([])
    setAnnouncements([])
    setError(null)
  }

  // ─── API helpers ─────────────────────────────────────────────────────────────

  const apiFetch = async (url, token) => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) throw new Error('Sessão expirada. Faça login novamente.')
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error?.message || `Erro HTTP ${res.status}`)
    }
    return res.json()
  }

  // ─── Fetch orchestration ─────────────────────────────────────────────────────

  const fetchAllData = async (token) => {
    setLoading(true)
    setError(null)
    try {
      const fetchedCourses = await fetchCourses(token)
      setCourses(fetchedCourses)
      const [allTasks, allAnnouncements] = await Promise.all([
        fetchAllTasks(token, fetchedCourses),
        fetchAllAnnouncements(token, fetchedCourses),
      ])
      setTasks(allTasks)
      setAnnouncements(allAnnouncements)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCourses = async (token) => {
    const data = await apiFetch(`${BASE}/courses?courseStates=ACTIVE&pageSize=30`, token)
    return data.courses || []
  }

  const fetchAllTasks = async (token, courseList) => {
    const allTasks = []

    // Run all courses in parallel for speed
    await Promise.all(
      courseList.map(async (course) => {
        try {
          const cwData = await apiFetch(
            `${BASE}/courses/${course.id}/courseWork?pageSize=50&orderBy=dueDate asc`,
            token,
          )
          const courseWork = cwData.courseWork || []

          // Fetch all submissions for this course in parallel
          await Promise.all(
            courseWork.map(async (work) => {
              let status = 'NEW'
              try {
                const subData = await apiFetch(
                  `${BASE}/courses/${course.id}/courseWork/${work.id}/studentSubmissions?userId=me`,
                  token,
                )
                const submissions = subData.studentSubmissions || []
                if (submissions.length > 0) {
                  const sub = submissions[0]
                  if (sub.state === 'TURNED_IN' || sub.state === 'RETURNED') {
                    status = 'TURNED_IN'
                  } else if (
                    sub.state === 'CREATED' ||
                    sub.state === 'RECLAIMED_BY_STUDENT'
                  ) {
                    status = 'PENDING'
                  }
                }
              } catch {
                // Submission fetch failure is non-fatal
              }

              let dueDate = null
              if (work.dueDate) {
                const { year, month, day } = work.dueDate
                // Use end of day local time so tasks due today don't show as overdue during the day
                dueDate = new Date(year, month - 1, day, 23, 59, 59)
              }

              allTasks.push({
                id: work.id,
                courseId: course.id,
                courseName: course.name,
                title: work.title,
                description: work.description || '',
                alternateLink: work.alternateLink || '',
                dueDate,
                dueDateStr: dueDate
                  ? dueDate.toLocaleDateString('pt-BR')
                  : 'Sem prazo',
                status,
                workType: work.workType || 'ASSIGNMENT',
                maxPoints: work.maxPoints ?? null,
              })
            }),
          )
        } catch {
          // Course fetch failure is non-fatal
        }
      }),
    )

    // Sort: no due date last, then ascending due date
    allTasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate - b.dueDate
    })

    return allTasks
  }

  const fetchAllAnnouncements = async (token, courseList) => {
    const all = []
    await Promise.all(
      courseList.map(async (course) => {
        try {
          const data = await apiFetch(
            `${BASE}/courses/${course.id}/announcements?pageSize=20&orderBy=updateTime desc`,
            token,
          )
          for (const ann of data.announcements || []) {
            all.push({
              id: ann.id,
              courseId: course.id,
              courseName: course.name,
              text: ann.text || '',
              creationTime: ann.creationTime ? new Date(ann.creationTime) : null,
              alternateLink: ann.alternateLink || '',
            })
          }
        } catch {
          // Non-fatal
        }
      }),
    )
    // Sort by most recent
    all.sort((a, b) => {
      if (!a.creationTime) return 1
      if (!b.creationTime) return -1
      return b.creationTime - a.creationTime
    })
    return all
  }

  // ─── Derived helpers ──────────────────────────────────────────────────────────

  const NOTICE_KEYWORDS = [
    'informamos', 'comunicamos', 'lembramos', 'não é necessário entregar',
    'apenas leia', 'não precisa entregar', 'sem necessidade de entrega',
    'apenas informativo', 'não há entrega', 'sem entrega',
  ]

  const isNotice = (task) => {
    if (task.workType === 'ANNOUNCEMENT' || task.workType === 'MATERIAL') return true
    const desc = (task.description || '').toLowerCase()
    return NOTICE_KEYWORDS.some((w) => desc.includes(w))
  }

  const isUrgent = (task) => {
    if (!task.dueDate || task.status === 'TURNED_IN') return false
    const now = new Date()
    const diffDays = (task.dueDate - now) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 3
  }

  const stats = {
    totalCourses: courses.length,
    pending: tasks.filter((t) => t.status !== 'TURNED_IN').length,
    urgent: tasks.filter((t) => isUrgent(t)).length,
    submitted: tasks.filter((t) => t.status === 'TURNED_IN').length,
  }

  return {
    isAuthenticated: !!accessToken,
    accessToken,
    refreshToken,
    user,
    courses,
    tasks,
    announcements,
    loading,
    error,
    stats,
    signIn,
    signOut,
    isUrgent,
    isNotice,
    refresh: () => accessToken && fetchAllData(accessToken),
  }
}
