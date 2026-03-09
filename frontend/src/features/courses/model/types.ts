export type CourseRole = 'student' | 'teacher' | 'owner'

export type CourseWithRole = {
  id: string
  title: string
  role: CourseRole
  invite_code?: string
}

export type CourseTabId = 'assignments' | 'posts' | 'materials' | 'users' | 'settings'

export type FeedItemType = 'post' | 'material' | 'assignment'

export type FeedItem = {
  type: FeedItemType
  id: string
  title: string
  body?: string | null
  created_at?: string
  deadline?: string | null
  user_id?: string | null
  author?: { first_name: string; last_name: string } | null
  attachments?: { id: string; name: string; type?: string; url?: string }[] | null
}

export type Post = {
  id: string
  course_id: string
  title: string
  body?: string | null
  created_at?: string
  attachments?: { id: string; name: string; type?: string; url?: string }[] | null
}

export type Comment = {
  id: string
  assignment_id?: string
  post_id?: string
  material_id?: string
  user_id: string
  parent_id?: string | null
  reply_to_user_id?: string | null
  body?: string | null
  created_at?: string
  author?: { first_name: string; last_name: string } | null
  replies?: Comment[]
}

export function countCommentsRecursively(comments: Comment[]): number {
  return comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length ? countCommentsRecursively(c.replies) : 0),
    0,
  )
}

export function flattenComments(comments: Comment[]): Comment[] {
  return comments.flatMap((c) => [c, ...(c.replies ? flattenComments(c.replies) : [])])
}

export function getGeneralComments(comments: Comment[]): Comment[] {
  return comments.filter((c) => c.reply_to_user_id == null)
}

export function filterStudentComments(
  comments: Comment[],
  authUserId: string | undefined,
  teacherIds: string[],
): Comment[] {
  if (!authUserId) return []
  return comments.filter((c) => {
    if (c.user_id === authUserId) return true
    if (!teacherIds.includes(c.user_id)) return false
    return c.reply_to_user_id == null || c.reply_to_user_id === authUserId
  })
}

export function filterTeacherDialogComments(
  comments: Comment[],
  authUserId: string | undefined,
  studentId: string,
): Comment[] {
  if (!authUserId) return []
  return comments.filter((c) => {
    if (c.user_id === studentId) return true
    if (c.user_id === authUserId)
      return c.reply_to_user_id == null || c.reply_to_user_id === studentId
    return false
  })
}

export type Member = {
  user_id: string
  email: string
  first_name: string
  last_name: string
  role: CourseRole
  birth_date?: string | null
}

type MemberLike = {
  user_id: string
  first_name?: string
  last_name?: string
}

export function getNameByUserId(
  members: MemberLike[],
  userId: string,
  fallback?: { first_name?: string; last_name?: string } | null,
): string {
  console.error(12312, members)
  const m = members.find((x) => x.user_id === userId)
  if (m) {
    const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
    return name || 'Участник'
  }
  if (fallback && (fallback.first_name || fallback.last_name)) {
    return `${fallback.first_name ?? ''} ${fallback.last_name ?? ''}`.trim()
  }
  return 'Участник'
}

export function getInitialsFromMember(
  members: MemberLike[],
  userId: string,
  fallback?: { first_name?: string; last_name?: string } | null,
): string {
  const m = members.find((x) => x.user_id === userId)
  if (m) return getMemberInitials(m)
  if (fallback && (fallback.first_name || fallback.last_name)) {
    const f = (fallback.first_name ?? '').trim().charAt(0)
    const l = (fallback.last_name ?? '').trim().charAt(0)
    return (f + l).toUpperCase() || '?'
  }
  return '?'
}

export function getMemberInitials(m: MemberLike & { email?: string }): string {
  const f = (m.first_name ?? '').trim().charAt(0)
  const l = (m.last_name ?? '').trim().charAt(0)
  return (f + l).toUpperCase() || m.email?.[0]?.toUpperCase() || '?'
}

export type InviteCode = {
  code: string
}

export type Assignment = {
  id: string
  course_id: string
  title: string
  body?: string | null
  deadline?: string | null
  max_grade?: number
  created_at?: string
  user_id?: string | null
  author?: { first_name: string; last_name: string } | null
}

export type SubmissionStatus = 'draft' | 'submitted' | 'returned'

export type Submission = {
  id: string
  assignment_id: string
  user_id: string
  body?: string | null
  submitted_at?: string
  grade: number | null
  grade_comment?: string | null
  status?: SubmissionStatus | null
  author?: { first_name: string; last_name: string } | null
}

export type SubmissionWithAssignment = {
  submission: {
    id: string
    assignment_id: string
    user_id: string
    grade: number | null
    submitted_at?: string
  }
  assignment: {
    id: string
    title: string
    deadline?: string | null
  }
}


