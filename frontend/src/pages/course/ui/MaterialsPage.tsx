import {
  Box,
  Button,
  Container,
  IconButton,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  getCourse,
  getCourseFeed,
} from '../../../features/courses/api/coursesApi'
import { MaterialCard } from '../../../features/courses/ui/CoursePage/MaterialCard/MaterialCard'
import { CreateMaterialDialog } from '../../../features/courses/ui/CoursePage/CreateMaterialDialog/CreateMaterialDialog'
import {
  type CourseWithRole,
  type FeedItem,
  type Member,
  getNameByUserId,
  getInitialsFromMember,
  getMemberInitials,
} from '../../../features/courses/model/types'
import { listCourseMembers } from '../../../features/courses/api/coursesApi'

function getAuthorForMaterial(
  item: FeedItem,
  members: Member[],
  teachers: Member[],
): { name: string; initial: string } {
  if (item.user_id) {
    const name = getNameByUserId(members, item.user_id, item.author)
    const m = members.find((x) => x.user_id === item.user_id)
    const initial = m ? getMemberInitials(m) : getInitialsFromMember(members, item.user_id, item.author)
    return { name: name || 'Автор', initial }
  }
  if (item.author) {
    const name = `${item.author.first_name} ${item.author.last_name}`.trim()
    const initial = (
      item.author.first_name?.[0] ?? item.author.last_name?.[0] ?? 'А'
    ).toUpperCase()
    return { name: name || 'Автор', initial }
  }
  const firstTeacher = teachers[0]
  if (firstTeacher) {
    const name = getNameByUserId(members, firstTeacher.user_id, null)
    return {
      name: name !== 'Участник' ? name : firstTeacher.email,
      initial: getMemberInitials(firstTeacher),
    }
  }
  return { name: 'Преподаватель', initial: 'П' }
}

export function MaterialsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<CourseWithRole | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    if (!courseId) {
      navigate('/')
      return
    }

    setLoading(true)
    Promise.all([
      getCourse(courseId),
      getCourseFeed(courseId),
      listCourseMembers(courseId),
    ])
      .then(([c, f, m]) => {
        setCourse(c)
        setFeed(f)
        setMembers(m)
      })
      .catch(() => {
        setCourse(null)
        setFeed([])
        setMembers([])
      })
      .finally(() => setLoading(false))
  }, [courseId, navigate])

  const materials = feed.filter((f) => f.type === 'material')
  const teachers = members.filter((m) => m.role === 'owner' || m.role === 'teacher')
  const isTeacher = course?.role === 'teacher' || course?.role === 'owner'

  const handleBack = () => {
    navigate(courseId ? `/course/${courseId}` : '/')
  }

  const refreshFeed = () => {
    if (!courseId) return
    getCourseFeed(courseId).then(setFeed).catch(() => setFeed([]))
  }

  if (!courseId) return null

  if (loading) {
    return (
      <Box className="flex justify-center items-center py-20">
        <Typography color="text.secondary">Загрузка…</Typography>
      </Box>
    )
  }

  if (!course) {
    return (
      <Container maxWidth="lg" disableGutters>
        <Box className="py-8 px-4">
          <Typography color="error">Курс не найден</Typography>
          <Button onClick={handleBack} className="mt-4">
            Назад
          </Button>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" disableGutters>
      <Box className="flex flex-col min-w-0 py-4">
        <Box className="flex items-center justify-between gap-4 mb-4">
          <Box className="flex items-center gap-2 min-w-0">
            <IconButton
              onClick={handleBack}
              aria-label="Назад к курсу"
              size="small"
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="body2" color="text.secondary" className="truncate">
              {course.title}
            </Typography>
          </Box>
        </Box>

        <Box className="flex flex-col gap-4">
          <Box className="flex items-center justify-between gap-4">
            <Typography variant="h6" className="font-semibold text-slate-800">
              Материалы
            </Typography>
            {isTeacher && (
              <Button
                variant="contained"
                startIcon={<SendOutlinedIcon />}
                onClick={() => setCreateDialogOpen(true)}
                aria-label="Добавить материал"
                sx={{ textTransform: 'none' }}
              >
                Новый материал
              </Button>
            )}
          </Box>

          {materials.length === 0 ? (
            <Box className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Typography variant="body2" color="text.secondary" className="mb-4">
                Пока нет материалов
              </Typography>
              {isTeacher && (
                <Button
                  variant="outlined"
                  onClick={() => setCreateDialogOpen(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Добавить первый материал
                </Button>
              )}
            </Box>
          ) : (
            <Box className="flex flex-col gap-4">
              {materials.map((item) => {
                const author = getAuthorForMaterial(item, members, teachers)
                return (
                  <MaterialCard
                    key={item.id}
                    item={item}
                    courseId={courseId}
                    authorName={author.name}
                    authorInitial={author.initial}
                    courseMembers={members}
                    onClick={() =>
                      navigate(`/course/${courseId}/material/${item.id}`, {
                        state: { material: item },
                      })
                    }
                  />
                )
              })}
            </Box>
          )}
        </Box>
      </Box>

      <CreateMaterialDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        courseId={courseId}
        onCreated={refreshFeed}
      />
    </Container>
  )
}

export default MaterialsPage
