import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckIcon from '@mui/icons-material/Check'
import LockIcon from '@mui/icons-material/Lock'
import SaveIcon from '@mui/icons-material/Save'
import type { Member, TeamMemberInfo, TeamWithMembers } from '../../model/types'
import { useLockRosterMutation, useSaveTeamsMutation } from '../../model/teamsQueries'

type DraftTeam = {
  id: string
  name: string
  memberIds: string[]
}

type Props = {
  courseId: string
  assignmentId: string
  teams: TeamWithMembers[]
  courseMembers: Member[]
  isLocked: boolean
}

function getMemberInitials(m: Member | TeamMemberInfo | undefined): string {
  if (!m) return '?'
  const f = (m.first_name ?? '').trim().charAt(0)
  const l = (m.last_name ?? '').trim().charAt(0)
  return (f + l).toUpperCase() || '?'
}

function getMemberName(m: Member | TeamMemberInfo | undefined): string {
  if (!m) return 'Участник'
  return `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Участник'
}

export function ManualTeamsView({
  courseId,
  assignmentId,
  teams,
  courseMembers,
  isLocked,
}: Props) {
  const [draftTeams, setDraftTeams] = useState<DraftTeam[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const saveMutation = useSaveTeamsMutation(courseId, assignmentId)
  const lockMutation = useLockRosterMutation(courseId, assignmentId)

  // Инициализируем черновик из текущих данных
  useEffect(() => {
    setDraftTeams(
      teams.map((t) => ({
        id: t.id,
        name: t.name,
        memberIds: t.members.map((m) => m.user_id),
      })),
    )
    setIsDirty(false)
  }, [teams])

  // Студенты курса
  const students = courseMembers.filter((m) => m.role === 'student')

  // Нераспределённые студенты
  const assignedIds = new Set(draftTeams.flatMap((t) => t.memberIds))
  const unassigned = students.filter((s) => !assignedIds.has(s.user_id))

  // Drag state
  const dragItem = useRef<{ userId: string; fromTeamId: string | null } | null>(null)

  const handleDragStart = (userId: string, fromTeamId: string | null) => {
    dragItem.current = { userId, fromTeamId }
  }

  const handleDropOnTeam = (toTeamId: string) => {
    if (!dragItem.current) return
    const { userId, fromTeamId } = dragItem.current
    dragItem.current = null

    if (fromTeamId === toTeamId) return

    const targetTeam = draftTeams.find((t) => t.id === toTeamId)
    if (!targetTeam) return

    // Проверяем max_members из исходных данных
    const originalTeam = teams.find((t) => t.id === toTeamId)
    const maxMembers = originalTeam?.max_members ?? Infinity
    if (targetTeam.memberIds.length >= maxMembers) {
      setError(`Команда «${targetTeam.name}» заполнена (макс. ${maxMembers})`)
      return
    }

    setDraftTeams((prev) =>
      prev.map((t) => {
        if (t.id === fromTeamId) {
          return { ...t, memberIds: t.memberIds.filter((id) => id !== userId) }
        }
        if (t.id === toTeamId) {
          return { ...t, memberIds: [...t.memberIds, userId] }
        }
        return t
      }),
    )
    setIsDirty(true)
  }

  const handleDropOnUnassigned = () => {
    if (!dragItem.current) return
    const { userId, fromTeamId } = dragItem.current
    dragItem.current = null
    if (!fromTeamId) return

    setDraftTeams((prev) =>
      prev.map((t) =>
        t.id === fromTeamId ? { ...t, memberIds: t.memberIds.filter((id) => id !== userId) } : t,
      ),
    )
    setIsDirty(true)
  }

  const handleAddTeam = () => {
    const name = newTeamName.trim() || `Команда ${draftTeams.length + 1}`
    const newId = `new-${Date.now()}`
    setDraftTeams((prev) => [...prev, { id: newId, name, memberIds: [] }])
    setNewTeamName('')
    setShowNewTeam(false)
    setIsDirty(true)
  }

  const handleDeleteTeam = (teamId: string) => {
    const team = draftTeams.find((t) => t.id === teamId)
    if (!team) return
    if (team.memberIds.length > 0) {
      setError('Нельзя удалить непустую команду')
      return
    }
    setDraftTeams((prev) => prev.filter((t) => t.id !== teamId))
    setIsDirty(true)
  }

  const handleRenameStart = (teamId: string, currentName: string) => {
    setEditingTeamId(teamId)
    setEditingName(currentName)
  }

  const handleRenameConfirm = () => {
    if (!editingTeamId) return
    const trimmed = editingName.trim()
    if (!trimmed) return
    setDraftTeams((prev) =>
      prev.map((t) => (t.id === editingTeamId ? { ...t, name: trimmed } : t)),
    )
    setEditingTeamId(null)
    setEditingName('')
    setIsDirty(true)
  }

  const handleSave = async () => {
    setError(null)
    try {
      await saveMutation.mutateAsync({
        teams: draftTeams.map((t) => ({ name: t.name, member_ids: t.memberIds })),
      })
      setIsDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  const handleLock = async () => {
    setError(null)
    try {
      await lockMutation.mutateAsync()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось зафиксировать составы')
    }
  }

  const getMember = (userId: string): Member | undefined =>
    courseMembers.find((m) => m.user_id === userId)

  if (isLocked) {
    return (
      <Box className="flex flex-col gap-4">
        <Alert severity="info">Состав команд зафиксирован</Alert>
        <Box className="flex flex-col gap-3">
          {teams.map((team) => (
            <Box
              key={team.id}
              sx={{ border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 2 }}
            >
              <Typography variant="subtitle2" className="font-semibold mb-1">
                {team.name} ({team.members.length}/{team.max_members})
              </Typography>
              <Box className="flex flex-col gap-1">
                {team.members.map((m) => (
                  <Box key={m.user_id} className="flex items-center gap-2">
                    <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>
                      {getMemberInitials(m)}
                    </Avatar>
                    <Typography variant="body2">{getMemberName(m)}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box className="flex flex-col gap-4">
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box className="flex gap-2 flex-wrap">
        {isDirty && (
          <Button
            variant="contained"
            size="small"
            startIcon={saveMutation.isPending ? <CircularProgress size={16} /> : <SaveIcon />}
            disabled={saveMutation.isPending}
            onClick={handleSave}
          >
            Сохранить
          </Button>
        )}
        {!isDirty && teams.length > 0 && (
          <Button
            variant="outlined"
            color="warning"
            size="small"
            startIcon={lockMutation.isPending ? <CircularProgress size={16} /> : <LockIcon />}
            disabled={lockMutation.isPending}
            onClick={handleLock}
          >
            Зафиксировать составы
          </Button>
        )}
      </Box>

      <Box className="flex gap-4 flex-col lg:flex-row">
        {/* Нераспределённые студенты */}
        <Box
          sx={{ flex: '0 0 auto', width: { xs: '100%', lg: 240 } }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnUnassigned}
        >
          <Typography variant="subtitle2" className="font-semibold mb-2">
            Не распределены ({unassigned.length})
          </Typography>
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'grey.300',
              borderRadius: 2,
              p: 1.5,
              minHeight: 80,
              bgcolor: 'grey.50',
            }}
          >
            {unassigned.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Все студенты распределены
              </Typography>
            ) : (
              <Box className="flex flex-col gap-1">
                {unassigned.map((s) => (
                  <Box
                    key={s.user_id}
                    draggable
                    onDragStart={() => handleDragStart(s.user_id, null)}
                    className="flex items-center gap-2 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-white"
                    sx={{ border: '1px solid', borderColor: 'grey.200', borderRadius: 1 }}
                  >
                    <Avatar sx={{ width: 22, height: 22, fontSize: 10 }}>
                      {getMemberInitials(s)}
                    </Avatar>
                    <Typography variant="body2" className="truncate">
                      {getMemberName(s)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Команды */}
        <Box className="flex-1 flex flex-col gap-3">
          {draftTeams.map((team) => {
            const originalTeam = teams.find((t) => t.id === team.id)
            const maxMembers = originalTeam?.max_members
            const isFull = maxMembers !== undefined && team.memberIds.length >= maxMembers

            return (
              <Box
                key={team.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnTeam(team.id)}
                sx={{
                  border: '1px solid',
                  borderColor: isFull ? 'error.light' : 'grey.200',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Box className="flex items-center gap-1 mb-2">
                  {editingTeamId === team.id ? (
                    <Box className="flex items-center gap-1 flex-1">
                      <TextField
                        size="small"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
                        autoFocus
                        sx={{ flex: 1 }}
                      />
                      <IconButton size="small" onClick={handleRenameConfirm}>
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="subtitle2" className="font-semibold flex-1">
                        {team.name}
                        {maxMembers !== undefined && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {team.memberIds.length}/{maxMembers}
                          </Typography>
                        )}
                      </Typography>
                      <Tooltip title="Переименовать">
                        <IconButton
                          size="small"
                          onClick={() => handleRenameStart(team.id, team.name)}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить команду">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={team.memberIds.length > 0}
                            onClick={() => handleDeleteTeam(team.id)}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Box>

                <Box
                  sx={{
                    minHeight: 48,
                    borderRadius: 1,
                    bgcolor: 'grey.50',
                    p: 1,
                    border: '1px dashed',
                    borderColor: 'grey.200',
                  }}
                >
                  {team.memberIds.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      Перетащите студентов сюда
                    </Typography>
                  ) : (
                    <Box className="flex flex-col gap-1">
                      {team.memberIds.map((uid) => {
                        const member = getMember(uid)
                        return (
                          <Box
                            key={uid}
                            draggable
                            onDragStart={() => handleDragStart(uid, team.id)}
                            className="flex items-center gap-2 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-white"
                            sx={{ border: '1px solid', borderColor: 'grey.200', borderRadius: 1 }}
                          >
                            <Avatar sx={{ width: 22, height: 22, fontSize: 10 }}>
                              {getMemberInitials(member)}
                            </Avatar>
                            <Typography variant="body2" className="truncate">
                              {getMemberName(member)}
                            </Typography>
                          </Box>
                        )
                      })}
                    </Box>
                  )}
                </Box>
              </Box>
            )
          })}

          {/* Добавить новую команду */}
          {showNewTeam ? (
            <Box className="flex gap-2 items-center">
              <TextField
                size="small"
                label="Название команды"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                sx={{ flex: 1 }}
                autoFocus
              />
              <Button size="small" variant="contained" onClick={handleAddTeam}>
                Добавить
              </Button>
              <Button size="small" onClick={() => setShowNewTeam(false)}>
                Отмена
              </Button>
            </Box>
          ) : (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setShowNewTeam(true)}
              sx={{
                border: '2px dashed',
                borderColor: 'grey.300',
                borderRadius: 2,
                color: 'text.secondary',
                '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
              }}
            >
              Добавить команду
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}
