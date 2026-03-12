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
  Menu,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  getCourse,
  getInviteCode,
  regenerateInviteCode,
  getCourseFeed,
  getMySubmission,
  listCourseMembers,
  deleteCourse,
  removeMember,
  changeMemberRole,
  leaveCourse,
  updateCourse,
  inviteTeacherByEmail,
} from '../../api/coursesApi'
import { checkEmailExists } from '../../../profile/api/profileApi'
import { useAuth } from '../../../auth/model/AuthContext'
import { useCourses } from '../../model/CoursesContext'
import { CourseBanner } from '../CourseHeader/CourseBanner'
import { CreateAssignmentDialog } from './CreateAssignmentDialog/CreateAssignmentDialog'
import { CreateMaterialDialog } from './CreateMaterialDialog/CreateMaterialDialog'
import { CreatePostDialog } from './CreatePostDialog/CreatePostDialog'
import { AssignmentCard } from './AssignmentCard/AssignmentCard'
import { PostCard } from './PostCard/PostCard'
import { MaterialCard } from './MaterialCard/MaterialCard'
import { UserProfileDialog } from './UserProfileDialog'
import {
  type CourseTabId,
  type CourseWithRole,
  type FeedItem,
  type Member,
  getNameByUserId,
  getInitialsFromMember,
  getMemberInitials,
} from '../../model/types'

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
  return assignments
    .filter((a) => {
      if (!a.deadline) return false
      const d = new Date(a.deadline)
      return d >= now && d <= nextWeek
    })
    .sort((a, b) => {
      const da = new Date(a.deadline!).getTime()
      const db = new Date(b.deadline!).getTime()
      return da - db
    })
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const TAB_PARAM = 'tab'

