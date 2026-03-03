import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/model/AuthContext'
import { fetchCurrentUser } from '../features/profile/api/profileApi'

type RequireAuthProps = {
  children: ReactElement
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, setUserFromServer } = useAuth()
  const location = useLocation()
  const [hasCheckedServer, setHasCheckedServer] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (user || hasCheckedServer) {
      return
    }

    fetchCurrentUser()
      .then((serverUser) => {
        if (cancelled) return
        setUserFromServer(serverUser)
        setHasCheckedServer(true)
      })
      .catch(() => {
        if (cancelled) return
        setHasCheckedServer(true)
      })

    return () => {
      cancelled = true
    }
  }, [user, hasCheckedServer, setUserFromServer])

  // Пока разбираемся, есть ли сессия на сервере — ничего не рендерим,
  // чтобы не мигать редиректом на /login.
  if (!user && !hasCheckedServer) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default RequireAuth


