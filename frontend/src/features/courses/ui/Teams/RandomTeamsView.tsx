import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import LockIcon from '@mui/icons-material/Lock'
import type { TeamWithMembers } from '../../model/types'
import { useGenerateRandomMutation, useLockRosterMutation } from '../../model/teamsQueries'
import { TeamCard } from './TeamCard'

type Props = {
  courseId: string
  assignmentId: string
  teams: TeamWithMembers[]
  currentUserId: string | undefined
  isTeacher: boolean
  isLocked: boolean
}

export function RandomTeamsView({
  courseId,
  assignmentId,
  teams,
  currentUserId,
  isTeacher,
  isLocked,
}: Props) {
  const [error, setError] = useState<string | null>(null)

  const generateMutation = useGenerateRandomMutation(courseId, assignmentId)
  const lockMutation = useLockRosterMutation(courseId, assignmentId)

  const myTeam = teams.find((t) => t.members.some((m) => m.user_id === currentUserId))

  const handleGenerate = async () => {
    setError(null)
    try {
      await generateMutation.mutateAsync()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сформировать команды')
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

      {isLocked && <Alert severity="info">Состав команд зафиксирован</Alert>}

      {isTeacher && !isLocked && (
        <Box className="flex gap-2">
          <Button
            variant="contained"
            startIcon={generateMutation.isPending ? <CircularProgress size={16} /> : <ShuffleIcon />}
            disabled={generateMutation.isPending}
            onClick={handleGenerate}
          >
            Сформировать команды
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
          <TeamCard team={myTeam} highlighted />
        </Box>
      )}

      <Box>
        <Typography variant="subtitle1" className="font-semibold mb-2">
          Все команды ({teams.length})
        </Typography>
        {teams.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {isTeacher ? 'Нажмите «Сформировать команды»' : 'Команды ещё не сформированы'}
          </Typography>
        ) : (
          <Box className="flex flex-col gap-3">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} highlighted={team.id === myTeam?.id} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
