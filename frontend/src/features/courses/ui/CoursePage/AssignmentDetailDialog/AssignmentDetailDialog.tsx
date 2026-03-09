import { useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import {
  getAssignment,
  listSubmissions,
  submitAssignment,
  updateSubmission,
  gradeSubmission,
  returnSubmission,
  listAssignmentComments,
  createAssignmentComment,
  listCourseMembers,
  uploadFiles,
} from '../../../api/coursesApi'
import { useAuth } from '../../../../auth/model/AuthContext'
import {
  type Assignment,
  type Comment,
  type FeedItem,
  type Member,
  type Submission,
  getGeneralComments,
  filterStudentComments,
  filterTeacherDialogComments,
  getNameByUserId,
  getInitialsFromMember,
} from '../../../model/types'

function GeneralCommentItem({
  comment,
  depth,
  replyToParentId,
  onReply,
  onCancelReply,
  renderReplyForm,
  courseMembers,
  authUserId,
  formatDate,
}: {
  comment: Comment
  depth: number
  replyToParentId: string | null
  onReply: (parentId: string) => void
  onCancelReply: () => void
  renderReplyForm: (parentId: string) => React.ReactNode
  courseMembers: Member[]
  authUserId?: string
  formatDate: (s?: string) => string
}) {
  const authorName = getNameByUserId(courseMembers, comment.user_id, comment.author)
  const isReplyingToThis = replyToParentId === comment.id
  const isOwn = authUserId && comment.user_id === authUserId
  return (
    <Box className="flex flex-col gap-1" sx={{ ml: depth * 2 }}>
      <Box
        className="p-3 rounded-lg"
        sx={{
          bgcolor: 'grey.50',
          border: '1px solid',
          borderColor: 'grey.200',
          ...(isOwn && {
            borderLeft: '4px solid',
            borderLeftColor: 'primary.main',
            pl: 2.5,
          }),
        }}
      >
        <Typography variant="body2" className="text-slate-700">
          {comment.body || '(без текста)'}
        </Typography>
        <Box className="flex items-center gap-2 mt-1 flex-wrap">
          <Typography variant="caption" color="text.secondary">
            {authorName} · {formatDate(comment.created_at)}
          </Typography>
          <Button
            size="small"
            variant="text"
            startIcon={<ReplyOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={() => onReply(comment.id)}
            sx={{ minWidth: 'auto', p: 0, fontSize: '0.75rem' }}
          >
            Ответить
          </Button>
        </Box>
      </Box>
      {isReplyingToThis && (
        <Box className="mt-2 pl-2" sx={{ borderLeft: '2px solid', borderColor: 'primary.light' }}>
          <Typography variant="caption" color="text.secondary" className="block mb-1">
            Ответ на комментарий {authorName}
          </Typography>
          {renderReplyForm(comment.id)}
          <Button size="small" variant="text" onClick={onCancelReply} sx={{ mt: 0.5 }}>
            Отмена
          </Button>
        </Box>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <Box className="flex flex-col gap-2 mt-1">
          {comment.replies.map((r) => (
            <GeneralCommentItem
              key={r.id}
              comment={r}
              depth={depth + 1}
              replyToParentId={replyToParentId}
              onReply={onReply}
              onCancelReply={onCancelReply}
              renderReplyForm={renderReplyForm}
              courseMembers={courseMembers}
              authUserId={authUserId}
              formatDate={formatDate}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

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


function getStatusLabel(
  submission: Submission | null,
  deadline: string | null | undefined,
): string {
  if (!submission) {
    if (deadline && new Date(deadline) < new Date()) return 'Просрочено'
    return 'Не сдано'
  }
  if (submission.status === 'returned') return 'Возвращено на доработку'
  if (submission.submitted_at) {
    if (submission.grade != null) return `Сдано · Оценка: ${submission.grade}`
    return 'Сдано · Проверяется'
  }
  return 'Не сдано'
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
  const [gradeComments, setGradeComments] = useState<Record<string, string>>({})
  const [gradeStatuses, setGradeStatuses] = useState<Record<string, 'passed' | 'failed' | null>>({})
  const [gradeLoading, setGradeLoading] = useState<Record<string, boolean>>({})
  const [returnLoading, setReturnLoading] = useState<Record<string, boolean>>({})
  const [editingGradeFor, setEditingGradeFor] = useState<string | null>(null)
  const [showAddComment, setShowAddComment] = useState(false)
  const [showAddGeneralComment, setShowAddGeneralComment] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [courseMembers, setCourseMembers] = useState<Member[]>([])
  const [replyToStudent, setReplyToStudent] = useState<string | null>(null)
  const [replyToParentId, setReplyToParentId] = useState<string | null>(null)
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
      listAssignmentComments(courseId, assignmentId),
    ])
      .then(([a, s, members, c]) => {
        setAssignment(a)
        setSubmissions(s)
        setCourseMembers(members ?? [])
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
  const canEdit =
    !loading &&
    (mySubmission?.status === 'returned' || mySubmission?.status === 'draft' || !mySubmission)
  const canSubmit = canEdit
  const statusLabel = getStatusLabel(mySubmission ?? null, assignment?.deadline ?? null)

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignmentId || !courseId || submitting) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const fileIds = answerFiles.length > 0 ? await uploadFiles(answerFiles) : []
      if (mySubmission?.status === 'returned' && mySubmission.id) {
        const updated = await updateSubmission(courseId, assignmentId, mySubmission.id, {
          body: answerText.trim() || undefined,
          file_ids: fileIds,
        })
        setSubmissions((prev) =>
          prev.map((s) => (s.id === mySubmission.id ? updated : s)),
        )
      } else {
        await submitAssignment(courseId, assignmentId, {
          body: answerText.trim() || undefined,
          file_ids: fileIds,
        })
        const updated = await listSubmissions(courseId, assignmentId)
        setSubmissions(updated)
      }
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

  const maxGrade = (assignment as { max_grade?: number } | null)?.max_grade ?? 100

  const isGradeValid = (val: string, status: 'passed' | 'failed' | null): boolean => {
    if (status === 'passed' || status === 'failed') return true
    if (!val.trim()) return false
    const n = parseInt(val, 10)
    return !isNaN(n) && n >= 0 && n <= maxGrade
  }

  const handleGradeChange = (submissionId: string, value: string) => {
    setGradeValues((prev) => ({ ...prev, [submissionId]: value }))
  }

  const handleGradeStatusChange = (submissionId: string, status: 'passed' | 'failed' | null) => {
    setGradeStatuses((prev) => ({ ...prev, [submissionId]: status }))
  }

  const handleGradeCommentChange = (submissionId: string, value: string) => {
    setGradeComments((prev) => ({ ...prev, [submissionId]: value }))
  }

  const handleSaveGrade = async (submissionId: string) => {
    const status = gradeStatuses[submissionId]
    const val = gradeValues[submissionId]
    let grade: number
    if (status === 'passed') {
      grade = maxGrade
    } else if (status === 'failed') {
      grade = 0
    } else {
      const parsed = val ? parseInt(val, 10) : NaN
      if (isNaN(parsed) || parsed < 0 || parsed > maxGrade || !courseId || !assignmentId) return
      grade = parsed
    }

    const commentParts: string[] = []
    if (status === 'passed') commentParts.push('Зачтено')
    else if (status === 'failed') commentParts.push('Не зачтено')
    const customComment = (gradeComments[submissionId] ?? '').trim()
    if (customComment) commentParts.push(customComment)
    const grade_comment = commentParts.length > 0 ? commentParts.join('\n') : undefined

    setGradeLoading((prev) => ({ ...prev, [submissionId]: true }))
    try {
      await gradeSubmission(courseId, assignmentId, submissionId, { grade, grade_comment })
      const updated = await listSubmissions(courseId, assignmentId)
      setSubmissions(updated)
      onUpdated()
    } catch {
    } finally {
      setGradeLoading((prev) => ({ ...prev, [submissionId]: false }))
      setEditingGradeFor(null)
    }
  }

  const handleReturnSubmission = async (submissionId: string) => {
    if (!courseId || !assignmentId) return
    setReturnLoading((prev) => ({ ...prev, [submissionId]: true }))
    try {
      await returnSubmission(courseId, assignmentId, submissionId)
      const updated = await listSubmissions(courseId, assignmentId)
      setSubmissions(updated)
      onUpdated()
    } catch {
    } finally {
      setReturnLoading((prev) => ({ ...prev, [submissionId]: false }))
    }
  }

  const handleAddComment = async (
    e: React.FormEvent,
    opts?: { isGeneral?: boolean; parent_id?: string | null },
  ) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || !assignmentId || !courseId || submittingComment) return

    setSubmittingComment(true)
    try {
      const fileIds = commentFiles.length > 0 ? await uploadFiles(commentFiles) : []
      await createAssignmentComment(courseId, assignmentId, {
        body: trimmed,
        file_ids: fileIds,
        reply_to_user_id: opts?.isGeneral ? undefined : replyToStudent ?? undefined,
        parent_id: opts?.isGeneral ? opts.parent_id : undefined,
      })
      const refreshed = await listAssignmentComments(courseId, assignmentId)
      setComments(refreshed)
      setCommentText('')
      setCommentFiles([])
      setReplyToParentId(null)
      setShowAddComment(false)
      setShowAddGeneralComment(false)
    } catch {
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
    setGradeComments({})
    setGradeStatuses({})
    setEditingGradeFor(null)
    setReplyToStudent(null)
    setReplyToParentId(null)
    setShowAddComment(false)
    setShowAddGeneralComment(false)
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
                      const member = courseMembers.find((m) => m.user_id === sub.user_id)
                      const authorName =
                        getNameByUserId(courseMembers, sub.user_id, sub.author) || 'Студент'
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
                                {getInitialsFromMember(courseMembers, sub.user_id, sub.author)}
                              </Avatar>
                              <Box className="min-w-0 flex-1">
                                <Typography variant="subtitle2" className="font-medium text-slate-800">
                                  {authorName}
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
                          {sub.grade_comment && (
                            <Typography variant="body2" color="text.secondary" className="mt-2">
                              {sub.grade_comment}
                            </Typography>
                          )}
                          <Divider sx={{ my: 2 }} />
                          <Box className="flex flex-wrap items-start gap-2">
                            {sub.grade != null && editingGradeFor !== sub.id ? (
                              <>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setEditingGradeFor(sub.id)
                                    setGradeValues((prev) => ({ ...prev, [sub.id]: String(sub.grade) }))
                                    setGradeComments((prev) => ({ ...prev, [sub.id]: sub.grade_comment ?? '' }))
                                  }}
                                >
                                  Изменить оценку
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  startIcon={<UndoOutlinedIcon />}
                                  onClick={() => handleReturnSubmission(sub.id)}
                                  disabled={returnLoading[sub.id]}
                                >
                                  {returnLoading[sub.id] ? '…' : 'Вернуть'}
                                </Button>
                              </>
                            ) : (
                              <>
                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                  <InputLabel>Статус</InputLabel>
                                  <Select
                                    value={gradeStatuses[sub.id] ?? ''}
                                    label="Статус"
                                    onChange={(e) =>
                                      handleGradeStatusChange(
                                        sub.id,
                                        (e.target.value as 'passed' | 'failed' | '') || null,
                                      )
                                    }
                                  >
                                    <MenuItem value="">
                                      <em>Числовая оценка</em>
                                    </MenuItem>
                                    <MenuItem value="passed">Зачтено</MenuItem>
                                    <MenuItem value="failed">Не зачтено</MenuItem>
                                  </Select>
                                </FormControl>
                                <TextField
                                  size="small"
                                  type="number"
                                  label={`Оценка (0–${maxGrade})`}
                                  value={
                                    gradeStatuses[sub.id]
                                      ? gradeStatuses[sub.id] === 'passed'
                                        ? maxGrade
                                        : 0
                                      : gradeValues[sub.id] ?? sub.grade ?? ''
                                  }
                                  onChange={(e) => handleGradeChange(sub.id, e.target.value)}
                                  inputProps={{
                                    min: 0,
                                    max: maxGrade,
                                    'aria-label': 'Оценка',
                                    readOnly: !!gradeStatuses[sub.id],
                                  }}
                                  sx={{ width: 130 }}
                                />
                                <TextField
                                  size="small"
                                  label="Комментарий к оценке"
                                  placeholder="Комментарий преподавателя..."
                                  value={gradeComments[sub.id] ?? ''}
                                  onChange={(e) => handleGradeCommentChange(sub.id, e.target.value)}
                                  sx={{ minWidth: 200, flex: 1 }}
                                />
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleSaveGrade(sub.id)}
                                  disabled={
                                    gradeLoading[sub.id] ||
                                    !(
                                      gradeStatuses[sub.id] ||
                                      isGradeValid(
                                        gradeValues[sub.id] ?? String(sub.grade ?? ''),
                                        gradeStatuses[sub.id] ?? null,
                                      )
                                    )
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
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  startIcon={<UndoOutlinedIcon />}
                                  onClick={() => handleReturnSubmission(sub.id)}
                                  disabled={returnLoading[sub.id]}
                                >
                                  {returnLoading[sub.id] ? '…' : 'Вернуть'}
                                </Button>
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

            <Box className="border-t border-slate-200 pt-4 flex flex-col gap-4">
              <Box>
                <Typography variant="subtitle2" className="text-slate-600 mb-2 flex items-center gap-1">
                  <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
                  Общие комментарии
                </Typography>
                {(() => {
                  const generalComments = getGeneralComments(comments).sort(
                    (a, b) =>
                      new Date(a.created_at ?? 0).getTime() -
                      new Date(b.created_at ?? 0).getTime(),
                  )
                  const renderReplyForm = (parentId: string) => (
                    <Box
                      component="form"
                      onSubmit={(e) => handleAddComment(e, { isGeneral: true, parent_id: parentId })}
                      className="flex flex-col gap-2"
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
                  )
                  return (
                    <Box className="flex flex-col gap-2">
                      {generalComments.length === 0 && !showAddGeneralComment ? (
                        <Box
                          component="button"
                          className="flex items-center gap-2 border-0 bg-transparent p-0 cursor-pointer text-left"
                          onClick={() => setShowAddGeneralComment(true)}
                        >
                          <Typography variant="body2" color="primary" className="font-medium">
                            Добавить комментарий
                          </Typography>
                        </Box>
                      ) : (
                        <>
                          <Box className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                            {generalComments.map((c) => (
                              <GeneralCommentItem
                                key={c.id}
                                comment={c}
                                depth={0}
                                replyToParentId={replyToParentId}
                                onReply={setReplyToParentId}
                                onCancelReply={() => setReplyToParentId(null)}
                                renderReplyForm={renderReplyForm}
                                courseMembers={courseMembers}
                                authUserId={authUser?.id}
                                formatDate={formatDate}
                              />
                            ))}
                          </Box>
                          {!showAddGeneralComment && generalComments.length > 0 && (
                            <Box
                              component="button"
                              className="flex items-center gap-2 border-0 bg-transparent p-0 cursor-pointer text-left mt-2"
                              onClick={() => setShowAddGeneralComment(true)}
                            >
                              <Typography variant="body2" color="primary" className="font-medium">
                                Добавить комментарий
                              </Typography>
                            </Box>
                          )}
                          {showAddGeneralComment && (
                            <Box
                              component="form"
                              onSubmit={(e) => handleAddComment(e, { isGeneral: true })}
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
                })()}
              </Box>

              <Box>
                <Typography variant="subtitle2" className="text-slate-600 mb-2 flex items-center gap-1">
                  <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
                  {isTeacher ? 'Личные комментарии' : 'Личные комментарии с преподавателем'}
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
                      const name =
                        getNameByUserId(courseMembers, uid, sub?.author) || 'Студент'
                      return { uid, name, firstComment: first }
                    })
                    return (
                      <Box className="flex flex-col gap-2">
                        {dialogs.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            Нет личных диалогов
                          </Typography>
                        ) : (
                          dialogs.map((d) => (
                            <Box
                              key={d.uid}
                              component="button"
                              type="button"
                              className="w-full text-left border rounded-lg p-2 hover:bg-slate-50 transition-colors cursor-pointer"
                              sx={{ borderColor: 'grey.300' }}
                              onClick={() => setReplyToStudent(d.uid)}
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
                        {studentIds.length > 0 && (
                          <Box
                            component="form"
                            onSubmit={(e) => handleAddComment(e)}
                            className="flex flex-col gap-2 mt-2"
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
                                  const name =
                                    getNameByUserId(courseMembers, uid, sub?.author) || 'Студент'
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
                            .map((c) => {
                              const isOwn = c.user_id === authUser?.id
                              return (
                                <Box
                                  key={c.id}
                                  className="p-3 rounded-lg"
                                  sx={{
                                    bgcolor: 'grey.50',
                                    border: '1px solid',
                                    borderColor: 'grey.200',
                                    ...(isOwn && {
                                      borderLeft: '4px solid',
                                      borderLeftColor: 'primary.main',
                                      pl: 2.5,
                                    }),
                                  }}
                                >
                                  <Typography variant="body2" className="text-slate-700">
                                    {c.body || '(без текста)'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {getNameByUserId(courseMembers, c.user_id, c.author)}{' '}
                                    · {formatDate(c.created_at)}
                                  </Typography>
                                </Box>
                              )
                            })}
                          {showAddComment && (
                            <Box
                              component="form"
                              onSubmit={(e) => handleAddComment(e)}
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
            </Box>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
