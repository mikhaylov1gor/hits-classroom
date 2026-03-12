import {
  Avatar,
  Box,
  Button,
  Container,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  getPost,
  getCourse,
  listPostComments,
  createPostComment,
  deletePost,
  listCourseMembers,
} from '../../../features/courses/api/coursesApi'
import { FileAttachmentLink } from '../../../features/courses/ui/FileAttachmentLink/FileAttachmentLink'
import { useAuth } from '../../../features/auth/model/AuthContext'
import type { Post } from '../../../features/courses/model/types'
import {
  type Comment,
  type Member,
  buildCommentTree,
  countCommentsRecursively,
  getNameByUserId,
  getInitialsFromMember,
} from '../../../features/courses/model/types'

function CommentTreeItem({
  comment,
  depth,
  members,
  authUserId,
  formatDate,
}: {
  comment: Comment
  depth: number
  members: Member[]
  authUserId?: string
  formatDate: (s?: string) => string
}) {
  const authorName = getNameByUserId(members, comment.user_id, comment.author)
  const isOwn = authUserId && comment.user_id === authUserId
  return (
    <Box
      sx={{
        ml: depth > 0 ? 3 : 0,
        pl: depth > 0 ? 2 : 0,
        borderLeft: depth > 0 ? '2px solid' : 'none',
        borderColor: 'grey.300',
      }}
    >
      <Box
        className="p-3 rounded-lg mb-2"
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
        <Typography variant="caption" color="text.secondary">
          {authorName} · {formatDate(comment.created_at)}
        </Typography>
      </Box>
      {comment.replies && comment.replies.length > 0 && (
        <Box className="flex flex-col gap-2">
          {comment.replies.map((r) => (
            <CommentTreeItem
              key={r.id}
              comment={r}
              depth={depth + 1}
              members={members}
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

export function PostPage() {
  const { courseId, postId } = useParams<{ courseId: string; postId: string }>()
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [course, setCourse] = useState<{ title: string; role?: string } | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [loading, setLoading] = useState(true)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!courseId || !postId) {
      navigate('/')
      return
    }
    setLoading(true)
    Promise.all([
      getCourse(courseId),
      getPost(courseId, postId),
      listCourseMembers(courseId),
      listPostComments(courseId, postId),
    ])
      .then(([c, p, m, cm]) => {
        setCourse(c)
        setPost(p)
        setMembers(m ?? [])
        setComments(Array.isArray(cm) ? cm : [])
      })
      .catch(() => {
        setPost(null)
        setComments([])
      })
      .finally(() => setLoading(false))
  }, [courseId, postId, navigate])

  const canDeletePost = post && (
    post.user_id === authUser?.id ||
    course?.role === 'owner' ||
    course?.role === 'teacher'
  )

  const handleBack = () => {
    navigate(courseId ? `/course/${courseId}` : '/')
  }

  const handleDeletePost = async () => {
    if (!courseId || !postId) return
    setDeleteLoading(true)
    try {
      await deletePost(courseId, postId)
      setDeleteDialogOpen(false)
      navigate(`/course/${courseId}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || !courseId || !postId || submittingComment) return
    setSubmittingComment(true)
    try {
      const created = await createPostComment(courseId, postId, {
        body: trimmed,
      })
      setComments((prev) => [...prev, created])
      setCommentText('')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (!courseId || !postId) return null

  if (loading && !post) {
    return (
      <Box className="flex justify-center items-center py-20">
        <Typography color="text.secondary">Загрузка…</Typography>
      </Box>
    )
  }

  if (!post) {
    return (
      <Container maxWidth="lg" disableGutters>
        <Box className="py-8 px-4">
          <Typography color="error">Пост не найден</Typography>
          <Button onClick={handleBack} className="mt-4">
            Назад к курсу
          </Button>
        </Box>
      </Container>
    )
  }

  const links = post.links ?? []
  const fileIds = post.file_ids ?? []
  const attachments = fileIds.map((id, i) => ({ id, name: `Файл ${i + 1}` }))
  const authorName =
    (post.user_id
      ? getNameByUserId(members, post.user_id, post.author)
      : post.author
        ? `${post.author.first_name} ${post.author.last_name}`.trim()
        : null) || 'Преподаватель'
  const authorInitial = getInitialsFromMember(
    members,
    post.user_id ?? '',
    post.author,
  )

  return (
    <Container maxWidth="lg" disableGutters>
      <Box className="flex flex-col min-w-0 py-4">
        <Box className="flex items-center gap-2 mb-4">
          <IconButton onClick={handleBack} aria-label="Назад к курсу" size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            {course?.title}
          </Typography>
        </Box>

        <Box className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <Box className="flex items-start gap-3 mb-4">
            <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48, fontSize: '1.25rem' }}>
              {authorInitial}
            </Avatar>
            <Box className="flex-1 min-w-0">
              <Box className="flex items-center justify-between gap-2">
                <Typography variant="h6" className="font-semibold text-slate-800">
                  {post.title}
                </Typography>
                {canDeletePost && (
                  <IconButton
                    size="small"
                    aria-label="Меню"
                    onClick={(e) => setMenuAnchor(e.currentTarget)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {authorName} · {formatDate(post.created_at)}
              </Typography>
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
                setDeleteDialogOpen(true)
              }}
              sx={{ color: 'error.main' }}
            >
              <DeleteOutlinedIcon sx={{ mr: 1, fontSize: 20 }} />
              Удалить пост
            </MenuItem>
          </Menu>
          <Typography variant="body1" className="whitespace-pre-wrap text-slate-700 mb-6">
            {post.body || '—'}
          </Typography>
          {links.length > 0 && (
            <Box className="mb-4">
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Ссылки
              </Typography>
              <Box className="flex flex-col gap-1">
                {links.map((url, i) => (
                  <Typography
                    key={i}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2"
                    className="text-primary-600 hover:underline break-all"
                  >
                    {url}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
          {attachments.length > 0 && (
            <Box className="mb-4">
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Прикреплённые материалы
              </Typography>
              <Box className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <FileAttachmentLink
                    key={a.id}
                    attachment={a}
                    fileSource={
                      courseId && postId
                        ? { type: 'post', courseId, postId }
                        : undefined
                    }
                  />
                ))}
              </Box>
            </Box>
          )}

          <Box className="border-t border-slate-200 pt-4">
            <Typography variant="subtitle2" className="text-slate-600 mb-3">
              Комментарии ({countCommentsRecursively(comments)})
            </Typography>
            <Box className="flex flex-col gap-3 mb-4">
              {buildCommentTree(comments).map((c) => (
                <CommentTreeItem
                  key={c.id}
                  comment={c}
                  depth={0}
                  members={members}
                  authUserId={authUser?.id}
                  formatDate={formatDate}
                />
              ))}
            </Box>
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
              Пост «{post.title}» будет удалён безвозвратно.
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
    </Container>
  )
}

export default PostPage
