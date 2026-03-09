import { useEffect } from 'react'
import { listCourses } from '../../api/coursesApi'
import { useCourses } from '../../model/CoursesContext'

export function CoursesLoader() {
  const ctx = useCourses()

  useEffect(() => {
    if (!ctx) return
    let cancelled = false
    listCourses()
      .then((data) => {
        if (!cancelled) ctx.setCourses(data)
      })
      .catch(() => {
        if (!cancelled) ctx.setCourses([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
