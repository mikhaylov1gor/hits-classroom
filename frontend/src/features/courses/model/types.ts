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
  created_at?: string
  deadline?: string | null
}

export type Member = {
  user_id: string
  email: string
  first_name: string
  last_name: string
  role: CourseRole
}

export type InviteCode = {
  code: string
}


