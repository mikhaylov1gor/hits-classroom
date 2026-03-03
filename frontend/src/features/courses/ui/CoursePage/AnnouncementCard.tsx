import { Avatar, Box, IconButton, Link, Typography } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import type { FeedItem } from '../../model/types'

type AnnouncementCardProps = {
  item: FeedItem
  authorName?: string
  authorInitial?: string
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const months = [
      'янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня',
      'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.',
    ]
    return `${d.getDate()} ${months[d.getMonth()]}`
  } catch {
    return ''
  }
}

export function AnnouncementCard({ item, authorName = 'Автор', authorInitial = 'А' }: AnnouncementCardProps) {
  const content = item.body || item.title
  const displayDate = formatDate(item.created_at)

  return (
    <Box
      className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
      sx={{ '&:hover': { boxShadow: 1 } }}
    >
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
                {authorName}
              </Typography>
              <Box className="flex items-center gap-0">
                <Typography variant="caption" color="text.secondary" className="shrink-0">
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
            {item.attachments && item.attachments.length > 0 && (
              <Box className="mt-3 p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                <InsertDriveFileOutlinedIcon fontSize="small" color="action" />
                <Box className="min-w-0 flex-1">
                  <Typography variant="body2" className="font-medium text-slate-700 truncate">
                    {item.attachments[0].name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.attachments[0].type || 'Файл'}
                  </Typography>
                </Box>
              </Box>
            )}
            <Link
              component="button"
              variant="body2"
              className="mt-3 inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
              sx={{ cursor: 'pointer', textDecoration: 'none' }}
            >
              <ChatBubbleOutlineOutlinedIcon fontSize="small" />
              Добавить комментарий
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
