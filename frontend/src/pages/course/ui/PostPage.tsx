import {
  Avatar,
  Box,
  Button,
  Container,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import LinkIcon from '@mui/icons-material/Link'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  getCourseFeed,
  getCourse,
  listPostComments,
  createPostComment,
  uploadFiles,
  listCourseMembers,
} from '../../../features/courses/api/coursesApi'
import { useAuth } from '../../../features/auth/model/AuthContext'
import {
  type Comment,
  type FeedItem,
  type Member,
  countCommentsRecursively,
  getNameByUserId,
  getInitialsFromMember,
} from '../../../features/courses/model/types'

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
  const location = useLocation()
  const { user: authUser } = useAuth()
  const [post, setPost] = useState<FeedItem | null>(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stateItem = (location.state as { post?: FeedItem })?.post

  useEffect(() => {
    if (!courseId || !postId) {
      navigate('/')
      return
    }
    if (stateItem && stateItem.type === 'post' && stateItem.id === postId) {
      setPost(stateItem)
      setLoading(false)
      Promise.all([
        getCourse(courseId).then((c) => setCourseTitle(c.title)),
        listCourseMembers(courseId).then(setMembers).catch(() => setMembers([])),
        listPostComments(courseId, postId).then(setComments).catch(() => setComments([])),
      ]).catch(() => {})
      return
    }
    setLoading(true)
    Promise.all([
      getCourse(courseId),
      getCourseFeed(courseId),
      listCourseMembers(courseId),
    ])
      .then(([c, feed, m]) => {
        setCourseTitle(c.title)
        setMembers(m ?? [])
        const found = feed.find((f) => f.type === 'post' && f.id === postId) ?? null
        setPost(found)
        return found ? listPostComments(courseId, postId) : []
      })
      .then((cm) => setComments(Array.isArray(cm) ? cm : []))
      .catch(() => {
        setPost(null)
        setComments([])
      })
      .finally(() => setLoading(false))
  }, [courseId, postId, stateItem, navigate])

  useEffect(() => {
    if (post && courseId && postId && !stateItem) {
      listPostComments(courseId, postId).then(setComments).catch(() => {})
    }
  }, [post, courseId, postId, stateItem])

  const handleBack = () => {
    navigate(courseId ? `/course/${courseId}` : '/')
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || !courseId || !postId || submittingComment) return
    setSubmittingComment(true)
    try {
      const fileIds = commentFiles.length > 0 ? await uploadFiles(commentFiles) : []
      const created = await createPostComment(courseId, postId, {
        body: trimmed,
        file_ids: fileIds,
      })
      setComments((prev) => [...prev, created])
      setCommentText('')
      setCommentFiles([])
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

  const attachments = post.attachments ?? []
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
            {courseTitle}
          </Typography>
        </Box>

        <Box className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <Box className="flex items-start gap-3 mb-4">
            <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48, fontSize: '1.25rem' }}>
              {authorInitial}
            </Avatar>
            <Box className="flex-1 min-w-0">
              <Typography variant="h6" className="font-semibold text-slate-800">
                {post.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {authorName} · {formatDate(post.created_at)}
              </Typography>
            </Box>
          </Box>
          <Typography variant="body1" className="whitespace-pre-wrap text-slate-700 mb-6">
            {post.body || '—'}
          </Typography>
          {attachments.length > 0 && (
            <Box className="mb-4">
              <Typography variant="subtitle2" className="text-slate-600 mb-2">
                Прикреплённые материалы
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
            <Typography variant="subtitle2" className="text-slate-600 mb-3">
              Комментарии ({countCommentsRecursively(comments)})
            </Typography>
            <Box className="flex flex-col gap-3 mb-4">
              {comments.map((c) => {
                const isOwn = authUser?.id && c.user_id === authUser.id
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
                      {getNameByUserId(members, c.user_id, c.author)}{' '}
                      · {formatDate(c.created_at)}
                    </Typography>
                  </Box>
                )
              })}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files
                    if (selected) setCommentFiles((prev) => [...prev, ...Array.from(selected)])
                    e.target.value = ''
                  }}
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
                {commentFiles.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {commentFiles.map((f) => f.name).join(', ')}
                  </Typography>
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
          </Box>
        </Box>
      </Box>
    </Container>
  )
}

export default PostPage
