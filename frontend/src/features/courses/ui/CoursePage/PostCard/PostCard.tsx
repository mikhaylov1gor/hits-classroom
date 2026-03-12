import { useEffect, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import {
  listPostComments,
  createPostComment,
  deletePost,
  getPost,
} from '../../../api/coursesApi'
import { FileAttachmentLink } from '../../FileAttachmentLink/FileAttachmentLink'
import { getLinkHref } from '../../../utils/urlValidation'
import LinkIcon from '@mui/icons-material/Link'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../../auth/model/AuthContext'
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined'
import {
  type Comment,
  type FeedItem,
  type Member,
  type Post,
  buildCommentTree,
  countCommentsRecursively,
  getNameByUserId,
} from '../../../model/types'

type PostCardProps = {
  item: FeedItem
  courseId: string
  authorName: string
  authorInitial: string
  courseMembers?: Member[]
  isTeacher?: boolean
  isAuthor?: boolean
  onDeleted?: () => void
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

function CommentForm({
  commentText,
  setCommentText,
  handleSubmitComment,
  submittingComment,
}: {
  commentText: string
  setCommentText: (v: string) => void
  handleSubmitComment: (e: React.FormEvent) => void
  submittingComment: boolean
}) {
  return (
    <Box component="form" onSubmit={handleSubmitComment} className="flex flex-col gap-2">
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
        <Button
          type="submit"
          variant="contained"
          size="small"
          endIcon={<SendOutlinedIcon />}
          disabled={submittingComment || !commentText.trim()}
        >
          Отправить
        </Button>
      </Box>
    </Box>
  )
}

function CommentItem({
  comment,
  formatDate,
  onReply,
  onCancelReply,
  depth,
  replyToParentId,
  renderReplyForm,
  getName,
  authUserId,
}: {
  comment: Comment
  formatDate: (s?: string) => string
  onReply: (parentId: string) => void
  onCancelReply: () => void
  depth: number
  replyToParentId: string | null
  renderReplyForm: (parentId: string) => React.ReactNode
  getName: (userId: string, fallback?: { first_name?: string; last_name?: string } | null) => string
  authUserId?: string
}) {
  const authorName = getName(comment.user_id, comment.author)
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
            <CommentItem
              key={r.id}
              comment={r}
              formatDate={formatDate}
              onReply={onReply}
              onCancelReply={onCancelReply}
              depth={depth + 1}
              replyToParentId={replyToParentId}
              renderReplyForm={renderReplyForm}
              getName={getName}
              authUserId={authUserId}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

export function PostCard({
  item,
  courseId,
  authorName,
  authorInitial,
  courseMembers = [],
  isTeacher = false,
  isAuthor = false,
  onDeleted,
}: PostCardProps) {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const getName = (userId: string, fallback?: { first_name?: string; last_name?: string } | null) =>
    getNameByUserId(courseMembers, userId, fallback)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [replyToParentId, setReplyToParentId] = useState<string | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showAddCommentInput, setShowAddCommentInput] = useState(false)
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [fullPost, setFullPost] = useState<Post | null>(null)
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false)

  const canDelete = isTeacher || isAuthor

  useEffect(() => {
    if (!courseId || item.type !== 'post') return
    getPost(courseId, item.id)
      .then(setFullPost)
      .catch(() => setFullPost(null))
  }, [courseId, item.id, item.type])

  useEffect(() => {
    if (!courseId) return
    setLoadingComments(true)
    listPostComments(courseId, item.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false))
  }, [item.id, courseId])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed) return

    setSubmittingComment(true)
    try {
      await createPostComment(courseId, item.id, {
        body: trimmed,
        parent_id: replyToParentId,
      })
      setCommentText('')
      setReplyToParentId(null)
      setShowAddCommentInput(false)
      const list = await listPostComments(courseId, item.id)
      setComments(list)
    } catch {
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeletePost = async () => {
    if (!courseId) return
    setDeleteLoading(true)
    try {
      await deletePost(courseId, item.id)
      setDeleteDialogOpen(false)
      onDeleted?.()
    } finally {
      setDeleteLoading(false)
    }
  }

  const data = fullPost ?? item
  const content = data.body || data.title
  const displayDate = formatDate(data.created_at ?? item.created_at)
  const links = (fullPost?.links ?? item.links) ?? []
  const fileIds = fullPost?.file_ids ?? item.file_ids ?? []
  const attachments =
    (fullPost?.attachments ?? item.attachments) && (fullPost?.attachments ?? item.attachments)!.length > 0
      ? (fullPost?.attachments ?? item.attachments)!
      : fileIds.map((id, i) => ({ id, name: `Файл ${i + 1}` }))
  const totalCommentsCount = countCommentsRecursively(comments)
  const hasComments = totalCommentsCount > 0

  const BODY_PREVIEW_LENGTH = 300
  const isBodyLong = (content?.length ?? 0) > BODY_PREVIEW_LENGTH
  const displayContent =
    isBodyLong && !bodyExpanded
      ? `${content!.slice(0, BODY_PREVIEW_LENGTH)}…`
      : content

  return (
    <Box className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <Box className="p-4">
        <Box className="flex items-start gap-3">
          <Avatar
            sx={{
              bgcolor: 'secondary.main',
              width: 40,
              height: 40,
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            {authorInitial}
          </Avatar>
          <Box className="flex-1 min-w-0">
            <Box className="flex items-center justify-between gap-2 mb-1">
              <Typography variant="subtitle1" className="font-semibold text-slate-800">
                {item.title}
              </Typography>
              <Box className="flex items-center gap-2 shrink-0">
                <Typography variant="caption" color="text.secondary">
                  {authorName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {displayDate}
                </Typography>
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
                <Menu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={() => setMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null)
                      navigate(`/course/${courseId}/post/${item.id}`)
                    }}
                  >
                    Открыть пост
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      const url = `${window.location.origin}/course/${courseId}/post/${item.id}`
                      navigator.clipboard.writeText(url)
                      setMenuAnchor(null)
                    }}
                  >
                    <ContentCopyOutlinedIcon sx={{ mr: 1, fontSize: 20 }} />
                    Копировать ссылку
                  </MenuItem>
                  {canDelete && (
                    <MenuItem
                      onClick={() => {
                        setMenuAnchor(null)
                        setDeleteDialogOpen(true)
                      }}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteOutlinedIcon sx={{ mr: 1, fontSize: 20 }} />
                      Удалить пост
                    </MenuItem>
                  )}
                </Menu>
              </Box>
            </Box>
            {(content || data.title) && (
              <>
                <Typography
                  variant="body2"
                  className="text-slate-600 whitespace-pre-wrap"
                  sx={{
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {displayContent}
                </Typography>
                {isBodyLong && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setBodyExpanded((v) => !v)}
                    startIcon={bodyExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ mt: 0.5, textTransform: 'none' }}
                  >
                    {bodyExpanded ? 'Свернуть' : 'Развернуть'}
                  </Button>
                )}
              </>
            )}
          </Box>
        </Box>
      </Box>

      <Box className="px-4 pb-4 pt-0 border-t border-slate-100">
          {(links.length > 0 || attachments.length > 0) && (
            <Box className="flex flex-col gap-2 mb-4">
              <Button
                size="small"
                variant="text"
                startIcon={
                  attachmentsExpanded ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )
                }
                onClick={() => setAttachmentsExpanded((v) => !v)}
                sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
              >
                Вложения ({links.length + attachments.length})
              </Button>
              {attachmentsExpanded && (
                <Box className="flex flex-col gap-2 w-full">
                  {links.map((url, i) => (
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
                        sx={{ color: 'primary.main', wordBreak: 'break-all' }}
                      >
                        {url}
                      </Typography>
                    </Box>
                  ))}
                  {attachments.map((a) => (
                    <Box key={a.id} className="w-full">
                      <FileAttachmentLink
                        attachment={{ id: a.id, name: a.name || 'Файл' }}
                        fileSource={{ type: 'post', courseId, postId: item.id }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          <Box className="border-t border-slate-200 pt-4">
            {loadingComments ? (
              <Typography variant="body2" color="text.secondary">
                Загрузка…
              </Typography>
            ) : !hasComments ? (
              <>
                {!showAddCommentInput ? (
                  <Box
                    component="button"
                    className="flex items-center gap-2 border-0 bg-transparent p-0 cursor-pointer text-left ml-4"
                    onClick={() => setShowAddCommentInput(true)}
                  >
                    <ChatBubbleOutlineOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="body2" color="primary" className="font-medium">
                      Добавить комментарий
                    </Typography>
                  </Box>
                ) : (
                  <CommentForm
                    commentText={commentText}
                    setCommentText={setCommentText}
                    handleSubmitComment={handleSubmitComment}
                    submittingComment={submittingComment}
                  />
                )}
              </>
            ) : (
              <>
                <Box
                  component="button"
                  className="flex items-center gap-2 border-0 bg-transparent p-0 cursor-pointer text-left ml-4"
                  onClick={() => setCommentsModalOpen(true)}
                >
                  <ChatBubbleOutlineOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="body2" color="primary" className="font-medium">
                    Комментарии ({totalCommentsCount})
                  </Typography>
                </Box>
                <Dialog
                  open={commentsModalOpen}
                  onClose={() => {
                    setCommentsModalOpen(false)
                    setReplyToParentId(null)
                  }}
                  maxWidth="sm"
                  fullWidth
                  aria-labelledby="comments-dialog-title"
                >
                  <DialogTitle id="comments-dialog-title">Комментарии</DialogTitle>
                  <DialogContent className="flex flex-col gap-4">
                    <Box className="flex flex-col gap-3">
                      {buildCommentTree(comments).map((c) => (
                        <CommentItem
                          key={c.id}
                          comment={c}
                          formatDate={formatDate}
                          onReply={(id) => setReplyToParentId(id)}
                          onCancelReply={() => {
                    setReplyToParentId(null)
                    setCommentText('')
                  }}
                          depth={0}
                          replyToParentId={replyToParentId}
                          authUserId={authUser?.id}
                          renderReplyForm={() => (
                            <CommentForm
                              commentText={commentText}
                              setCommentText={setCommentText}
                              handleSubmitComment={handleSubmitComment}
                              submittingComment={submittingComment}
                            />
                          )}
                          getName={getName}
                        />
                      ))}
                    </Box>
                    {!replyToParentId && (
                      <CommentForm
                        commentText={commentText}
                        setCommentText={setCommentText}
                        handleSubmitComment={handleSubmitComment}
                        submittingComment={submittingComment}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </>
            )}
          </Box>
        </Box>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
        aria-labelledby="delete-post-dialog-title"
      >
        <DialogTitle id="delete-post-dialog-title">Удалить пост?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Пост «{item.title}» будет удалён безвозвратно.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            Отмена
          </Button>
          <Button
            onClick={handleDeletePost}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Удаление…' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
