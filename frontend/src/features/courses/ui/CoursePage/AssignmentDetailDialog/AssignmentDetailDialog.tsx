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
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import {
  getAssignment,
  listSubmissions,
  submitAssignment,
  gradeSubmission,
  returnSubmission,
  listAssignmentComments,
  createAssignmentComment,
  listCourseMembers,
  uploadFiles,
} from '../../../api/coursesApi'
import { FileAttachmentLink } from '../../FileAttachmentLink/FileAttachmentLink'
import { parseSubmissionBodyLinks, getLinkHref } from '../../../utils/urlValidation'
import { formatGradeDisplay, isPassFailGrading } from '../../../utils/gradeUtils'
import { SubmitAssignmentConfirmDialog } from '../../SubmitAssignmentConfirmDialog/SubmitAssignmentConfirmDialog'
import { ReturnSubmissionConfirmDialog } from '../../ReturnSubmissionConfirmDialog/ReturnSubmissionConfirmDialog'
import { useAuth } from '../../../../auth/model/AuthContext'
import {
  type Assignment,
  type Comment,
  type FeedItem,
  type Member,
  type Submission,
  buildCommentTree,
  getGeneralComments,
  getPersonalCommentsTreeForStudent,
  getPersonalCommentsTreeForTeacher,
  filterTeacherDialogComments,
  getNameByUserId,
  getInitialsFromMember,
  isSubmissionDraft,
  isSubmissionReturned,
} from '../../../model/types'

