import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { TeamWithMembers } from '../../model/types'
import {
  useCreateTeamMutation,
  useJoinTeamMutation,
  useLeaveTeamMutation,
  useLockRosterMutation,
} from '../../model/teamsQueries'
import { TeamCard } from './TeamCard'

type Props = {
  courseId: string
  assignmentId: string
  teams: TeamWithMembers[]
  currentUserId: string | undefined
  isTeacher: boolean
  isLocked: boolean
}

export function FreeTeamsView({
  courseId,
  assignmentId,
  teams,
  currentUserId,
  isTeacher,
  isLocked,
}: Props) {
  const [newTeamName, setNewTeamName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const myTeam = teams.find((t) => t.members.some((m) => m.user_id === currentUserId))

  const createMutation = useCreateTeamMutation(courseId, assignmentId)
  const joinMutation = useJoinTeamMutation(courseId, assignmentId)
  const leaveMutation = useLeaveTeamMutation(courseId, assignmentId)
  const lockMutation = useLockRosterMutation(courseId, assignmentId)

  const teamsForList = !isTeacher && myTeam
    ? teams.filter((team) => team.id !== myTeam.id)
    : teams

  const handleCreate = async () => {
    setError(null)
    try {
      await createMutation.mutateAsync({ name: newTeamName.trim() || undefined })
      setNewTeamName('')
      setShowCreate(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать команду')
    }
  }

  const handleJoin = async (teamId: string) => {
    setError(null)
    try {
      await joinMutation.mutateAsync({ teamId })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось вступить в команду')
    }
  }

  const handleLeave = async () => {
    setError(null)
    try {
      await leaveMutation.mutateAsync()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось покинуть команду')
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

  return (
    <Box className="flex flex-col gap-4">
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLocked && (
        <Alert severity="info">Состав команд зафиксирован</Alert>
      )}

      {/* Секция «Моя команда» для студента */}
      {!isTeacher && (
        <Box>
          <Typography variant="subtitle1" className="font-semibold mb-2">
            Моя команда
          </Typography>
          {myTeam ? (
            <Box className="flex flex-col gap-2">
              <TeamCard
                team={myTeam}
                highlighted
                actions={
                  !isLocked && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={leaveMutation.isPending}
                      onClick={handleLeave}
                    >
                      {leaveMutation.isPending ? <CircularProgress size={16} /> : 'Покинуть команду'}
                    </Button>
                  )
                }
              />
            </Box>
          ) : isLocked ? (
            <Typography variant="body2" color="text.secondary">
              Вы не состоите ни в одной команде
            </Typography>
          ) : (
            <Box className="flex flex-col gap-2">
              <Typography variant="body2" color="text.secondary">
                Вы не состоите ни в одной команде
              </Typography>
              {showCreate ? (
                <Box className="flex gap-2 items-center">
                  <TextField
                    size="small"
                    label="Название команды (необязательно)"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    disabled={createMutation.isPending}
                    onClick={handleCreate}
                  >
                    {createMutation.isPending ? <CircularProgress size={16} /> : 'Создать'}
                  </Button>
                  <Button size="small" onClick={() => setShowCreate(false)}>
                    Отмена
                  </Button>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setShowCreate(true)}
                >
                  Создать команду
                </Button>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Список всех команд */}
      <Box>
        <Typography variant="subtitle1" className="font-semibold mb-2">
          Все команды ({teamsForList.length})
        </Typography>
        {teamsForList.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Команд пока нет
          </Typography>
        ) : (
          <Box className="flex flex-col gap-3">
            {teamsForList.map((team) => {
              const isMine = team.id === myTeam?.id
              const isFull = team.members.length >= team.max_members
              const canJoin = !isTeacher && !isLocked && !myTeam && !isFull

              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  highlighted={isMine}
                  actions={
                    canJoin ? (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={joinMutation.isPending}
                        onClick={() => handleJoin(team.id)}
                      >
                        {joinMutation.isPending ? <CircularProgress size={16} /> : 'Вступить'}
                      </Button>
                    ) : !isTeacher && !isMine && isFull && !isLocked && !myTeam ? (
                      <Button size="small" variant="outlined" disabled>
                        Команда заполнена
                      </Button>
                    ) : null
                  }
                />
              )
            })}
          </Box>
        )}
      </Box>

      {/* Кнопка фиксации для преподавателя */}
      {isTeacher && !isLocked && teams.length > 0 && (
        <Box className="flex justify-end">
          <Button
            variant="contained"
            color="warning"
            disabled={lockMutation.isPending}
            onClick={handleLock}
          >
            {lockMutation.isPending ? <CircularProgress size={18} /> : 'Зафиксировать составы'}
          </Button>
        </Box>
      )}
    </Box>
  )
}
