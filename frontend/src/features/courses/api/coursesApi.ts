import type {
  Assignment,
  Comment,
  CourseWithRole,
  FeedItem,
  InviteCode,
  Member,
  Post,
  Submission,
  SubmissionWithAssignment,
} from '../model/types'

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

export type UploadedFile = {
  id: string
  name: string
  url?: string | null
  type?: string | null
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 400) throw new Error('BAD_REQUEST')
  if (!response.ok) throw new Error('UPLOAD_FAILED')

  return (await response.json()) as UploadedFile
}

export async function uploadFiles(files: File[]): Promise<string[]> {
  const ids: string[] = []
  for (const file of files) {
    const uploaded = await uploadFile(file)
    ids.push(uploaded.id)
  }
  return ids
}

export async function createCourse(payload: { title: string }): Promise<CourseWithRole> {
  const response = await fetch(`${API_BASE}/courses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (!response.ok) {
    throw new Error('CREATE_COURSE_FAILED')
  }

  const data = (await response.json()) as { id: string; title: string; invite_code?: string }
  return { ...data, role: 'owner' as const }
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

export async function regenerateInviteCode(courseId: string): Promise<InviteCode> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/invite-code`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('REGENERATE_INVITE_CODE_FAILED')

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

export async function createPost(
  courseId: string,
  payload: { title: string; body?: string; file_ids?: string[] },
): Promise<Post> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('CREATE_POST_FAILED')

  return (await response.json()) as Post
}

export async function getAssignment(
  courseId: string,
  assignmentId: string,
): Promise<Assignment> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}`,
    { method: 'GET', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_ASSIGNMENT_FAILED')

  return (await response.json()) as Assignment
}

export async function createAssignment(
  courseId: string,
  payload: {
    title: string
    body?: string
    file_ids?: string[]
    deadline?: string
    max_grade?: number
  },
): Promise<Assignment> {
  const body: Record<string, unknown> = {
    title: payload.title,
    body: payload.body,
    file_ids: payload.file_ids,
    max_grade: payload.max_grade,
  }
  if (payload.deadline != null && payload.deadline !== '') {
    body.deadline = payload.deadline
  }

  const response = await fetch(`${API_BASE}/courses/${courseId}/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('CREATE_ASSIGNMENT_FAILED')

  return (await response.json()) as Assignment
}

export async function listSubmissions(
  courseId: string,
  assignmentId: string,
): Promise<Submission[]> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/submissions`,
    { method: 'GET', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_SUBMISSIONS_FAILED')

  return (await response.json()) as Submission[]
}

export async function submitAssignment(
  courseId: string,
  assignmentId: string,
  payload: { body?: string; file_ids?: string[] },
): Promise<Submission> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/submissions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    },
  )

  if (response.status === 400) throw new Error('BAD_REQUEST')
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (response.status === 409) throw new Error('ALREADY_SUBMITTED')
  if (!response.ok) throw new Error('SUBMIT_ASSIGNMENT_FAILED')

  return (await response.json()) as Submission
}

export async function gradeSubmission(
  courseId: string,
  assignmentId: string,
  submissionId: string,
  payload: { grade: number; grade_comment?: string },
): Promise<Submission> {
  const body: { grade: number; grade_comment?: string } = { grade: payload.grade }
  if (payload.grade_comment != null && payload.grade_comment.trim() !== '') {
    body.grade_comment = payload.grade_comment.trim()
  }

  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/grade`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    },
  )

  if (response.status === 400) throw new Error('BAD_REQUEST')
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('GRADE_SUBMISSION_FAILED')

  return (await response.json()) as Submission
}

export async function updateSubmission(
  courseId: string,
  assignmentId: string,
  submissionId: string,
  payload: { body?: string; file_ids?: string[] },
): Promise<Submission> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('UPDATE_SUBMISSION_FAILED')

  return (await response.json()) as Submission
}

