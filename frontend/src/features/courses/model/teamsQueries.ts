import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTeam,
  generateBalancedTeams,
  generateRandomTeams,
  joinTeam,
  leaveTeam,
  listTeams,
  lockRoster,
  saveTeams,
} from '../api/coursesApi'

export function teamsQueryKey(courseId: string, assignmentId: string) {
  return ['teams', courseId, assignmentId]
}

export function useTeamsQuery(courseId: string | undefined, assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['teams', courseId, assignmentId],
    queryFn: () => listTeams(courseId!, assignmentId!),
    enabled: Boolean(courseId && assignmentId),
  })
}

function useTeamsMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  courseId: string | undefined,
  assignmentId: string | undefined,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (courseId && assignmentId) {
        void queryClient.invalidateQueries({ queryKey: teamsQueryKey(courseId, assignmentId) })
      }
    },
  })
}

export function useCreateTeamMutation(courseId: string | undefined, assignmentId: string | undefined) {
  return useTeamsMutation(
    ({ name }: { name?: string }) => createTeam(courseId!, assignmentId!, name),
    courseId,
    assignmentId,
  )
}

export function useJoinTeamMutation(courseId: string | undefined, assignmentId: string | undefined) {
  return useTeamsMutation(
    ({ teamId }: { teamId: string }) => joinTeam(courseId!, assignmentId!, teamId),
    courseId,
    assignmentId,
  )
}

export function useLeaveTeamMutation(courseId: string | undefined, assignmentId: string | undefined) {
  return useTeamsMutation(
    (_: void) => leaveTeam(courseId!, assignmentId!),
    courseId,
    assignmentId,
  )
}

export function useSaveTeamsMutation(courseId: string | undefined, assignmentId: string | undefined) {
  return useTeamsMutation(
    ({ teams }: { teams: { name: string; member_ids: string[] }[] }) =>
      saveTeams(courseId!, assignmentId!, teams),
    courseId,
    assignmentId,
  )
}

export function useGenerateRandomMutation(courseId: string | undefined, assignmentId: string | undefined) {
  return useTeamsMutation(
    (_: void) => generateRandomTeams(courseId!, assignmentId!),
    courseId,
    assignmentId,
  )
}

export function useGenerateBalancedMutation(courseId: string | undefined, assignmentId: string | undefined) {
  return useTeamsMutation(
    (_: void) => generateBalancedTeams(courseId!, assignmentId!),
    courseId,
    assignmentId,
  )
}

export function useLockRosterMutation(courseId: string | undefined, assignmentId: string | undefined) {
  return useTeamsMutation(
    (_: void) => lockRoster(courseId!, assignmentId!),
    courseId,
    assignmentId,
  )
}
