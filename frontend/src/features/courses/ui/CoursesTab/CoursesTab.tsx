import { useEffect, useState } from 'react'
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import { useNavigate } from 'react-router-dom'
import { listCourses, listCourseMembers } from '../../api/coursesApi'
import { useCourses } from '../../model/CoursesContext'
import type { CourseWithRole, Member } from '../../model/types'

const COURSE_GRADIENTS: [string, string][] = [
  ['#7eb8a8', '#a8ddc4'],
  ['#7eb8d4', '#b3dff0'],
  ['#a8a0c0', '#c9c4dc'],
  ['#8ec9a0', '#b8e0c8'],
  ['#7eb0d8', '#a8d4f0'],
  ['#e8a898', '#f0c8c0'],
  ['#e8c890', '#f0dcb8'],
  ['#b8a8d8', '#d4c8e8'],
]

function getCourseGradient(id: string): [string, string] {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COURSE_GRADIENTS[Math.abs(hash) % COURSE_GRADIENTS.length]
}

function getInitials(m: Member): string {
  const first = (m.first_name?.[0] ?? '').toUpperCase()
  const last = (m.last_name?.[0] ?? '').toUpperCase()
  return (first + last) || m.email[0]?.toUpperCase() || '?'
}

type CoursesTabProps = {
  onCoursesLoaded?: (courses: CourseWithRole[]) => void
}

export function CoursesTab({ onCoursesLoaded }: CoursesTabProps = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [owners, setOwners] = useState<Record<string, Member>>({})
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

  useEffect(() => {
    if (!courses?.length) return
    let cancelled = false
    const loadOwners = async () => {
      const results = await Promise.allSettled(
        courses.map((c) => listCourseMembers(c.id)),
      )
      if (cancelled) return
      const next: Record<string, Member> = {}
      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          const owner = result.value.find((m) => m.role === 'owner')
          const teacher = result.value.find((m) => m.role === 'teacher')
          const first = owner ?? teacher ?? result.value[0]
          next[courses[i].id] = first
        }
      })
      setOwners((prev) => ({ ...prev, ...next }))
    }
    loadOwners()
    return () => {
      cancelled = true
    }
  }, [courses])

  return (
    <Box className="mt-4 space-y-4 pb-24 md:pb-0">
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
          className="grid gap-3 sm:gap-4 max-h-none md:max-h-[70vh] overflow-auto"
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
            const owner = owners[course.id]
            const ownerName = owner
              ? `${owner.first_name} ${owner.last_name}`.trim() || owner.email
              : '—'
            const roleLabel =
              course.role === 'owner'
                ? 'Роль: владелец'
                : course.role === 'teacher'
                  ? 'Роль: преподаватель'
                  : 'Роль: студент'
            const memberStatus = course.membership_status
            const isPending = memberStatus === 'pending'
            const isRejected = memberStatus === 'rejected'
            const isClickable = !isPending && !isRejected
            return (
              <Tooltip
                key={course.id}
                title={
                  isPending
                    ? 'Ожидает подтверждения преподавателем'
                    : isRejected
                      ? 'Заявка отклонена'
                      : ''
                }
                placement="top"
              >
                <Card
                  component="div"
                  elevation={0}
                  className={`overflow-visible border rounded-2xl transition-all duration-200 text-left w-full ${isClickable ? 'cursor-pointer hover:shadow-lg hover:border-slate-300' : 'cursor-default'} ${isPending ? 'border-slate-300 opacity-75' : isRejected ? 'border-red-200 opacity-60' : 'border-slate-200'}`}
                  onClick={isClickable ? () => navigate(`/course/${course.id}`) : undefined}
                  sx={{
                    '&:hover': isClickable ? { boxShadow: '0 4px 16px rgba(0,0,0,0.1)' } : {},
                  }}
                >
                  <Box className="relative">
                    <Box
                      className="h-28 sm:h-32 flex flex-col justify-end p-3 sm:p-4 pb-5 sm:pb-6 relative overflow-hidden"
                      sx={{
                        background: (() => {
                          const [from, to] = getCourseGradient(course.id)
                          return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
                        })(),
                        filter: (isPending || isRejected) ? 'grayscale(40%)' : undefined,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          background:
                            'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.06) 100%)',
                          pointerEvents: 'none',
                        },
                      }}
                    >
                      {isPending && (
                        <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 3 }}>
                          <Chip
                            size="small"
                            icon={<HourglassEmptyOutlinedIcon fontSize="small" />}
                            label="Ожидает"
                            sx={{ bgcolor: 'rgba(255,255,255,0.85)', fontSize: '0.7rem' }}
                          />
                        </Box>
                      )}
                      {isRejected && (
                        <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 3 }}>
                          <Chip
                            size="small"
                            icon={<BlockOutlinedIcon fontSize="small" />}
                            label="Отклонено"
                            color="error"
                            sx={{ bgcolor: 'rgba(255,255,255,0.85)', fontSize: '0.7rem' }}
                          />
                        </Box>
                      )}
                      <Typography
                        variant="h6"
                        className="font-medium text-slate-800 line-clamp-2 relative z-10"
                        sx={{
                          textShadow: '0 1px 2px rgba(255,255,255,0.5)',
                          fontSize: { xs: '1rem', sm: '1.05rem' },
                        }}
                      >
                        {course.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        className="text-slate-700 relative z-10 mt-0.5"
                        sx={{ textShadow: '0 1px 2px rgba(255,255,255,0.5)' }}
                      >
                        {ownerName}
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{
                        position: 'absolute',
                        right: { xs: 10, sm: 12 },
                        bottom: -18,
                        width: { xs: 36, sm: 40 },
                        height: { xs: 36, sm: 40 },
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                        bgcolor: 'primary.main',
                        border: '3px solid white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        zIndex: 2,
                      }}
                    >
                      {owner ? getInitials(owner) : '?'}
                    </Avatar>
                  </Box>
                  <CardContent className="py-3 px-3 sm:py-4 sm:px-4 pt-5 sm:pt-6">
                    <Typography variant="body2" className="text-slate-500 mb-3">
                      {roleLabel}
                    </Typography>
                    <Box className="flex justify-end gap-0.5">
                      <IconButton size="small" className="text-slate-400" disabled>
                        <ImageOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" className="text-slate-400" disabled>
                        <FolderOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" className="text-slate-400" disabled>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Tooltip>
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


