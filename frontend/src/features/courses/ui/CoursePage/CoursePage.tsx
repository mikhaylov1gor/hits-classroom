import { useEffect, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getCourse,
  getInviteCode,
  getCourseFeed,
  listCourseMembers,
  deleteCourse,
} from '../../api/coursesApi'
import { useCourses } from '../../model/CoursesContext'
import { CourseHeader } from '../CourseHeader/CourseHeader'
import type { CourseTabId, CourseWithRole, FeedItem, Member } from '../../model/types'

const TAB_LABELS: Record<CourseTabId, string> = {
  assignments: 'Задания',
  posts: 'Посты',
  materials: 'Материалы',
  users: 'Пользователи',
  settings: 'Настройки',
}

function TabPanel({
  value,
  index,
  children,
}: {
  value: number
  index: number
  children: React.ReactNode
}) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box className="py-4">{children}</Box>}
    </div>
  )
}

export function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const ctx = useCourses()
  const [course, setCourse] = useState<CourseWithRole | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [copySnackbar, setCopySnackbar] = useState(false)

  const isTeacher = course?.role === 'teacher' || course?.role === 'owner'
  const showSettingsTab = isTeacher

  const tabIds: CourseTabId[] = ['assignments', 'posts', 'materials', 'users']
  if (showSettingsTab) tabIds.push('settings')

  const currentTabId = tabIds[tabValue] ?? tabIds[0]

  useEffect(() => {
    if (!courseId) {
      navigate('/')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getCourse(courseId)
      .then((data) => {
        if (!cancelled) {
          setCourse(data)
          ctx?.addCourse(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки')
          if (err instanceof Error && err.message === 'COURSE_NOT_FOUND') {
            navigate('/')
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [courseId, navigate])

  useEffect(() => {
    if (!course || !courseId) return
    const isTeacherRole = course.role === 'teacher' || course.role === 'owner'
    if (isTeacherRole) {
      getInviteCode(courseId)
        .then((res) => setInviteCode(res.code))
        .catch(() => setInviteCode(null))
    }
  }, [course, courseId])

  useEffect(() => {
    if (!courseId || currentTabId === 'settings') return
    if (currentTabId === 'users') {
      listCourseMembers(courseId)
        .then(setMembers)
        .catch(() => setMembers([]))
    } else {
      getCourseFeed(courseId)
        .then(setFeed)
        .catch(() => setFeed([]))
    }
  }, [courseId, currentTabId])

  const handleCourseUpdated = (updated: CourseWithRole) => {
    setCourse(updated)
    ctx?.addCourse(updated)
  }

  const handleCourseDeleted = () => {
    ctx?.setCourses((prev) => prev.filter((c) => c.id !== course?.id))
    navigate('/')
  }

  const handleDeleteConfirm = async () => {
    if (!courseId) return
    setDeleteLoading(true)
    try {
      await deleteCourse(courseId)
      handleCourseDeleted()
    } catch {
      // TODO: show error
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      setCopySnackbar(true)
      setTimeout(() => setCopySnackbar(false), 2000)
    }
  }

  if (loading || !course) {
    return (
      <Box className="flex justify-center items-center py-20">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box className="py-8">
        <Typography color="error">{error}</Typography>
      </Box>
    )
  }

  const assignments = feed.filter((f) => f.type === 'assignment')
  const posts = feed.filter((f) => f.type === 'post')
  const materials = feed.filter((f) => f.type === 'material')

  const teachers = members.filter((m) => m.role === 'owner' || m.role === 'teacher')
  const students = members.filter((m) => m.role === 'student')

  function getInitials(m: Member): string {
    const first = (m.first_name?.[0] ?? '').toUpperCase()
    const last = (m.last_name?.[0] ?? '').toUpperCase()
    return (first + last) || m.email[0]?.toUpperCase() || '?'
  }

  function MemberRow({ member }: { member: Member }) {
    const name = `${member.first_name} ${member.last_name}`.trim() || member.email
    return (
      <Box className="flex items-center gap-3 py-3">
        <Avatar
          sx={{
            bgcolor: 'primary.main',
            width: 40,
            height: 40,
            fontSize: '1rem',
          }}
        >
          {getInitials(member)}
        </Avatar>
        <Typography variant="body1" className="text-slate-800 font-medium">
          {name}
        </Typography>
      </Box>
    )
  }

  return (
    <Box className="flex flex-col h-full pb-24 md:pb-0 min-w-0 overflow-x-hidden">
      <CourseHeader course={course} onCourseUpdated={handleCourseUpdated} />

      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        className="border-b border-slate-200 mt-4"
        sx={{
          minHeight: 48,
          minWidth: 0,
          '& .MuiTab-root': { minHeight: 48, py: 1 },
          '& .MuiTabs-scroller': { overflow: 'auto !important' },
        }}
      >
        <Tab label={TAB_LABELS.assignments} icon={<AssignmentOutlinedIcon />} iconPosition="start" />
        <Tab label={TAB_LABELS.posts} icon={<ArticleOutlinedIcon />} iconPosition="start" />
        <Tab label={TAB_LABELS.materials} icon={<FolderOutlinedIcon />} iconPosition="start" />
        <Tab label={TAB_LABELS.users} icon={<PeopleOutlinedIcon />} iconPosition="start" />
        {showSettingsTab && (
          <Tab label={TAB_LABELS.settings} icon={<SettingsOutlinedIcon />} iconPosition="start" />
        )}
      </Tabs>

      <Box className="flex-1 overflow-auto min-w-0">
        <TabPanel value={tabValue} index={0}>
          <List className="flex flex-col gap-1 min-w-0">
            {assignments.length === 0 ? (
              <Box className="flex justify-center items-center py-12 md:py-4 md:justify-start md:items-stretch">
                <Typography variant="body2" className="text-slate-500 text-center md:text-left">
                  Нет заданий
                </Typography>
              </Box>
            ) : (
              assignments.map((item) => (
                <ListItem key={item.id} className="border border-slate-200 rounded-lg min-w-0">
                  <ListItemText primary={item.title} secondary={item.deadline ?? undefined} />
                </ListItem>
              ))
            )}
          </List>
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <List className="flex flex-col gap-1 min-w-0">
            {posts.length === 0 ? (
              <Box className="flex justify-center items-center py-12 md:py-4 md:justify-start md:items-stretch">
                <Typography variant="body2" className="text-slate-500 text-center md:text-left">
                  Нет постов
                </Typography>
              </Box>
            ) : (
              posts.map((item) => (
                <ListItem key={item.id} className="border border-slate-200 rounded-lg min-w-0">
                  <ListItemText primary={item.title} />
                </ListItem>
              ))
            )}
          </List>
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <List className="flex flex-col gap-1 min-w-0">
            {materials.length === 0 ? (
              <Box className="flex justify-center items-center py-12 md:py-4 md:justify-start md:items-stretch">
                <Typography variant="body2" className="text-slate-500 text-center md:text-left">
                  Нет материалов
                </Typography>
              </Box>
            ) : (
              materials.map((item) => (
                <ListItem key={item.id} className="border border-slate-200 rounded-lg min-w-0">
                  <ListItemText primary={item.title} />
                </ListItem>
              ))
            )}
          </List>
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <Box className="flex flex-col">
            {members.length === 0 ? (
              <Box className="flex justify-center items-center py-12 md:py-4 md:justify-start md:items-stretch">
                <Typography variant="body2" className="text-slate-500 text-center md:text-left">
                  Нет участников
                </Typography>
              </Box>
            ) : (
              <>
                {teachers.length > 0 && (
                  <Box>
                    <Typography
                      variant="subtitle1"
                      className="font-semibold text-slate-800 mb-2"
                    >
                      Преподаватели
                    </Typography>
                    {teachers.map((m) => (
                      <Box key={m.user_id}>
                        <MemberRow member={m} />
                        <Divider light className="border-slate-200" />
                      </Box>
                    ))}
                  </Box>
                )}
                {students.length > 0 && (
                  <Box className={teachers.length > 0 ? 'mt-6' : ''}>
                    <Box className="flex items-center justify-between mb-2">
                      <Typography
                        variant="subtitle1"
                        className="font-semibold text-slate-800"
                      >
                        Другие учащиеся
                      </Typography>
                      <Typography variant="body2" className="text-slate-500">
                        {students.length} {students.length === 1 ? 'учащийся' : 'учащихся'}
                      </Typography>
                    </Box>
                    {students.map((m) => (
                      <Box key={m.user_id}>
                        <MemberRow member={m} />
                        <Divider light className="border-slate-200" />
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Box>
        </TabPanel>
        {showSettingsTab && (
          <TabPanel value={tabValue} index={4}>
            <Box className="flex flex-col gap-4">
              {inviteCode && (
                <Box className="flex items-center gap-2 p-4 bg-slate-50 rounded-xl">
                  <Box className="flex-1 min-w-0">
                    <Typography variant="subtitle2" className="text-slate-600 mb-1">
                      Код приглашения
                    </Typography>
                    <Typography variant="body1" className="font-mono font-semibold">
                      {inviteCode}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label="Копировать код"
                    onClick={handleCopyCode}
                  >
                    <ContentCopyOutlinedIcon fontSize="small" />
                  </IconButton>
                  {copySnackbar && (
                    <Typography variant="caption" className="text-green-600">
                      Скопировано
                    </Typography>
                  )}
                </Box>
              )}
              {course.role === 'owner' && (
                <Box className="flex flex-col gap-2">
                  <Typography variant="body2" className="text-slate-500">
                    Переименование доступно в шапке курса.
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlinedIcon />}
                    onClick={() => setDeleteDialogOpen(true)}
                    aria-label="Удалить курс"
                  >
                    Удалить курс
                  </Button>
                </Box>
              )}
            </Box>
            <Dialog
              open={deleteDialogOpen}
              onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
              aria-labelledby="delete-dialog-title"
              aria-describedby="delete-dialog-description"
            >
              <DialogTitle id="delete-dialog-title">Удалить курс?</DialogTitle>
              <DialogContent>
                <DialogContentText id="delete-dialog-description">
                  Курс «{course.title}» будет удалён безвозвратно. Это действие нельзя отменить.
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
                  Отмена
                </Button>
                <Button
                  onClick={handleDeleteConfirm}
                  color="error"
                  variant="contained"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Удаление…' : 'Удалить'}
                </Button>
              </DialogActions>
            </Dialog>
          </TabPanel>
        )}
      </Box>
    </Box>
  )
}
