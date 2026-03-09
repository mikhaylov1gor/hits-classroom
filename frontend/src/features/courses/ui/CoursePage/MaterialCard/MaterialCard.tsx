import { useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CloseIcon from '@mui/icons-material/Close'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import LinkIcon from '@mui/icons-material/Link'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import {
  listMaterialComments,
  createMaterialComment,
  uploadFiles,
} from '../../../api/coursesApi'
import { useAuth } from '../../../../auth/model/AuthContext'
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined'
import {
  type Comment,
  type FeedItem,
  type Member,
  countCommentsRecursively,
  getNameByUserId,
} from '../../../model/types'

type MaterialCardProps = {
  item: FeedItem
  courseId: string
  authorName: string
  authorInitial: string
  onClick?: () => void
  courseMembers?: Member[]
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
  commentFiles,
  handleFileChange,
  removeCommentFile,
  handleSubmitComment,
  submittingComment,
  fileInputRef,
}: {
  commentText: string
  setCommentText: (v: string) => void
  commentFiles: File[]
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  removeCommentFile: (i: number) => void
  handleSubmitComment: (e: React.FormEvent) => void
  submittingComment: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
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
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          aria-label="Прикрепить файл к комментарию"
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
        {commentFiles.length > 0 && (
          <Box className="flex flex-wrap gap-1">
            {commentFiles.map((f, i) => (
              <Box
                key={`${f.name}-${i}`}
                className="flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 rounded text-xs"
              >
                <Typography variant="caption" className="truncate max-w-[80px]">
                  {f.name}
                </Typography>
                <IconButton
                  size="small"
                  sx={{ p: 0.25 }}
                  aria-label={`Удалить ${f.name}`}
                  onClick={() => removeCommentFile(i)}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
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

export function MaterialCard({
  item,
  courseId,
  authorName,
  authorInitial,
  onClick,
  courseMembers = [],
}: MaterialCardProps) {
  const { user: authUser } = useAuth()
  const getName = (userId: string, fallback?: { first_name?: string; last_name?: string } | null) =>
    getNameByUserId(courseMembers, userId, fallback)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [replyToParentId, setReplyToParentId] = useState<string | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showAddCommentInput, setShowAddCommentInput] = useState(false)
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!courseId) return
    setLoadingComments(true)
    listMaterialComments(courseId, item.id)
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
      const fileIds = commentFiles.length > 0 ? await uploadFiles(commentFiles) : []
      await createMaterialComment(courseId, item.id, {
        body: trimmed,
        parent_id: replyToParentId,
        file_ids: fileIds,
      })
      setCommentText('')
      setCommentFiles([])
      setReplyToParentId(null)
      setShowAddCommentInput(false)
      const list = await listMaterialComments(courseId, item.id)
      setComments(list)
    } catch {
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) {
      setCommentFiles((prev) => [...prev, ...Array.from(selected)])
    }
    e.target.value = ''
  }

  const removeCommentFile = (index: number) => {
    setCommentFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const content = item.body || item.title
  const displayDate = formatDate(item.created_at)
  const attachments = item.attachments ?? []
  const totalCommentsCount = countCommentsRecursively(comments)
  const hasComments = totalCommentsCount > 0

  return (
    <Box
      className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
      sx={
        onClick
          ? {
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
            }
          : undefined
      }
      onClick={onClick}
    >
      <Box className="p-4">
        <Box className="flex items-start gap-3">
          <Avatar
            sx={{
              bgcolor: 'info.main',
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
              </Box>
            </Box>
            <Typography
              variant="body2"
              className="text-slate-600 whitespace-pre-wrap"
              sx={{ lineHeight: 1.6 }}
            >
              {content}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        className="px-4 pb-4 pt-0 border-t border-slate-100"
        onClick={(e) => onClick && e.stopPropagation()}
      >
        {attachments.length > 0 && (
          <Box className="flex flex-col gap-2 mb-4">
            <Typography variant="subtitle2" className="text-slate-600">
              Вложения
            </Typography>
            <Box className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <Box
                  key={a.id}
                  className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <InsertDriveFileOutlinedIcon fontSize="small" color="action" />
                  <Typography variant="body2" className="font-medium">
                    {a.name}
                  </Typography>
                  {a.url && (
                    <IconButton
                      size="small"
                      component="a"
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Открыть ${a.name}`}
                    >
                      <LinkIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Box
          className="border-t border-slate-200 pt-4"
          onClick={(e) => onClick && e.stopPropagation()}
        >
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
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowAddCommentInput(true)
                  }}
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
                  commentFiles={commentFiles}
                  handleFileChange={handleFileChange}
                  removeCommentFile={removeCommentFile}
                  handleSubmitComment={handleSubmitComment}
                  submittingComment={submittingComment}
                  fileInputRef={fileInputRef}
                />
              )}
            </>
          ) : (
            <>
              <Box
                component="button"
                className="flex items-center gap-2 border-0 bg-transparent p-0 cursor-pointer text-left ml-4"
                onClick={(e) => {
                  e.stopPropagation()
                  setCommentsModalOpen(true)
                }}
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
                aria-labelledby="material-comments-dialog-title"
              >
                <DialogTitle id="material-comments-dialog-title">Комментарии</DialogTitle>
                <DialogContent className="flex flex-col gap-4">
                  <Box className="flex flex-col gap-3">
                    {comments.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        formatDate={formatDate}
                        onReply={(id) => setReplyToParentId(id)}
                        onCancelReply={() => {
                        setReplyToParentId(null)
                        setCommentText('')
                        setCommentFiles([])
                      }}
                        depth={0}
                        replyToParentId={replyToParentId}
                        authUserId={authUser?.id}
                        renderReplyForm={() => (
                          <CommentForm
                            commentText={commentText}
                            setCommentText={setCommentText}
                            commentFiles={commentFiles}
                            handleFileChange={handleFileChange}
                            removeCommentFile={removeCommentFile}
                            handleSubmitComment={handleSubmitComment}
                            submittingComment={submittingComment}
                            fileInputRef={fileInputRef}
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
                      commentFiles={commentFiles}
                      handleFileChange={handleFileChange}
                      removeCommentFile={removeCommentFile}
                      handleSubmitComment={handleSubmitComment}
                      submittingComment={submittingComment}
                      fileInputRef={fileInputRef}
                    />
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}