export async function returnSubmission(
  courseId: string,
  assignmentId: string,
  submissionId: string,
): Promise<Submission> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/return`,
    {
      method: 'PUT',
      headers: getAuthHeaders(),
    },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('RETURN_SUBMISSION_FAILED')

  return (await response.json()) as Submission
}

export async function inviteTeacherByEmail(
  courseId: string,
  email: string,
): Promise<Member> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/invite-teacher`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ email: email.trim() }),
    },
  )

  if (response.status === 400) throw new Error('BAD_REQUEST')
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('USER_NOT_FOUND')
  if (response.status === 409) throw new Error('ALREADY_TEACHER')
  if (!response.ok) throw new Error('INVITE_TEACHER_FAILED')

  return (await response.json()) as Member
}

export async function createMaterial(
  courseId: string,
  payload: { title: string; body?: string; file_ids?: string[] },
): Promise<unknown> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/materials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('CREATE_MATERIAL_FAILED')

  return response.json()
}

export async function listAssignmentComments(
  courseId: string,
  assignmentId: string,
): Promise<Comment[]> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/comments`,
    { method: 'GET', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_COMMENTS_FAILED')

  return (await response.json()) as Comment[]
}

export async function createAssignmentComment(
  courseId: string,
  assignmentId: string,
  payload: {
    body: string
    parent_id?: string | null
    file_ids?: string[]
    reply_to_user_id?: string | null
  },
): Promise<Comment> {
  const body: Record<string, unknown> = { body: payload.body, file_ids: payload.file_ids ?? [] }
  if (payload.parent_id != null) body.parent_id = payload.parent_id
  if (payload.reply_to_user_id != null) body.reply_to_user_id = payload.reply_to_user_id

  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/comments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('CREATE_COMMENT_FAILED')

  return (await response.json()) as Comment
}

export async function listPostComments(
  courseId: string,
  postId: string,
): Promise<Comment[]> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/posts/${postId}/comments`,
    { method: 'GET', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_COMMENTS_FAILED')

  return (await response.json()) as Comment[]
}

export async function createPostComment(
  courseId: string,
  postId: string,
  payload: { body: string; parent_id?: string | null; file_ids?: string[] },
): Promise<Comment> {
  const body: Record<string, unknown> = { body: payload.body, file_ids: payload.file_ids ?? [] }
  if (payload.parent_id != null) body.parent_id = payload.parent_id

  const response = await fetch(
    `${API_BASE}/courses/${courseId}/posts/${postId}/comments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('CREATE_COMMENT_FAILED')

  return (await response.json()) as Comment
}

export async function listMaterialComments(
  courseId: string,
  materialId: string,
): Promise<Comment[]> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/materials/${materialId}/comments`,
    { method: 'GET', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_COMMENTS_FAILED')

  return (await response.json()) as Comment[]
}

export async function createMaterialComment(
  courseId: string,
  materialId: string,
  payload: { body: string; parent_id?: string | null; file_ids?: string[] },
): Promise<Comment> {
  const body: Record<string, unknown> = { body: payload.body, file_ids: payload.file_ids ?? [] }
  if (payload.parent_id != null) body.parent_id = payload.parent_id

  const response = await fetch(
    `${API_BASE}/courses/${courseId}/materials/${materialId}/comments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('CREATE_COMMENT_FAILED')

  return (await response.json()) as Comment
}

export const listComments = listAssignmentComments

export async function createComment(
  courseId: string,
  entityId: string,
  payload: { body?: string; file_ids?: string[]; reply_to_user_id?: string },
): Promise<Comment> {
  return createAssignmentComment(courseId, entityId, {
    body: payload.body ?? '',
    file_ids: payload.file_ids,
    reply_to_user_id: payload.reply_to_user_id,
  })
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

export async function assignTeacher(
  courseId: string,
  userId: string,
): Promise<Member> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ user_id: userId }),
  })

  if (response.status === 400) throw new Error('BAD_REQUEST')
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('COURSE_NOT_FOUND')
  if (!response.ok) throw new Error('ASSIGN_TEACHER_FAILED')

  return (await response.json()) as Member
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

