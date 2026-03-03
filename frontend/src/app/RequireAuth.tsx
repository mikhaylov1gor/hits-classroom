import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/model/AuthContext'
import { useCurrentUserQuery } from '../features/profile/model/profileQueries'

type RequireAuthProps = {
  children: ReactElement
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, setUserFromServer } = useAuth()
  const location = useLocation()
  const [hasCheckedServer, setHasCheckedServer] = useState(false)
  const { data: serverUser, isLoading } = useCurrentUserQuery(!user && !hasCheckedServer)

  useEffect(() => {
    if (user || hasCheckedServer) {
      return
    }

    if (serverUser) {
      setUserFromServer(serverUser)
      setHasCheckedServer(true)
    } else if (!isLoading) {
      setHasCheckedServer(true)
    }
  }, [user, hasCheckedServer, serverUser, isLoading, setUserFromServer])

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


