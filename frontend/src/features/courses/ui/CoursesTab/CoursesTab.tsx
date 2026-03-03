import { useEffect, useState } from 'react'
import { Box, Card, CardContent, CircularProgress, List, ListItemButton, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { listCourses } from '../../api/coursesApi'
import type { CourseWithRole } from '../../model/types'

type CoursesTabProps = {
  onCoursesLoaded?: (courses: CourseWithRole[]) => void
}

export function CoursesTab({ onCoursesLoaded }: CoursesTabProps) {
  const [courses, setCourses] = useState<CourseWithRole[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

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

    return () => {
      cancelled = true
    }
  }, [])

  if (courses === null && !error) {
    return (
      <Box className="flex justify-center py-10">
        <CircularProgress />
      </Box>
    )
  }

  if (!courses || courses.length === 0) {
    return (
      <Card className="mt-4 border border-dashed border-slate-300 bg-slate-50">
        <CardContent>
          <Typography variant="body1" className="text-slate-700">
            У вас пока нет курсов
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box className="mt-4">
      <List>
        {courses.map((course) => (
          <ListItemButton
            key={course.id}
            onClick={() => navigate(`/course/${course.id}`)}
          >
            <Box className="flex flex-col">
              <Typography variant="body1" className="font-medium">
                {course.title}
              </Typography>
              <Typography variant="body2" className="text-slate-500">
                Роль: {course.role === 'owner' ? 'владелец' : course.role === 'teacher' ? 'преподаватель' : 'студент'}
              </Typography>
            </Box>
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}

export default CoursesTab


