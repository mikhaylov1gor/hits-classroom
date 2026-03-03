export type CourseRole = 'student' | 'teacher' | 'owner'

export type CourseWithRole = {
  id: string
  title: string
  role: CourseRole
}


