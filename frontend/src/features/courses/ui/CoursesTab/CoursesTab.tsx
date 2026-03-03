import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { listCourses } from '../../api/coursesApi'
import { useCourses } from '../../model/CoursesContext'
import type { CourseWithRole } from '../../model/types'

const COURSE_GRADIENTS: [string, string][] = [
  ['#667eea', '#764ba2'],
  ['#11998e', '#38ef7d'],
  ['#4facfe', '#00f2fe'],
  ['#f093fb', '#f5576c'],
  ['#ee9ca7', '#ffdde1'],
  ['#a18cd1', '#fbc2eb'],
  ['#ff6b6b', '#feca57'],
  ['#48c6ef', '#6f86d6'],
]

function getCourseGradient(id: string): [string, string] {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COURSE_GRADIENTS[Math.abs(hash) % COURSE_GRADIENTS.length]
}

type CoursesTabProps = {
  onCoursesLoaded?: (courses: CourseWithRole[]) => void
}

export function CoursesTab({ onCoursesLoaded }: CoursesTabProps = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const ctx = useCourses()
  const [localCourses, setLocalCourses] = useState<CourseWithRole[]>([])
  const courses = ctx ? ctx.courses : localCourses
  const setCourses = ctx ? ctx.setCourses : setLocalCourses

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    listCourses()
      .then((data) => {
        if (!cancelled) {
          setCourses(data)
          onCoursesLoaded?.(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Не удалось загрузить курсы')
          setCourses([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Box className="mt-4 space-y-4">
      {loading && !error && (
        <Box className="flex justify-center py-10">
          <CircularProgress />
        </Box>
      )}

      {(!courses || courses.length === 0) && !error && (
        <Card className="border border-dashed border-slate-300 bg-slate-50">
          <CardContent>
            <Typography variant="body1" className="text-slate-700">
              У вас пока нет курсов
            </Typography>
          </CardContent>
        </Card>
      )}

      {courses && courses.length > 0 && (
        <Box
          className="grid gap-4 max-h-[70vh] overflow-auto"
          sx={{
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
          }}
        >
          {courses.map((course) => {
            const roleLabel =
              course.role === 'owner'
                ? 'Роль: владелец'
                : course.role === 'teacher'
                  ? 'Роль: преподаватель'
                  : 'Роль: студент'
            return (
              <Card
                key={course.id}
                component="button"
                elevation={0}
                className="overflow-hidden cursor-pointer border border-slate-200 rounded-2xl transition-all duration-200 hover:shadow-md hover:border-slate-300 text-left w-full"
                onClick={() => navigate(`/course/${course.id}`)}
                sx={{
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  },
                }}
              >
                <Box
                  className="h-24 flex items-end p-4 relative overflow-hidden"
                  sx={{
                    background: (() => {
                      const [from, to] = getCourseGradient(course.id)
                      return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
                    })(),
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.15) 100%)',
                      pointerEvents: 'none',
                    },
                  }}
                >
                  <Typography
                    variant="h6"
                    className="font-medium text-white line-clamp-2 relative z-10"
                    sx={{
                      textShadow: '0 1px 3px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.2)',
                      fontSize: { xs: '1rem', sm: '1.1rem' },
                    }}
                  >
                    {course.title}
                  </Typography>
                </Box>
                <CardContent className="py-3 px-4">
                  <Typography variant="body2" className="text-slate-500">
                    {roleLabel}
                  </Typography>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}

      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
    </Box>
  )
}

export default CoursesTab


