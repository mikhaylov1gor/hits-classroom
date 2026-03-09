import { useRef, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CloseIcon from '@mui/icons-material/Close'
import { createPost, uploadFiles } from '../../../api/coursesApi'

type CreatePostDialogProps = {
  open: boolean
  onClose: () => void
  courseId: string
  onCreated: () => void
}

export function CreatePostDialog({
  open,
  onClose,
  courseId,
  onCreated,
}: CreatePostDialogProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [links, setLinks] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setTitle('')
    setContent('')
    setLinks('')
    setFiles([])
    setError(null)
  }

  const handleClose = () => {
    if (!loading) {
      resetForm()
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    if (!trimmedTitle) {
      setError('Введите заголовок')
      return
    }

    const linkLines = links
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const parts: string[] = []
    if (trimmedContent) parts.push(trimmedContent)
    if (linkLines.length > 0) parts.push('Ссылки:\n' + linkLines.join('\n'))
    const body = parts.length > 0 ? parts.join('\n\n') : undefined

    setLoading(true)
    try {
      const fileIds = files.length > 0 ? await uploadFiles(files) : []
      await createPost(courseId, {
        title: trimmedTitle,
        body,
        file_ids: fileIds,
      })
      resetForm()
      onClose()
      onCreated()
    } catch {
      setError('Не удалось создать пост')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) {
      setFiles((prev) => [...prev, ...Array.from(selected)])
    }
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="create-post-dialog-title"
    >
      <DialogTitle id="create-post-dialog-title">Новый пост</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent className="flex flex-col gap-4">
          <TextField
            label="Заголовок"
            required
            fullWidth
            size="small"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            inputProps={{ 'aria-label': 'Заголовок поста' }}
          />
          <TextField
            label="Содержание"
            fullWidth
            multiline
            minRows={4}
            size="small"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            inputProps={{ 'aria-label': 'Содержание поста' }}
          />
          <TextField
            label="Ссылки (опционально, по одной на строку)"
            fullWidth
            multiline
            minRows={2}
            size="small"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="https://example.com"
            inputProps={{ 'aria-label': 'Ссылки' }}
          />
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              aria-label="Прикрепить файлы"
            />
            <Button
              component="span"
              variant="outlined"
              size="small"
              startIcon={<AttachFileOutlinedIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Прикрепить файлы
            </Button>
            {files.length > 0 && (
              <Box className="mt-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <Box
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm"
                  >
                    <Typography variant="body2" className="truncate max-w-[120px]">
                      {f.name}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label={`Удалить ${f.name}`}
                      onClick={() => removeFile(i)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Создание…' : 'Создать'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
