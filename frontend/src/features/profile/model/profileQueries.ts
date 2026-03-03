import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '../../auth/model/types'
import { fetchCurrentUser, updateCurrentUser, type UpdateProfilePayload } from '../api/profileApi'

export const currentUserQueryKey = ['currentUser']

export function useCurrentUserQuery(enabled: boolean) {
  return useQuery<User, Error>({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    enabled,
  })
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation<User, Error, UpdateProfilePayload>({
    mutationFn: updateCurrentUser,
    onSuccess: (user) => {
      queryClient.setQueryData<User>(currentUserQueryKey, user)
    },
  })
}


