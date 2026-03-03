import type {
  CourseWithRole,
  FeedItem,
  InviteCode,
  Member,
  SubmissionWithAssignment,
} from '../model/types'

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

export async function getCourse(courseId: string): Promise<CourseWithRole> {
  const response = await fetch(`${API_BASE}/courses/${courseId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_COURSE_FAILED')

  return (await response.json()) as CourseWithRole
}

export async function updateCourse(
  courseId: string,
  payload: { title: string },
): Promise<CourseWithRole> {
  const response = await fetch(`${API_BASE}/courses/${courseId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('UPDATE_COURSE_FAILED')

  return (await response.json()) as CourseWithRole
}

export async function deleteCourse(courseId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/courses/${courseId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('DELETE_COURSE_FAILED')
}

export async function getInviteCode(courseId: string): Promise<InviteCode> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/invite-code`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_INVITE_CODE_FAILED')

  return (await response.json()) as InviteCode
}

export async function getCourseFeed(courseId: string): Promise<FeedItem[]> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/feed`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_FEED_FAILED')

  return (await response.json()) as FeedItem[]
}

export async function listCourseMembers(courseId: string): Promise<Member[]> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/members`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_MEMBERS_FAILED')

  return (await response.json()) as Member[]
}

export async function getMemberGrades(
  courseId: string,
  userId: string,
): Promise<SubmissionWithAssignment[]> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/members/${userId}/grades`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_GRADES_FAILED')

  return (await response.json()) as SubmissionWithAssignment[]
}

export async function removeMember(
  courseId: string,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/members/${userId}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('REMOVE_MEMBER_FAILED')
}

export async function updateMemberRole(
  courseId: string,
  userId: string,
  role: 'teacher' | 'owner',
): Promise<Member> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/members/${userId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ role }),
    },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('UPDATE_MEMBER_ROLE_FAILED')

  return (await response.json()) as Member
}

