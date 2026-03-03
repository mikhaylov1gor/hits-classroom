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
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import { listComments, createComment } from '../../../api/coursesApi'
import type { Comment, FeedItem } from '../../../model/types'

type PostCardProps = {
  item: FeedItem
  courseId: string
  authorName: string
  authorInitial: string
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
  fileInputRef: React.RefObject<HTMLInputElement>
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

export function PostCard({
  item,
  courseId,
  authorName,
  authorInitial,
}: PostCardProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showAddCommentInput, setShowAddCommentInput] = useState(false)
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!courseId) return
    setLoadingComments(true)
    listComments(courseId, item.id)
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
      const created = await createComment(courseId, item.id, {
        body: trimmed,
        file_ids: [],
      })
      setComments((prev) => [...prev, created])
      setCommentText('')
      setCommentFiles([])
      setShowAddCommentInput(false)
    } catch {
      // TODO: show error
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
  const hasComments = comments.length > 0

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
                <IconButton size="small" aria-label="Меню" sx={{ p: 0.5 }}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
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

      <Box className="px-4 pb-4 pt-0 border-t border-slate-100">
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
                  onClick={() => setCommentsModalOpen(true)}
                >
                  <ChatBubbleOutlineOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="body2" color="primary" className="font-medium">
                    Комментарии ({comments.length})
                  </Typography>
                </Box>
                <Dialog
                  open={commentsModalOpen}
                  onClose={() => setCommentsModalOpen(false)}
                  maxWidth="sm"
                  fullWidth
                  aria-labelledby="comments-dialog-title"
                >
                  <DialogTitle id="comments-dialog-title">Комментарии</DialogTitle>
                  <DialogContent className="flex flex-col gap-4">
                    <Box className="flex flex-col gap-3">
                      {comments.map((c) => (
                        <Box
                          key={c.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <Typography variant="body2" className="text-slate-700">
                            {c.body || '(без текста)'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {c.author
                              ? `${c.author.first_name} ${c.author.last_name}`.trim()
                              : 'Участник'}{' '}
                            · {formatDate(c.created_at)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
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
                  </DialogContent>
                </Dialog>
              </>
            )}
          </Box>
        </Box>
    </Box>
  )
}
