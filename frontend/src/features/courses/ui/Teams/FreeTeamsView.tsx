import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { Member, TeamWithMembers } from '../../model/types'
import {
  teamsQueryKey,
  useCreateTeamMutation,
  useDeleteTeamMutation,
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
  /** Если задано в настройках задания — нельзя создать больше команд */
  maxTeams?: number | null
  courseMembers?: Member[]
  onAssignmentUpdated?: () => void | Promise<void>
}

export function FreeTeamsView({
  courseId,
  assignmentId,
  teams,
  currentUserId,
  isTeacher,
  isLocked,
  maxTeams,
  courseMembers = [],
  onAssignmentUpdated,
}: Props) {
  const queryClient = useQueryClient()
  const refreshTeamsAndAssignment = useCallback(async () => {
    if (courseId && assignmentId) {
      await queryClient.invalidateQueries({ queryKey: teamsQueryKey(courseId, assignmentId) })
    }
    await onAssignmentUpdated?.()
  }, [assignmentId, courseId, onAssignmentUpdated, queryClient])

  const [newTeamName, setNewTeamName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [lastMemberLeaveChoice, setLastMemberLeaveChoice] = useState(false)
  /** Удаление пустой команды из блока «Все команды» (создатель не в составе) */
  const [pendingEmptyDeleteId, setPendingEmptyDeleteId] = useState<string | null>(null)
  /** Удаление команды преподавателем до фиксации составов */
  const [pendingTeacherDeleteId, setPendingTeacherDeleteId] = useState<string | null>(null)

  const myTeam =
    (currentUserId &&
      teams.find((t) => t.members.some((m) => m.user_id === currentUserId))) ||
    undefined

  const teamLimit = maxTeams != null && maxTeams > 0 ? maxTeams : null
  const isAtTeamCreationLimit = teamLimit != null && teams.length >= teamLimit

  const createMutation = useCreateTeamMutation(courseId, assignmentId)
  const joinMutation = useJoinTeamMutation(courseId, assignmentId)
  const leaveMutation = useLeaveTeamMutation(courseId, assignmentId)
  const deleteMutation = useDeleteTeamMutation(courseId, assignmentId)
  const lockMutation = useLockRosterMutation(courseId, assignmentId)

  const canDeleteMyTeam =
    !isLocked &&
    myTeam != null &&
    currentUserId != null &&
    myTeam.creator_id === currentUserId &&
    myTeam.members.some((m) => m.user_id === myTeam.creator_id)

  const isLastMemberCreator =
    myTeam != null &&
    currentUserId != null &&
    myTeam.members.length === 1 &&
    myTeam.members[0].user_id === currentUserId &&
    myTeam.creator_id === currentUserId

  useEffect(() => {
    setDeleteConfirm(false)
    setLastMemberLeaveChoice(false)
  }, [myTeam?.id])

  useEffect(() => {
    if (pendingEmptyDeleteId && !teams.some((t) => t.id === pendingEmptyDeleteId)) {
      setPendingEmptyDeleteId(null)
    }
  }, [teams, pendingEmptyDeleteId])

  useEffect(() => {
    if (pendingTeacherDeleteId && !teams.some((t) => t.id === pendingTeacherDeleteId)) {
      setPendingTeacherDeleteId(null)
    }
  }, [teams, pendingTeacherDeleteId])

  const teamsForList = !isTeacher && myTeam
    ? teams.filter((team) => team.id !== myTeam.id)
    : teams

  const handleCreate = async () => {
    if (teamLimit != null && teams.length >= teamLimit) {
      setError(`Достигнуто максимальное количество команд (${teamLimit})`)
      return
    }
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
      setLastMemberLeaveChoice(false)
      await onAssignmentUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось покинуть команду')
      await refreshTeamsAndAssignment()
    }
  }

  const onLeaveClick = () => {
    if (!myTeam) return
    if (!isLocked && isLastMemberCreator) {
      setLastMemberLeaveChoice(true)
      return
    }
    void handleLeave()
  }

  const handleDeleteTeamById = async (teamId: string) => {
    setError(null)
    try {
      await deleteMutation.mutateAsync({ teamId })
      setDeleteConfirm(false)
      setPendingEmptyDeleteId(null)
      setPendingTeacherDeleteId(null)
      setLastMemberLeaveChoice(false)
      await onAssignmentUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить команду')
      await refreshTeamsAndAssignment()
    }
  }

  const handleDeleteTeam = async () => {
    if (!myTeam) return
    await handleDeleteTeamById(myTeam.id)
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
                showCreatorName={isTeacher}
                courseMembers={courseMembers}
                actions={
                  !isLocked && (
                    <>
                      {lastMemberLeaveChoice ? (
                        <Box className="flex flex-col gap-2">
                          <Typography variant="body2" color="text.secondary">
                            Вы последний участник. Удалить команду или оставить её без участников?
                          </Typography>
                          <Box className="flex flex-wrap gap-1 items-center">
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={leaveMutation.isPending || deleteMutation.isPending}
                              onClick={() => void handleLeave()}
                            >
                              {leaveMutation.isPending ? (
                                <CircularProgress size={16} />
                              ) : (
                                'Оставить пустой'
                              )}
                            </Button>
                            {canDeleteMyTeam &&
                              (deleteConfirm ? (
                                <>
                                  <Button
                                    size="small"
                                    color="error"
                                    variant="contained"
                                    disabled={deleteMutation.isPending || leaveMutation.isPending}
                                    onClick={handleDeleteTeam}
                                  >
                                    {deleteMutation.isPending ? (
                                      <CircularProgress size={16} />
                                    ) : (
                                      'Да, удалить'
                                    )}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="text"
                                    disabled={deleteMutation.isPending || leaveMutation.isPending}
                                    onClick={() => setDeleteConfirm(false)}
                                  >
                                    Нет
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  disabled={leaveMutation.isPending}
                                  onClick={() => setDeleteConfirm(true)}
                                >
                                  Удалить команду
                                </Button>
                              ))}
                            <Button
                              size="small"
                              variant="text"
                              disabled={leaveMutation.isPending || deleteMutation.isPending}
                              onClick={() => {
                                setLastMemberLeaveChoice(false)
                                setDeleteConfirm(false)
                              }}
                            >
                              Отмена
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <Box className="flex flex-wrap gap-1 items-center">
                          {canDeleteMyTeam &&
                            (deleteConfirm ? (
                              <>
                                <Button
                                  size="small"
                                  color="error"
                                  variant="contained"
                                  disabled={deleteMutation.isPending || leaveMutation.isPending}
                                  onClick={handleDeleteTeam}
                                >
                                  {deleteMutation.isPending ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    'Да, удалить'
                                  )}
                                </Button>
                                <Button
                                  size="small"
                                  variant="text"
                                  disabled={deleteMutation.isPending || leaveMutation.isPending}
                                  onClick={() => setDeleteConfirm(false)}
                                >
                                  Нет
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                disabled={leaveMutation.isPending}
                                onClick={() => setDeleteConfirm(true)}
                              >
                                Удалить команду
                              </Button>
                            ))}
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={leaveMutation.isPending || deleteMutation.isPending}
                            onClick={onLeaveClick}
                          >
                            {leaveMutation.isPending ? (
                              <CircularProgress size={16} />
                            ) : (
                              'Покинуть команду'
                            )}
                          </Button>
                        </Box>
                      )}
                    </>
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
              {isAtTeamCreationLimit && (
                <Alert severity="warning">
                  Достигнуто максимальное количество команд для этого задания ({teamLimit}).
                  Новую команду создать нельзя.
                </Alert>
              )}
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
                    disabled={createMutation.isPending || isAtTeamCreationLimit}
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
                  disabled={isAtTeamCreationLimit}
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
              const isMyEmptyTeam =
                Boolean(currentUserId) &&
                team.members.length === 0 &&
                team.creator_id === currentUserId

              const canJoin =
                !isTeacher &&
                !isLocked &&
                !myTeam &&
                !isFull &&
                !isMyEmptyTeam

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
              } else if (!isTeacher && !isLocked && isMyEmptyTeam) {
                listActions =
                  pendingEmptyDeleteId === team.id ? (
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
                        onClick={() => setPendingEmptyDeleteId(null)}
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
                      onClick={() => setPendingEmptyDeleteId(team.id)}
                    >
                      Удалить команду
                    </Button>
                  )
              } else if (canJoin) {
                listActions = (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={joinMutation.isPending}
                    onClick={() => handleJoin(team.id)}
                  >
                    {joinMutation.isPending ? <CircularProgress size={16} /> : 'Вступить'}
                  </Button>
                )
              } else if (!isTeacher && !isMine && isFull && !isLocked && !myTeam) {
                listActions = (
                  <Button size="small" variant="outlined" disabled>
                    Команда заполнена
                  </Button>
                )
              }

              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  highlighted={isMine}
                  showCreatorName={isTeacher}
                  courseMembers={courseMembers}
                  actions={listActions}
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
