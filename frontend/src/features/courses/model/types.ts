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
  user_id: string
  /** Адресат личного комментария (от преподавателя студенту) */
  reply_to_user_id?: string | null
  body?: string | null
  created_at?: string
  author?: { first_name: string; last_name: string } | null
}

/** Комментарии студента: только свои и от преподавателя (адресованные ему) */
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

/** Комментарии преподавателя в диалоге со студентом */
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

export type InviteCode = {
  code: string
}

export type Assignment = {
  id: string
  course_id: string
  title: string
  body?: string | null
  deadline?: string | null
  created_at?: string
}

export type Submission = {
  id: string
  assignment_id: string
  user_id: string
  body?: string | null
  submitted_at?: string
  grade: number | null
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


