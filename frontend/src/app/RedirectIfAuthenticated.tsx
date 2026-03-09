import { useEffect, useState, type ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/model/AuthContext'
import { useCurrentUserQuery } from '../features/profile/model/profileQueries'

type RedirectIfAuthenticatedProps = {
  children: ReactElement
}

export function RedirectIfAuthenticated({ children }: RedirectIfAuthenticatedProps) {
  const { user, setUserFromServer } = useAuth()
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

  if (user || serverUser) {
    return <Navigate to="/" replace />
  }

  if (!hasCheckedServer) {
    return null
  }

  return children
}
