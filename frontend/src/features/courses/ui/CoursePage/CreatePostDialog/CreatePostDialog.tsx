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
import LinkIcon from '@mui/icons-material/Link'
import { createPost, uploadFiles } from '../../../api/coursesApi'
import { isValidUrl, getLinkHref } from '../../../utils/urlValidation'

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
  const [links, setLinks] = useState<string[]>([])
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setTitle('')
    setContent('')
    setLinks([])
    setShowLinkDialog(false)
    setLinkUrl('')
    setLinkUrlError(null)
    setFiles([])
    setError(null)
  }

  const handleAddLink = () => {
    const trimmed = linkUrl.trim()
    if (!trimmed) return
    if (!isValidUrl(trimmed)) {
      setLinkUrlError('Некорректная ссылка')
      return
    }
    setLinkUrlError(null)
    setLinks((prev) => [...prev, trimmed])
    setLinkUrl('')
    setShowLinkDialog(false)
  }

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
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
    if (!trimmedContent) {
      setError('Введите содержание поста')
      return
    }

    setLoading(true)
    try {
      const fileIds = files.length > 0 ? await uploadFiles(files) : []
      await createPost(courseId, {
        title: trimmedTitle,
        body: trimmedContent,
        links: links.length > 0 ? links : undefined,
        file_ids: fileIds,
      })
      resetForm()
      onClose()
      onCreated()
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'FILE_TOO_LARGE'
          ? 'Файл слишком большой'
          : 'Не удалось создать пост',
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
    <>
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
            required
            fullWidth
            multiline
            minRows={4}
            size="small"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            inputProps={{ 'aria-label': 'Содержание поста' }}
          />
          <Box>
            <Box className="flex flex-wrap gap-2">
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkIcon />}
                onClick={() => setShowLinkDialog(true)}
              >
                Добавить ссылку
              </Button>
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
            </Box>
            {(links.length > 0 || files.length > 0) && (
              <Box className="mt-2 flex flex-col gap-2 w-full">
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
                      className="truncate max-w-[160px] text-primary-600 hover:underline"
                    >
                      {url}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="Удалить ссылку"
                      onClick={() => removeLink(i)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                {files.map((f, i) => (
                  <Box
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm w-full"
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

    <Dialog
      open={showLinkDialog}
      onClose={() => {
        setShowLinkDialog(false)
        setLinkUrl('')
        setLinkUrlError(null)
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Добавить ссылку</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="URL"
          placeholder="https://..."
          value={linkUrl}
          onChange={(e) => {
            setLinkUrl(e.target.value)
            setLinkUrlError(null)
          }}
          error={Boolean(linkUrlError)}
          helperText={linkUrlError}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowLinkDialog(false)}>Отмена</Button>
        <Button onClick={handleAddLink} variant="contained" disabled={!linkUrl.trim()}>
          Добавить
        </Button>
      </DialogActions>
    </Dialog>
    </>
  )
}
