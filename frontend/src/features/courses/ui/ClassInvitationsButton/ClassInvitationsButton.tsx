import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import {
  acceptCourseInvitation,
  approveJoinRequest,
  leaveCourse,
  listCourses,
  listJoinRequests,
  rejectJoinRequest,
} from '../../api/coursesApi'
import { useCourses } from '../../model/CoursesContext'
import type { CourseWithRole, Member } from '../../model/types'

type ModeratorBlock = {
  courseId: string
  courseTitle: string
  members: Member[]
}

type ClassInvitationsButtonProps = {
  variant?: 'button' | 'icon'
}

function memberLabel(m: Member): string {
  const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
  return name || m.email
}

export function ClassInvitationsButton({ variant = 'button' }: ClassInvitationsButtonProps) {
  const ctx = useCourses()
  const courses = ctx?.courses ?? []
  const setCourses = ctx?.setCourses

  const [open, setOpen] = useState(false)
  const [moderatorBlocks, setModeratorBlocks] = useState<ModeratorBlock[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingModerator, setLoadingModerator] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [teacherPendingCount, setTeacherPendingCount] = useState(0)
  const [allCourses, setAllCourses] = useState<CourseWithRole[]>([])

  const moderatorCourses = useMemo(
    () => courses.filter((c) => c.role === 'owner' || c.role === 'teacher'),
    [courses],
  )

  const studentPendingCourses = useMemo(
    () =>
      allCourses.filter((c) => c.role === 'student' && c.membership_status === 'pending'),
    [allCourses],
  )

  const teacherInvitePendingCourses = useMemo(
    () =>
      allCourses.filter((c) => c.membership_status === 'pending' && c.role !== 'student'),
    [allCourses],
  )

  const badgeCount =
    studentPendingCourses.length + teacherInvitePendingCourses.length + teacherPendingCount

  const reloadAllCourses = useCallback(async () => {
    try {
      const next = await listCourses()
      setAllCourses(next)
      return next
    } catch {
      return null
    }
  }, [])

  const refreshModeratorRequests = useCallback(async () => {
    if (moderatorCourses.length === 0) {
      setModeratorBlocks([])
      return
    }
    setLoadingModerator(true)
    setLoadError(null)
    try {
      const results = await Promise.all(
        moderatorCourses.map(async (c) => {
          const members = await listJoinRequests(c.id, 'pending')
          return { courseId: c.id, courseTitle: c.title, members }
        }),
      )
      setModeratorBlocks(results)
    } catch {
      setLoadError('Не удалось загрузить заявки')
      setModeratorBlocks([])
    } finally {
      setLoadingModerator(false)
    }
  }, [moderatorCourses])

  useEffect(() => {
    if (!open) return
    void reloadAllCourses()
    void refreshModeratorRequests()
  }, [open, refreshModeratorRequests, reloadAllCourses])

  useEffect(() => {
    void reloadAllCourses()
  }, [reloadAllCourses])

  useEffect(() => {
    if (moderatorCourses.length === 0) {
      setTeacherPendingCount(0)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const lists = await Promise.all(
          moderatorCourses.map((c) => listJoinRequests(c.id, 'pending')),
        )
        if (!cancelled) {
          setTeacherPendingCount(lists.reduce((acc, l) => acc + l.length, 0))
        }
      } catch {
        if (!cancelled) setTeacherPendingCount(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [moderatorCourses])

  const reloadCourses = useCallback(async () => {
    const next = await reloadAllCourses()
    if (!next || !setCourses) return
    setCourses(next.filter((course) => course.membership_status !== 'pending'))
  }, [reloadAllCourses, setCourses])

  const handleApprove = async (courseId: string, userId: string) => {
    const key = `${courseId}:${userId}`
    setPendingAction(key)
    try {
      await approveJoinRequest(courseId, userId)
      await refreshModeratorRequests()
      await reloadCourses()
    } catch {
      setLoadError('Не удалось принять заявку')
    } finally {
      setPendingAction(null)
    }
  }

  const handleReject = async (courseId: string, userId: string) => {
    const key = `${courseId}:${userId}`
    setPendingAction(key)
    try {
      await rejectJoinRequest(courseId, userId)
      await refreshModeratorRequests()
      await reloadCourses()
    } catch {
      setLoadError('Не удалось отклонить заявку')
    } finally {
      setPendingAction(null)
    }
  }

  const handleDeclinePendingCourse = async (courseId: string) => {
    setPendingAction(`decline:${courseId}`)
    try {
      await leaveCourse(courseId)
      await reloadCourses()
      await refreshModeratorRequests()
    } catch {
      setLoadError('Не удалось отклонить приглашение')
    } finally {
      setPendingAction(null)
    }
  }

  const handleAcceptPendingCourse = async (courseId: string) => {
    setPendingAction(`accept:${courseId}`)
    try {
      await acceptCourseInvitation(courseId)
      await reloadCourses()
      await refreshModeratorRequests()
    } catch {
      setLoadError('Не удалось принять приглашение')
    } finally {
      setPendingAction(null)
    }
  }

  const showModeratorSection = moderatorCourses.length > 0
  const showStudentSection = studentPendingCourses.length > 0
  const showTeacherInviteSection = teacherInvitePendingCourses.length > 0
  const empty =
    !showModeratorSection &&
    !showStudentSection &&
    !showTeacherInviteSection &&
    !loadingModerator &&
    !loadError

  return (
    <>
      {variant === 'icon' ? (
        <IconButton
          color="inherit"
          aria-label="Приглашения"
          onClick={() => setOpen(true)}
          size="large"
        >
          <Badge
            badgeContent={badgeCount}
            color="error"
            max={99}
            invisible={badgeCount === 0}
          >
            <MailOutlineIcon fontSize="large" />
          </Badge>
        </IconButton>
      ) : (
        <Badge badgeContent={badgeCount} color="error" max={99} invisible={badgeCount === 0}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<MailOutlineIcon />}
            onClick={() => setOpen(true)}
            className="normal-case"
            sx={{ borderColor: 'divider', color: 'text.primary' }}
          >
            Приглашения
          </Button>
        </Badge>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Приглашения</DialogTitle>
        <DialogContent className="space-y-4 pb-4">
          {loadError && (
            <Typography color="error" variant="body2">
              {loadError}
            </Typography>
          )}

          {showTeacherInviteSection && (
            <Box>
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Приглашения в курсы
              </Typography>
              <List dense disablePadding>
                {teacherInvitePendingCourses.map((c) => {
                  const busyAccept = pendingAction === `accept:${c.id}`
                  const busyDecline = pendingAction === `decline:${c.id}`
                  const busy = busyAccept || busyDecline
                  return (
                    <ListItem
                      key={c.id}
                      className="border border-slate-100 rounded-lg mb-1 px-2"
                      secondaryAction={
                        <Box className="flex gap-1 pr-1">
                          <Button
                            size="small"
                            color="success"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => handleAcceptPendingCourse(c.id)}
                          >
                            {busyAccept ? '…' : 'Принять'}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => handleDeclinePendingCourse(c.id)}
                          >
                            {busyDecline ? '…' : 'Отклонить'}
                          </Button>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={c.title}
                        secondary="Приглашение отправлено владельцем курса"
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          )}

          {showTeacherInviteSection && (showStudentSection || showModeratorSection) && (
            <Divider className="my-2" />
          )}

          {showModeratorSection && (
            <Box>
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Заявки на вступление (преподаватель)
              </Typography>
              {loadingModerator ? (
                <Box className="flex justify-center py-4">
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <>
                  {moderatorBlocks.every((b) => b.members.length === 0) ? (
                    <Typography variant="body2" className="text-slate-500">
                      Нет ожидающих заявок
                    </Typography>
                  ) : (
                    moderatorBlocks.map((block) =>
                      block.members.length === 0 ? null : (
                        <Box key={block.courseId} className="mb-3">
                          <Typography variant="body2" className="font-medium text-slate-800 mb-1">
                            {block.courseTitle}
                          </Typography>
                          <List dense disablePadding>
                            {block.members.map((m) => {
                              const pk = `${block.courseId}:${m.user_id}`
                              const busy = pendingAction === pk
                              return (
                                <ListItem
                                  key={m.user_id}
                                  className="border border-slate-100 rounded-lg mb-1 px-2"
                                  secondaryAction={
                                    <Box className="flex gap-1 pr-1">
                                      <Button
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                        disabled={busy}
                                        onClick={() => handleApprove(block.courseId, m.user_id)}
                                      >
                                        {busy ? '…' : 'Принять'}
                                      </Button>
                                      <Button
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        disabled={busy}
                                        onClick={() => handleReject(block.courseId, m.user_id)}
                                      >
                                        Отклонить
                                      </Button>
                                    </Box>
                                  }
                                >
                                  <ListItemText
                                    primary={
                                      <Box className="flex items-center gap-2 flex-wrap">
                                        <span>{memberLabel(m)}</span>
                                        <Chip
                                          size="small"
                                          variant="outlined"
                                          label={
                                            m.role === 'teacher'
                                              ? 'Приглашение преподавателю'
                                              : 'Заявка студента'
                                          }
                                          sx={{ height: 22, fontSize: '0.65rem' }}
                                        />
                                      </Box>
                                    }
                                    secondary={m.email}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              )
                            })}
                          </List>
                        </Box>
                      ),
                    )
                  )}
                </>
              )}
            </Box>
          )}

          {showModeratorSection && showStudentSection && <Divider className="my-2" />}

          {showStudentSection && (
            <Box>
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Ожидают подтверждения преподавателя
              </Typography>
              <List dense disablePadding>
                {studentPendingCourses.map((c) => {
                  const busyAccept = pendingAction === `accept:${c.id}`
                  const busyDecline = pendingAction === `decline:${c.id}`
                  const busy = busyAccept || busyDecline
                  return (
                    <ListItem
                      key={c.id}
                      className="border border-slate-100 rounded-lg mb-1 px-2"
                      secondaryAction={
                        <Box className="flex gap-1 pr-1">
                          <Button
                            size="small"
                            color="success"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => handleAcceptPendingCourse(c.id)}
                          >
                            {busyAccept ? '…' : 'Принять'}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => handleDeclinePendingCourse(c.id)}
                          >
                            {busyDecline ? '…' : 'Отклонить'}
                          </Button>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={c.title}
                        secondary="Заявка отправлена"
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          )}

          {empty && (
            <Typography variant="body2" className="text-slate-500">
              Нет активных приглашений
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ClassInvitationsButton
