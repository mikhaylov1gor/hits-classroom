import { Box, CircularProgress, Divider, Typography } from '@mui/material'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import type { Assignment, Member } from '../../model/types'
import { useTeamsQuery } from '../../model/teamsQueries'
import { FreeTeamsView } from './FreeTeamsView'
import { RandomTeamsView } from './RandomTeamsView'
import { BalancedTeamsView } from './BalancedTeamsView'
import { ManualTeamsView } from './ManualTeamsView'

type Props = {
  courseId: string
  assignmentId: string
  assignment: Assignment
  currentUserId: string | undefined
  isTeacher: boolean
  courseMembers: Member[]
}

export function TeamsBlock({
  courseId,
  assignmentId,
  assignment,
  currentUserId,
  isTeacher,
  courseMembers,
}: Props) {
  const { data: teams, isLoading } = useTeamsQuery(courseId, assignmentId)

  const isLocked = Boolean(assignment.roster_locked_at)
  const distType = assignment.team_distribution_type ?? 'free'

  return (
    <Box className="flex flex-col gap-4">
      <Divider />
      <Box className="flex items-center gap-2">
        <PeopleOutlineIcon sx={{ color: 'text.secondary' }} />
        <Typography variant="h6">Команды</Typography>
      </Box>

      {isLoading ? (
        <Box className="flex justify-center py-4">
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          {distType === 'free' && (
            <FreeTeamsView
              courseId={courseId}
              assignmentId={assignmentId}
              teams={teams ?? []}
              currentUserId={currentUserId}
              isTeacher={isTeacher}
              isLocked={isLocked}
            />
          )}

          {distType === 'random' && (
            <RandomTeamsView
              courseId={courseId}
              assignmentId={assignmentId}
              teams={teams ?? []}
              currentUserId={currentUserId}
              isTeacher={isTeacher}
              isLocked={isLocked}
            />
          )}

          {distType === 'balanced' && (
            <BalancedTeamsView
              courseId={courseId}
              assignmentId={assignmentId}
              teams={teams ?? []}
              currentUserId={currentUserId}
              isTeacher={isTeacher}
              isLocked={isLocked}
            />
          )}

          {distType === 'manual' && isTeacher && (
            <ManualTeamsView
              courseId={courseId}
              assignmentId={assignmentId}
              teams={teams ?? []}
              courseMembers={courseMembers}
              isLocked={isLocked}
            />
          )}

          {distType === 'manual' && !isTeacher && (
            <RandomTeamsView
              courseId={courseId}
              assignmentId={assignmentId}
              teams={teams ?? []}
              currentUserId={currentUserId}
              isTeacher={false}
              isLocked={isLocked}
            />
          )}
        </>
      )}
    </Box>
  )
}
