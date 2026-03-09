import { useEffect, useRef, useState } from 'react'
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
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined'
import {
  listAssignmentComments,
  createAssignmentComment,
  uploadFiles,
} from '../../../api/coursesApi'
import { useAuth } from '../../../../auth/model/AuthContext'
import {
  type Comment,
  type FeedItem,
  type Member,
  countCommentsRecursively,
  getGeneralComments,
  getNameByUserId,
} from '../../../model/types'

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

function GeneralCommentItem({
  comment,
  depth,
  replyToParentId,
  onReply,
  onCancelReply,
  renderReplyForm,
  courseMembers,
  authUserId,
  formatDateTime,
}: {
  comment: Comment
  depth: number
  replyToParentId: string | null
  onReply: (parentId: string) => void
  onCancelReply: () => void
  renderReplyForm: (parentId: string) => React.ReactNode
  courseMembers: Member[]
  authUserId?: string
  formatDateTime: (s?: string) => string
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
            {authorName} · {formatDateTime(comment.created_at)}
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
              formatDateTime={formatDateTime}
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
  const [loadingComments, setLoadingComments] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyToParentId, setReplyToParentId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!courseId) return
    setLoadingComments(true)
    listAssignmentComments(courseId, item.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false))
  }, [item.id, courseId])

  const handleAddComment = async (
    e: React.FormEvent,
    opts?: { isGeneral?: boolean; parent_id?: string | null },
  ) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || !courseId || submittingComment) return
    setSubmittingComment(true)
    try {
      const fileIds = commentFiles.length > 0 ? await uploadFiles(commentFiles) : []
      const payload: {
        body: string
        file_ids: string[]
        parent_id?: string | null
      } = { body: trimmed, file_ids: fileIds }
      if (opts?.parent_id != null) payload.parent_id = opts.parent_id
      const created = await createAssignmentComment(courseId, item.id, payload)
      const refreshed = await listAssignmentComments(courseId, item.id)
      setComments(refreshed)
      setCommentText('')
      setCommentFiles([])
      setReplyToParentId(null)
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
    setReplyToParentId(null)
  }

  const displayDate = formatDate(item.created_at)
  const generalCount = countCommentsRecursively(getGeneralComments(comments))
  const hasComments = generalCount > 0

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
                  {item.deadline && ` · Дедлайн: ${formatDateTime(item.deadline)}`}
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
                setCommentsModalOpen(true)
              }}
            >
              <ChatBubbleOutlineOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="body2" color="primary" className="font-medium">
                {hasComments
                  ? `Комментарии (${generalCount})`
                  : 'Общие комментарии'}
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
        <MenuItem
          onClick={() => {
            const url = `${window.location.origin}/course/${courseId}/assignment/${item.id}`
            navigator.clipboard.writeText(url)
            setMenuAnchor(null)
          }}
        >
          <ContentCopyOutlinedIcon sx={{ mr: 1, fontSize: 20 }} />
          Копировать ссылку
        </MenuItem>
      </Menu>

      <Dialog
        open={commentsModalOpen}
        onClose={handleCloseCommentsModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { maxHeight: '80vh' } }}
        aria-labelledby="assignment-comments-dialog-title"
      >
        <DialogTitle id="assignment-comments-dialog-title">
          Комментарии: {item.title}
        </DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4">
          <Box className="flex flex-col gap-4">
            <Typography variant="subtitle2" className="text-slate-600 mb-2">
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
                        <input
                          ref={fileInputRef}
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
                          onClick={() => fileInputRef.current?.click()}
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
                          formatDateTime={formatDateTime}
                        />
                      ))}
                      {!replyToParentId && (
                        <Box
                          component="form"
                          onSubmit={(e) => handleAddComment(e)}
                          className="flex flex-col gap-2 mt-2"
                        >
                          <TextField
                            label="Написать комментарий"
                            fullWidth
                            multiline
                            minRows={2}
                            size="small"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Введите комментарий..."
                            inputProps={{ 'aria-label': 'Текст комментария' }}
                          />
                          <Box className="flex items-center gap-2">
                            <input
                              ref={fileInputRef}
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
                              onClick={() => fileInputRef.current?.click()}
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
                    </Box>
                  )
                })()}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
