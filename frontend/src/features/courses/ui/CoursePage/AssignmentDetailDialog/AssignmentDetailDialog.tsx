import { useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CloseIcon from '@mui/icons-material/Close'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import {
  getAssignment,
  listSubmissions,
  submitAssignment,
  gradeSubmission,
  listComments,
  createComment,
  listCourseMembers,
} from '../../../api/coursesApi'
import { useAuth } from '../../../../auth/model/AuthContext'
import {
  type Assignment,
  type Comment,
  type FeedItem,
  type Submission,
  filterStudentComments,
  filterTeacherDialogComments,
} from '../../../model/types'

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
    return 'Не сдано'
  }
  if (submission.grade != null) return `Оценка: ${submission.grade}`
  return 'Проверяется'
}

type AssignmentDetailDialogProps = {
  open: boolean
  onClose: () => void
  courseId: string
  item: FeedItem | null
  isTeacher: boolean
  onUpdated: () => void
}

export function AssignmentDetailDialog({
  open,
  onClose,
  courseId,
  item,
  isTeacher,
  onUpdated,
}: AssignmentDetailDialogProps) {
  const { user: authUser } = useAuth()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [answerFiles, setAnswerFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [gradeValues, setGradeValues] = useState<Record<string, string>>({})
  const [gradeLoading, setGradeLoading] = useState<Record<string, boolean>>({})
  const [editingGradeFor, setEditingGradeFor] = useState<string | null>(null)
  const [showAddComment, setShowAddComment] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [courseMembers, setCourseMembers] = useState<{ user_id: string; role: string }[]>([])
  const [replyToStudent, setReplyToStudent] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentFileInputRef = useRef<HTMLInputElement>(null)

  const assignmentId = item?.id ?? ''

  useEffect(() => {
    if (!open || !assignmentId || !courseId) return

    setLoading(true)
    Promise.all([
      getAssignment(courseId, assignmentId),
      listSubmissions(courseId, assignmentId),
      listCourseMembers(courseId),
      listComments(courseId, assignmentId),
    ])
      .then(([a, s, members, c]) => {
        setAssignment(a)
        setSubmissions(s)
        setCourseMembers((members as { user_id: string; role: string }[]) ?? [])
        setComments(c)
        const mySub = s.find((x) => x.user_id === authUser?.id)
        if (mySub) {
          setAnswerText(mySub.body ?? '')
        }
      })
      .catch(() => {
        setAssignment(null)
        setSubmissions([])
        setComments([])
      })
      .finally(() => setLoading(false))
  }, [open, assignmentId, courseId, authUser?.id])

  const mySubmission = submissions.find((s) => s.user_id === authUser?.id)
  const canSubmit = !mySubmission && !loading
  const statusLabel = getStatusLabel(mySubmission ?? null, assignment?.deadline ?? null)

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignmentId || !courseId || submitting) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      await submitAssignment(courseId, assignmentId, {
        body: answerText.trim() || undefined,
        file_ids: [],
      })
      const updated = await listSubmissions(courseId, assignmentId)
      setSubmissions(updated)
      setAnswerText('')
      setAnswerFiles([])
      onUpdated()
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
      onUpdated()
    } catch {
      // TODO: show error
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
      const created = await createComment(courseId, assignmentId, {
        body: trimmed,
        file_ids: [],
      })
      setComments((prev) => [...prev, created])
      setCommentText('')
      setCommentFiles([])
      setShowAddComment(false)
    } catch {
      // TODO: show error
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

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) setCommentFiles((prev) => [...prev, ...Array.from(selected)])
    e.target.value = ''
  }

  const removeCommentFile = (index: number) => {
    setCommentFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleClose = () => {
    setAnswerText('')
    setAnswerFiles([])
    setSubmitError(null)
    setGradeValues({})
    setEditingGradeFor(null)
    setReplyToStudent(null)
    setShowAddComment(false)
    setCommentText('')
    setCommentFiles([])
    onClose()
  }

  if (!item) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="assignment-dialog-title"
    >
      <DialogTitle id="assignment-dialog-title">{item.title}</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        {loading ? (
          <Typography color="text.secondary">Загрузка…</Typography>
        ) : assignment ? (
          <>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" className="mb-1">
                Описание
              </Typography>
              <Typography variant="body1" className="whitespace-pre-wrap">
                {assignment.body || '—'}
              </Typography>
              {assignment.deadline && (
                <Typography variant="caption" color="text.secondary" className="mt-2 block">
                  Дедлайн: {formatDate(assignment.deadline)}
                </Typography>
              )}
            </Box>

            {item.attachments && item.attachments.length > 0 && (
              <Box>
                <Typography variant="subtitle2" className="text-slate-600 mb-2">
                  Вложения
                </Typography>
                <Box className="flex flex-wrap gap-2">
                  {item.attachments.map((a) => (
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
              <Box>
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
                      const authorName =
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
                                  {authorName || 'Студент'}
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
                                  inputProps={{ min: 0, max: 100, 'aria-label': 'Оценка' }}
                                  sx={{ width: 130 }}
                                />
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleSaveGrade(sub.id)}
                                  disabled={gradeLoading[sub.id]}
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
            ) : (
              <Box>
                <Typography variant="subtitle2" className="text-slate-600 mb-2">
                  Статус: {statusLabel}
                </Typography>
                {mySubmission && (
                  <Box className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-4">
                    <Typography variant="body2" className="whitespace-pre-wrap">
                      {mySubmission.body || '—'}
                    </Typography>
                    {mySubmission.submitted_at && (
                      <Typography variant="caption" color="text.secondary">
                        Отправлено: {formatDate(mySubmission.submitted_at)}
                      </Typography>
                    )}
                  </Box>
                )}
                {canSubmit && (
                  <Box component="form" onSubmit={handleSubmitAnswer} className="flex flex-col gap-3">
                    <TextField
                      label="Текст ответа"
                      fullWidth
                      multiline
                      minRows={4}
                      size="small"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      inputProps={{ 'aria-label': 'Текст ответа' }}
                    />
                    <Box>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        aria-label="Прикрепить файлы"
                      />
                      <Button
                        component="span"
                        variant="outlined"
                        size="small"
                        startIcon={<AttachFileOutlinedIcon />}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Прикрепить файлы
                      </Button>
                      {answerFiles.length > 0 && (
                        <Box className="mt-2 flex flex-wrap gap-2">
                          {answerFiles.map((f, i) => (
                            <Box
                              key={`${f.name}-${i}`}
                              className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm"
                            >
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
                        </Box>
                      )}
                    </Box>
                    {submitError && (
                      <Typography variant="body2" color="error">
                        {submitError}
                      </Typography>
                    )}
                    <Box className="flex gap-2">
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={handleClose}
                        disabled={submitting}
                      >
                        Отмена
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        startIcon={<SendOutlinedIcon />}
                        disabled={submitting}
                      >
                        {submitting ? 'Отправка…' : 'Отправить'}
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            <Box className="border-t border-slate-200 pt-4">
              <Typography variant="subtitle2" className="text-slate-600 mb-2 flex items-center gap-1">
                <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
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
                  const allComments = [...comments].sort(
                    (a, b) =>
                      new Date(a.created_at ?? 0).getTime() -
                      new Date(b.created_at ?? 0).getTime(),
                  )
                  return (
                    <Box className="flex flex-col gap-3">
                      {allComments.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Нет комментариев
                        </Typography>
                      ) : (
                        <Box className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                          {allComments.map((c) => (
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
                        </Box>
                      )}
                      {studentIds.length > 0 && (
                        <Box
                          component="form"
                          onSubmit={handleAddComment}
                          className="flex flex-col gap-2"
                        >
                          {studentIds.length > 1 && (
                            <TextField
                              select
                              size="small"
                              label="Ответить студенту"
                              value={replyToStudent ?? ''}
                              onChange={(e) => setReplyToStudent(e.target.value || null)}
                              sx={{ minWidth: 200 }}
                            >
                              <MenuItem value="">— Выберите —</MenuItem>
                              {studentIds.map((uid) => {
                                const sub = submissions.find((s) => s.user_id === uid)
                                const name = sub?.author
                                  ? `${sub.author.first_name} ${sub.author.last_name}`.trim()
                                  : 'Студент'
                                return (
                                  <MenuItem key={uid} value={uid}>
                                    {name}
                                  </MenuItem>
                                )
                              })}
                            </TextField>
                          )}
                          <TextField
                            label={studentIds.length === 1 ? 'Ответить студенту' : 'Текст ответа'}
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
                            <Button
                              type="submit"
                              variant="contained"
                              size="small"
                              disabled={
                                submittingComment ||
                                !commentText.trim() ||
                                (studentIds.length > 1 && !replyToStudent)
                              }
                            >
                              Отправить
                            </Button>
                          </Box>
                        </Box>
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
                          {myConvComments
                            .sort(
                              (a, b) =>
                                new Date(a.created_at ?? 0).getTime() -
                                new Date(b.created_at ?? 0).getTime(),
                            )
                            .map((c) => (
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
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
