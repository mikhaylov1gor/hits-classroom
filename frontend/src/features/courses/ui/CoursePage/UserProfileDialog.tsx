import { useEffect, useState } from 'react'
import {
  Avatar,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { getMemberGrades } from '../../api/coursesApi'
import type { Member, SubmissionWithAssignment } from '../../model/types'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  teacher: 'Преподаватель',
  student: 'Студент',
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('ru-RU')
  } catch {
    return s
  }
}

type UserProfileDialogProps = {
  open: boolean
  onClose: () => void
  member: Member | null
  courseId: string
  authUserId?: string
  isTeacher?: boolean
  onAssignmentClick?: (assignmentId: string) => void
}

export function UserProfileDialog({
  open,
  onClose,
  member,
  courseId,
  authUserId,
  isTeacher,
  onAssignmentClick,
}: UserProfileDialogProps) {
  const [grades, setGrades] = useState<SubmissionWithAssignment[]>([])
  const [loading, setLoading] = useState(false)

  const showGrades =
    Boolean(member) &&
    (Boolean(isTeacher) || (Boolean(authUserId) && member!.user_id === authUserId))

  useEffect(() => {
    if (!open || !member || !courseId || !showGrades) {
      setGrades([])
      return
    }
    setLoading(true)
    getMemberGrades(courseId, member.user_id)
      .then(setGrades)
      .catch(() => setGrades([]))
      .finally(() => setLoading(false))
  }, [open, member, courseId, showGrades])

  if (!member) return null

  const fullName = `${member.first_name} ${member.last_name}`.trim() || member.email
  const initials =
    (member.first_name?.[0] ?? '').toUpperCase() +
    (member.last_name?.[0] ?? '').toUpperCase() ||
    member.email[0]?.toUpperCase() ||
    '?'

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="flex items-center justify-between pr-2">
        <span>Профиль пользователя</span>
        <IconButton
          aria-label="Закрыть"
          onClick={onClose}
          size="small"
          edge="end"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box className="flex flex-col gap-4">
          <Box className="flex items-center gap-4">
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 56,
                height: 56,
                fontSize: '1.25rem',
              }}
            >
              {initials}
            </Avatar>
            <Box className="flex-1 min-w-0">
              <Typography variant="h6" className="font-semibold">
                {fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {ROLE_LABELS[member.role] ?? member.role}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" className="mb-1">
              Email
            </Typography>
            <Typography variant="body1">{member.email}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" className="mb-1">
              Дата рождения
            </Typography>
            <Typography variant="body1">
              {formatDate(member.birth_date)}
            </Typography>
          </Box>

          {showGrades && (
            <Box>
              <Typography variant="subtitle2" className="font-semibold mb-2">
                Последние задания с оценками
              </Typography>
              {loading ? (
                <Box className="flex justify-center py-6">
                  <CircularProgress size={32} />
                </Box>
              ) : grades.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Нет заданий с оценками
                </Typography>
              ) : (
                <List dense disablePadding>
                {grades.map(({ submission, assignment }) => (
                  <ListItem
                    key={submission.id}
                    className="border border-slate-200 rounded-lg mb-2 cursor-pointer hover:bg-slate-50"
                    onClick={() => onAssignmentClick?.(assignment.id)}
                    sx={{ cursor: onAssignmentClick ? 'pointer' : 'default' }}
                  >
                    <ListItemText
                      primary={assignment.title}
                      secondary={
                        submission.grade != null
                          ? `Оценка: ${submission.grade}`
                          : 'Без оценки'
                      }
                    />
                  </ListItem>
                ))}
                </List>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
