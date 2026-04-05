import { useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckIcon from '@mui/icons-material/Check'
import type { Member } from '../../model/types'

export type ManualTeamDraft = {
  id: string
  name: string
  memberIds: string[]
}

type Props = {
  students: Member[]
  teams: ManualTeamDraft[]
  onChange: (teams: ManualTeamDraft[]) => void
  maxMembersPerTeam?: number
  disabled?: boolean
}

function getInitials(m: Member): string {
  const f = (m.first_name ?? '').trim().charAt(0)
  const l = (m.last_name ?? '').trim().charAt(0)
  return (f + l).toUpperCase() || '?'
}

function getName(m: Member): string {
  return `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Участник'
}

export function ManualTeamsSetup({ students, teams, onChange, maxMembersPerTeam, disabled }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)
  const dragItem = useRef<{ userId: string; fromTeamId: string | null } | null>(null)

  const assignedIds = new Set(teams.flatMap((t) => t.memberIds))
  const unassigned = students.filter((s) => !assignedIds.has(s.user_id))

  const handleDragStart = (userId: string, fromTeamId: string | null) => {
    if (disabled) return
    dragItem.current = { userId, fromTeamId }
  }

  const handleDropOnTeam = (toTeamId: string) => {
    if (!dragItem.current || disabled) return
    const { userId, fromTeamId } = dragItem.current
    dragItem.current = null
    if (fromTeamId === toTeamId) return

    const targetTeam = teams.find((t) => t.id === toTeamId)
    if (!targetTeam) return

    if (maxMembersPerTeam !== undefined && targetTeam.memberIds.length >= maxMembersPerTeam) {
      setSizeError(`Команда «${targetTeam.name}» уже заполнена (макс. ${maxMembersPerTeam})`)
      return
    }

    setSizeError(null)
    onChange(
      teams.map((t) => {
        if (t.id === fromTeamId) return { ...t, memberIds: t.memberIds.filter((id) => id !== userId) }
        if (t.id === toTeamId) return { ...t, memberIds: [...t.memberIds, userId] }
        return t
      }),
    )
  }

  const handleDropOnUnassigned = () => {
    if (!dragItem.current || disabled) return
    const { userId, fromTeamId } = dragItem.current
    dragItem.current = null
    if (!fromTeamId) return
    setSizeError(null)
    onChange(
      teams.map((t) =>
        t.id === fromTeamId ? { ...t, memberIds: t.memberIds.filter((id) => id !== userId) } : t,
      ),
    )
  }

  const handleAddTeam = () => {
    const name = newTeamName.trim() || `Команда ${teams.length + 1}`
    onChange([...teams, { id: `draft-${Date.now()}`, name, memberIds: [] }])
    setNewTeamName('')
    setShowNew(false)
  }

  const handleDelete = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId)
    if (team && team.memberIds.length > 0) {
      setSizeError('Нельзя удалить непустую команду')
      return
    }
    setSizeError(null)
    onChange(teams.filter((t) => t.id !== teamId))
  }

  const handleRenameConfirm = () => {
    if (!editingId) return
    const trimmed = editingName.trim()
    if (!trimmed) return
    onChange(teams.map((t) => (t.id === editingId ? { ...t, name: trimmed } : t)))
    setEditingId(null)
  }

  return (
    <Box className="flex flex-col gap-3">
      {sizeError && (
        <Alert severity="warning" onClose={() => setSizeError(null)} sx={{ py: 0 }}>
          {sizeError}
        </Alert>
      )}

      <Box className="flex gap-3 flex-col sm:flex-row">
        {/* Нераспределённые */}
        <Box
          sx={{ flex: '0 0 auto', width: { xs: '100%', sm: 200 } }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnUnassigned}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Не распределены ({unassigned.length})
          </Typography>
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'grey.300',
              borderRadius: 1.5,
              p: 1,
              minHeight: 64,
              bgcolor: 'grey.50',
            }}
          >
            {unassigned.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Все распределены
              </Typography>
            ) : (
              <Box className="flex flex-col gap-1">
                {unassigned.map((s) => (
                  <Box
                    key={s.user_id}
                    draggable={!disabled}
                    onDragStart={() => handleDragStart(s.user_id, null)}
                    className="flex items-center gap-1.5 p-1 rounded"
                    sx={{
                      border: '1px solid',
                      borderColor: 'grey.200',
                      borderRadius: 1,
                      bgcolor: 'white',
                      cursor: disabled ? 'default' : 'grab',
                    }}
                  >
                    <Avatar sx={{ width: 20, height: 20, fontSize: 10 }}>{getInitials(s)}</Avatar>
                    <Typography variant="caption" className="truncate">{getName(s)}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Команды */}
        <Box className="flex-1 flex flex-col gap-2">
          {teams.map((team) => {
            const isFull = maxMembersPerTeam !== undefined && team.memberIds.length >= maxMembersPerTeam
            return (
              <Box
                key={team.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnTeam(team.id)}
                sx={{
                  border: '1px solid',
                  borderColor: isFull ? 'error.light' : 'grey.200',
                  borderRadius: 1.5,
                  p: 1.5,
                }}
              >
                <Box className="flex items-center gap-1 mb-1">
                  {editingId === team.id ? (
                    <Box className="flex items-center gap-1 flex-1">
                      <TextField
                        size="small"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
                        autoFocus
                        sx={{ flex: 1 }}
                        inputProps={{ style: { padding: '2px 6px', fontSize: 13 } }}
                      />
                      <IconButton size="small" onClick={handleRenameConfirm}>
                        <CheckIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="body2" className="font-semibold flex-1">
                        {team.name}
                        {maxMembersPerTeam !== undefined && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            {team.memberIds.length}/{maxMembersPerTeam}
                          </Typography>
                        )}
                      </Typography>
                      {!disabled && (
                        <>
                          <Tooltip title="Переименовать">
                            <IconButton size="small" onClick={() => { setEditingId(team.id); setEditingName(team.name) }}>
                              <EditOutlinedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={team.memberIds.length > 0}
                                onClick={() => handleDelete(team.id)}
                              >
                                <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      )}
                    </>
                  )}
                </Box>

                <Box
                  sx={{
                    minHeight: 36,
                    borderRadius: 1,
                    bgcolor: 'grey.50',
                    p: 0.75,
                    border: '1px dashed',
                    borderColor: 'grey.200',
                  }}
                >
                  {team.memberIds.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      Перетащите студентов сюда
                    </Typography>
                  ) : (
                    <Box className="flex flex-wrap gap-1">
                      {team.memberIds.map((uid) => {
                        const m = students.find((s) => s.user_id === uid)
                        return (
                          <Box
                            key={uid}
                            draggable={!disabled}
                            onDragStart={() => handleDragStart(uid, team.id)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                            sx={{
                              border: '1px solid',
                              borderColor: 'grey.200',
                              bgcolor: 'white',
                              cursor: disabled ? 'default' : 'grab',
                            }}
                          >
                            <Avatar sx={{ width: 18, height: 18, fontSize: 9 }}>
                              {m ? getInitials(m) : '?'}
                            </Avatar>
                            <Typography variant="caption">{m ? getName(m) : uid}</Typography>
                          </Box>
                        )
                      })}
                    </Box>
                  )}
                </Box>
              </Box>
            )
          })}

          {!disabled && (
            showNew ? (
              <Box className="flex gap-1 items-center">
                <TextField
                  size="small"
                  label="Название"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                  autoFocus
                  sx={{ flex: 1 }}
                  inputProps={{ style: { fontSize: 13 } }}
                />
                <Button size="small" variant="contained" onClick={handleAddTeam}>Добавить</Button>
                <Button size="small" onClick={() => setShowNew(false)}>Отмена</Button>
              </Box>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowNew(true)}
                sx={{ borderStyle: 'dashed', color: 'text.secondary', borderColor: 'grey.300' }}
              >
                Добавить команду
              </Button>
            )
          )}
        </Box>
      </Box>
    </Box>
  )
}
