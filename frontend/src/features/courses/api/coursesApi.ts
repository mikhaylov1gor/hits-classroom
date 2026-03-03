import type { CourseWithRole } from '../model/types'

// Use relative base URL so that webpack devServer proxy can forward to backend on port 8080
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

export async function listCourses(): Promise<CourseWithRole[]> {
  const response = await fetch(`${API_BASE}/courses`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
    },
  })

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (!response.ok) {
    throw new Error('FETCH_COURSES_FAILED')
  }

  const courses = (await response.json()) as CourseWithRole[]
  return courses
}

export async function joinCourse(code: string): Promise<CourseWithRole> {
  const response = await fetch(`${API_BASE}/courses/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ code }),
  })

  if (response.status === 404) {
    throw new Error('COURSE_NOT_FOUND')
  }

  if (!response.ok) {
    throw new Error('JOIN_COURSE_FAILED')
  }

  const course = (await response.json()) as CourseWithRole
  return course
}

