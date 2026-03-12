import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from '@mui/material'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import LinkIcon from '@mui/icons-material/Link'
import { getFileInfo } from '../../api/coursesApi'

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function getAttachmentCountText(fileCount: number, linkCount: number): string {
  const total = fileCount + linkCount
  if (total === 0) return ''
  if (fileCount > 0 && linkCount > 0) {
    const fileWord =
      fileCount === 1 ? 'файл' : fileCount >= 2 && fileCount <= 4 ? 'файла' : 'файлов'
    const linkWord =
      linkCount === 1 ? 'ссылку' : linkCount >= 2 && linkCount <= 4 ? 'ссылки' : 'ссылок'
    return `${fileCount} прикрепленных ${fileWord} и ${linkCount} ${linkWord} будет отправлено`
  }
  if (fileCount > 0) {
    if (fileCount === 1) return '1 прикрепленный файл будет отправлен'
    const word = fileCount >= 2 && fileCount <= 4 ? 'прикрепленных файла' : 'прикрепленных файлов'
    return `${fileCount} ${word} будет отправлено`
  }
  if (linkCount === 1) return '1 ссылка будет отправлена'
  const word = linkCount >= 2 && linkCount <= 4 ? 'ссылки' : 'ссылок'
  return `${linkCount} ${word} будет отправлено`
}

type SubmitAssignmentConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  assignmentTitle: string
  assignmentDeadline?: string | null
  fileNames: string[]
  linkUrls?: string[]
  /** ID файлов из черновика (для отображения списка имён) */
  draftFileIds?: string[]
  submitting?: boolean
}

export function SubmitAssignmentConfirmDialog({
  open,
  onClose,
  onConfirm,
  assignmentTitle,
  assignmentDeadline,
  fileNames,
  linkUrls = [],
  draftFileIds = [],
  submitting = false,
}: SubmitAssignmentConfirmDialogProps) {
  const [draftFileNames, setDraftFileNames] = useState<string[]>([])

  useEffect(() => {
    if (!open || draftFileIds.length === 0) {
      setDraftFileNames([])
      return () => {}
    }
    let cancelled = false
    Promise.all(draftFileIds.map((id) => getFileInfo(id)))
      .then((infos) => {
        if (!cancelled) {
          setDraftFileNames(infos.map((f) => f.file_name || 'Файл'))
        }
      })
      .catch(() => {
        if (!cancelled) setDraftFileNames(draftFileIds.map(() => 'Файл'))
      })
    return () => {
      cancelled = true
    }
  }, [open, draftFileIds.join(',')])

  const totalFileCount = fileNames.length + draftFileIds.length
  const attachmentCountText = getAttachmentCountText(totalFileCount, linkUrls.length)
  const assignmentLabel = assignmentDeadline
    ? `${assignmentTitle} ${formatDate(assignmentDeadline)}`
    : assignmentTitle

  const hasAttachments = totalFileCount > 0 || linkUrls.length > 0

  const message = hasAttachments
    ? `${attachmentCountText} для задания «${assignmentLabel}».`
    : `Ответ будет отправлен для задания «${assignmentLabel}».`

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Сдать задание?</DialogTitle>
      <DialogContent>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {message}
        </Typography>
        {(totalFileCount > 0 || linkUrls.length > 0) && (
          <Box className="flex flex-col gap-1">
            {draftFileIds.length > 0 &&
              (draftFileNames.length > 0 ? (
                draftFileNames.map((name, i) => (
                  <Box
                    key={`draft-${draftFileIds[i]}`}
                    className="flex items-center gap-2 py-1"
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <InsertDriveFileOutlinedIcon fontSize="small" color="action" />
                    <Typography variant="body2" className="truncate">
                      {name}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Загрузка списка файлов…
                </Typography>
              ))}
            {fileNames.map((name, i) => (
              <Box
                key={`file-${i}`}
                className="flex items-center gap-2 py-1"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <InsertDriveFileOutlinedIcon fontSize="small" color="action" />
                <Typography variant="body2" className="truncate">
                  {name}
                </Typography>
              </Box>
            ))}
            {linkUrls.map((url, i) => (
              <Box
                key={`link-${i}`}
                className="flex items-center gap-2 py-1"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <LinkIcon fontSize="small" color="action" sx={{ fontSize: 18 }} />
                <Link
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  underline="hover"
                  className="truncate max-w-full"
                  sx={{ color: 'primary.main' }}
                >
                  {url}
                </Link>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Отмена
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={submitting}>
          {submitting ? 'Отправка…' : 'Сдать'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
