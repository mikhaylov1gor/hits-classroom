import {
  Box,
  Button,
  Container,
  IconButton,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import LinkIcon from '@mui/icons-material/Link'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getCourseFeed, getCourse } from '../../../features/courses/api/coursesApi'
import type { FeedItem } from '../../../features/courses/model/types'

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
  const location = useLocation()
  const [material, setMaterial] = useState<FeedItem | null>(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [loading, setLoading] = useState(true)

  const stateItem = (location.state as { material?: FeedItem })?.material

  useEffect(() => {
    if (!courseId || !materialId) {
      navigate('/')
      return
    }
    if (stateItem && stateItem.type === 'material' && stateItem.id === materialId) {
      setMaterial(stateItem)
      setLoading(false)
      getCourse(courseId).then((c) => setCourseTitle(c.title)).catch(() => {})
      return
    }
    setLoading(true)
    Promise.all([getCourse(courseId), getCourseFeed(courseId)])
      .then(([c, feed]) => {
        setCourseTitle(c.title)
        const found = feed.find(
          (f) => f.type === 'material' && f.id === materialId,
        ) ?? null
        setMaterial(found)
      })
      .catch(() => setMaterial(null))
      .finally(() => setLoading(false))
  }, [courseId, materialId, stateItem, navigate])

  const handleBack = () => {
    navigate(courseId ? `/course/${courseId}` : '/')
  }

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

  const attachments = material.attachments ?? []
  const authorName = material.author
    ? `${material.author.first_name} ${material.author.last_name}`.trim()
    : 'Преподаватель'

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

        <Box className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <Typography variant="h5" className="font-semibold text-slate-800 mb-2">
            {material.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" className="mb-4">
            {authorName} · {formatDate(material.created_at)}
          </Typography>
          <Typography variant="body1" className="whitespace-pre-wrap text-slate-700 mb-6">
            {material.body || '—'}
          </Typography>
          {attachments.length > 0 && (
            <Box>
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
        </Box>
      </Box>
    </Container>
  )
}

export default MaterialPage
