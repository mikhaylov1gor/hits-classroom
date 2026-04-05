import { Avatar, Box, Chip, Typography } from '@mui/material'
import type { TeamWithMembers } from '../../model/types'

const STATUS_LABELS: Record<string, string> = {
  forming: 'Формируется',
  roster_locked: 'Состав зафиксирован',
  voting_open: 'Голосование открыто',
  voting: 'Голосование',
  submitted: 'Сдано',
  graded: 'Проверено',
  not_submitted: 'Не сдано',
}

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  forming: 'default',
  roster_locked: 'primary',
  voting_open: 'warning',
  voting: 'warning',
  submitted: 'success',
  graded: 'success',
  not_submitted: 'error',
}

type Props = {
  team: TeamWithMembers
  highlighted?: boolean
  actions?: React.ReactNode
}

export function TeamCard({ team, highlighted, actions }: Props) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: highlighted ? 'primary.main' : 'grey.200',
        borderRadius: 2,
        p: 2,
        bgcolor: highlighted ? 'primary.50' : 'background.paper',
      }}
    >
      <Box className="flex items-center justify-between gap-2 mb-2">
        <Typography variant="subtitle2" className="font-semibold truncate">
          {team.name}
        </Typography>
        <Box className="flex items-center gap-1 shrink-0">
          <Chip
            label={STATUS_LABELS[team.status] ?? team.status}
            color={STATUS_COLORS[team.status] ?? 'default'}
            size="small"
          />
          <Typography variant="caption" color="text.secondary">
            {team.members.length}/{team.max_members}
          </Typography>
        </Box>
      </Box>

      {team.members.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Нет участников
        </Typography>
      ) : (
        <Box className="flex flex-col gap-1">
          {team.members.map((m) => {
            const initials =
              ((m.first_name?.[0] ?? '') + (m.last_name?.[0] ?? '')).toUpperCase() || '?'
            return (
              <Box key={m.user_id} className="flex items-center gap-2">
                <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>{initials}</Avatar>
                <Typography variant="body2">
                  {m.first_name} {m.last_name}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}

      {actions && <Box className="mt-2">{actions}</Box>}
    </Box>
  )
}