export function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [createPostOpen, setCreatePostOpen] = useState(false)
  const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false)
  const [createMaterialOpen, setCreateMaterialOpen] = useState(false)
  const [inviteTeacherEmail, setInviteTeacherEmail] = useState('')
  const [inviteTeacherLoading, setInviteTeacherLoading] = useState(false)
  const [inviteTeacherError, setInviteTeacherError] = useState<string | null>(null)
  const [inviteCodeRegenerating, setInviteCodeRegenerating] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [memberActionError, setMemberActionError] = useState<string | null>(null)
  const [submittedAssignmentIds, setSubmittedAssignmentIds] = useState<Set<string>>(new Set())

  const { user: authUser } = useAuth()
  const isTeacher = course?.role === 'teacher' || course?.role === 'owner'
  const isOwner = course?.role === 'owner'
  const showSettingsTab = isTeacher

  const tabIds: CourseTabId[] = ['assignments', 'posts', 'materials', 'users']
  if (showSettingsTab) tabIds.push('settings')

  const currentTabId = tabIds[tabValue] ?? tabIds[0]

  const handleTabChange = (idx: number) => {
    setTabValue(idx)
    const tabId = tabIds[idx]
    if (tabId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set(TAB_PARAM, tabId)
        return next
      })
    }
  }

  useEffect(() => {
    const tabFromUrl = searchParams.get(TAB_PARAM)
    const idx = tabFromUrl ? tabIds.indexOf(tabFromUrl as CourseTabId) : -1
    if (idx >= 0) setTabValue(idx)
  }, [searchParams, tabIds.join(',')])

  useEffect(() => {
    if (!courseId) {
      navigate('/')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getCourse(courseId),
      getCourseFeed(courseId),
      listCourseMembers(courseId),
    ])
      .then(([courseData, feedData, membersData]) => {
        if (!cancelled) {
          setCourse(courseData)
          ctx?.addCourse(courseData)
          setFeed(feedData)
          setMembers(membersData)
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

  const refreshFeed = () => {
    if (courseId && currentTabId !== 'settings' && currentTabId !== 'users') {
      getCourseFeed(courseId).then(setFeed).catch(() => setFeed([]))
    }
  }

  const assignmentsForEffect = feed.filter((f) => f.type === 'assignment')
  const upcomingForEffect = getUpcomingAssignments(assignmentsForEffect)
  useEffect(() => {
    if (!courseId || !authUser || course?.role !== 'student' || upcomingForEffect.length === 0) {
      setSubmittedAssignmentIds(new Set())
      return
    }
    let cancelled = false
    Promise.all(
      upcomingForEffect.map((a) =>
        getMySubmission(courseId, a.id)
          .then((sub) => ({ id: a.id, submitted: sub?.is_attached === true }))
          .catch(() => ({ id: a.id, submitted: false })),
      ),
    ).then((results) => {
      if (!cancelled) {
        setSubmittedAssignmentIds(new Set(results.filter((r) => r.submitted).map((r) => r.id)))
      }
    })
    return () => {
      cancelled = true
    }
  }, [courseId, authUser?.id, course?.role, feed, upcomingForEffect.map((a) => a.id).join(',')])

  const prevCourseIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!courseId || currentTabId === 'settings') return
    const isNewCourse = prevCourseIdRef.current !== courseId
    prevCourseIdRef.current = courseId
    if (isNewCourse) return
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

  const handleRegenerateInviteCode = async () => {
    if (!courseId || inviteCodeRegenerating) return
    setInviteCodeRegenerating(true)
    try {
      const res = await regenerateInviteCode(courseId)
      setInviteCode(res.code)
    } catch {
      setInviteCode(null)
    } finally {
      setInviteCodeRegenerating(false)
    }
  }

  const refreshMembers = () => {
    if (courseId) {
      listCourseMembers(courseId).then(setMembers).catch(() => setMembers([]))
    }
  }

  const ownersCount = members.filter((m) => m.role === 'owner').length

  const canExclude = (m: Member): boolean => {
    if (m.user_id === authUser?.id) return false
    if (m.role === 'owner' && ownersCount <= 1) return false
    if (isOwner) return true
    if (isTeacher && m.role === 'student') return true
    return false
  }

  const canChangeRole = (m: Member): boolean => {
    return isOwner && m.user_id !== authUser?.id
  }

  const handleExcludeConfirm = async () => {
    if (!courseId || !excludeMember) return
    setExcludeLoading(true)
    try {
      await removeMember(courseId, excludeMember.user_id)
      setExcludeMember(null)
      refreshMembers()
      setProfileMember((prev) => (prev?.user_id === excludeMember.user_id ? null : prev))
    } catch (err) {
      if (err instanceof Error && err.message === 'LAST_OWNER') {
        setExcludeMember(null)
        setMemberActionError('Нельзя исключить последнего владельца курса')
      }
    } finally {
      setExcludeLoading(false)
    }
  }

  const handleRoleChange = async (member: Member, newRole: 'owner' | 'teacher' | 'student') => {
    if (!courseId) return
    setRoleMenuAnchor(null)
    try {
      await changeMemberRole(courseId, member.user_id, newRole)
      refreshMembers()
      setProfileMember((prev) =>
        prev?.user_id === member.user_id ? { ...prev, role: newRole } : prev,
      )
    } catch (err) {
      if (err instanceof Error && err.message === 'LAST_OWNER') {
        setMemberActionError('Нельзя понизить последнего владельца курса')
      }
    }
  }

  const handleLeaveCourse = async () => {
    if (!courseId) return
    setLeaveLoading(true)
    try {
      await leaveCourse(courseId)
      ctx?.setCourses((prev) => prev.filter((c) => c.id !== course?.id))
      setLeaveDialogOpen(false)
      navigate('/')
    } catch (err) {
      if (err instanceof Error && err.message === 'LAST_OWNER') {
        setMemberActionError('Нельзя покинуть курс — вы последний владелец. Сначала назначьте другого владельца.')
      }
    } finally {
      setLeaveLoading(false)
    }
  }

  const handleAssignmentClick = (assignmentId: string) => {
    setProfileMember(null)
    if (courseId) navigate(`/course/${courseId}/assignment/${assignmentId}`)
  }

  const handleStartRename = () => {
    setEditTitle(course?.title ?? '')
    setIsEditingRename(true)
  }

  const handleSaveRename = async () => {
    const trimmed = editTitle.trim()
    if (!trimmed || !course || trimmed === course.title || !courseId) {
      setIsEditingRename(false)
      return
    }
    setRenameLoading(true)
    try {
      const updated = await updateCourse(courseId, { title: trimmed })
      handleCourseUpdated(updated)
      setIsEditingRename(false)
    } catch {
    } finally {
      setRenameLoading(false)
    }
  }

  const handleCancelRename = () => {
    setEditTitle(course?.title ?? '')
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
  const upcomingRaw = getUpcomingAssignments(assignments)
  const upcomingAssignments = !isTeacher
    ? upcomingRaw.filter((a) => !submittedAssignmentIds.has(a.id))
    : upcomingRaw

  const teachers = members.filter((m) => m.role === 'owner' || m.role === 'teacher')
  const students = members.filter((m) => m.role === 'student')

  function getAuthorForPost(post: FeedItem): { name: string; initial: string } {
    if (post.user_id) {
      const name = getNameByUserId(members, post.user_id, post.author)
      const m = members.find((x) => x.user_id === post.user_id)
      const initial = m ? getMemberInitials(m) : getInitialsFromMember(members, post.user_id, post.author)
      return { name: name || 'Автор', initial }
    }
    if (post.author) {
      const name = `${post.author.first_name} ${post.author.last_name}`.trim()
      const initial = (post.author.first_name?.[0] ?? post.author.last_name?.[0] ?? 'А').toUpperCase()
      return { name: name || 'Автор', initial }
    }
    const firstTeacher = teachers[0]
    if (firstTeacher) {
      const name = getNameByUserId(members, firstTeacher.user_id, null)
      return { name: name !== 'Участник' ? name : firstTeacher.email, initial: getMemberInitials(firstTeacher) }
    }
    return { name: 'Преподаватель', initial: 'П' }
  }

  function getAuthorForAssignment(item: FeedItem): string {
    if (item.user_id) {
      return getNameByUserId(members, item.user_id, item.author) || 'Автор'
    }
    if (item.author) {
      return `${item.author.first_name} ${item.author.last_name}`.trim() || 'Автор'
    }
    const firstTeacher = teachers[0]
    if (firstTeacher) {
      const name = getNameByUserId(members, firstTeacher.user_id, null)
      return name !== 'Участник' ? name : `${firstTeacher.first_name} ${firstTeacher.last_name}`.trim() || firstTeacher.email
    }
    return 'Преподаватель'
  }

  function MemberRow({ member }: { member: Member }) {
    const name =
      getNameByUserId(members, member.user_id, null) !== 'Участник'
        ? getNameByUserId(members, member.user_id, null)
        : `${member.first_name} ${member.last_name}`.trim() || member.email
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
            {getMemberInitials(member)}
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
        onChange={(_, v) => handleTabChange(Number(v))}
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
          <Box className="flex flex-col lg:flex-row gap-6 py-4">
            {!isTeacher && (
              <Box className="lg:w-64 shrink-0">
                <Box className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <Typography variant="subtitle1" className="font-semibold text-slate-800 mb-2">
                    Предстоящие задания
                  </Typography>
                  {upcomingAssignments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" className="mb-3">
                      У вас нет заданий, которые нужно сдать на следующей неделе.
                    </Typography>
                  ) : (
                    <Box className="flex flex-col gap-0">
                      {upcomingAssignments.slice(0, 3).map((a, idx) => (
                        <Box key={a.id}>
                          {idx > 0 && (
                            <Divider
                              sx={{ borderColor: 'rgb(203 213 225)', my: 1.5 }}
                              className="border-slate-300"
                            />
                          )}
                          <Box
                            className="cursor-pointer rounded-lg bg-slate-50/80 hover:bg-slate-100/90 hover:text-primary-600 flex flex-col gap-0.5 px-2.5 py-2 transition-colors"
                            onClick={() => courseId && navigate(`/course/${courseId}/assignment/${a.id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                courseId && navigate(`/course/${courseId}/assignment/${a.id}`)
                              }
                            }}
                          >
                            <Typography variant="body2" className="text-slate-700 font-medium">
                              {a.title}
                            </Typography>
                            {a.deadline && (
                              <Typography variant="caption" color="text.secondary">
                                · {formatDateTime(a.deadline)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {currentTabId !== 'assignments' && (
                    <Typography
                      component="button"
                      variant="body2"
                      className="text-primary-600 hover:text-primary-700 font-medium cursor-pointer border-0 bg-transparent p-0"
                      onClick={() => handleTabChange(tabIds.indexOf('assignments'))}
                    >
                      Посмотреть всё
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
            <Box className="flex-1 min-w-0 flex flex-col" sx={{ gap: '1.5rem' }}>
              {isTeacher && (
                <Button
                  variant="contained"
                  startIcon={<SendOutlinedIcon />}
                  sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                  onClick={() => setCreateAssignmentOpen(true)}
                  aria-label="Создать задание"
                >
                  Новое задание
                </Button>
              )}
              <Box className="flex flex-col gap-4">
                {assignments.length === 0 ? (
                  <Box className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <Typography variant="body2" color="text.secondary">
                      Нет заданий
                    </Typography>
                  </Box>
                ) : (
                  assignments.map((item) => (
                    <AssignmentCard
                      key={item.id}
                      item={item}
                      courseId={courseId ?? ''}
                      authorName={getAuthorForAssignment(item)}
                      onClick={() => courseId && navigate(`/course/${courseId}/assignment/${item.id}`)}
                      isTeacher={isTeacher}
                      courseMembers={members}
                      onDeleted={refreshFeed}
                    />
                  ))
                )}
              </Box>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box className="flex flex-col lg:flex-row gap-6 py-4">
            {!isTeacher && (
              <Box className="lg:w-64 shrink-0">
                <Box className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <Typography variant="subtitle1" className="font-semibold text-slate-800 mb-2">
                    Предстоящие задания
                  </Typography>
                  {upcomingAssignments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" className="mb-3">
                      У вас нет заданий, которые нужно сдать на следующей неделе.
                    </Typography>
                  ) : (
                    <Box className="flex flex-col gap-0">
                      {upcomingAssignments.slice(0, 3).map((a, idx) => (
                        <Box key={a.id}>
                          {idx > 0 && (
                            <Divider
                              sx={{ borderColor: 'rgb(203 213 225)', my: 1.5 }}
                              className="border-slate-300"
                            />
                          )}
                          <Box
                            className="cursor-pointer rounded-lg bg-slate-50/80 hover:bg-slate-100/90 hover:text-primary-600 flex flex-col gap-0.5 px-2.5 py-2 transition-colors"
                            onClick={() => courseId && navigate(`/course/${courseId}/assignment/${a.id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                courseId && navigate(`/course/${courseId}/assignment/${a.id}`)
                              }
                            }}
                          >
                            <Typography variant="body2" className="text-slate-700 font-medium">
                              {a.title}
                            </Typography>
                            {a.deadline && (
                              <Typography variant="caption" color="text.secondary">
                                · {formatDateTime(a.deadline)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {currentTabId !== 'assignments' && (
                    <Typography
                      component="button"
                      variant="body2"
                      className="text-primary-600 hover:text-primary-700 font-medium cursor-pointer border-0 bg-transparent p-0"
                      onClick={() => handleTabChange(tabIds.indexOf('assignments'))}
                    >
                      Посмотреть всё
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
            <Box className="flex-1 min-w-0 flex flex-col" sx={{ gap: '1.5rem' }}>
              <Button
                variant="contained"
                startIcon={<SendOutlinedIcon />}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                onClick={() => setCreatePostOpen(true)}
                aria-label="Создать пост"
              >
                Новый пост
              </Button>
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
                      <PostCard
                        key={item.id}
                        item={item}
                        courseId={courseId ?? ''}
                        authorName={author.name}
                        authorInitial={author.initial}
                        courseMembers={members}
                        isTeacher={isTeacher}
                        isAuthor={item.user_id === authUser?.id}
                        onDeleted={refreshFeed}
                      />
                    )
                  })
                )}
              </Box>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box className="flex flex-wrap items-center gap-3 mb-4">
            {isTeacher && (
              <Button
                variant="contained"
                startIcon={<SendOutlinedIcon />}
                sx={{ textTransform: 'none' }}
                onClick={() => setCreateMaterialOpen(true)}
                aria-label="Создать материал"
              >
                Новый материал
              </Button>
            )}
          </Box>
          <Box className="flex flex-col gap-4">
            {materials.length === 0 ? (
              <Box className="flex justify-center items-center py-12 md:py-4 md:justify-start md:items-stretch">
                <Typography variant="body2" className="text-slate-500 text-center md:text-left">
                  Нет материалов
                </Typography>
              </Box>
            ) : (
              materials.map((item) => {
                const author = getAuthorForPost(item)
                return (
                  <MaterialCard
                    key={item.id}
                    item={item}
                    courseId={courseId ?? ''}
                    authorName={author.name}
                    authorInitial={author.initial}
                    courseMembers={members}
                    onClick={() =>
                      courseId && navigate(`/course/${courseId}/material/${item.id}`, { state: { material: item } })
                    }
                  />
                )
              })
            )}
          </Box>
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
                {memberActionError && (
                  <Box className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                    <Typography variant="body2" color="error" className="flex-1">
                      {memberActionError}
                    </Typography>
                    <IconButton size="small" onClick={() => setMemberActionError(null)} aria-label="Закрыть">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
                <Box className="flex flex-col md:flex-row md:items-stretch gap-4">
                  {course.role === 'owner' && (
                    <Box className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl md:flex-[3] min-w-0">
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
                    <Box className="flex items-center gap-2 p-4 bg-slate-50 rounded-xl md:flex-[1] min-w-0">
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
                      aria-label="Перегенерировать код"
                      onClick={handleRegenerateInviteCode}
                      disabled={inviteCodeRegenerating}
                    >
                      {inviteCodeRegenerating ? (
                        <CircularProgress size={20} />
                      ) : (
                        <RefreshOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
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
                </Box>
                {course.role === 'owner' && (
                  <Box className="flex flex-col gap-4 p-4 bg-slate-50 rounded-xl">
                    <Typography variant="subtitle2" className="text-slate-600">
                      Добавить преподавателя по email
                    </Typography>
                    <Box className="flex flex-col sm:flex-row gap-2">
                      <TextField
                        size="small"
                        type="email"
                        label="Email"
                        placeholder="teacher@example.com"
                        value={inviteTeacherEmail}
                        onChange={(e) => {
                          setInviteTeacherEmail(e.target.value)
                          setInviteTeacherError(null)
                        }}
                        disabled={inviteTeacherLoading}
                        sx={{ minWidth: 240 }}
                        inputProps={{ 'aria-label': 'Email преподавателя' }}
                      />
                      <Button
                        variant="outlined"
                        onClick={async () => {
                          const email = inviteTeacherEmail.trim()
                          if (!email || !courseId) return
                          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                          if (!emailPattern.test(email)) {
                            setInviteTeacherError('Введите корректный email')
                            return
                          }
                          setInviteTeacherLoading(true)
                          setInviteTeacherError(null)
                          try {
                            const { exists } = await checkEmailExists(email)
                            if (!exists) {
                              setInviteTeacherError('Пользователь с таким email не найден')
                              return
                            }
                            await inviteTeacherByEmail(courseId, email)
                            setInviteTeacherEmail('')
                            refreshMembers()
                          } catch (err) {
                            const msg =
                              err instanceof Error && err.message === 'USER_NOT_FOUND'
                                ? 'Пользователь с таким email не найден'
                                : err instanceof Error && err.message === 'ALREADY_TEACHER'
                                  ? 'Пользователь уже является преподавателем'
                                  : 'Не удалось пригласить'
                            setInviteTeacherError(msg)
                          } finally {
                            setInviteTeacherLoading(false)
                          }
                        }}
                        disabled={inviteTeacherLoading || !inviteTeacherEmail.trim()}
                      >
                        {inviteTeacherLoading ? 'Добавление…' : 'Добавить'}
                      </Button>
                    </Box>
                    {inviteTeacherError && (
                      <Typography variant="body2" color="error">
                        {inviteTeacherError}
                      </Typography>
                    )}
                  </Box>
                )}
                <Box className="flex flex-col gap-2">
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={() => {
                      if (course?.role === 'owner' && ownersCount <= 1) {
                        setMemberActionError(
                          'Нельзя покинуть курс — вы последний владелец. Сначала назначьте другого владельца.',
                        )
                        return
                      }
                      setLeaveDialogOpen(true)
                    }}
                    aria-label="Покинуть курс"
                    disabled={leaveLoading}
                  >
                    Покинуть курс
                  </Button>
                  {course.role === 'owner' && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlinedIcon />}
                      onClick={() => setDeleteDialogOpen(true)}
                      aria-label="Удалить курс"
                    >
                      Удалить курс
                    </Button>
                  )}
                </Box>
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

        <CreatePostDialog
          open={createPostOpen}
          onClose={() => setCreatePostOpen(false)}
          courseId={courseId ?? ''}
          onCreated={refreshFeed}
        />
        <CreateAssignmentDialog
          open={createAssignmentOpen}
          onClose={() => setCreateAssignmentOpen(false)}
          courseId={courseId ?? ''}
          onCreated={refreshFeed}
        />
        <CreateMaterialDialog
          open={createMaterialOpen}
          onClose={() => setCreateMaterialOpen(false)}
          courseId={courseId ?? ''}
          onCreated={refreshFeed}
        />
        <UserProfileDialog
          open={Boolean(profileMember)}
          onClose={() => setProfileMember(null)}
          member={profileMember}
          courseId={courseId ?? ''}
          isTeacher={isTeacher}
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
          {roleMenuAnchor?.member.role !== 'owner' && (
            <MenuItem onClick={() => handleRoleChange(roleMenuAnchor!.member, 'owner')}>
              Назначить владельцем
            </MenuItem>
          )}
          {roleMenuAnchor?.member.role !== 'teacher' && (
            <MenuItem onClick={() => handleRoleChange(roleMenuAnchor!.member, 'teacher')}>
              Назначить преподавателем
            </MenuItem>
          )}
          {roleMenuAnchor?.member.role !== 'student' && (
            <MenuItem
              onClick={() => handleRoleChange(roleMenuAnchor!.member, 'student')}
              disabled={
                roleMenuAnchor?.member.role === 'owner' && ownersCount <= 1
              }
            >
              Вернуть в студенты
            </MenuItem>
          )}
        </Menu>

        <Dialog
          open={leaveDialogOpen}
          onClose={() => !leaveLoading && setLeaveDialogOpen(false)}
          aria-labelledby="leave-dialog-title"
          aria-describedby="leave-dialog-description"
        >
          <DialogTitle id="leave-dialog-title">Покинуть курс?</DialogTitle>
          <DialogContent>
            <DialogContentText id="leave-dialog-description">
              Вы покинете курс «{course?.title}». Чтобы снова присоединиться, понадобится код приглашения.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLeaveDialogOpen(false)} disabled={leaveLoading}>
              Отмена
            </Button>
            <Button
              onClick={handleLeaveCourse}
              color="warning"
              variant="contained"
              disabled={leaveLoading}
            >
              {leaveLoading ? 'Выход…' : 'Покинуть'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  )
}
