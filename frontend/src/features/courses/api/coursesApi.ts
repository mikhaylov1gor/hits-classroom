import type {
  Assignment,
  AssignmentType,
  Comment,
  CourseWithRole,
  FeedItem,
  GroupSettings,
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

/** Схема File из API (POST /files, GET /users/{userId}/files) */
export type ApiFile = {
  id: string
  user_id: string
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
}

/** Результат загрузки файла (совместимость с существующим кодом) */
export type UploadedFile = {
  id: string
  name: string
  url?: string | null
  type?: string | null
}

function apiFileToUploadedFile(api: ApiFile): UploadedFile {
  return {
    id: api.id,
    name: api.file_name,
    type: api.mime_type,
  }
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
  if (response.status === 413) throw new Error('FILE_TOO_LARGE')
  if (!response.ok) throw new Error('UPLOAD_FAILED')

  const apiFile = (await response.json()) as ApiFile
  return apiFileToUploadedFile(apiFile)
}

export async function listUserFiles(userId: string): Promise<ApiFile[]> {
  const response = await fetch(`${API_BASE}/users/${userId}/files`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_FILES_FAILED')

  return (await response.json()) as ApiFile[]
}

export async function uploadFiles(files: File[]): Promise<string[]> {
  const ids: string[] = []
  for (const file of files) {
    const uploaded = await uploadFile(file)
    ids.push(uploaded.id)
  }
  return ids
}

/** Получение информации о файле (GET /files/{fileId}/info) */
export async function getFileInfo(fileId: string): Promise<ApiFile> {
  const response = await fetch(`${API_BASE}/files/${fileId}/info`, {
    headers: getAuthHeaders(),
  })
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_FILE_INFO_FAILED')
  return (await response.json()) as ApiFile
}

function triggerBlobDownload(blob: Blob, suggestedName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  a.click()
  URL.revokeObjectURL(url)
}

function getSuggestedFileName(
  response: Response,
  fileName?: string,
  fileId?: string,
): string {
  return (
    fileName ??
    response.headers
      .get('Content-Disposition')
      ?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)?.[1]
      ?.replace(/['"]/g, '') ??
    (fileId ? `file-${fileId.slice(0, 8)}` : 'download')
  )
}

/** Скачивание файла по ID (GET /files/{fileId}). Для файлов заданий и общих файлов. */
export async function downloadFile(fileId: string, fileName?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/files/${fileId}`, {
    headers: getAuthHeaders(),
  })
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('DOWNLOAD_FAILED')
  const blob = await response.blob()
  const suggestedName = getSuggestedFileName(response, fileName, fileId)
  triggerBlobDownload(blob, suggestedName)
}

/** Скачивание файла поста (GET /courses/{courseId}/posts/{postId}/files/{fileId}) */
export async function downloadPostFile(
  courseId: string,
  postId: string,
  fileId: string,
  fileName?: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/posts/${postId}/files/${fileId}`,
    { headers: getAuthHeaders() },
  )
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('DOWNLOAD_FAILED')
  const blob = await response.blob()
  const suggestedName = getSuggestedFileName(response, fileName, fileId)
  triggerBlobDownload(blob, suggestedName)
}

/** Скачивание файла материала (GET /courses/{courseId}/materials/{materialId}/files/{fileId}) */
export async function downloadMaterialFile(
  courseId: string,
  materialId: string,
  fileId: string,
  fileName?: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/materials/${materialId}/files/${fileId}`,
    { headers: getAuthHeaders() },
  )
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('DOWNLOAD_FAILED')
  const blob = await response.blob()
  const suggestedName = getSuggestedFileName(response, fileName, fileId)
  triggerBlobDownload(blob, suggestedName)
}

/**
 * Скачивание файла решения.
 * GET /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}/files/{fileId}
 *
 * Логика доступа:
 * - Owner/Teacher: любой файл из любого решения в своём курсе
 * - Student: только файлы из своего решения
 *
 * Проверки: участник курса, задание в курсе, решение в задании, fileId в file_ids решения.
 */
export async function downloadSubmissionFile(
  courseId: string,
  assignmentId: string,
  submissionId: string,
  fileId: string,
  fileName?: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/files/${fileId}`,
    { headers: getAuthHeaders() },
  )
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('DOWNLOAD_FAILED')
  const blob = await response.blob()
  const suggestedName = getSuggestedFileName(response, fileName, fileId)
  triggerBlobDownload(blob, suggestedName)
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

export async function getPost(courseId: string, postId: string): Promise<Post> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/posts/${postId}`,
    { method: 'GET', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_POST_FAILED')

  return (await response.json()) as Post
}

export async function deletePost(courseId: string, postId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/posts/${postId}`,
    { method: 'DELETE', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('DELETE_POST_FAILED')
}

export async function createPost(
  courseId: string,
  payload: { title: string; body?: string; links?: string[]; file_ids?: string[] },
): Promise<Post> {
  const body: Record<string, unknown> = {
    title: payload.title,
    body: payload.body,
    links: payload.links,
  }
  if (payload.file_ids && payload.file_ids.length > 0) {
    body.file_ids = payload.file_ids
  }
  const response = await fetch(`${API_BASE}/courses/${courseId}/posts`, {
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

export async function deleteAssignment(
  courseId: string,
  assignmentId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}`,
    { method: 'DELETE', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('DELETE_ASSIGNMENT_FAILED')
}

export async function getMySubmission(
  courseId: string,
  assignmentId: string,
): Promise<Submission | null> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/submissions/my`,
    { method: 'GET', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) return null
  if (!response.ok) throw new Error('FETCH_MY_SUBMISSION_FAILED')

  return (await response.json()) as Submission
}

export type AssignmentPayload = {
  title: string
  body?: string
  links?: string[]
  file_ids?: string[]
  deadline?: string
  max_grade?: number
  assignment_type?: AssignmentType
  group_settings?: GroupSettings
}

export async function createAssignment(
  courseId: string,
  payload: AssignmentPayload,
): Promise<Assignment> {
  const body: Record<string, unknown> = {
    title: payload.title,
    body: payload.body,
    links: payload.links,
    max_grade: payload.max_grade,
  }
  if (payload.file_ids && payload.file_ids.length > 0) {
    body.file_ids = payload.file_ids
  }
  if (payload.deadline != null && payload.deadline !== '') {
    body.deadline = payload.deadline
  }
  if (payload.assignment_type) {
    body.assignment_type = payload.assignment_type
  }
  if (payload.assignment_type === 'group' && payload.group_settings) {
    body.group_settings = payload.group_settings
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

export async function updateAssignment(
  courseId: string,
  assignmentId: string,
  payload: AssignmentPayload,
): Promise<Assignment> {
  const body: Record<string, unknown> = {
    title: payload.title,
    body: payload.body,
    links: payload.links,
    max_grade: payload.max_grade,
  }
  if (payload.file_ids && payload.file_ids.length > 0) {
    body.file_ids = payload.file_ids
  }
  if (payload.deadline != null && payload.deadline !== '') {
    body.deadline = payload.deadline
  } else {
    body.deadline = null
  }
  if (payload.assignment_type) {
    body.assignment_type = payload.assignment_type
  }
  if (payload.assignment_type === 'group' && payload.group_settings) {
    body.group_settings = payload.group_settings
  } else if (payload.assignment_type === 'individual') {
    body.group_settings = null
  }

  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}`,
    {
      method: 'PUT',
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
  if (!response.ok) throw new Error('UPDATE_ASSIGNMENT_FAILED')

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

/** CreateSubmissionRequest: body, file_ids, is_attached (false=черновик, true=финальная сдача) */
export async function submitAssignment(
  courseId: string,
  assignmentId: string,
  payload: { body?: string; file_ids?: string[]; is_attached?: boolean },
): Promise<Submission> {
  const body: Record<string, unknown> = {
    body: payload.body ?? '',
    file_ids: payload.file_ids ?? [],
    is_attached: payload.is_attached ?? false,
  }

  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/submissions`,
    {
      method: 'POST',
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
  if (response.status === 409) {
    const err = (await response.json().catch(() => ({}))) as { code?: string; error?: string }
    if (err.code === 'DEADLINE_EXCEEDED' || /дедлайн|deadline/i.test(err.error ?? '')) {
      throw new Error('DEADLINE_EXCEEDED')
    }
    throw new Error('ALREADY_SUBMITTED')
  }
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

export async function detachSubmission(
  courseId: string,
  assignmentId: string,
  userId: string,
): Promise<Submission> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/assignments/${assignmentId}/detach`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ user_id: userId }),
    },
  )

  if (response.status === 400) throw new Error('BAD_REQUEST')
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('DETACH_SUBMISSION_FAILED')

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

export type Material = {
  id: string
  course_id: string
  title: string
  body?: string | null
  links?: string[]
  file_ids?: string[]
  created_at?: string
  user_id?: string
  author?: { first_name: string; last_name: string } | null
}

export async function getMaterial(
  courseId: string,
  materialId: string,
): Promise<Material> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/materials/${materialId}`,
    { method: 'GET', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('FETCH_MATERIAL_FAILED')

  return (await response.json()) as Material
}

export async function deleteMaterial(
  courseId: string,
  materialId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/materials/${materialId}`,
    { method: 'DELETE', headers: getAuthHeaders() },
  )

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 404) throw new Error('NOT_FOUND')
  if (!response.ok) throw new Error('DELETE_MATERIAL_FAILED')
}

export async function createMaterial(
  courseId: string,
  payload: { title: string; body?: string; links?: string[]; file_ids?: string[] },
): Promise<Material> {
  const body: Record<string, unknown> = {
    title: payload.title,
    body: payload.body,
    links: payload.links,
  }
  if (payload.file_ids && payload.file_ids.length > 0) {
    body.file_ids = payload.file_ids
  }
  const response = await fetch(`${API_BASE}/courses/${courseId}/materials`, {
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
  if (!response.ok) throw new Error('CREATE_MATERIAL_FAILED')

  return (await response.json()) as Material
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
    is_private?: boolean
    file_ids?: string[]
  },
): Promise<Comment> {
  const body: Record<string, unknown> = { body: payload.body, file_ids: payload.file_ids ?? [] }
  if (payload.parent_id != null) body.parent_id = payload.parent_id
  if (payload.is_private != null) body.is_private = payload.is_private

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
  payload: { body: string; parent_id?: string | null; is_private?: boolean; file_ids?: string[] },
): Promise<Comment> {
  const body: Record<string, unknown> = { body: payload.body, file_ids: payload.file_ids ?? [] }
  if (payload.parent_id != null) body.parent_id = payload.parent_id
  if (payload.is_private != null) body.is_private = payload.is_private

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
  payload: { body: string; parent_id?: string | null; is_private?: boolean; file_ids?: string[] },
): Promise<Comment> {
  const body: Record<string, unknown> = { body: payload.body, file_ids: payload.file_ids ?? [] }
  if (payload.parent_id != null) body.parent_id = payload.parent_id
  if (payload.is_private != null) body.is_private = payload.is_private

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
  payload: { body?: string; file_ids?: string[]; parent_id?: string | null; is_private?: boolean },
): Promise<Comment> {
  return createAssignmentComment(courseId, entityId, {
    body: payload.body ?? '',
    file_ids: payload.file_ids,
    parent_id: payload.parent_id,
    is_private: payload.is_private,
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
  if (response.status === 409) throw new Error('LAST_OWNER')
  if (!response.ok) throw new Error('REMOVE_MEMBER_FAILED')
}

export async function leaveCourse(courseId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/courses/${courseId}/leave`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')
  if (response.status === 409) throw new Error('LAST_OWNER')
  if (!response.ok) throw new Error('LEAVE_COURSE_FAILED')
}

export async function changeMemberRole(
  courseId: string,
  userId: string,
  role: 'owner' | 'teacher' | 'student',
): Promise<Member> {
  const response = await fetch(
    `${API_BASE}/courses/${courseId}/members/${userId}/role`,
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
  if (response.status === 409) throw new Error('LAST_OWNER')
  if (!response.ok) throw new Error('CHANGE_MEMBER_ROLE_FAILED')

  return (await response.json()) as Member
}

/** @deprecated Use changeMemberRole instead */
export async function updateMemberRole(
  courseId: string,
  userId: string,
  role: 'teacher' | 'owner',
): Promise<Member> {
  return changeMemberRole(courseId, userId, role)
}

