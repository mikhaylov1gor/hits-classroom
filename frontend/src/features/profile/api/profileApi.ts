import type { User } from '../../auth/model/types'

const API_BASE = '/api/v1'
const AUTH_STORAGE_KEY = 'hits-classroom-auth'

type StoredAuth = {
  token?: string | null
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuth
    return typeof parsed.token === 'string' ? parsed.token : null
  } catch {
    return null
  }
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export async function fetchCurrentUser(): Promise<User> {
  const response = await fetch(`${API_BASE}/users/me`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
    },
  })

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (!response.ok) {
    throw new Error('FETCH_PROFILE_FAILED')
  }

  const user = (await response.json()) as User
  return user
}

export type UpdateProfilePayload = {
  fullName: string
  birthDate: string
}

export async function updateCurrentUser(payload: UpdateProfilePayload): Promise<User> {
  const trimmedFullName = payload.fullName.trim()
  const [first, ...rest] = trimmedFullName.split(/\s+/)
  const first_name = first ?? ''
  const last_name = rest.join(' ') || first_name

  const body = {
    first_name,
    last_name,
    birth_date: payload.birthDate,
  }

  const response = await fetch(`${API_BASE}/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (!response.ok) {
    throw new Error('UPDATE_PROFILE_FAILED')
  }

  const user = (await response.json()) as User
  return user
}

