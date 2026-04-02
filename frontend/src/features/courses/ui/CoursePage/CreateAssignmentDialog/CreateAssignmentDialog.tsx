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
import { createAssignment, uploadFiles } from '../../../api/coursesApi'
import { isValidUrl } from '../../../utils/urlValidation'

type CreateAssignmentDialogProps = {
  open: boolean
  onClose: () => void
  courseId: string
  onCreated: () => void
}

export function CreateAssignmentDialog({
  open,
  onClose,
  courseId,
  onCreated,
}: CreateAssignmentDialogProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [links, setLinks] = useState('')
  const [deadline, setDeadline] = useState('')
  const [maxGrade, setMaxGrade] = useState<string>('100')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setTitle('')
    setContent('')
    setLinks('')
    setDeadline('')
    setMaxGrade('100')
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
      setError('Введите название задания')
      return
    }
    if (!trimmedContent) {
      setError('Введите описание задания')
      return
    }

    const parsedMaxGrade = maxGrade.trim() ? parseInt(maxGrade, 10) : 100
    if (isNaN(parsedMaxGrade) || parsedMaxGrade < 1 || parsedMaxGrade > 1000) {
      setError('Максимальный балл должен быть от 1 до 1000')
      return
    }

    const trimmedDeadline = deadline.trim()
    if (trimmedDeadline) {
      const deadlineDate = new Date(trimmedDeadline)
      if (isNaN(deadlineDate.getTime())) {
        setError('Некорректная дата дедлайна')
        return
      }
      if (deadlineDate <= new Date()) {
        setError('Дедлайн должен быть в будущем')
        return
      }
    }

    const linkLines = links
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    if (linkLines.length > 0) {
      const invalidIndex = linkLines.findIndex((line) => !isValidUrl(line))
      if (invalidIndex >= 0) {
        setError(`Некорректная ссылка в строке ${invalidIndex + 1}: «${linkLines[invalidIndex]}»`)
        return
      }
    }

    setLoading(true)
    try {
      const fileIds = files.length > 0 ? await uploadFiles(files) : []
      const trimmedDeadline = deadline.trim()
      const deadlineIso =
        trimmedDeadline && !isNaN(new Date(trimmedDeadline).getTime())
          ? new Date(trimmedDeadline).toISOString()
          : undefined
      await createAssignment(courseId, {
        title: trimmedTitle,
        body: trimmedContent,
        links: linkLines.length > 0 ? linkLines : undefined,
        deadline: deadlineIso,
        max_grade: parsedMaxGrade,
        file_ids: fileIds,
      })
      resetForm()
      onClose()
      onCreated()
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'FILE_TOO_LARGE'
          ? 'Файл слишком большой'
          : 'Не удалось создать задание',
      )
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
      aria-labelledby="create-assignment-dialog-title"
    >
      <DialogTitle id="create-assignment-dialog-title">Новое задание</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent className="flex flex-col gap-4">
          <TextField
            label="Название"
            required
            fullWidth
            size="small"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            inputProps={{ 'aria-label': 'Название задания' }}
          />
          <TextField
            label="Описание"
            required
            fullWidth
            multiline
            minRows={4}
            size="small"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            inputProps={{ 'aria-label': 'Описание задания' }}
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
          <TextField
            label="Дедлайн"
            fullWidth
            size="small"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              'aria-label': 'Дедлайн',
              min: new Date(Date.now() + 60000)
                .toISOString()
                .slice(0, 16),
            }}
            helperText="Только дата в будущем"
          />
          <TextField
            label="Максимальный балл"
            fullWidth
            size="small"
            type="number"
            value={maxGrade}
            onChange={(e) => setMaxGrade(e.target.value)}
            inputProps={{ min: 1, max: 1000, 'aria-label': 'Максимальный балл' }}
            helperText="1 = зачёт/незачёт, >1 = числовая шкала (по умолчанию 100)"
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