function PersonalCommentItem({
  comment,
  depth,
  replyToParentId,
  onReply,
  onCancelReply,
  courseMembers,
  authUserId,
  formatDate,
}: {
  comment: Comment
  depth: number
  replyToParentId: string | null
  onReply: (parentId: string) => void
  onCancelReply: () => void
  courseMembers: Member[]
  authUserId?: string
  formatDate: (s?: string) => string
}) {
  const authorName = getNameByUserId(courseMembers, comment.user_id, comment.author)
  const isOwn = authUserId && comment.user_id === authUserId
  const isReplyingToThis = replyToParentId === comment.id
  return (
    <Box
      className="flex flex-col gap-1"
      sx={{
        ml: depth > 0 ? 3 : 0,
        pl: depth > 0 ? 2 : 0,
        borderLeft: depth > 0 ? '2px solid' : 'none',
        borderColor: 'grey.300',
      }}
    >
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
          <Typography variant="caption" color="primary" className="block">
            Ответ на комментарий {authorName}
          </Typography>
          <Button size="small" variant="text" onClick={onCancelReply} sx={{ mt: 0.5, p: 0 }}>
            Отмена
          </Button>
        </Box>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <Box className="flex flex-col gap-2 mt-2">
          {comment.replies.map((r) => (
            <PersonalCommentItem
              key={r.id}
              comment={r}
              depth={depth + 1}
              replyToParentId={replyToParentId}
              onReply={onReply}
              onCancelReply={onCancelReply}
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
    <Box
      className="flex flex-col gap-1"
      sx={{
        ml: depth > 0 ? 3 : 0,
        pl: depth > 0 ? 2 : 0,
        borderLeft: depth > 0 ? '2px solid' : 'none',
        borderColor: 'grey.300',
      }}
    >
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
        <Box className="flex flex-col gap-2 mt-2">
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
  maxGrade: number = 100,
): string {
  if (!submission) {
    if (deadline && new Date(deadline) < new Date()) return 'Просрочено'
    return 'Не сдано'
  }
  if (isSubmissionReturned(submission)) return 'Возвращено на доработку'
  if (isSubmissionDraft(submission)) return 'Черновик'
  if (submission.submitted_at) {
    if (submission.grade != null)
      return `Сдано · ${formatGradeDisplay(submission.grade, maxGrade)}`
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
  const [showAddGeneralComment, setShowAddGeneralComment] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [courseMembers, setCourseMembers] = useState<Member[]>([])
  const [replyToStudent, setReplyToStudent] = useState<string | null>(null)
  const [replyToParentId, setReplyToParentId] = useState<string | null>(null)
  const [personalCommentsDialogStudentId, setPersonalCommentsDialogStudentId] = useState<
    string | null
  >(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [returnConfirmSubmissionId, setReturnConfirmSubmissionId] = useState<string | null>(null)
  const [draftSaving, setDraftSaving] = useState(false)
  const [assignmentAttachmentsExpanded, setAssignmentAttachmentsExpanded] = useState(true)
  const [submissionAttachmentsCollapsed, setSubmissionAttachmentsCollapsed] = useState<
    Record<string, boolean>
  >({})
  const [draftAttachmentsExpanded, setDraftAttachmentsExpanded] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleSubmissionAttachments = (submissionId: string) => {
    setSubmissionAttachmentsCollapsed((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }))
  }

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
  }, [open, assignmentId, courseId])

  const mySubmission = submissions.find((s) => s.user_id === authUser?.id)
  const canEdit =
    !loading &&
    (isSubmissionReturned(mySubmission) || isSubmissionDraft(mySubmission) || !mySubmission)
  const canSubmit = canEdit
  const maxGrade = (assignment as { max_grade?: number } | null)?.max_grade ?? 100
  const statusLabel = getStatusLabel(
    mySubmission ?? null,
    assignment?.deadline ?? null,
    maxGrade,
  )

  const performSubmit = async () => {
    if (!assignmentId || !courseId || submitting) return
    setSubmitError(null)
    setSubmitting(true)
    setShowSubmitConfirm(false)
    try {
      const newFileIds = answerFiles.length > 0 ? await uploadFiles(answerFiles) : []
      const existingIds = mySubmission?.file_ids ?? []
      const fileIds = [...existingIds, ...newFileIds]
      const created = await submitAssignment(courseId, assignmentId, {
        body: answerText.trim() || undefined,
        file_ids: fileIds,
        is_attached: true,
      })
      setSubmissions((prev) =>
        mySubmission
          ? prev.map((s) => (s.id === mySubmission.id ? created : s))
          : [created],
      )
      setAnswerText('')
      setAnswerFiles([])
      onUpdated()
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message === 'DEADLINE_EXCEEDED'
          ? 'Дедлайн истёк, сдача невозможна'
          : err instanceof Error && err.message === 'ALREADY_SUBMITTED'
            ? 'Ответ уже отправлен'
            : 'Не удалось отправить ответ',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignmentId || !courseId || submitting) return
    if (assignment?.deadline && new Date(assignment.deadline) < new Date()) {
      setSubmitError('Дедлайн истёк, сдача невозможна')
      return
    }
    setSubmitError(null)
    setShowSubmitConfirm(true)
  }

  const handleSaveDraft = async () => {
    if (!assignmentId || !courseId || submitting || draftSaving) return
    setDraftSaving(true)
    setSubmitError(null)
    try {
      const newFileIds = answerFiles.length > 0 ? await uploadFiles(answerFiles) : []
      const existingIds = mySubmission?.file_ids ?? []
      const fileIds = [...existingIds, ...newFileIds]
      const created = await submitAssignment(courseId, assignmentId, {
        body: answerText.trim() || undefined,
        file_ids: fileIds,
        is_attached: false,
      })
      setSubmissions((prev) =>
        mySubmission
          ? prev.map((s) => (s.id === mySubmission.id ? created : s))
          : [created],
      )
      setAnswerFiles([])
      onUpdated()
    } catch {
      setSubmitError('Не удалось сохранить черновик')
    } finally {
      setDraftSaving(false)
    }
  }

  const handleSaveDraftWith = async (files: File[]) => {
    if (!assignmentId || !courseId || submitting || draftSaving) return
    setDraftSaving(true)
    setSubmitError(null)
    try {
      const newFileIds = files.length > 0 ? await uploadFiles(files) : []
      const existingIds = mySubmission?.file_ids ?? []
      const fileIds = [...existingIds, ...newFileIds]
      const created = await submitAssignment(courseId, assignmentId, {
        body: answerText.trim() || undefined,
        file_ids: fileIds,
        is_attached: false,
      })
      setSubmissions((prev) =>
        mySubmission
          ? prev.map((s) => (s.id === mySubmission.id ? created : s))
          : [created],
      )
      setAnswerFiles([])
      onUpdated()
    } catch {
      setSubmitError('Не удалось сохранить черновик')
    } finally {
      setDraftSaving(false)
    }
  }

  const handleRemoveDraftFile = async (fileId: string) => {
    if (!assignmentId || !courseId || submitting || draftSaving) return
    const currentIds = mySubmission?.file_ids ?? []
    const newIds = currentIds.filter((id) => id !== fileId)
    setDraftSaving(true)
    setSubmitError(null)
    try {
      const created = await submitAssignment(courseId, assignmentId, {
        body: answerText.trim() || undefined,
        file_ids: newIds,
        is_attached: false,
      })
      setSubmissions((prev) =>
        mySubmission
          ? prev.map((s) => (s.id === mySubmission.id ? created : s))
          : [created],
      )
      onUpdated()
    } catch {
      setSubmitError('Не удалось удалить файл')
    } finally {
      setDraftSaving(false)
    }
  }

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

  const performReturnSubmission = async (submissionId: string) => {
    if (!courseId || !assignmentId) return
    setReturnLoading((prev) => ({ ...prev, [submissionId]: true }))
    try {
      await returnSubmission(courseId, assignmentId, submissionId)
      const updated = await listSubmissions(courseId, assignmentId)
      setSubmissions(updated)
      onUpdated()
      setReturnConfirmSubmissionId(null)
    } catch {
      setReturnConfirmSubmissionId(null)
    } finally {
      setReturnLoading((prev) => ({ ...prev, [submissionId]: false }))
    }
  }

  const handleReturnSubmission = (submissionId: string) => {
    setReturnConfirmSubmissionId(submissionId)
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
      const isPersonal = !opts?.isGeneral
      await createAssignmentComment(courseId, assignmentId, {
        body: trimmed,
        parent_id: opts?.parent_id ?? undefined,
        is_private: isPersonal,
      })
      const refreshed = await listAssignmentComments(courseId, assignmentId)
      setComments(refreshed)
      setCommentText('')
      setReplyToParentId(null)
      setShowAddGeneralComment(false)
    } catch {
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) {
      const newFiles = [...answerFiles, ...Array.from(selected)]
      setAnswerFiles(newFiles)
      if (!isTeacher && canEdit && !submitting && !draftSaving && !isSubmissionReturned(mySubmission)) {
        void handleSaveDraftWith(newFiles)
      }
    }
    e.target.value = ''
  }

  const removeAnswerFile = (index: number) => {
    const newFiles = answerFiles.filter((_, i) => i !== index)
    setAnswerFiles(newFiles)
    if (!isTeacher && canEdit && !submitting && !draftSaving && !isSubmissionReturned(mySubmission)) {
      void handleSaveDraftWith(newFiles)
    }
  }

  const handleClose = () => {
    setShowSubmitConfirm(false)
    setReturnConfirmSubmissionId(null)
    setAnswerText('')
    setAnswerFiles([])
    setSubmitError(null)
    setGradeValues({})
    setGradeComments({})
    setGradeStatuses({})
    setEditingGradeFor(null)
    setReplyToStudent(null)
    setReplyToParentId(null)
    setPersonalCommentsDialogStudentId(null)
    setShowAddGeneralComment(false)
    setCommentText('')
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
            {assignment.deadline && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Дедлайн: {formatDate(assignment.deadline)}
                </Typography>
              </Box>
            )}

            {(() => {
              const attachments =
                item.attachments && item.attachments.length > 0
                  ? item.attachments
                  : (assignment.file_ids ?? []).map((id, i) => ({ id, name: `Файл ${i + 1}` }))
              const assignmentLinks = (assignment as { links?: string[] }).links ?? []
              const totalCount = attachments.length + assignmentLinks.length
              if (totalCount === 0) return null
              return (
                <Box>
                  <Box className="flex items-center justify-between gap-2 mb-2">
                    <Typography variant="subtitle2" className="text-slate-600">
                      Вложения ({totalCount})
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setAssignmentAttachmentsExpanded((v) => !v)}
                      startIcon={
                        assignmentAttachmentsExpanded ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )
                      }
                      sx={{ textTransform: 'none', minWidth: 'auto' }}
                    >
                      {assignmentAttachmentsExpanded ? 'Свернуть' : 'Развернуть'}
                    </Button>
                  </Box>
                  {assignmentAttachmentsExpanded && (
                    <Box className="flex flex-col gap-2 w-full">
                      {assignmentLinks.map((url, i) => (
                        <Box key={`link-${i}`} className="w-full">
                          <Typography
                            variant="body2"
                            component="a"
                            href={getLinkHref(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ color: 'primary.main', wordBreak: 'break-all', display: 'block' }}
                          >
                            {url}
                          </Typography>
                        </Box>
                      ))}
                      {attachments.map((a) => (
                        <Box key={a.id} className="w-full">
                          <FileAttachmentLink
                            attachment={{ id: a.id, name: a.name || 'Файл' }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )
            })()}

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
                              {(() => {
                                  const links = parseSubmissionBodyLinks(sub.body)
                                  if (links.length === 0) {
                                    return (
                                      <Typography variant="body2" className="mt-2 text-slate-600">
                                        —
                                      </Typography>
                                    )
                                  }
                                  return (
                                    <Box className="mt-2 flex min-w-0 w-full flex-col gap-1">
                                      {links.map((url, i) => (
                                        <Typography
                                          key={`${sub.id}-link-${i}`}
                                          component="a"
                                          href={getLinkHref(url)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          variant="body2"
                                          className="w-full text-primary-600 hover:underline break-all"
                                          sx={{ display: 'block' }}
                                        >
                                          {url}
                                        </Typography>
                                      ))}
                                    </Box>
                                  )
                                })()}
                                {(sub.file_ids ?? []).length > 0 && (
                                  <Box className="flex flex-col gap-2 mt-2">
                                    <Button
                                      size="small"
                                      variant="text"
                                      onClick={() => toggleSubmissionAttachments(sub.id)}
                                      startIcon={
                                        submissionAttachmentsCollapsed[sub.id] ? (
                                          <ExpandMoreIcon />
                                        ) : (
                                          <ExpandLessIcon />
                                        )
                                      }
                                      sx={{
                                        textTransform: 'none',
                                        minWidth: 'auto',
                                        alignSelf: 'flex-start',
                                      }}
                                    >
                                      {submissionAttachmentsCollapsed[sub.id]
                                        ? `Развернуть вложения (${(sub.file_ids ?? []).length})`
                                        : 'Свернуть вложения'}
                                    </Button>
                                    {!submissionAttachmentsCollapsed[sub.id] &&
                                      (sub.file_ids ?? []).map((fileId, i) => (
                                        <Box key={fileId} className="w-full">
                                          <FileAttachmentLink
                                            attachment={{ id: fileId, name: `Файл ${i + 1}` }}
                                            fileSource={{
                                              type: 'submission',
                                              courseId,
                                              assignmentId,
                                              submissionId: sub.id,
                                            }}
                                          />
                                        </Box>
                                      ))}
                                  </Box>
                                )}
                              </Box>
                            </Box>
                            {sub.grade != null && (
                              <Box
                                sx={{
                                  px: 1.5,
                                  py: 0.5,
                                  borderRadius: 1,
                                  bgcolor:
                                    maxGrade === 1 && sub.grade < 1 ? 'error.main' : 'success.main',
                                  color: 'white',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                {formatGradeDisplay(sub.grade, maxGrade)}
                              </Box>
                            )}
                          </Box>
                          {sub.grade_comment && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 3, pl: 2, borderLeft: '3px solid', borderColor: 'divider' }}
                            >
                              {sub.grade_comment}
                            </Typography>
                          )}
                          <Divider sx={{ my: 2 }} />
                          {sub.is_attached !== true ? (
                            <Typography variant="body2" color="text.secondary">
                              Работа не сдана. Оценить можно только после сдачи.
                            </Typography>
                          ) : (
                          <Box className="flex flex-wrap items-start gap-2">
                            {sub.is_returned === true ? (
                              <Typography variant="body2" color="text.secondary">
                                Работа возвращена на доработку. Оценку изменить нельзя.
                              </Typography>
                            ) : sub.grade != null && editingGradeFor !== sub.id ? (
                              <>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setEditingGradeFor(sub.id)
                                    setGradeValues((prev) => ({ ...prev, [sub.id]: String(sub.grade) }))
                                    setGradeComments((prev) => ({ ...prev, [sub.id]: sub.grade_comment ?? '' }))
                                    if (isPassFailGrading(maxGrade) && sub.grade != null) {
                                      setGradeStatuses((prev) => ({
                                        ...prev,
                                        [sub.id]: sub.grade! >= 1 ? 'passed' : 'failed',
                                      }))
                                    }
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
                                {isPassFailGrading(maxGrade) && (
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
                                      <MenuItem value="passed">Зачёт</MenuItem>
                                      <MenuItem value="failed">Не зачёт</MenuItem>
                                    </Select>
                                  </FormControl>
                                )}
                                {!isPassFailGrading(maxGrade) && (
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
                                )}
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
                          )}
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
                    {(() => {
                      const links = parseSubmissionBodyLinks(mySubmission.body)
                      if (links.length === 0) {
                        return (
                          <Typography variant="body2" className="text-slate-600">
                            —
                          </Typography>
                        )
                      }
                      return (
                        <Box className="flex min-w-0 w-full flex-col gap-1">
                          {links.map((url, i) => (
                            <Typography
                              key={`my-${i}`}
                              component="a"
                              href={getLinkHref(url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="body2"
                              className="w-full text-primary-600 hover:underline break-all"
                              sx={{ display: 'block' }}
                            >
                              {url}
                            </Typography>
                          ))}
                        </Box>
                      )
                    })()}
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
                      {(mySubmission?.file_ids ?? []).length > 0 && (
                        <Box className="mb-2 flex flex-col gap-2">
                          <Box className="flex items-center justify-between gap-2">
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                              Прикреплённые файлы черновика (
                              {(mySubmission?.file_ids ?? []).length})
                            </Typography>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => setDraftAttachmentsExpanded((v) => !v)}
                              startIcon={
                                draftAttachmentsExpanded ? (
                                  <ExpandLessIcon />
                                ) : (
                                  <ExpandMoreIcon />
                                )
                              }
                              sx={{ textTransform: 'none', minWidth: 'auto' }}
                            >
                              {draftAttachmentsExpanded ? 'Свернуть' : 'Развернуть'}
                            </Button>
                          </Box>
                          {draftAttachmentsExpanded &&
                            (mySubmission?.file_ids ?? []).map((fileId) => (
                              <Box key={fileId} className="flex w-full items-center gap-2">
                                <FileAttachmentLink
                                  attachment={{ id: fileId, name: '' }}
                                  showDownload={true}
                                  fileSource={
                                    courseId && assignmentId && mySubmission
                                      ? {
                                          type: 'submission',
                                          courseId,
                                          assignmentId,
                                          submissionId: mySubmission.id,
                                        }
                                      : undefined
                                  }
                                />
                                <IconButton
                                  size="small"
                                  aria-label="Удалить файл"
                                  onClick={() => handleRemoveDraftFile(fileId)}
                                  disabled={draftSaving}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ))}
                        </Box>
                      )}
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
                  const commentsTree = buildCommentTree(comments)
                  const generalComments = getGeneralComments(commentsTree).sort(
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
                              onClick={() => {
                                setReplyToStudent(d.uid)
                                setPersonalCommentsDialogStudentId(d.uid)
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
                        {studentIds.length > 0 && (
                          <Box
                            component="form"
                            onSubmit={(e) =>
                              handleAddComment(
                                e,
                                (() => {
                                  if (replyToParentId) return { parent_id: replyToParentId }
                                  const studentId = replyToStudent ?? studentIds[0]
                                  const dialogTree = getPersonalCommentsTreeForTeacher(
                                    comments,
                                    authUser?.id,
                                    studentId,
                                  )
                                  const root = dialogTree[0]
                                  return root ? { parent_id: root.id } : undefined
                                })(),
                              )
                            }
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
                  const myConvTree = getPersonalCommentsTreeForStudent(
                    comments,
                    authUser?.id,
                    teacherIds,
                  )
                  return (
                    <Box className="flex flex-col gap-2">
                      {myConvTree.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Нет сообщений
                        </Typography>
                      ) : (
                        <Box className="flex flex-col gap-2">
                          {myConvTree.map((c) => (
                            <PersonalCommentItem
                              key={c.id}
                              comment={c}
                              depth={0}
                              replyToParentId={replyToParentId}
                              onReply={setReplyToParentId}
                              onCancelReply={() => setReplyToParentId(null)}
                              courseMembers={courseMembers}
                              authUserId={authUser?.id}
                              formatDate={formatDate}
                            />
                          ))}
                        </Box>
                      )}
                      <Box
                        component="form"
                        onSubmit={(e) =>
                          handleAddComment(
                            e,
                            replyToParentId
                              ? { parent_id: replyToParentId }
                              : myConvTree[0]
                                ? { parent_id: myConvTree[0].id }
                                : undefined,
                          )
                        }
                        className="flex flex-col gap-2 mt-4"
                      >
                        {replyToParentId && (
                          <Box className="flex items-center gap-2">
                            <Typography variant="caption" color="text.secondary">
                              Ответ на комментарий
                            </Typography>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => setReplyToParentId(null)}
                              sx={{ minWidth: 'auto', p: 0 }}
                            >
                              Отмена
                            </Button>
                          </Box>
                        )}
                        <TextField
                          label="Текст ответа"
                          fullWidth
                          multiline
                          minRows={2}
                          size="small"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          inputProps={{ 'aria-label': 'Текст ответа' }}
                        />
                        <Box className="flex items-center gap-2">
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
                    </Box>
                  )
                })()
              )}
            </Box>
            </Box>
          </>
        ) : null}
      </DialogContent>
      <SubmitAssignmentConfirmDialog
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={performSubmit}
        assignmentTitle={item.title}
        assignmentDeadline={assignment?.deadline}
        fileNames={answerFiles.map((f) => f.name)}
        draftFileIds={mySubmission?.file_ids ?? []}
        submitting={submitting}
      />
      {(() => {
        const sub = returnConfirmSubmissionId
          ? submissions.find((s) => s.id === returnConfirmSubmissionId)
          : null
        const studentName = sub
          ? getNameByUserId(courseMembers, sub.user_id, sub.author) || 'Студент'
          : ''
        return (
          <ReturnSubmissionConfirmDialog
            open={Boolean(returnConfirmSubmissionId)}
            onClose={() => setReturnConfirmSubmissionId(null)}
            onConfirm={() =>
              returnConfirmSubmissionId && performReturnSubmission(returnConfirmSubmissionId)
            }
            studentName={studentName}
            loading={returnConfirmSubmissionId ? returnLoading[returnConfirmSubmissionId] : false}
          />
        )
      })()}
      {isTeacher && personalCommentsDialogStudentId && (
        <Dialog
          open={true}
          onClose={() => {
            setPersonalCommentsDialogStudentId(null)
            setReplyToParentId(null)
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { position: 'fixed', top: 80 } }}
          aria-labelledby="personal-comments-dialog-title"
        >
          <DialogTitle
            id="personal-comments-dialog-title"
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>
              Диалог с{' '}
              {getNameByUserId(
                courseMembers,
                personalCommentsDialogStudentId,
                submissions.find((s) => s.user_id === personalCommentsDialogStudentId)?.author,
              ) || 'студентом'}
            </span>
            <IconButton
              size="small"
              onClick={() => {
                setPersonalCommentsDialogStudentId(null)
                setReplyToParentId(null)
              }}
              aria-label="Закрыть"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {(() => {
              const tree = getPersonalCommentsTreeForTeacher(
                comments,
                authUser?.id,
                personalCommentsDialogStudentId,
              )
              return (
                <Box className="flex flex-col gap-3">
                  {tree.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Нет сообщений в диалоге
                    </Typography>
                  ) : (
                    <Box className="flex flex-col gap-2">
                      {tree.map((c) => (
                        <PersonalCommentItem
                          key={c.id}
                          comment={c}
                          depth={0}
                          replyToParentId={replyToParentId}
                          onReply={setReplyToParentId}
                          onCancelReply={() => setReplyToParentId(null)}
                          courseMembers={courseMembers}
                          authUserId={authUser?.id}
                          formatDate={formatDate}
                        />
                      ))}
                    </Box>
                  )}
                  <Box
                    component="form"
                    onSubmit={(e) =>
                      handleAddComment(
                        e,
                        replyToParentId
                          ? { parent_id: replyToParentId }
                          : tree[0]
                            ? { parent_id: tree[0].id }
                            : undefined,
                      )
                    }
                    className="flex flex-col gap-2 mt-2"
                  >
                    {replyToParentId && (
                      <Box className="flex items-center gap-2">
                        <Typography variant="caption" color="text.secondary">
                          Ответ на комментарий
                        </Typography>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => setReplyToParentId(null)}
                          sx={{ minWidth: 'auto', p: 0 }}
                        >
                          Отмена
                        </Button>
                      </Box>
                    )}
                    <TextField
                      label="Текст ответа"
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      inputProps={{ 'aria-label': 'Текст ответа' }}
                    />
                    <Box className="flex items-center gap-2">
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
                </Box>
              )
            })()}
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
