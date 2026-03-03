import { useEffect, useRef, useState } from 'react'
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
  Menu,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getCourse,
  getInviteCode,
  getCourseFeed,
  listCourseMembers,
  deleteCourse,
  removeMember,
  updateMemberRole,
  updateCourse,
} from '../../api/coursesApi'
import { useAuth } from '../../../auth/model/AuthContext'
import { useCourses } from '../../model/CoursesContext'
import { CourseBanner } from '../CourseHeader/CourseBanner'
import { AnnouncementCard } from './AnnouncementCard'
import { UserProfileDialog } from './UserProfileDialog'
import type { CourseTabId, CourseWithRole, FeedItem, Member } from '../../model/types'

const ROLE_LABELS: Record<string, string> = {
  owner: 'владелец',
  teacher: 'преподаватель',
  student: 'студент',
}

const TAB_LABELS: Record<CourseTabId, string> = {
  assignments: 'Задания',
  posts: 'Посты',
  materials: 'Материалы',
  users: 'Пользователи',
  settings: 'Настройки класса',
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

function getUpcomingAssignments(assignments: FeedItem[]): FeedItem[] {
  const now = new Date()
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  return assignments.filter((a) => {
    if (!a.deadline) return false
    const d = new Date(a.deadline)
    return d >= now && d <= nextWeek
  })
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
  const [profileMember, setProfileMember] = useState<Member | null>(null)
  const [excludeMember, setExcludeMember] = useState<Member | null>(null)
  const [excludeLoading, setExcludeLoading] = useState(false)
  const [roleMenuAnchor, setRoleMenuAnchor] = useState<{
    el: HTMLElement
    member: Member
    position: { top: number; left: number }
  } | null>(null)
  const [isEditingRename, setIsEditingRename] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const renameFormRef = useRef<HTMLDivElement>(null)
  const saveClickedRef = useRef(false)

  const { user: authUser } = useAuth()
  const isTeacher = course?.role === 'teacher' || course?.role === 'owner'
  const isOwner = course?.role === 'owner'
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

  const handleCourseUpdated = (updated: Partial<CourseWithRole>) => {
    const merged = course ? { ...course, ...updated } : (updated as CourseWithRole)
    setCourse(merged)
    ctx?.addCourse(merged)
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

  const refreshMembers = () => {
    if (courseId) {
      listCourseMembers(courseId).then(setMembers).catch(() => setMembers([]))
    }
  }

  const canExclude = (m: Member): boolean => {
    if (m.user_id === authUser?.id) return false
    if (isOwner) return true
    if (isTeacher && m.role === 'student') return true
    return false
  }

  const canChangeRole = (m: Member): boolean => {
    return isOwner && m.user_id !== authUser?.id && m.role !== 'owner'
  }

  const handleExcludeConfirm = async () => {
    if (!courseId || !excludeMember) return
    setExcludeLoading(true)
    try {
      await removeMember(courseId, excludeMember.user_id)
      setExcludeMember(null)
      refreshMembers()
      setProfileMember((prev) => (prev?.user_id === excludeMember.user_id ? null : prev))
    } finally {
      setExcludeLoading(false)
    }
  }

  const handleRoleChange = async (member: Member, newRole: 'teacher' | 'owner') => {
    if (!courseId) return
    setRoleMenuAnchor(null)
    try {
      await updateMemberRole(courseId, member.user_id, newRole)
      refreshMembers()
      setProfileMember((prev) =>
        prev?.user_id === member.user_id ? { ...prev, role: newRole } : prev,
      )
    } catch {
      // TODO: show error
    }
  }

  const handleAssignmentClick = () => {
    setProfileMember(null)
    setTabValue(tabIds.indexOf('assignments'))
  }

  const handleStartRename = () => {
    setEditTitle(course.title)
    setIsEditingRename(true)
  }

  const handleSaveRename = async () => {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === course.title || !courseId) {
      setIsEditingRename(false)
      return
    }
    setRenameLoading(true)
    try {
      const updated = await updateCourse(courseId, { title: trimmed })
      handleCourseUpdated(updated)
      setIsEditingRename(false)
    } catch {
      // TODO: show error
    } finally {
      setRenameLoading(false)
    }
  }

  const handleCancelRename = () => {
    setEditTitle(course.title)
    setIsEditingRename(false)
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
      <Box className="py-8 px-4">
        <Typography color="error">{error}</Typography>
      </Box>
    )
  }

  const assignments = feed.filter((f) => f.type === 'assignment')
  const posts = feed.filter((f) => f.type === 'post')
  const materials = feed.filter((f) => f.type === 'material')
  const upcomingAssignments = getUpcomingAssignments(assignments)

  const teachers = members.filter((m) => m.role === 'owner' || m.role === 'teacher')
  const students = members.filter((m) => m.role === 'student')

  function getInitials(m: Member): string {
    const first = (m.first_name?.[0] ?? '').toUpperCase()
    const last = (m.last_name?.[0] ?? '').toUpperCase()
    return (first + last) || m.email[0]?.toUpperCase() || '?'
  }

  function getAuthorForPost(post: FeedItem): { name: string; initial: string } {
    if (post.author) {
      const name = `${post.author.first_name} ${post.author.last_name}`.trim()
      const initial = (post.author.first_name?.[0] ?? post.author.last_name?.[0] ?? 'А').toUpperCase()
      return { name: name || 'Автор', initial }
    }
    const firstTeacher = teachers[0]
    if (firstTeacher) {
      const name = `${firstTeacher.first_name} ${firstTeacher.last_name}`.trim() || firstTeacher.email
      return { name, initial: getInitials(firstTeacher) }
    }
    return { name: 'Преподаватель', initial: 'П' }
  }

  function MemberRow({ member }: { member: Member }) {
    const name = `${member.first_name} ${member.last_name}`.trim() || member.email
    const showActions = canExclude(member) || canChangeRole(member)
    return (
      <Box className="flex items-center justify-between gap-3 py-3 group">
        <Box
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => setProfileMember(member)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setProfileMember(member)
            }
          }}
          aria-label={`Открыть профиль ${name}`}
        >
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
          <Box className="min-w-0 flex-1">
            <Typography variant="body1" className="text-slate-800 font-medium">
              {name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Роль: {ROLE_LABELS[member.role] ?? member.role}
            </Typography>
          </Box>
        </Box>
        {showActions && (
          <Box className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {canChangeRole(member) && (
              <IconButton
                size="small"
                aria-label="Изменить роль"
                onClick={(e) => {
                  const el = e.currentTarget
                  const rect = el.getBoundingClientRect()
                  setRoleMenuAnchor({
                    el,
                    member,
                    position: { top: rect.bottom, left: rect.left },
                  })
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            )}
            {canExclude(member) && (
              <IconButton
                size="small"
                aria-label="Исключить из курса"
                color="error"
                onClick={() => setExcludeMember(member)}
              >
                <PersonRemoveOutlinedIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box className="flex flex-col h-full pb-24 md:pb-0 min-w-0 overflow-x-hidden">
      <CourseBanner course={course} />

      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        className="border-b border-slate-200 mt-2 px-3 sm:px-4 md:px-6"
        sx={{
          minHeight: 48,
          minWidth: 0,
          '& .MuiTab-root': { minHeight: 48, py: 1, textTransform: 'none', fontSize: '1rem' },
          '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
          '& .MuiTabs-scroller': { overflow: 'auto !important' },
        }}
      >
        <Tab label={TAB_LABELS.assignments} />
        <Tab label={TAB_LABELS.posts} />
        <Tab label={TAB_LABELS.materials} />
        <Tab label={TAB_LABELS.users} />
        {showSettingsTab && <Tab label={TAB_LABELS.settings} />}
      </Tabs>

      <Box className="flex-1 overflow-auto min-w-0 px-3 sm:px-4 md:px-6">
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
          <Box className="flex flex-col lg:flex-row gap-6 py-4">
            <Box className="lg:w-64 shrink-0">
              <Box className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <Typography variant="subtitle1" className="font-semibold text-slate-800 mb-2">
                  Предстоящие
                </Typography>
                {upcomingAssignments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" className="mb-3">
                    У вас нет заданий, которые нужно сдать на следующей неделе.
                  </Typography>
                ) : (
                  <Box className="flex flex-col gap-2 mb-3">
                    {upcomingAssignments.slice(0, 3).map((a) => (
                      <Typography key={a.id} variant="body2" className="text-slate-700">
                        {a.title}
                      </Typography>
                    ))}
                  </Box>
                )}
                <Typography
                  component="button"
                  variant="body2"
                  className="text-primary-600 hover:text-primary-700 font-medium cursor-pointer border-0 bg-transparent p-0"
                  onClick={() => setTabValue(tabIds.indexOf('assignments'))}
                >
                  Посмотреть всё
                </Typography>
              </Box>
            </Box>
            <Box className="flex-1 min-w-0">
              {isTeacher && (
                <Button
                  variant="contained"
                  startIcon={<SendOutlinedIcon />}
                  className="mb-4"
                  sx={{ textTransform: 'none' }}
                >
                  Новое объявление
                </Button>
              )}
              <Box className="flex flex-col gap-4">
                {posts.length === 0 ? (
                  <Box className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <Typography variant="body2" color="text.secondary">
                      Нет объявлений
                    </Typography>
                  </Box>
                ) : (
                  posts.map((item) => {
                    const author = getAuthorForPost(item)
                    return (
                      <AnnouncementCard
                        key={item.id}
                        item={item}
                        authorName={author.name}
                        authorInitial={author.initial}
                      />
                    )
                  })
                )}
              </Box>
            </Box>
          </Box>
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
          <>
            <TabPanel value={tabValue} index={4}>
              <Box className="flex flex-col gap-4">
                {course.role === 'owner' && (
                  <Box className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl">
                    <Typography variant="subtitle2" className="text-slate-600 mb-1">
                      Название курса
                    </Typography>
                    {isEditingRename ? (
                      <Box ref={renameFormRef} className="flex flex-col sm:flex-row gap-2">
                        <TextField
                          size="small"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => {
                            if (saveClickedRef.current) {
                              saveClickedRef.current = false
                              return
                            }
                            const active = document.activeElement
                            if (active && renameFormRef.current?.contains(active)) return
                            handleCancelRename()
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename()
                            if (e.key === 'Escape') handleCancelRename()
                          }}
                          autoFocus
                          disabled={renameLoading}
                          className="flex-1"
                          inputProps={{ 'aria-label': 'Название курса' }}
                        />
                        <Box className="flex gap-2">
                          <Button
                            size="small"
                            variant="contained"
                            onMouseDown={() => { saveClickedRef.current = true }}
                            onClick={handleSaveRename}
                            disabled={renameLoading || !editTitle.trim()}
                          >
                            Сохранить
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleCancelRename}
                            disabled={renameLoading}
                          >
                            Отмена
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Box className="flex items-center gap-2">
                        <Typography variant="body1" className="text-slate-800 font-medium">
                          {course.title}
                        </Typography>
                        <IconButton
                          size="small"
                          aria-label="Переименовать курс"
                          onClick={handleStartRename}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                )}
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
          </>
        )}

        <UserProfileDialog
          open={Boolean(profileMember)}
          onClose={() => setProfileMember(null)}
          member={profileMember}
          courseId={courseId ?? ''}
          onAssignmentClick={handleAssignmentClick}
        />

        <Dialog
          open={Boolean(excludeMember)}
          onClose={() => !excludeLoading && setExcludeMember(null)}
          aria-labelledby="exclude-dialog-title"
          aria-describedby="exclude-dialog-description"
        >
          <DialogTitle id="exclude-dialog-title">Исключить из курса?</DialogTitle>
          <DialogContent>
            <DialogContentText id="exclude-dialog-description">
              {excludeMember &&
                `Пользователь ${`${excludeMember.first_name} ${excludeMember.last_name}`.trim() || excludeMember.email} будет исключён из курса.`}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExcludeMember(null)} disabled={excludeLoading}>
              Отмена
            </Button>
            <Button
              onClick={handleExcludeConfirm}
              color="error"
              variant="contained"
              disabled={excludeLoading}
            >
              {excludeLoading ? 'Исключение…' : 'Исключить'}
            </Button>
          </DialogActions>
        </Dialog>

        <Menu
          anchorReference="anchorPosition"
          anchorPosition={
            roleMenuAnchor
              ? { top: roleMenuAnchor.position.top, left: roleMenuAnchor.position.left }
              : undefined
          }
          open={Boolean(roleMenuAnchor)}
          onClose={() => setRoleMenuAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          {roleMenuAnchor?.member.role !== 'teacher' && (
            <MenuItem onClick={() => handleRoleChange(roleMenuAnchor!.member, 'teacher')}>
              Назначить преподавателем
            </MenuItem>
          )}
          {roleMenuAnchor?.member.role !== 'owner' && (
            <MenuItem onClick={() => handleRoleChange(roleMenuAnchor!.member, 'owner')}>
              Назначить владельцем
            </MenuItem>
          )}
        </Menu>
      </Box>
    </Box>
  )
}
