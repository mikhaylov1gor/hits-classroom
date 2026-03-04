import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { listComments, listSubmissions, createComment } from '../../../api/coursesApi'
import { useAuth } from '../../../../auth/model/AuthContext'
import {
  type Comment,
  type FeedItem,
  type Submission,
  filterStudentComments,
  filterTeacherDialogComments,
} from '../../../model/types'

type Member = { user_id: string; role: string }

type AssignmentCardProps = {
  item: FeedItem
  courseId: string
  authorName: string
  onClick: () => void
  isTeacher?: boolean
  courseMembers?: Member[]
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

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Сегодня'
    if (diffDays === 1) return 'Вчера'
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  } catch {
    return ''
  }
}

export function AssignmentCard({
  item,
  courseId,
  authorName,
  onClick,
  isTeacher = false,
  courseMembers = [],
}: AssignmentCardProps) {
  const { user: authUser } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const [selectedDialogUserId, setSelectedDialogUserId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyToStudent, setReplyToStudent] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    setLoadingComments(true)
    Promise.all([
      listComments(courseId, item.id),
      isTeacher ? listSubmissions(courseId, item.id) : Promise.resolve([] as Submission[]),
    ])
      .then(([cm, sub]) => {
        setComments(cm)
        setSubmissions(sub)
      })
      .catch(() => {
        setComments([])
        setSubmissions([])
      })
      .finally(() => setLoadingComments(false))
  }, [item.id, courseId, isTeacher])

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || !courseId || submittingComment) return
    setSubmittingComment(true)
    try {
      const payload: { body: string; file_ids: string[]; user_id?: string } = {
        body: trimmed,
        file_ids: [],
      }
      if (replyToStudent) payload.user_id = replyToStudent
      const created = await createComment(courseId, item.id, payload)
      setComments((prev) => [...prev, created])
      setCommentText('')
      setCommentFiles([])
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) setCommentFiles((prev) => [...prev, ...Array.from(selected)])
    e.target.value = ''
  }

  const handleCloseCommentsModal = () => {
    setCommentsModalOpen(false)
    setSelectedDialogUserId(null)
    setReplyToStudent(null)
  }

  const displayDate = formatDate(item.created_at)
  const teacherIds = courseMembers
    .filter((m) => m.role === 'teacher' || m.role === 'owner')
    .map((m) => m.user_id)
  const myCommentsCount = isTeacher
    ? comments.length
    : filterStudentComments(comments, authUser?.id, teacherIds).length
  const hasComments = myCommentsCount > 0

  return (
    <Box className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <Box className="p-4">
        <Box className="flex items-start gap-3">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 0,
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AssignmentOutlinedIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box className="flex-1 min-w-0">
            <Box className="flex items-start justify-between gap-2">
              <Box
                className="flex-1 min-w-0 cursor-pointer"
                onClick={onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onClick()
                  }
                }}
                aria-label={`Открыть задание ${item.title}`}
              >
                <Typography variant="subtitle1" className="font-semibold text-slate-800 mb-0.5">
                  Пользователь {authorName} добавил задание: {item.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {displayDate}
                  {item.deadline && ` · Дедлайн: ${formatDate(item.deadline)}`}
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label="Меню"
                sx={{ p: 0.5 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuAnchor(e.currentTarget)
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box className="px-4 pb-4 pt-0 border-t border-slate-100">
        <Box className="border-t border-slate-200 pt-4">
          {loadingComments ? (
            <Typography variant="body2" color="text.secondary">
              Загрузка…
            </Typography>
          ) : (
            <Box
              component="button"
              className="flex items-center gap-2 border-0 bg-transparent p-0 cursor-pointer text-left w-full"
              onClick={(e) => {
                e.stopPropagation()
                if (!isTeacher) {
                  const teacherIds = courseMembers
                    .filter((m) => m.role === 'teacher' || m.role === 'owner')
                    .map((m) => m.user_id)
                  setSelectedDialogUserId(teacherIds[0] ?? 'teacher')
                }
                setCommentsModalOpen(true)
              }}
            >
              <ChatBubbleOutlineOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="body2" color="primary" className="font-medium">
                {hasComments
                  ? `Комментарии (${myCommentsCount})`
                  : 'Комментарии с преподавателем'}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            onClick()
          }}
        >
          Открыть задание
        </MenuItem>
      </Menu>

      <Dialog
        open={commentsModalOpen}
        onClose={handleCloseCommentsModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: selectedDialogUserId ? { maxHeight: '80vh' } : undefined }}
        aria-labelledby="assignment-comments-dialog-title"
      >
        <DialogTitle
          id="assignment-comments-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {selectedDialogUserId ? (
            <>
              {isTeacher && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setSelectedDialogUserId(null)
                    setReplyToStudent(null)
                  }}
                  aria-label="Назад"
                >
                  <ArrowBackIcon />
                </IconButton>
              )}
              {(() => {
                if (isTeacher) {
                  const sub = submissions.find((s) => s.user_id === selectedDialogUserId)
                  return sub?.author
                    ? `${sub.author.first_name} ${sub.author.last_name}`.trim()
                    : 'Студент'
                }
                return `Комментарии: ${item.title}`
              })()}
            </>
          ) : (
            `Комментарии: ${item.title}`
          )}
        </DialogTitle>
        <DialogContent dividers={!!selectedDialogUserId} className="flex flex-col gap-4">
          {!selectedDialogUserId ? (
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
                const commentAuthor = comments.find((c) => c.user_id === uid)?.author
                const name = sub?.author
                  ? `${sub.author.first_name} ${sub.author.last_name}`.trim()
                  : commentAuthor
                    ? `${commentAuthor.first_name} ${commentAuthor.last_name}`.trim()
                    : 'Студент'
                return { uid, name, firstComment: first }
              })
              return dialogs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Нет диалогов
                </Typography>
              ) : (
                <Box className="flex flex-col gap-2">
                  {dialogs.map((d) => (
                    <Box
                      key={d.uid}
                      component="button"
                      type="button"
                      className="w-full text-left border rounded-lg p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      sx={{ borderColor: 'grey.300' }}
                      onClick={() => {
                        setSelectedDialogUserId(d.uid)
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
                  ))}
                </Box>
              )
            })()
          ) : (
            <>
              <Box className="flex flex-col gap-2">
                {(() => {
                  const teacherIds = courseMembers
                    .filter((m) => m.role === 'teacher' || m.role === 'owner')
                    .map((m) => m.user_id)
                  const dialogComments =
                    isTeacher && selectedDialogUserId
                      ? filterTeacherDialogComments(
                          comments,
                          authUser?.id,
                          selectedDialogUserId,
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
                          · {formatDateTime(c.created_at)}
                        </Typography>
                      </Box>
                    ))
                  )
                })()}
              </Box>
              <Box
                component="form"
                onSubmit={handleAddComment}
                className="flex flex-col gap-2 mt-2"
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
                    type="file"
                    multiple
                    className="hidden"
                    id={`comment-file-${item.id}`}
                    onChange={handleCommentFileChange}
                    aria-label="Прикрепить файл"
                  />
                  <Button
                    component="span"
                    variant="outlined"
                    size="small"
                    startIcon={<AttachFileOutlinedIcon />}
                    onClick={() =>
                      document.getElementById(`comment-file-${item.id}`)?.click()
                    }
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
