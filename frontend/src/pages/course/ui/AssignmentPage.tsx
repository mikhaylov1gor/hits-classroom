import { useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CloseIcon from '@mui/icons-material/Close'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import LinkIcon from '@mui/icons-material/Link'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import VideoFileOutlinedIcon from '@mui/icons-material/VideoFileOutlined'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAssignment,
  getCourse,
  listSubmissions,
  submitAssignment,
  gradeSubmission,
  listComments,
  createComment,
  listCourseMembers,
} from '../../../features/courses/api/coursesApi'
import { useAuth } from '../../../features/auth/model/AuthContext'
import {
  type Assignment,
  type Comment,
  type Submission,
  filterStudentComments,
  filterTeacherDialogComments,
} from '../../../features/courses/model/types'

function formatDate(dateStr?: string): string {
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

function getInitials(author?: { first_name?: string; last_name?: string } | null): string {
  if (!author) return '?'
  const f = author.first_name?.trim().charAt(0) ?? ''
  const l = author.last_name?.trim().charAt(0) ?? ''
  return (f + l).toUpperCase() || '?'
}

function getStatusLabel(
  submission: Submission | null,
  deadline: string | null | undefined,
): string {
  if (!submission) {
    if (deadline && new Date(deadline) < new Date()) return 'Просрочено'
    return 'Назначено'
  }
  if (submission.grade != null) return `Оценка: ${submission.grade}`
  return 'Проверяется'
}

export function AssignmentPage() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>()
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [course, setCourse] = useState<{ title: string } | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [answerFiles, setAnswerFiles] = useState<File[]>([])
  const [answerLinks, setAnswerLinks] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [gradeValues, setGradeValues] = useState<Record<string, string>>({})
  const [gradeLoading, setGradeLoading] = useState<Record<string, boolean>>({})
  const [editingGradeFor, setEditingGradeFor] = useState<string | null>(null)
  const [showAddComment, setShowAddComment] = useState(false)
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [courseMembers, setCourseMembers] = useState<{ user_id: string; role: string }[]>([])
  const [replyToStudent, setReplyToStudent] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [dialogOpenUserId, setDialogOpenUserId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!courseId || !assignmentId) {
      navigate('/')
      return
    }

    setLoading(true)
    Promise.all([
      getCourse(courseId),
      getAssignment(courseId, assignmentId),
      listComments(courseId, assignmentId),
      listCourseMembers(courseId),
    ])
      .then(([c, a, cm, members]) => {
        setCourse(c)
        setAssignment(a)
        setComments(cm)
        setCourseMembers((members as { user_id: string; role: string }[]) ?? [])
        const courseWithRole = c as { role?: string } | null
        const isTeacher = courseWithRole?.role === 'teacher' || courseWithRole?.role === 'owner'
        if (isTeacher) {
          return listSubmissions(courseId, assignmentId).then((s) => setSubmissions(s))
        }
        return listSubmissions(courseId, assignmentId)
          .then((s) => setSubmissions(s.filter((x) => x.user_id === authUser?.id)))
          .catch((err) => {
            if (err instanceof Error && err.message === 'FORBIDDEN') {
              setSubmissions([])
            } else {
              throw err
            }
          })
      })
      .catch(() => {
        setCourse(null)
        setAssignment(null)
        setSubmissions([])
        setComments([])
        setCourseMembers([])
      })
      .finally(() => setLoading(false))
  }, [courseId, assignmentId, authUser?.id, navigate])

  const mySubmission = submissions.find((s) => s.user_id === authUser?.id)
  const courseWithRole = course as { title?: string; role?: string } | null
  const isTeacher = courseWithRole?.role === 'teacher' || courseWithRole?.role === 'owner'
  const canSubmit = !mySubmission && !loading
  const statusLabel = getStatusLabel(mySubmission ?? null, assignment?.deadline ?? null)
  const assignmentExt = assignment as Assignment & {
    author?: { first_name: string; last_name: string }
    attachments?: { id: string; name: string }[]
  }
  const displayAuthor = assignmentExt?.author
    ? `${assignmentExt.author.first_name} ${assignmentExt.author.last_name}`.trim()
    : 'Преподаватель'

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignmentId || !courseId || submitting) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const created = await submitAssignment(courseId, assignmentId, {
        body: answerLinks.length > 0 ? answerLinks.join('\n') : undefined,
        file_ids: [],
      })
      setSubmissions([created])
      setAnswerFiles([])
      setAnswerLinks([])
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message === 'ALREADY_SUBMITTED'
          ? 'Ответ уже отправлен'
          : 'Не удалось отправить ответ',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const isGradeValid = (val: string): boolean => {
    if (!val.trim()) return false
    const n = parseInt(val, 10)
    return !isNaN(n) && n >= 0 && n <= 100
  }

  const handleGradeChange = (submissionId: string, value: string) => {
    setGradeValues((prev) => ({ ...prev, [submissionId]: value }))
  }

  const handleSaveGrade = async (submissionId: string) => {
    const val = gradeValues[submissionId]
    const grade = val ? parseInt(val, 10) : NaN
    if (isNaN(grade) || grade < 0 || grade > 100 || !courseId || !assignmentId) return

    setGradeLoading((prev) => ({ ...prev, [submissionId]: true }))
    try {
      await gradeSubmission(courseId, assignmentId, submissionId, grade)
      const updated = await listSubmissions(courseId, assignmentId)
      setSubmissions(updated)
    } finally {
      setGradeLoading((prev) => ({ ...prev, [submissionId]: false }))
      setEditingGradeFor(null)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || !assignmentId || !courseId || submittingComment) return

    setSubmittingComment(true)
    try {
      const payload: { body: string; file_ids: string[]; user_id?: string } = {
        body: trimmed,
        file_ids: [],
      }
      if (replyToStudent) payload.user_id = replyToStudent
      const created = await createComment(courseId, assignmentId, payload)
      setComments((prev) => [...prev, created])
      setCommentText('')
      setCommentFiles([])
      setShowAddComment(false)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) setAnswerFiles((prev) => [...prev, ...Array.from(selected)])
    e.target.value = ''
  }

  const removeAnswerFile = (index: number) => {
    setAnswerFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const removeAnswerLink = (index: number) => {
    setAnswerLinks((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) setCommentFiles((prev) => [...prev, ...Array.from(selected)])
    e.target.value = ''
  }

  const handleBack = () => {
    navigate(courseId ? `/course/${courseId}` : '/')
  }

  const handleAddLink = () => {
    const trimmed = linkUrl.trim()
    if (trimmed) {
      setAnswerLinks((prev) => [...prev, trimmed])
      setLinkUrl('')
      setShowLinkDialog(false)
    }
  }

  if (!courseId || !assignmentId) return null

  if (loading && !assignment) {
    return (
      <Box className="flex justify-center items-center py-20">
        <CircularProgress />
      </Box>
    )
  }

  if (!assignment) {
    return (
      <Box className="py-8 px-4">
        <Typography color="error">Задание не найдено</Typography>
        <Button onClick={handleBack} className="mt-4">
          Назад к курсу
        </Button>
      </Box>
    )
  }

  return (
    <Container maxWidth="lg" disableGutters>
    <Box className="flex flex-col min-w-0 py-4">
      <Box className="flex items-center gap-2 mb-4">
        <IconButton onClick={handleBack} aria-label="Назад к курсу" size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          {courseWithRole?.title}
        </Typography>
      </Box>

      <Box className="flex flex-col lg:flex-row gap-6">
        <Box className="flex-1 min-w-0">
          <Box className="flex items-start gap-3 mb-6">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 0,
                bgcolor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AssignmentOutlinedIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box className="flex-1 min-w-0">
              <Box className="flex items-start justify-between gap-2">
                <Box>
                  <Typography variant="h6" className="font-semibold text-slate-800">
                    {assignment.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {displayAuthor} · {formatDate(assignment.created_at)}
                  </Typography>
                </Box>
                <IconButton size="small" aria-label="Меню" sx={{ p: 0.5 }}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
              {assignment.deadline && (
                <Typography variant="body2" color="text.secondary" className="mt-1">
                  Срок сдачи: {formatDate(assignment.deadline)}
                </Typography>
              )}
            </Box>
          </Box>

          <Box className="mb-6">
            <Typography variant="body1" className="whitespace-pre-wrap text-slate-700">
              {assignment.body || '—'}
            </Typography>
          </Box>

          {assignmentExt?.attachments && assignmentExt.attachments.length > 0 && (
            <Box className="mb-6">
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Вложения
              </Typography>
              <Box className="flex flex-wrap gap-2">
                {assignmentExt.attachments.map((a) => (
                  <Box
                    key={a.id}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <InsertDriveFileOutlinedIcon fontSize="small" color="action" />
                    <Typography variant="body2" className="font-medium">
                      {a.name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {isTeacher ? (
            <Box className="mb-6">
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Ответы студентов
              </Typography>
              {submissions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Пока нет ответов
                </Typography>
              ) : (
                <Box className="flex flex-col gap-4">
                  {submissions.map((sub) => {
                    const subAuthor =
                      sub.author &&
                      `${sub.author.first_name} ${sub.author.last_name}`.trim()
                    return (
                      <Box
                        key={sub.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <Box className="flex items-start justify-between gap-3">
                          <Box className="flex min-w-0 flex-1 items-start gap-3">
                            <Avatar
                              sx={{
                                width: 40,
                                height: 40,
                                bgcolor: 'primary.main',
                                fontSize: '0.875rem',
                              }}
                            >
                              {getInitials(sub.author)}
                            </Avatar>
                            <Box className="min-w-0 flex-1">
                              <Typography variant="subtitle2" className="font-medium text-slate-800">
                                {subAuthor || 'Студент'}
                              </Typography>
                              <Typography
                                variant="body2"
                                className="mt-2 whitespace-pre-wrap text-slate-600"
                              >
                                {sub.body || '—'}
                              </Typography>
                            </Box>
                          </Box>
                          {sub.grade != null && (
                            <Box
                              sx={{
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 1,
                                bgcolor: 'success.main',
                                color: 'white',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              {sub.grade}
                            </Box>
                          )}
                        </Box>
                        <Divider sx={{ my: 2 }} />
                        <Box className="flex items-center gap-2">
                          {sub.grade != null && editingGradeFor !== sub.id ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setEditingGradeFor(sub.id)
                                setGradeValues((prev) => ({ ...prev, [sub.id]: String(sub.grade) }))
                              }}
                            >
                              Изменить оценку
                            </Button>
                          ) : (
                            <>
                              <TextField
                                size="small"
                                type="number"
                                label="Оценка (0–100)"
                                value={gradeValues[sub.id] ?? sub.grade ?? ''}
                                onChange={(e) => handleGradeChange(sub.id, e.target.value)}
                                error={
                                  (gradeValues[sub.id] ?? '') !== '' &&
                                  !isGradeValid(gradeValues[sub.id] ?? '')
                                }
                                helperText={
                                  (gradeValues[sub.id] ?? '') !== '' &&
                                  !isGradeValid(gradeValues[sub.id] ?? '')
                                    ? 'Оценка должна быть от 0 до 100'
                                    : undefined
                                }
                                inputProps={{ min: 0, max: 100, 'aria-label': 'Оценка' }}
                                sx={{ width: 130 }}
                              />
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleSaveGrade(sub.id)}
                                disabled={
                                  gradeLoading[sub.id] ||
                                  !isGradeValid(gradeValues[sub.id] ?? String(sub.grade ?? ''))
                                }
                              >
                                {gradeLoading[sub.id] ? 'Сохранение…' : 'Сохранить'}
                              </Button>
                              {sub.grade != null && (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => setEditingGradeFor(null)}
                                >
                                  Отмена
                                </Button>
                              )}
                            </>
                          )}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          ) : null}

          <Box className="border-t border-slate-200 pt-6 mt-6">
            <Typography variant="subtitle2" className="text-slate-600 mb-2 flex items-center gap-1">
              <PersonOutlineIcon sx={{ fontSize: 18 }} />
              {isTeacher ? 'Личные комментарии' : 'Комментарии с преподавателем'}
            </Typography>
            {isTeacher ? (
              (() => {
                const teacherIds = courseMembers
                  .filter((m) => m.role === 'teacher' || m.role === 'owner')
                  .map((m) => m.user_id)
                const studentIds = [
                  ...new Set([
                    ...comments.map((c) => c.user_id).filter((id) => !teacherIds.includes(id)),
                    ...submissions.map((s) => s.user_id),
                  ]),
                ]
                const dialogs = studentIds.map((uid) => {
                  const relevant = filterTeacherDialogComments(
                    comments,
                    authUser?.id,
                    uid,
                  )
                  const first = [...relevant].sort(
                    (a, b) =>
                      new Date(a.created_at ?? 0).getTime() -
                      new Date(b.created_at ?? 0).getTime(),
                  )[0]
                  const sub = submissions.find((s) => s.user_id === uid)
                  const name = sub?.author
                    ? `${sub.author.first_name} ${sub.author.last_name}`.trim()
                    : 'Студент'
                  return { uid, name, firstComment: first }
                })
                return (
                  <Box className="flex flex-col gap-2">
                    {dialogs.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Нет диалогов
                      </Typography>
                    ) : (
                      dialogs.map((d) => (
                        <Box
                          key={d.uid}
                          component="button"
                          type="button"
                          className="w-full text-left border rounded-lg p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                          sx={{ borderColor: 'grey.300' }}
                          onClick={() => {
                            setDialogOpenUserId(d.uid)
                            setReplyToStudent(d.uid)
                          }}
                        >
                          <Typography variant="subtitle2" className="font-medium text-slate-900">
                            {d.name}
                          </Typography>
                          {d.firstComment && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              className="mt-0.5 line-clamp-2"
                            >
                              {d.firstComment.body || '(без текста)'}
                            </Typography>
                          )}
                        </Box>
                      ))
                    )}
                  </Box>
                )
              })()
            ) : (
              (() => {
                const teacherIds = courseMembers
                  .filter((m) => m.role === 'teacher' || m.role === 'owner')
                  .map((m) => m.user_id)
                const myConvComments = filterStudentComments(
                  comments,
                  authUser?.id,
                  teacherIds,
                ).sort(
                    (a, b) =>
                      new Date(a.created_at ?? 0).getTime() -
                      new Date(b.created_at ?? 0).getTime(),
                  )
                return (
                  <Box className="flex flex-col gap-2">
                    {myConvComments.length === 0 && !showAddComment ? (
                      <Box
                        component="button"
                        className="flex items-center gap-2 border-0 bg-transparent p-0 cursor-pointer text-left"
                        onClick={() => setShowAddComment(true)}
                      >
                        <Typography variant="body2" color="primary" className="font-medium">
                          Написать преподавателю
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        {myConvComments.map((c) => (
                          <Box
                            key={c.id}
                            sx={{
                              ml: c.user_id === authUser?.id ? 2 : 0,
                              mr: c.user_id === authUser?.id ? 0 : 2,
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor:
                                c.user_id === authUser?.id ? 'primary.main' : 'grey.100',
                              color:
                                c.user_id === authUser?.id
                                  ? 'primary.contrastText'
                                  : 'text.primary',
                              border: '1px solid',
                              borderColor:
                                c.user_id === authUser?.id ? 'primary.dark' : 'grey.300',
                            }}
                          >
                            <Typography variant="body2" sx={{ color: 'inherit' }}>
                              {c.body || '(без текста)'}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color:
                                  c.user_id === authUser?.id
                                    ? 'primary.contrastText'
                                    : 'text.secondary',
                                opacity: 0.9,
                              }}
                            >
                              {c.author
                                ? `${c.author.first_name} ${c.author.last_name}`.trim()
                                : 'Участник'}{' '}
                              · {formatDate(c.created_at)}
                            </Typography>
                          </Box>
                        ))}
                        {showAddComment && (
                          <Box
                            component="form"
                            onSubmit={handleAddComment}
                            className="flex flex-col gap-2 mt-2"
                          >
                            <TextField
                              label="Текст комментария"
                              fullWidth
                              multiline
                              minRows={2}
                              size="small"
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              inputProps={{ 'aria-label': 'Текст комментария' }}
                            />
                            <Box className="flex items-center gap-2">
                              <input
                                ref={commentFileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleCommentFileChange}
                                aria-label="Прикрепить файл к комментарию"
                              />
                              <Button
                                component="span"
                                variant="outlined"
                                size="small"
                                startIcon={<AttachFileOutlinedIcon />}
                                onClick={() => commentFileInputRef.current?.click()}
                              >
                                Файл
                              </Button>
                              {commentFiles.length > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  {commentFiles.map((f) => f.name).join(', ')}
                                </Typography>
                              )}
                              <Button
                                type="submit"
                                variant="contained"
                                size="small"
                                disabled={submittingComment || !commentText.trim()}
                              >
                                Отправить
                              </Button>
                            </Box>
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                )
              })()
            )}
          </Box>
        </Box>

        {!isTeacher && (
          <Box className="lg:w-80 shrink-0 flex flex-col gap-4">
            <Box className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sticky top-4">
              <Box className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="font-bold text-slate-900">
                  Мои задания
                </Typography>
                <Typography variant="body2" className="text-slate-800">
                  {statusLabel}
                </Typography>
              </Box>

              {mySubmission ? (
                <>
                  <Box
                    sx={{
                      display: 'inline-block',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '9999px',
                      bgcolor: 'success.main',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      mb: 2,
                    }}
                  >
                    {mySubmission.grade != null ? `Оценка: ${mySubmission.grade}` : 'Сдано'}
                  </Box>
                  <Typography variant="body2" className="whitespace-pre-wrap text-slate-600">
                    {mySubmission.body || '—'}
                  </Typography>
                  {assignment.deadline && new Date(assignment.deadline) < new Date() && (
                    <Typography variant="caption" color="text.secondary" className="block mt-2">
                      Нельзя сдать работу, так как её срок выполнения уже прошёл.
                    </Typography>
                  )}
                </>
              ) : (
                <Box component="form" onSubmit={handleSubmitAnswer} className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    aria-label="Прикрепить файлы"
                  />
                  <Button
                    variant="outlined"
                    fullWidth
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={(e) => setAddMenuAnchor(e.currentTarget)}
                    sx={{ justifyContent: 'flex-start', mb: 0.5 }}
                  >
                    Добавить или создать
                  </Button>
                  <Menu
                    anchorEl={addMenuAnchor}
                    open={Boolean(addMenuAnchor)}
                    onClose={() => setAddMenuAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    slotProps={{
                      paper: {
                        sx: {
                          mt: 1.5,
                          minWidth: 180,
                          boxShadow: 3,
                          borderRadius: 2,
                        },
                      },
                    }}
                  >
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Добавить
                      </Typography>
                    </Box>
                    <MenuItem
                      onClick={() => {
                        setAddMenuAnchor(null)
                        window.open('https://drive.google.com', '_blank')
                      }}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            background: 'linear-gradient(135deg, #4285f4 0%, #34a853 50%, #fbbc04 100%)',
                          }}
                        >
                          <FolderOutlinedIcon sx={{ color: 'white', fontSize: 16 }} />
                        </Box>
                      </ListItemIcon>
                      <ListItemText primary="Google Диск" />
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAddMenuAnchor(null)
                        setShowLinkDialog(true)
                      }}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <LinkIcon sx={{ color: 'text.secondary' }} />
                      </ListItemIcon>
                      <ListItemText primary="Ссылка" />
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAddMenuAnchor(null)
                        fileInputRef.current?.click()
                      }}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <AttachFileOutlinedIcon sx={{ color: 'text.secondary' }} />
                      </ListItemIcon>
                      <ListItemText primary="Файл" />
                    </MenuItem>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Создать
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                        {'После создания скопируйте ссылку\nи добавьте через «Ссылка»'}
                      </Typography>
                    </Box>
                    <MenuItem
                      onClick={() => {
                        setAddMenuAnchor(null)
                        window.open('https://docs.google.com/document/create', '_blank')
                      }}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <DescriptionOutlinedIcon sx={{ color: '#4285f4' }} />
                      </ListItemIcon>
                      <ListItemText primary="Документы" />
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAddMenuAnchor(null)
                        window.open('https://docs.google.com/presentation/create', '_blank')
                      }}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <SlideshowOutlinedIcon sx={{ color: '#fbbc04' }} />
                      </ListItemIcon>
                      <ListItemText primary="Презентации" />
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAddMenuAnchor(null)
                        window.open('https://docs.google.com/spreadsheets/create', '_blank')
                      }}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <TableChartOutlinedIcon sx={{ color: '#34a853' }} />
                      </ListItemIcon>
                      <ListItemText primary="Таблицы" />
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAddMenuAnchor(null)
                        window.open('https://docs.google.com/drawings/create', '_blank')
                      }}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <ImageOutlinedIcon sx={{ color: '#ea4335' }} />
                      </ListItemIcon>
                      <ListItemText primary="Рисунки" />
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAddMenuAnchor(null)
                        window.open('https://vids.google.com/create', '_blank')
                      }}
                      sx={{ py: 1.5, display: 'flex', alignItems: 'center' }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <VideoFileOutlinedIcon sx={{ color: '#9c27b0' }} />
                      </ListItemIcon>
                      <ListItemText primary="Vids" />
                      <Box
                        component="span"
                        sx={{
                          ml: 'auto',
                          px: 1,
                          py: 0.25,
                          borderRadius: '9999px',
                          bgcolor: 'primary.main',
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        Новое
                      </Box>
                    </MenuItem>
                  </Menu>
                  {(answerFiles.length > 0 || answerLinks.length > 0) && (
                    <Box className="flex flex-wrap gap-2">
                      {answerFiles.map((f, i) => (
                        <Box
                          key={`file-${f.name}-${i}`}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm"
                        >
                          <AttachFileOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" className="truncate max-w-[120px]">
                            {f.name}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label={`Удалить ${f.name}`}
                            onClick={() => removeAnswerFile(i)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                      {answerLinks.map((url, i) => (
                        <Box
                          key={`link-${i}`}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm"
                        >
                          <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" className="truncate max-w-[120px]">
                            {url}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label={`Удалить ссылку`}
                            onClick={() => removeAnswerLink(i)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {submitError && (
                    <Typography variant="body2" color="error">
                      {submitError}
                    </Typography>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    color="primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Отправка…' : 'Отметить как выполненное'}
                  </Button>
                  {assignment.deadline && new Date(assignment.deadline) < new Date() && (
                    <Typography variant="caption" color="text.secondary" className="block">
                      Нельзя сдать работу, так как её срок выполнения уже прошёл.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      <Dialog
        open={showLinkDialog}
        onClose={() => {
          setShowLinkDialog(false)
          setLinkUrl('')
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Добавить ссылку</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="URL"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLinkDialog(false)}>Отмена</Button>
          <Button onClick={handleAddLink} variant="contained" disabled={!linkUrl.trim()}>
            Добавить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialogOpenUserId != null}
        onClose={() => {
          setDialogOpenUserId(null)
          setReplyToStudent(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { maxHeight: '80vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {(() => {
            if (isTeacher && dialogOpenUserId) {
              const sub = submissions.find((s) => s.user_id === dialogOpenUserId)
              return sub?.author
                ? `${sub.author.first_name} ${sub.author.last_name}`.trim()
                : 'Студент'
            }
            return 'Диалог с преподавателем'
          })()}
          <IconButton
            size="small"
            onClick={() => {
              setDialogOpenUserId(null)
              setReplyToStudent(null)
            }}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box className="flex flex-col gap-2">
            {(() => {
              const teacherIds = courseMembers
                .filter((m) => m.role === 'teacher' || m.role === 'owner')
                .map((m) => m.user_id)
              const dialogComments =
                isTeacher && dialogOpenUserId
                  ? filterTeacherDialogComments(
                      comments,
                      authUser?.id,
                      dialogOpenUserId,
                    ).sort(
                      (a, b) =>
                        new Date(a.created_at ?? 0).getTime() -
                        new Date(b.created_at ?? 0).getTime(),
                    )
                  : filterStudentComments(
                      comments,
                      authUser?.id,
                      teacherIds,
                    ).sort(
                      (a, b) =>
                        new Date(a.created_at ?? 0).getTime() -
                        new Date(b.created_at ?? 0).getTime(),
                    )
              return dialogComments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Нет сообщений
                </Typography>
              ) : (
                dialogComments.map((c) => (
                  <Box
                    key={c.id}
                    sx={{
                      ml: c.user_id === authUser?.id ? 2 : 0,
                      mr: c.user_id === authUser?.id ? 0 : 2,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: c.user_id === authUser?.id ? 'primary.main' : 'grey.100',
                      color:
                        c.user_id === authUser?.id ? 'primary.contrastText' : 'text.primary',
                      border: '1px solid',
                      borderColor:
                        c.user_id === authUser?.id ? 'primary.dark' : 'grey.300',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: 'inherit' }}>
                      {c.body || '(без текста)'}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color:
                          c.user_id === authUser?.id
                            ? 'primary.contrastText'
                            : 'text.secondary',
                        opacity: 0.9,
                      }}
                    >
                      {c.author
                        ? `${c.author.first_name} ${c.author.last_name}`.trim()
                        : 'Участник'}{' '}
                      · {formatDate(c.created_at)}
                    </Typography>
                  </Box>
                ))
              )
            })()}
          </Box>
          <Box
            component="form"
            onSubmit={handleAddComment}
            className="flex flex-col gap-2 mt-4"
          >
            <TextField
              label="Текст ответа"
              fullWidth
              multiline
              minRows={2}
              size="small"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              inputProps={{ 'aria-label': 'Текст комментария' }}
            />
            <Box className="flex items-center gap-2">
              <input
                ref={commentFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleCommentFileChange}
                aria-label="Прикрепить файл"
              />
              <Button
                component="span"
                variant="outlined"
                size="small"
                startIcon={<AttachFileOutlinedIcon />}
                onClick={() => commentFileInputRef.current?.click()}
              >
                Файл
              </Button>
              {commentFiles.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {commentFiles.map((f) => f.name).join(', ')}
                </Typography>
              )}
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={submittingComment || !commentText.trim()}
              >
                Отправить
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
    </Container>
  )
}
