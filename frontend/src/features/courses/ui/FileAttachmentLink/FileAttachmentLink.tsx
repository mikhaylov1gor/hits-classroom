import { useEffect, useState } from 'react'
import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import {
  downloadFile,
  downloadMaterialFile,
  downloadPostFile,
  downloadSubmissionFile,
  getFileInfo,
  type ApiFile,
} from '../../api/coursesApi'

export type FileAttachment = {
  id: string
  name: string
  url?: string | null
}

/** Контекст для скачивания файла по специфичному endpoint API */
export type FileSourceContext =
  | { type: 'post'; courseId: string; postId: string }
  | { type: 'material'; courseId: string; materialId: string }
  | { type: 'submission'; courseId: string; assignmentId: string; submissionId: string }
  | null

type FileAttachmentLinkProps = {
  attachment: FileAttachment
  /** Контекст источника файла. Если не указан — используется generic GET /files/{fileId} */
  fileSource?: FileSourceContext
  /** Показывать кнопку скачивания (по умолчанию true) */
  showDownload?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

/**
 * Ссылка на скачивание файла с авторизацией.
 * Загружает информацию о файле (имя, размер, тип), отображает её и скачивает в исходном формате.
 * Использует контекстные endpoints API согласно спеке: посты, материалы, решения.
 */
export function FileAttachmentLink({
  attachment,
  fileSource,
  showDownload = true,
}: FileAttachmentLinkProps) {
  const [info, setInfo] = useState<ApiFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getFileInfo(attachment.id)
      .then((data) => {
        if (!cancelled) setInfo(data)
      })
      .catch(() => {
        if (!cancelled) {
          setInfo(null)
          if (!fileSource) {
            setError('Не удалось загрузить информацию')
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attachment.id, fileSource])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const fileName = info?.file_name || attachment.name || undefined
      if (fileSource?.type === 'post') {
        await downloadPostFile(fileSource.courseId, fileSource.postId, attachment.id, fileName)
      } else if (fileSource?.type === 'material') {
        await downloadMaterialFile(
          fileSource.courseId,
          fileSource.materialId,
          attachment.id,
          fileName,
        )
      } else if (fileSource?.type === 'submission') {
        await downloadSubmissionFile(
          fileSource.courseId,
          fileSource.assignmentId,
          fileSource.submissionId,
          attachment.id,
          fileName,
        )
      } else {
        await downloadFile(attachment.id, fileName)
      }
    } finally {
      setDownloading(false)
    }
  }

  const displayName = info?.file_name || attachment.name || 'Файл'

  return (
    <Box
      className="flex flex-1 min-w-0 items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: 1, minWidth: 0 }}
    >
      <InsertDriveFileOutlinedIcon fontSize="small" color="action" />
      <Box className="flex-1 min-w-0">
        <Typography variant="body2" className="font-medium">
          {displayName}
        </Typography>
        {loading && (
          <Typography variant="caption" color="text.secondary">
            Загрузка информации…
          </Typography>
        )}
        {info && !loading && (
          <Typography variant="caption" color="text.secondary" display="block">
            {formatFileSize(info.file_size)}
          </Typography>
        )}
        {error && !loading && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}
      </Box>
      {showDownload && (
        <Tooltip title="Скачать">
          <span>
            <IconButton
              size="small"
              onClick={handleDownload}
              disabled={downloading || loading}
              aria-label={`Скачать ${displayName}`}
            >
              {downloading ? (
                <CircularProgress size={20} />
              ) : (
                <DownloadIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  )
}
