import {
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
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  getMaterial,
  getCourse,
  listCourseMembers,
  deleteMaterial,
} from '../../../features/courses/api/coursesApi'
import type { Material } from '../../../features/courses/api/coursesApi'
import { FileAttachmentLink } from '../../../features/courses/ui/FileAttachmentLink/FileAttachmentLink'
import {
  type Member,
  getNameByUserId,
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

export function MaterialPage() {
  const { courseId, materialId } = useParams<{ courseId: string; materialId: string }>()
  const navigate = useNavigate()
  const [material, setMaterial] = useState<Material | null>(null)
  const [course, setCourse] = useState<{ title: string; role?: string } | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false)

  useEffect(() => {
    if (!courseId || !materialId) {
      navigate('/')
      return
    }
    setLoading(true)
    Promise.all([
      getCourse(courseId),
      getMaterial(courseId, materialId),
      listCourseMembers(courseId),
    ])
      .then(([c, m, mem]) => {
        setCourse(c)
        setMaterial(m)
        setMembers(mem ?? [])
      })
      .catch(() => setMaterial(null))
      .finally(() => setLoading(false))
  }, [courseId, materialId, navigate])

  const handleBack = () => {
    navigate(courseId ? `/course/${courseId}` : '/')
  }

  const handleDeleteMaterial = async () => {
    if (!courseId || !materialId) return
    setDeleteLoading(true)
    try {
      await deleteMaterial(courseId, materialId)
      setDeleteDialogOpen(false)
      navigate(`/course/${courseId}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const canDelete = course?.role === 'owner' || course?.role === 'teacher'

  if (!courseId || !materialId) return null

  if (loading && !material) {
    return (
      <Box className="flex justify-center items-center py-20">
        <Typography color="text.secondary">Загрузка…</Typography>
      </Box>
    )
  }

  if (!material) {
    return (
      <Container maxWidth="lg" disableGutters>
        <Box className="py-8 px-4">
          <Typography color="error">Материал не найден</Typography>
          <Button onClick={handleBack} className="mt-4">
            Назад к курсу
          </Button>
        </Box>
      </Container>
    )
  }

  const links = material.links ?? []
  const fileIds = material.file_ids ?? []
  const attachments = fileIds.map((id, i) => ({ id, name: `Файл ${i + 1}` }))
  const authorName =
    (material.user_id
      ? getNameByUserId(members, material.user_id, material.author)
      : material.author
        ? `${material.author.first_name} ${material.author.last_name}`.trim()
        : null) || 'Преподаватель'

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

        <Box className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <Box className="flex items-center justify-between gap-2 mb-2">
            <Typography variant="h5" className="font-semibold text-slate-800">
              {material.title}
            </Typography>
            {canDelete && (
              <IconButton
                size="small"
                aria-label="Меню"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
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
              Удалить материал
            </MenuItem>
          </Menu>
          <Typography variant="body2" color="text.secondary" className="mb-4">
            {authorName} · {formatDate(material.created_at)}
          </Typography>
          {material.body && material.body.trim() && (
            <Typography variant="body1" className="whitespace-pre-wrap text-slate-700 mb-6">
              {material.body}
            </Typography>
          )}
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
            <Box>
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
                sx={{ textTransform: 'none' }}
              >
                Прикреплённые материалы ({attachments.length})
              </Button>
              {attachmentsExpanded && (
                <Box className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((a) => (
                    <FileAttachmentLink
                      key={a.id}
                      attachment={a}
                      fileSource={
                        courseId && materialId
                          ? { type: 'material', courseId, materialId }
                          : undefined
                      }
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
          aria-labelledby="delete-material-dialog-title"
        >
          <DialogTitle id="delete-material-dialog-title">Удалить материал?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Материал «{material.title}» будет удалён безвозвратно.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
              Отмена
            </Button>
            <Button
              onClick={handleDeleteMaterial}
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

export default MaterialPage
