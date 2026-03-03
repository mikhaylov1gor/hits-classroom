import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { queryClient } from '../../../app/queryClient'
import { currentUserQueryKey } from '../../profile/model/profileQueries'
import type { LoginResponse, User } from './types'

type AuthState = {
  user: User | null
  token: string | null
}

type AuthContextValue = AuthState & {
  applyLogin: (response: LoginResponse) => void
  /**
   * Hydrate user from a trusted server response (например, /api/v1/users/me),
   * когда у нас уже есть сессия на сервере (cookie), но нет данных в localStorage.
   */
  setUserFromServer: (user: User) => void
  logout: (onRedirect?: () => void) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const STORAGE_KEY = 'hits-classroom-auth'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === 'undefined') {
      return { user: null, token: null }
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return { user: null, token: null }
      }
      const parsed = JSON.parse(raw) as AuthState
      return parsed
    } catch {
      return { user: null, token: null }
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore storage errors
    }
  }, [state])

  const applyLogin = useCallback((response: LoginResponse) => {
    setState({
      user: response.user,
      token: response.token,
    })
  }, [])

  const setUserFromServer = useCallback((user: User) => {
    setState((prev) => ({
      user,
      // если токена нет, оставляем null — сервер может жить на cookies
      token: prev.token ?? null,
    }))
  }, [])

  const logout = useCallback((onRedirect?: () => void) => {
    setState({ user: null, token: null })
    queryClient.removeQueries({ queryKey: currentUserQueryKey })
    onRedirect?.()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      token: state.token,
      applyLogin,
      setUserFromServer,
      logout,
    }),
    [state.user, state.token, applyLogin, setUserFromServer, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

