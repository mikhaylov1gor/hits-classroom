import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import BalanceIcon from '@mui/icons-material/Balance'
import LockIcon from '@mui/icons-material/Lock'
import type { Member, TeamWithMembers } from '../../model/types'
import {
  useDeleteTeamMutation,
  useGenerateBalancedMutation,
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
  courseMembers?: Member[]
  onAssignmentUpdated?: () => void | Promise<void>
}

export function BalancedTeamsView({
  courseId,
  assignmentId,
  teams,
  currentUserId,
  isTeacher,
  isLocked,
  courseMembers = [],
  onAssignmentUpdated,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pendingTeacherDeleteId, setPendingTeacherDeleteId] = useState<string | null>(null)

  const generateMutation = useGenerateBalancedMutation(courseId, assignmentId)
  const lockMutation = useLockRosterMutation(courseId, assignmentId)
  const deleteMutation = useDeleteTeamMutation(courseId, assignmentId)

  const myTeam = teams.find((t) => t.members.some((m) => m.user_id === currentUserId))
  const teamsForList = !isTeacher && myTeam ? teams.filter((team) => team.id !== myTeam.id) : teams

  const handleGenerate = async () => {
    setError(null)
    try {
      await generateMutation.mutateAsync()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сбалансировать команды')
    }
  }

  const handleLock = async () => {
    setError(null)
    try {
      await lockMutation.mutateAsync()
      await onAssignmentUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось зафиксировать составы')
    }
  }

  useEffect(() => {
    if (pendingTeacherDeleteId && !teams.some((t) => t.id === pendingTeacherDeleteId)) {
      setPendingTeacherDeleteId(null)
    }
  }, [teams, pendingTeacherDeleteId])

  const handleDeleteTeamById = async (teamId: string) => {
    setError(null)
    try {
      await deleteMutation.mutateAsync({ teamId })
      setPendingTeacherDeleteId(null)
      await onAssignmentUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить команду')
    }
  }

  return (
    <Box className="flex flex-col gap-4">
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLocked && <Alert severity="info">Состав команд зафиксирован</Alert>}

      {isTeacher && !isLocked && (
        <Box className="flex gap-2">
          <Button
            variant="contained"
            startIcon={generateMutation.isPending ? <CircularProgress size={16} /> : <BalanceIcon />}
            disabled={generateMutation.isPending}
            onClick={handleGenerate}
          >
            Сбалансировать команды
          </Button>
          {teams.length > 0 && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={lockMutation.isPending ? <CircularProgress size={16} /> : <LockIcon />}
              disabled={lockMutation.isPending}
              onClick={handleLock}
            >
              Зафиксировать составы
            </Button>
          )}
        </Box>
      )}

      {!isTeacher && myTeam && (
        <Box>
          <Typography variant="subtitle1" className="font-semibold mb-2">
            Моя команда
          </Typography>
          <TeamCard
            team={myTeam}
            highlighted
            showCreatorName={isTeacher}
            courseMembers={courseMembers}
          />
        </Box>
      )}

      <Box>
        <Typography variant="subtitle1" className="font-semibold mb-2">
          Все команды ({teamsForList.length})
        </Typography>
        {teamsForList.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {isTeacher ? 'Нажмите «Сбалансировать команды»' : 'Команды ещё не сформированы'}
          </Typography>
        ) : (
          <Box className="flex flex-col gap-3">
            {teamsForList.map((team) => {
              let listActions: ReactNode = null
              if (isTeacher && !isLocked) {
                listActions =
                  pendingTeacherDeleteId === team.id ? (
                    <Box className="flex flex-wrap gap-1 items-center">
                      <Button
                        size="small"
                        color="error"
                        variant="contained"
                        disabled={deleteMutation.isPending}
                        onClick={() => void handleDeleteTeamById(team.id)}
                      >
                        {deleteMutation.isPending ? <CircularProgress size={16} /> : 'Да, удалить'}
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        disabled={deleteMutation.isPending}
                        onClick={() => setPendingTeacherDeleteId(null)}
                      >
                        Нет
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={deleteMutation.isPending}
                      onClick={() => setPendingTeacherDeleteId(team.id)}
                    >
                      Удалить команду
                    </Button>
                  )
              }

              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  highlighted={team.id === myTeam?.id}
                  showCreatorName={isTeacher}
                  courseMembers={courseMembers}
                  actions={listActions}
                />
              )
            })}
          </Box>
        )}
      </Box>
    </Box>
  )
}
