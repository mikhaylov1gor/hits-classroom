import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { CourseWithRole } from './types'

type CoursesContextValue = {
  courses: CourseWithRole[]
  setCourses: (courses: CourseWithRole[] | ((prev: CourseWithRole[]) => CourseWithRole[])) => void
  addCourse: (course: CourseWithRole) => void
}

const CoursesContext = createContext<CoursesContextValue | null>(null)

export function CoursesProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<CourseWithRole[]>([])
  const addCourse = useCallback((course: CourseWithRole) => {
    setCourses((prev) => {
      const exists = prev.some((c) => c.id === course.id)
      return exists ? prev.map((c) => (c.id === course.id ? course : c)) : [...prev, course]
    })
  }, [])
  return (
    <CoursesContext.Provider value={{ courses, setCourses, addCourse }}>
      {children}
    </CoursesContext.Provider>
  )
}

export function useCourses() {
  return useContext(CoursesContext)
}
