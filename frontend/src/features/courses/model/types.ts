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
  attachments?: { id: string; name: string; type?: string }[] | null
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


