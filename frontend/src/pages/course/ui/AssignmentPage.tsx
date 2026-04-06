import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CloseIcon from '@mui/icons-material/Close'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import LinkIcon from '@mui/icons-material/Link'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined'
import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import VideoFileOutlinedIcon from '@mui/icons-material/VideoFileOutlined'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  getAssignment,
  getCourse,
  listSubmissions,
  getMySubmission,
  submitAssignment,
  gradeSubmission,
  returnSubmission,
  listAssignmentComments,
  createAssignmentComment,
  listCourseMembers,
  uploadFiles,
  deleteAssignment,
} from '../../../features/courses/api/coursesApi'
import { useAuth } from '../../../features/auth/model/AuthContext'
import {
  isValidUrl,
  parseSubmissionBodyLinks,
  getLinkHref,
} from '../../../features/courses/utils/urlValidation'
import {
  formatGradeDisplay,
  isPassFailGrading,
} from '../../../features/courses/utils/gradeUtils'
import {
  type Assignment,
  type Comment,
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
} from '../../../features/courses/model/types'
import { SubmitAssignmentConfirmDialog } from '../../../features/courses/ui/SubmitAssignmentConfirmDialog/SubmitAssignmentConfirmDialog'
import { ReturnSubmissionConfirmDialog } from '../../../features/courses/ui/ReturnSubmissionConfirmDialog/ReturnSubmissionConfirmDialog'
import { FileAttachmentLink } from '../../../features/courses/ui/FileAttachmentLink/FileAttachmentLink'
import { TeamBlock } from '../../../features/courses/ui/TeamBlock/TeamBlock'
import { TeamsPanel } from '../../../features/courses/ui/TeamsPanel/TeamsPanel'

const DRAFT_STORAGE_KEY = 'assignment-draft'

function getDraftKey(courseId: string, assignmentId: string): string {
  return `${DRAFT_STORAGE_KEY}-${courseId}-${assignmentId}`
}

type AssignmentDraft = {
  body: string
  links: string[]
  fileNames: string[]
}

function loadDraft(courseId: string, assignmentId: string): AssignmentDraft | null {
  try {
    const raw = localStorage.getItem(getDraftKey(courseId, assignmentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AssignmentDraft
    return {
      body: typeof parsed.body === 'string' ? parsed.body : '',
      links: Array.isArray(parsed.links) ? parsed.links : [],
      fileNames: Array.isArray(parsed.fileNames) ? parsed.fileNames : [],
    }
  } catch {
    return null
  }
}

function saveDraft(
  courseId: string,
  assignmentId: string,
  draft: { body: string; links: string[]; fileNames: string[] },
): void {
  try {
    if (!draft.body && draft.links.length === 0 && draft.fileNames.length === 0) {
      localStorage.removeItem(getDraftKey(courseId, assignmentId))
      return
    }
    localStorage.setItem(getDraftKey(courseId, assignmentId), JSON.stringify(draft))
  } catch {
  }
}

function PersonalCommentItem({
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
            <PersonalCommentItem
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
          {comment.is_private && (
            <Typography variant="caption" color="primary" sx={{ fontWeight: 500 }}>
              Приватный
            </Typography>
          )}
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
  const [gradeComments, setGradeComments] = useState<Record<string, string>>({})
  const [gradeStatuses, setGradeStatuses] = useState<Record<string, 'passed' | 'failed' | null>>({})
  const [gradeLoading, setGradeLoading] = useState<Record<string, boolean>>({})
  const [returnLoading, setReturnLoading] = useState<Record<string, boolean>>({})
  const [editingGradeFor, setEditingGradeFor] = useState<string | null>(null)
  const [showAddGeneralComment, setShowAddGeneralComment] = useState(false)
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null)
  const [courseMembers, setCourseMembers] = useState<Member[]>([])
  const [replyToStudent, setReplyToStudent] = useState<string | null>(null)
  const [replyToParentId, setReplyToParentId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [dialogOpenUserId, setDialogOpenUserId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'instructions' | 'student-work'>('instructions')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [studentWorkFilter, setStudentWorkFilter] = useState<'all' | 'submitted' | 'assigned' | 'graded'>('all')
  const [studentSortBy, setStudentSortBy] = useState<string>('name')
  const [commentsTab, setCommentsTab] = useState<'general' | 'personal'>('general')
  const [assignmentMenuAnchor, setAssignmentMenuAnchor] = useState<HTMLElement | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const submitSectionRef = useRef<HTMLDivElement>(null)
  const [canSubmit, setCanSubmit] = useState<boolean | null>(null)

  useEffect(() => {
    if (!courseId || !assignmentId) {
      navigate('/')
      return
    }

    setLoading(true)
    Promise.all([
      getCourse(courseId),
      getAssignment(courseId, assignmentId),
      listAssignmentComments(courseId, assignmentId),
      listCourseMembers(courseId),
    ])
      .then(([c, a, cm, members]) => {
        setCourse(c)
        setAssignment(a)
        setComments(cm)
        setCourseMembers(members ?? [])
        const courseWithRole = c as { role?: string } | null
        const isTeacher = courseWithRole?.role === 'teacher' || courseWithRole?.role === 'owner'
        if (isTeacher) {
          return listSubmissions(courseId, assignmentId).then((s) => setSubmissions(s))
        }
        return getMySubmission(courseId, assignmentId).then((my) =>
          setSubmissions(my ? [my] : []),
        )
      })
      .catch(() => {
        setCourse(null)
        setAssignment(null)
        setSubmissions([])
        setComments([])
        setCourseMembers([])
      })
      .finally(() => setLoading(false))
  }, [courseId, assignmentId])

  const mySubmission = submissions.find((s) => s.user_id === authUser?.id)
  const [restoredFileNames, setRestoredFileNames] = useState<string[]>([])
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const canEditSubmission =
    !mySubmission || isSubmissionReturned(mySubmission) || isSubmissionDraft(mySubmission)

  useEffect(() => {
    if (!courseId || !assignmentId || mySubmission) return
    const draft = loadDraft(courseId, assignmentId)
    if (draft) {
      if (draft.links.length > 0) setAnswerLinks(draft.links)
      if (draft.fileNames.length > 0) setRestoredFileNames(draft.fileNames)
    }
  }, [courseId, assignmentId, mySubmission])

  const submissionBodyInitRef = useRef<string | null>(null)
  useEffect(() => {
    if (mySubmission?.body && submissionBodyInitRef.current !== mySubmission.id) {
      submissionBodyInitRef.current = mySubmission.id
      const links = parseSubmissionBodyLinks(mySubmission.body)
      if (links.length > 0) setAnswerLinks(links)
    }
  }, [mySubmission])

  useEffect(() => {
    if (!courseId || !assignmentId || mySubmission) return
    saveDraft(courseId, assignmentId, {
      body: '',
      links: answerLinks,
      fileNames: answerFiles.map((f) => f.name),
    })
  }, [courseId, assignmentId, mySubmission, answerLinks, answerFiles])

  const courseWithRole = course as { title?: string; role?: string } | null
  const isTeacher = courseWithRole?.role === 'teacher' || courseWithRole?.role === 'owner'
  const maxGrade = (assignment as { max_grade?: number } | null)?.max_grade ?? 100
  const statusLabel = getStatusLabel(
    mySubmission ?? null,
    assignment?.deadline ?? null,
    maxGrade,
  )

  const students = courseMembers.filter((m) => m.role === 'student')
  const submittedCount = submissions.filter((s) => s.is_attached === true).length
  const gradedCount = submissions.filter((s) => s.grade != null).length
  const assignedCount = students.filter(
    (s) => !submissions.some((sub) => sub.user_id === s.user_id),
  ).length

  const getSubmissionForStudent = (userId: string) =>
    submissions.find((s) => s.user_id === userId)

  const getStudentStatus = (userId: string): 'graded' | 'submitted' | 'assigned' => {
    const sub = getSubmissionForStudent(userId)
    if (sub?.grade != null) return 'graded'
    if (sub && sub.is_attached === true) return 'submitted'
    return 'assigned'
  }

  const filteredStudents = students.filter((s) => {
    if (studentWorkFilter === 'all') return true
    const status = getStudentStatus(s.user_id)
    return status === studentWorkFilter
  })

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const nameA = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim().toLowerCase()
    const nameB = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim().toLowerCase()
    if (studentSortBy === 'name') return nameA.localeCompare(nameB)
    const statusA = getStudentStatus(a.user_id)
    const statusB = getStudentStatus(b.user_id)
    const order = { graded: 0, submitted: 1, assigned: 2 }
    return (order[statusA] ?? 3) - (order[statusB] ?? 3)
  })

  const selectedSubmission = selectedStudentId
    ? getSubmissionForStudent(selectedStudentId)
    : null

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    setActiveTab((prev) => {
      if (tabFromUrl === 'student-work' && isTeacher) return 'student-work'
      if (tabFromUrl === 'instructions') return 'instructions'
      return prev
    })
  }, [searchParams, isTeacher])

  useEffect(() => {
    if (activeTab === 'student-work' && isTeacher && filteredStudents.length > 0) {
      setSelectedStudentId((prev) => {
        const valid = prev && filteredStudents.some((s) => s.user_id === prev)
        return valid ? prev : filteredStudents[0].user_id
      })
    }
  }, [activeTab, isTeacher, filteredStudents])
  const assignmentFileIds = (assignment as { file_ids?: string[] })?.file_ids ?? []
  const displayAuthor =
    (assignment?.user_id
      ? getNameByUserId(courseMembers, assignment.user_id, assignment.author)
      : assignment?.author
        ? `${assignment.author.first_name} ${assignment.author.last_name}`.trim()
        : null) || 'Преподаватель'

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
        body: answerLinks.length > 0 ? answerLinks.join('\n') : undefined,
        file_ids: fileIds,
        is_attached: true,
      })
      setSubmissions((prev) =>
        mySubmission
          ? prev.map((s) => (s.id === mySubmission.id ? created : s))
          : [created],
      )
      setAnswerFiles([])
      setAnswerLinks([])
      setRestoredFileNames([])
      if (courseId && assignmentId) {
        localStorage.removeItem(getDraftKey(courseId, assignmentId))
      }
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

  const handleRemoveDraftFile = async (fileId: string) => {
    if (!assignmentId || !courseId || submitting || draftSaving) return
    const currentIds = mySubmission?.file_ids ?? []
    const newIds = currentIds.filter((id) => id !== fileId)
    setDraftSaving(true)
    setSubmitError(null)
    try {
      const created = await submitAssignment(courseId, assignmentId, {
        body: answerLinks.length > 0 ? answerLinks.join('\n') : undefined,
        file_ids: newIds,
        is_attached: false,
      })
      setSubmissions((prev) =>
        mySubmission
          ? prev.map((s) => (s.id === mySubmission.id ? created : s))
          : [created],
      )
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
      if (isNaN(parsed) || parsed < 0 || parsed > maxGrade) return
      grade = parsed
    }
    if (!courseId || !assignmentId) return

    const commentParts: string[] = []
    const customComment = (gradeComments[submissionId] ?? '').trim()
    if (customComment) commentParts.push(customComment)
    const grade_comment = commentParts.length > 0 ? commentParts.join('\n') : undefined

    setGradeLoading((prev) => ({ ...prev, [submissionId]: true }))
    try {
      await gradeSubmission(courseId, assignmentId, submissionId, { grade, grade_comment })
      const updated = await listSubmissions(courseId, assignmentId)
      setSubmissions(updated)
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
      setShowReturnConfirm(false)
    } catch {
      setShowReturnConfirm(false)
    } finally {
      setReturnLoading((prev) => ({ ...prev, [submissionId]: false }))
    }
  }

  const handleReturnSubmission = () => {
    if (selectedSubmission) setShowReturnConfirm(true)
  }

  const handleDeleteAssignment = async () => {
    if (!courseId || !assignmentId) return
    setDeleteLoading(true)
    try {
      await deleteAssignment(courseId, assignmentId)
      setDeleteDialogOpen(false)
      navigate(`/course/${courseId}`)
    } finally {
      setDeleteLoading(false)
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
      const isPersonal = !opts?.isGeneral
      const payload: {
        body: string
        parent_id?: string | null
        is_private?: boolean
      } = {
        body: trimmed,
        is_private: isPersonal,
      }
      if (opts?.parent_id != null) payload.parent_id = opts.parent_id
      await createAssignmentComment(courseId, assignmentId, payload)
      const refreshed = await listAssignmentComments(courseId, assignmentId)
      setComments(refreshed)
      setCommentText('')
      setReplyToParentId(null)
      setShowAddGeneralComment(false)
    } finally {
      setSubmittingComment(false)
    }
  }

  const saveDraftToServer = async (files: File[], links: string[]) => {
    if (courseWithRole?.role === 'teacher' || courseWithRole?.role === 'owner') return
    if (!canEditSubmission || !courseId || !assignmentId || submitting || draftSaving) return
    if (isSubmissionReturned(mySubmission)) {
      if (!mySubmission) return
      setAutoSaveStatus('saving')
      try {
        const newFileIds = files.length > 0 ? await uploadFiles(files) : []
        const existingIds = mySubmission.file_ids ?? []
        const fileIds = [...existingIds, ...newFileIds]
        const created = await submitAssignment(courseId, assignmentId, {
          body: links.length > 0 ? links.join('\n') : undefined,
          file_ids: fileIds,
          is_attached: false,
        })
        setSubmissions((prev) =>
          prev.map((s) => (s.id === mySubmission.id ? created : s)),
        )
        setAnswerFiles([])
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch {
        setAutoSaveStatus('error')
      }
    } else {
      setDraftSaving(true)
      setSubmitError(null)
      try {
        const newFileIds = files.length > 0 ? await uploadFiles(files) : []
        const existingIds = mySubmission?.file_ids ?? []
        const fileIds = [...existingIds, ...newFileIds]
        const created = await submitAssignment(courseId, assignmentId, {
          body: links.length > 0 ? links.join('\n') : undefined,
          file_ids: fileIds,
          is_attached: false,
        })
        setSubmissions((prev) =>
          mySubmission
            ? prev.map((s) => (s.id === mySubmission.id ? created : s))
            : [created],
        )
        setAnswerFiles([])
      } catch {
        setSubmitError('Не удалось сохранить черновик')
      } finally {
        setDraftSaving(false)
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) {
      const newFiles = [...answerFiles, ...Array.from(selected)]
      setAnswerFiles(newFiles)
      setRestoredFileNames([])
      void saveDraftToServer(newFiles, answerLinks)
    }
    e.target.value = ''
  }

  const removeAnswerFile = (index: number) => {
    const newFiles = answerFiles.filter((_, i) => i !== index)
    setAnswerFiles(newFiles)
    void saveDraftToServer(newFiles, answerLinks)
  }

  const removeAnswerLink = (index: number) => {
    const newLinks = answerLinks.filter((_, i) => i !== index)
    setAnswerLinks(newLinks)
    void saveDraftToServer(answerFiles, newLinks)
  }

  const handleBack = () => {
    navigate(courseId ? `/course/${courseId}` : '/')
  }

  const handleAddLink = () => {
    const trimmed = linkUrl.trim()
    if (!trimmed) return
    if (!isValidUrl(trimmed)) {
      setLinkUrlError('Некорректная ссылка')
      return
    }
    setLinkUrlError(null)
    const newLinks = [...answerLinks, trimmed]
    setAnswerLinks(newLinks)
    setLinkUrl('')
    setShowLinkDialog(false)
    void saveDraftToServer(answerFiles, newLinks)
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

      {isTeacher && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => {
            const tab = v as 'instructions' | 'student-work'
            setActiveTab(tab)
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.set('tab', tab)
              return next
            })
          }}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="Инструкции" value="instructions" />
          <Tab label="Работы учащихся" value="student-work" />
        </Tabs>
      )}

      {(!isTeacher || activeTab === 'instructions') && (
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
                <IconButton
                  size="small"
                  aria-label="Меню"
                  sx={{ p: 0.5 }}
                  onClick={(e) => setAssignmentMenuAnchor(e.currentTarget)}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu
                  anchorEl={assignmentMenuAnchor}
                  open={Boolean(assignmentMenuAnchor)}
                  onClose={() => setAssignmentMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <MenuItem
                    onClick={() => {
                      let url = `${window.location.origin}/course/${courseId}/assignment/${assignmentId}`
                      if (activeTab === 'student-work') url += '?tab=student-work'
                      navigator.clipboard.writeText(url)
                      setAssignmentMenuAnchor(null)
                    }}
                  >
                    <ContentCopyOutlinedIcon sx={{ mr: 1, fontSize: 20 }} />
                    Копировать ссылку
                  </MenuItem>
                  {isTeacher && (
                    <MenuItem
                      onClick={() => {
                        setAssignmentMenuAnchor(null)
                        setDeleteDialogOpen(true)
                      }}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteOutlinedIcon sx={{ mr: 1, fontSize: 20 }} />
                      Удалить задание
                    </MenuItem>
                  )}
                </Menu>
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

          {(((assignment as { links?: string[] }).links ?? []).length > 0 || assignmentFileIds.length > 0) && (
            <Box className="mb-6">
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Вложения ({((assignment as { links?: string[] }).links ?? []).length + assignmentFileIds.length})
              </Typography>
              <Box className="flex flex-col gap-2 w-full">
                {((assignment as { links?: string[] }).links ?? []).map((url, i) => (
                  <Box key={i} className="w-full">
                    <Typography
                      component="a"
                      href={getLinkHref(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2"
                      className="text-primary-600 hover:underline break-all"
                      sx={{ display: 'block' }}
                    >
                      {url}
                    </Typography>
                  </Box>
                ))}
                {assignmentFileIds.map((fileId, i) => (
                  <Box key={fileId} className="w-full">
                    <FileAttachmentLink
                      attachment={{ id: fileId, name: `Файл ${i + 1}` }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Box className="border-t border-slate-200 pt-6 mt-6 flex flex-col gap-6">
            <Tabs
              value={commentsTab}
              onChange={(_, v) => setCommentsTab(v as 'general' | 'personal')}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, minHeight: 40 }}
            >
              <Tab label="Общие" value="general" />
              <Tab label="Личные" value="personal" />
            </Tabs>

            {commentsTab === 'general' && (
            <Box>
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
            )}

            {commentsTab === 'personal' && (
            <Box>
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
                                renderReplyForm={(parentId) => (
                                  <Box
                                    component="form"
                                    onSubmit={(e) => handleAddComment(e, { parent_id: parentId })}
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
                                )}
                                courseMembers={courseMembers}
                                authUserId={authUser?.id}
                                formatDate={formatDate}
                              />
                            ))}
                        </Box>
                      )}
                      <Box className="flex flex-col gap-2 mt-4">
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
                    </Box>
                  )
                })()
              )}
            </Box>
            )}
          </Box>
        </Box>

        {!isTeacher && activeTab === 'instructions' && (
          <Box className="lg:w-80 shrink-0 flex flex-col gap-4">
            {/* TeamBlock: shown only for group assignments to students */}
            {assignment?.assignment_kind === 'group' && courseId && assignmentId && authUser && (
              <TeamBlock
                courseId={courseId}
                assignmentId={assignmentId}
                assignment={assignment}
                myUserId={authUser.id}
                submissions={submissions}
                onRefresh={() => {
                  if (courseId && assignmentId) {
                    getMySubmission(courseId, assignmentId).then((s) => {
                      if (s) setSubmissions((prev) => {
                        const without = prev.filter((x) => x.user_id !== authUser.id)
                        return [...without, s]
                      })
                    }).catch(() => {})
                  }
                }}
                onProposeClick={() =>
                  submitSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
                onCanSubmitChange={(can) => setCanSubmit(can)}
              />
            )}
            <Box ref={submitSectionRef} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sticky top-4">
              <Box className="flex items-center justify-between mb-4">
                <Typography variant="h6" className="font-bold text-slate-900">
                  Мои задания
                </Typography>
                <Typography variant="body2" className="text-slate-800">
                  {statusLabel}
                </Typography>
              </Box>

              {mySubmission && !canEditSubmission ? (
                <>
                  {(mySubmission.file_ids ?? []).length > 0 && (
                    <Box className="flex flex-col gap-2 mt-2">
                      {(mySubmission.file_ids ?? []).map((fileId, i) => (
                        <FileAttachmentLink
                          key={fileId}
                          attachment={{ id: fileId, name: `Файл ${i + 1}` }}
                          fileSource={
                            courseId && assignmentId
                              ? {
                                  type: 'submission',
                                  courseId,
                                  assignmentId,
                                  submissionId: mySubmission.id,
                                }
                              : undefined
                          }
                        />
                      ))}
                    </Box>
                  )}
                  {(() => {
                    const links = parseSubmissionBodyLinks(mySubmission.body)
                    if (links.length === 0) return null
                    return (
                      <Box className="mt-2 flex min-w-0 w-full flex-col gap-1">
                        {links.map((url: string, i: number) => (
                          <Typography
                            key={`my-link-${i}`}
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
                  {mySubmission.grade_comment && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 3, pl: 2, borderLeft: '3px solid', borderColor: 'divider' }}
                    >
                      Комментарий преподавателя: {mySubmission.grade_comment}
                    </Typography>
                  )}
                  {assignment.deadline && new Date(assignment.deadline) < new Date() && (
                    <Typography variant="caption" color="text.secondary" className="block mt-2">
                      Нельзя сдать работу, так как её срок выполнения уже прошёл.
                    </Typography>
                  )}
                </>
              ) : assignment?.team_submission_rule === 'top_student_only' && canSubmit === false ? (
                <Alert severity="info">
                  Только участник с наивысшим баллом вашей команды может сдать финальное решение.
                </Alert>
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
                  {((mySubmission?.file_ids ?? []).length > 0 ||
                    answerFiles.length > 0 ||
                    answerLinks.length > 0 ||
                    restoredFileNames.length > 0) && (
                    <Box className="flex flex-col gap-2">
                      {(mySubmission?.file_ids ?? []).length > 0 && (
                        <Box className="flex flex-col gap-2">
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Прикреплённые файлы черновика
                          </Typography>
                          {(mySubmission?.file_ids ?? []).map((fileId) => (
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
                      {restoredFileNames.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Сохранённый прогресс (добавьте заново): {restoredFileNames.join(', ')}
                        </Typography>
                      )}
                      <Box className="flex flex-col gap-2 w-full">
                      {answerFiles.map((f, i) => (
                        <Box
                          key={`file-${f.name}-${i}`}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm w-full"
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
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm w-full"
                        >
                          <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography
                            variant="body2"
                            component="a"
                            href={getLinkHref(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate max-w-[120px] text-primary-600 hover:underline"
                          >
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
                    </Box>
                  )}
                  {isSubmissionReturned(mySubmission) && (
                    <Typography variant="caption" color="text.secondary">
                      {autoSaveStatus === 'saving' && 'Сохранение…'}
                      {autoSaveStatus === 'saved' && 'Сохранено'}
                      {autoSaveStatus === 'error' && 'Ошибка сохранения'}
                    </Typography>
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
      )}

      {activeTab === 'student-work' && isTeacher && (
        <Box className="flex flex-col gap-4">
          {/* TeamsPanel: shown only for group assignments */}
          {assignment?.assignment_kind === 'group' && courseId && assignmentId && (
            <TeamsPanel
              courseId={courseId}
              assignmentId={assignmentId}
              assignment={assignment}
              submissions={submissions}
              onRefresh={() => {
                if (courseId && assignmentId) {
                  listSubmissions(courseId, assignmentId)
                    .then(setSubmissions)
                    .catch(() => {})
                }
              }}
            />
          )}
        </Box>
      )}

      {activeTab === 'student-work' && isTeacher && (
        <Box className="flex flex-col lg:flex-row gap-6">
          <Box className="flex flex-col gap-4 mb-4 lg:mb-0 lg:w-64 shrink-0">
            <Box className="flex items-center gap-2">
              <PeopleOutlineIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="subtitle2" className="font-medium text-slate-700">
                Все учащиеся
              </Typography>
            </Box>
            <FormControl size="small" fullWidth>
              <Select
                value={studentSortBy}
                onChange={(e) => setStudentSortBy(e.target.value)}
                displayEmpty
                sx={{ bgcolor: 'grey.50' }}
              >
                <MenuItem value="name">Сортировать по имени</MenuItem>
                <MenuItem value="status">Сортировать по статусу</MenuItem>
              </Select>
            </FormControl>
            <Box className="flex flex-col gap-1">
              {(['graded', 'submitted', 'assigned'] as const).map((sectionStatus) => {
                const sectionStudents = sortedStudents.filter(
                  (m) => getStudentStatus(m.user_id) === sectionStatus,
                )
                if (sectionStudents.length === 0) return null
                const sectionLabel =
                  sectionStatus === 'graded'
                    ? 'С оценкой'
                    : sectionStatus === 'submitted'
                      ? 'Сдано'
                      : 'Назначено'
                return (
                  <Box key={sectionStatus}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ px: 1, pt: 1, display: 'block' }}
                    >
                      {sectionLabel}
                    </Typography>
                    {sectionStudents.map((m) => {
                      const sub = getSubmissionForStudent(m.user_id)
                      const isSelected = selectedStudentId === m.user_id
                      return (
                        <Box
                          key={m.user_id}
                          component="button"
                          type="button"
                          onClick={() => setSelectedStudentId(m.user_id)}
                          className="flex items-center gap-2 w-full text-left p-2 rounded-lg border-0 cursor-pointer transition-colors"
                          sx={{
                            bgcolor: isSelected ? 'grey.200' : 'transparent',
                            '&:hover': { bgcolor: isSelected ? 'grey.200' : 'grey.100' },
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: 'primary.main',
                              fontSize: '0.75rem',
                            }}
                          >
                            {getInitialsFromMember(courseMembers, m.user_id, sub?.author)}
                          </Avatar>
                          <Typography variant="body2" className="flex-1 truncate">
                            {m.first_name} {m.last_name}
                          </Typography>
                          {sectionStatus === 'graded' && sub?.grade != null && (
                            <Typography variant="body2" fontWeight={600}>
                              {formatGradeDisplay(sub.grade, maxGrade)}
                            </Typography>
                          )}
                        </Box>
                      )
                    })}
                  </Box>
                )
              })}
            </Box>
          </Box>

          <Box className="flex-1 min-w-0 flex flex-col gap-4">
            <Typography variant="h6" className="font-semibold">
              {assignment?.title}
            </Typography>

            <Box className="flex gap-6">
              <Typography variant="body2" color="text.secondary">
                {submittedCount} Сдано
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {assignedCount} Назначено
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {gradedCount} Поставлена оценка
              </Typography>
            </Box>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={studentWorkFilter}
                onChange={(e) =>
                  setStudentWorkFilter(
                    e.target.value as 'all' | 'submitted' | 'assigned' | 'graded',
                  )
                }
                displayEmpty
                sx={{ bgcolor: 'grey.50' }}
              >
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="submitted">Сдано</MenuItem>
                <MenuItem value="assigned">Назначено</MenuItem>
                <MenuItem value="graded">С оценкой</MenuItem>
              </Select>
            </FormControl>

            {selectedStudentId ? (
              <Box className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                {selectedSubmission ? (
                  <>
                    <Box className="flex items-start justify-between gap-3 mb-4">
                      <Box className="flex min-w-0 flex-1 items-start gap-3">
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: 'primary.main',
                            fontSize: '0.875rem',
                          }}
                        >
                          {getInitialsFromMember(
                            courseMembers,
                            selectedStudentId,
                            selectedSubmission.author,
                          )}
                        </Avatar>
                        <Box className="min-w-0 flex-1">
                          <Typography variant="subtitle2" className="font-medium text-slate-800">
                            {getNameByUserId(
                              courseMembers,
                              selectedStudentId,
                              selectedSubmission.author,
                            ) || 'Студент'}
                          </Typography>
                          {(() => {
                            const links = parseSubmissionBodyLinks(selectedSubmission.body)
                            if (links.length === 0) {
                              return (
                                <Typography variant="body2" className="mt-2 text-slate-600">
                                  —
                                </Typography>
                              )
                            }
                            return (
                              <Box className="mt-2 flex min-w-0 w-full flex-col gap-1">
                                {links.map((url: string, i: number) => (
                                  <Typography
                                    key={`${selectedSubmission.id}-link-${i}`}
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
                          {(selectedSubmission.file_ids ?? []).length > 0 && (
                            <Box className="flex flex-col gap-2 mt-2 w-full">
                              {(selectedSubmission.file_ids ?? []).map((fileId, i) => (
                                <Box key={fileId} className="w-full">
                                  <FileAttachmentLink
                                    attachment={{ id: fileId, name: `Файл ${i + 1}` }}
                                    fileSource={
                                      courseId && assignmentId
                                        ? {
                                            type: 'submission',
                                            courseId,
                                            assignmentId,
                                            submissionId: selectedSubmission.id,
                                          }
                                        : undefined
                                    }
                                  />
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Box>
                      {selectedSubmission.grade != null && (
                        <Box
                          sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            bgcolor:
                              maxGrade === 1 && selectedSubmission.grade < 1
                                ? 'error.main'
                                : 'success.main',
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {formatGradeDisplay(selectedSubmission.grade, maxGrade)}
                        </Box>
                      )}
                    </Box>
                    {selectedSubmission.grade_comment && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 3, mb: 4, pl: 2, borderLeft: '3px solid', borderColor: 'divider' }}
                      >
                        {selectedSubmission.grade_comment}
                      </Typography>
                    )}
                    <Divider sx={{ my: 2 }} />
                    {selectedSubmission.is_attached !== true ? (
                      <Typography variant="body2" color="text.secondary">
                        Работа не сдана. Оценить можно только после сдачи.
                      </Typography>
                    ) : (
                    <Box className="flex flex-wrap items-start gap-2">
                      {selectedSubmission.is_returned === true ? (
                        <Typography variant="body2" color="text.secondary">
                          Работа возвращена на доработку. Оценку изменить нельзя.
                        </Typography>
                      ) : selectedSubmission.grade != null && editingGradeFor !== selectedSubmission.id ? (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setEditingGradeFor(selectedSubmission.id)
                              setGradeValues((prev) => ({
                                ...prev,
                                [selectedSubmission.id]: String(selectedSubmission.grade),
                              }))
                              setGradeComments((prev) => ({
                                ...prev,
                                [selectedSubmission.id]: selectedSubmission.grade_comment ?? '',
                              }))
                              if (
                                isPassFailGrading(maxGrade) &&
                                selectedSubmission.grade != null
                              ) {
                                setGradeStatuses((prev) => ({
                                  ...prev,
                                  [selectedSubmission.id]:
                                    selectedSubmission.grade! >= 1 ? 'passed' : 'failed',
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
                            onClick={handleReturnSubmission}
                            disabled={returnLoading[selectedSubmission.id]}
                          >
                            {returnLoading[selectedSubmission.id] ? '…' : 'Вернуть'}
                          </Button>
                        </>
                      ) : (
                        <>
                          {isPassFailGrading(maxGrade) && (
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                              <InputLabel>Статус</InputLabel>
                              <Select
                                value={gradeStatuses[selectedSubmission.id] ?? ''}
                                label="Статус"
                                onChange={(e) =>
                                  handleGradeStatusChange(
                                    selectedSubmission.id,
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
                                gradeStatuses[selectedSubmission.id]
                                  ? gradeStatuses[selectedSubmission.id] === 'passed'
                                    ? maxGrade
                                    : 0
                                  : gradeValues[selectedSubmission.id] ??
                                      selectedSubmission.grade ??
                                      ''
                              }
                              onChange={(e) =>
                                handleGradeChange(selectedSubmission.id, e.target.value)
                              }
                              error={
                                !gradeStatuses[selectedSubmission.id] &&
                                (gradeValues[selectedSubmission.id] ?? '') !== '' &&
                                !isGradeValid(
                                  gradeValues[selectedSubmission.id] ?? '',
                                  gradeStatuses[selectedSubmission.id] ?? null,
                                )
                              }
                              inputProps={{
                                min: 0,
                                max: maxGrade,
                                'aria-label': 'Оценка',
                                readOnly: !!gradeStatuses[selectedSubmission.id],
                              }}
                              sx={{ width: 130 }}
                            />
                          )}
                          <TextField
                            size="small"
                            label="Комментарий к оценке"
                            placeholder="Комментарий преподавателя..."
                            value={gradeComments[selectedSubmission.id] ?? ''}
                            onChange={(e) =>
                              handleGradeCommentChange(selectedSubmission.id, e.target.value)
                            }
                            sx={{ minWidth: 200, flex: 1 }}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleSaveGrade(selectedSubmission.id)}
                            disabled={
                              gradeLoading[selectedSubmission.id] ||
                              !(
                                gradeStatuses[selectedSubmission.id] ||
                                isGradeValid(
                                  gradeValues[selectedSubmission.id] ??
                                    String(selectedSubmission.grade ?? ''),
                                  gradeStatuses[selectedSubmission.id] ?? null,
                                )
                              )
                            }
                          >
                            {gradeLoading[selectedSubmission.id] ? 'Сохранение…' : 'Сохранить'}
                          </Button>
                          {selectedSubmission.grade != null && (
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
                            onClick={handleReturnSubmission}
                            disabled={returnLoading[selectedSubmission.id]}
                          >
                            {returnLoading[selectedSubmission.id] ? '…' : 'Вернуть'}
                          </Button>
                        </>
                      )}
                    </Box>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Работа не сдана
                  </Typography>
                )}
              </Box>
            ) : (
              <Box
                className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"
                sx={{ minHeight: 200 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Выберите учащегося из списка слева
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      <Dialog
        open={showLinkDialog}
        onClose={() => {
          setShowLinkDialog(false)
          setLinkUrl('')
          setLinkUrlError(null)
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
            onChange={(e) => {
              setLinkUrl(e.target.value)
              setLinkUrlError(null)
            }}
            error={Boolean(linkUrlError)}
            helperText={linkUrlError}
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
          setReplyToParentId(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { maxHeight: '80vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {(() => {
            if (isTeacher && dialogOpenUserId) {
              const sub = submissions.find((s) => s.user_id === dialogOpenUserId)
              return (
                getNameByUserId(courseMembers, dialogOpenUserId, sub?.author) || 'Студент'
              )
            }
            return 'Диалог с преподавателем'
          })()}
          <IconButton
            size="small"
            onClick={() => {
              setDialogOpenUserId(null)
              setReplyToStudent(null)
              setReplyToParentId(null)
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
              const dialogTree =
                isTeacher && dialogOpenUserId
                  ? getPersonalCommentsTreeForTeacher(
                      comments,
                      authUser?.id,
                      dialogOpenUserId,
                    )
                  : getPersonalCommentsTreeForStudent(comments, authUser?.id, teacherIds)
              return dialogTree.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Нет сообщений
                </Typography>
              ) : (
                <Box className="flex flex-col gap-2">
                  {dialogTree.map((c) => (
                    <PersonalCommentItem
                      key={c.id}
                      comment={c}
                      depth={0}
                      replyToParentId={replyToParentId}
                      onReply={setReplyToParentId}
                      onCancelReply={() => setReplyToParentId(null)}
                      renderReplyForm={(parentId) => (
                        <Box
                          component="form"
                          onSubmit={(e) => handleAddComment(e, { parent_id: parentId })}
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
                      )}
                      courseMembers={courseMembers}
                      authUserId={authUser?.id}
                      formatDate={formatDate}
                    />
                  ))}
                </Box>
              )
            })()}
          </Box>
          <Box className="flex flex-col gap-2 mt-4">
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
            <Box
              component="form"
              onSubmit={(e) => {
                const teacherIds = courseMembers
                  .filter((m) => m.role === 'teacher' || m.role === 'owner')
                  .map((m) => m.user_id)
                const dialogTree =
                  isTeacher && dialogOpenUserId
                    ? getPersonalCommentsTreeForTeacher(
                        comments,
                        authUser?.id,
                        dialogOpenUserId,
                      )
                    : getPersonalCommentsTreeForStudent(comments, authUser?.id, teacherIds)
                handleAddComment(
                  e,
                  replyToParentId
                    ? { parent_id: replyToParentId }
                    : dialogTree[0]
                      ? { parent_id: dialogTree[0].id }
                      : undefined,
                )
              }}
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
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
        aria-labelledby="delete-assignment-dialog-title"
      >
        <DialogTitle id="delete-assignment-dialog-title">Удалить задание?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Задание «{assignment?.title}» будет удалено безвозвратно вместе со всеми ответами и комментариями.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            Отмена
          </Button>
          <Button
            onClick={handleDeleteAssignment}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Удаление…' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
      {assignment && isTeacher && selectedSubmission && (
        <ReturnSubmissionConfirmDialog
          open={showReturnConfirm}
          onClose={() => setShowReturnConfirm(false)}
          onConfirm={() => performReturnSubmission(selectedSubmission.id)}
          studentName={
            getNameByUserId(courseMembers, selectedSubmission.user_id, selectedSubmission.author) ||
            'Студент'
          }
          loading={returnLoading[selectedSubmission.id]}
        />
      )}
      {assignment && !isTeacher && (
        <SubmitAssignmentConfirmDialog
          open={showSubmitConfirm}
          onClose={() => setShowSubmitConfirm(false)}
          onConfirm={performSubmit}
          assignmentTitle={assignment.title}
          assignmentDeadline={assignment.deadline}
          fileNames={answerFiles.map((f) => f.name)}
          linkUrls={answerLinks}
          draftFileIds={mySubmission?.file_ids ?? []}
          submitting={submitting}
        />
      )}
    </Box>
    </Container>
  )
}
