import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Slider,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type {
  Assignment,
  TeamMemberInfo,
  TeamSubmissionForVote,
  TeamWithMembers,
} from '../../model/types'
import {
  createTeam,
  joinTeam,
  leaveTeam,
  listTeamSubmissions,
  listTeams,
  submitPeerGradeSplit,
  toggleSubmissionLike,
  voteForSubmission,
} from '../../api/coursesApi'

const STATUS_LABELS: Record<string, string> = {
  forming: 'Формирование',
  roster_locked: 'Состав закреплён',
  voting_open: 'Голосование открыто',
  voting: 'Голосование',
  submitted: 'Сдано',
  graded: 'Оценено',
  not_submitted: 'Не сдано',
}

const STATUS_COLORS: Record<
  string,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
  forming: 'default',
  roster_locked: 'info',
  voting_open: 'secondary',
  voting: 'secondary',
  submitted: 'success',
  graded: 'success',
  not_submitted: 'error',
}

function TeamStatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={STATUS_LABELS[status] ?? status}
      color={STATUS_COLORS[status] ?? 'default'}
    />
  )
}

function VotingPanel({
  courseId,
  assignmentId,
  team,
  myUserId,
  onRefresh,
  isDeadlinePassed,
  onProposeClick,
}: {
  courseId: string
  assignmentId: string
  team: TeamWithMembers
  myUserId: string
  onRefresh: () => void
  isDeadlinePassed: boolean
  onProposeClick?: () => void
}) {
  const [items, setItems] = useState<TeamSubmissionForVote[]>([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [voting, setVoting] = useState<string | null>(null)
  const [liking, setLiking] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSubmissions = useCallback(async () => {
    setFetchLoading(true)
    try {
      const data = await listTeamSubmissions(courseId, assignmentId, team.id)
      setItems(data.sort((a, b) => (b.stats?.vote_weight ?? 0) - (a.stats?.vote_weight ?? 0)))
    } catch {
      // non-critical — show empty list
    } finally {
      setFetchLoading(false)
    }
  }, [courseId, assignmentId, team.id])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleVote = useCallback(
    async (submissionId: string) => {
      setVoting(submissionId)
      setError(null)
      try {
        await voteForSubmission(courseId, assignmentId, team.id, submissionId)
        await fetchSubmissions()
        onRefresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка голосования')
      } finally {
        setVoting(null)
      }
    },
    [courseId, assignmentId, team.id, onRefresh, fetchSubmissions],
  )

  const handleLike = useCallback(
    async (submissionId: string) => {
      setLiking(submissionId)
      // optimistic update
      setItems((prev) =>
        prev.map((item) =>
          item.submission.id === submissionId
            ? { ...item, stats: { ...item.stats, like_count: item.stats.like_count + 1 } }
            : item,
        ),
      )
      try {
        await toggleSubmissionLike(courseId, assignmentId, team.id, submissionId)
        await fetchSubmissions()
      } catch {
        await fetchSubmissions() // revert on error
      } finally {
        setLiking(null)
      }
    },
    [courseId, assignmentId, team.id, fetchSubmissions],
  )

  const myCandidate = items.find((item) => item.submission.user_id === myUserId)

  if (fetchLoading) {
    return <LinearProgress sx={{ mt: 1 }} />
  }

  if (isDeadlinePassed) {
    return (
      <Alert severity="info" sx={{ mt: 1 }}>
        Голосование завершено — дедлайн прошёл.
        {items.length > 0
          ? ' Система автоматически определила финальное решение.'
          : ' Ни одно решение не было предложено.'}
      </Alert>
    )
  }

  if (items.length === 0) {
    return (
      <Box className="flex flex-col gap-2 mt-2">
        <Alert severity="info">
          Никто из команды ещё не предложил решение для голосования.
        </Alert>
        {onProposeClick && (
          <Button variant="outlined" size="small" onClick={onProposeClick}>
            Предложить решение
          </Button>
        )}
      </Box>
    )
  }

  return (
    <Box className="flex flex-col gap-2 mt-2">
      <Box className="flex items-center gap-1">
        <HowToVoteOutlinedIcon fontSize="small" color="action" />
        <Typography variant="subtitle2">Проголосуйте за финальное решение</Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <List dense disablePadding>
        {items.map(({ submission: sub, stats }) => {
          const author = team.members.find((m) => m.user_id === sub.user_id)
          const authorName = author
            ? `${author.first_name} ${author.last_name}`
            : (sub.author
                ? `${sub.author.first_name} ${sub.author.last_name}`
                : 'Участник')
          const isOwn = sub.user_id === myUserId
          const isVoting = voting === sub.id
          const isLiking = liking === sub.id
          return (
            <ListItem
              key={sub.id}
              sx={{
                border: '1px solid',
                borderColor: 'grey.200',
                borderRadius: 1,
                mb: 1,
                flexDirection: 'column',
                alignItems: 'flex-start',
                bgcolor: isOwn ? 'primary.50' : 'background.paper',
                pr: 1,
              }}
            >
              <Box className="flex items-center justify-between w-full gap-2">
                <Box className="flex items-center gap-1 flex-1 min-w-0">
                  <Typography variant="body2" fontWeight={isOwn ? 600 : 400} className="truncate">
                    {authorName}
                  </Typography>
                  {isOwn && (
                    <Chip label="Моё" size="small" color="primary" sx={{ height: 18 }} />
                  )}
                </Box>
                <Box className="flex items-center gap-1 shrink-0">
                  <Chip
                    size="small"
                    icon={<HowToVoteOutlinedIcon sx={{ fontSize: '0.8rem !important' }} />}
                    label={`${stats?.vote_count ?? 0} (${(stats?.vote_weight ?? 0).toFixed(1)})`}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                  <Chip
                    size="small"
                    label={`♥ ${stats?.like_count ?? 0}`}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22, color: 'error.main', borderColor: 'error.light' }}
                  />
                </Box>
              </Box>
              {sub.body && expandedId !== sub.id && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {sub.body.slice(0, 100)}{sub.body.length > 100 ? '…' : ''}
                </Typography>
              )}
              {expandedId === sub.id && (
                <Box sx={{ mt: 1, width: '100%' }}>
                  {sub.body && (
                    <Typography
                      variant="body2"
                      color="text.primary"
                      sx={{ whiteSpace: 'pre-wrap', mb: 1 }}
                    >
                      {sub.body}
                    </Typography>
                  )}
                  {sub.file_ids && sub.file_ids.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Файлы:
                      </Typography>
                      {sub.file_ids.map((fid) => (
                        <Typography key={fid} variant="caption" color="text.secondary" sx={{ display: 'block', pl: 1 }}>
                          {fid}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  {sub.submitted_at && (
                    <Typography variant="caption" color="text.secondary">
                      Отправлено: {new Date(sub.submitted_at).toLocaleString('ru-RU')}
                    </Typography>
                  )}
                </Box>
              )}
              <Box className="flex gap-1 mt-1 flex-wrap">
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                  sx={{ fontSize: '0.72rem', py: 0.25 }}
                >
                  {expandedId === sub.id ? 'Скрыть' : 'Посмотреть решение'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!!voting || isDeadlinePassed}
                  startIcon={isVoting ? <CircularProgress size={12} /> : <HowToVoteOutlinedIcon />}
                  onClick={() => handleVote(sub.id)}
                  sx={{ fontSize: '0.72rem', py: 0.25 }}
                >
                  Голос
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={!!liking}
                  onClick={() => handleLike(sub.id)}
                  sx={{ fontSize: '0.72rem', py: 0.25, minWidth: 0, px: 1 }}
                >
                  {isLiking ? <CircularProgress size={12} /> : '♥'}
                </Button>
              </Box>
            </ListItem>
          )
        })}
      </List>
      {!myCandidate && onProposeClick && (
        <Button variant="outlined" size="small" onClick={onProposeClick} sx={{ mt: 0.5 }}>
          Предложить решение
        </Button>
      )}
    </Box>
  )
}

function PeerSplitPanel({
  courseId,
  assignmentId,
  team,
  myUserId,
  minPercent,
  maxPercent,
  onRefresh,
}: {
  courseId: string
  assignmentId: string
  team: TeamWithMembers
  myUserId: string
  minPercent: number
  maxPercent: number
  onRefresh: () => void
}) {
  const members = team.members
  const equal = members.length > 0 ? parseFloat((100 / members.length).toFixed(2)) : 0

  const [percents, setPercents] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    members.forEach((m, i) => {
      // distribute evenly, give remainder to last
      init[m.user_id] =
        i === members.length - 1
          ? parseFloat((100 - equal * (members.length - 1)).toFixed(2))
          : equal
    })
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const total = Object.values(percents).reduce((s, v) => s + v, 0)
  const isValid =
    Math.abs(total - 100) < 0.02 &&
    Object.values(percents).every((v) => v >= minPercent && v <= maxPercent)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await submitPeerGradeSplit(courseId, assignmentId, team.id, percents)
      setDone(true)
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mt: 1 }}>
        Вы уже отправили распределение процентов.
      </Alert>
    )
  }

  return (
    <Box className="flex flex-col gap-2 mt-2">
      <Typography variant="subtitle2">
        Распределите вклад участников (сумма = 100%, каждый от {minPercent}% до {maxPercent}%)
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {members.map((m) => (
        <Box key={m.user_id} className="flex flex-col gap-0.5">
          <Box className="flex justify-between">
            <Typography variant="body2">
              {m.first_name} {m.last_name}
              {m.user_id === myUserId && (
                <Chip label="Я" size="small" sx={{ ml: 1, height: 18 }} />
              )}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {percents[m.user_id]}%
            </Typography>
          </Box>
          <Slider
            size="small"
            min={minPercent}
            max={maxPercent}
            step={0.5}
            value={percents[m.user_id]}
            onChange={(_, val) =>
              setPercents((prev) => ({ ...prev, [m.user_id]: val as number }))
            }
          />
        </Box>
      ))}
      <Box className="flex items-center justify-between mt-1">
        <Typography
          variant="caption"
          color={Math.abs(total - 100) < 0.02 ? 'success.main' : 'error.main'}
        >
          Итого: {total.toFixed(2)}% {Math.abs(total - 100) >= 0.02 && '(должно быть 100%)'}
        </Typography>
        <Button
          variant="contained"
          size="small"
          disabled={!isValid || submitting}
          onClick={handleSubmit}
        >
          {submitting ? <CircularProgress size={16} /> : 'Отправить'}
        </Button>
      </Box>
    </Box>
  )
}

function TopStudentHint({ members, myUserId }: { members: TeamMemberInfo[]; myUserId: string }) {
  const sorted = [...members].sort((a, b) => b.average_score - a.average_score)
  const topId = sorted[0]?.user_id
  const isTop = topId === myUserId
  const top = sorted[0]

  return (
    <Alert
      severity={isTop ? 'success' : 'info'}
      icon={<EmojiEventsOutlinedIcon />}
      sx={{ mt: 1 }}
    >
      {isTop ? (
        'Вы — участник с наивысшим баллом и можете сдать финальное решение.'
      ) : top ? (
        <>
          Только <strong>{top.first_name} {top.last_name}</strong> (ср. балл:{' '}
          {top.average_score.toFixed(1)}) может сдать финальное решение.
        </>
      ) : (
        'Информация о баллах участников недоступна.'
      )}
    </Alert>
  )
}

function MembersList({
  members,
  myUserId,
  showScore,
}: {
  members: TeamMemberInfo[]
  myUserId: string
  showScore: boolean
}) {
  return (
    <List dense disablePadding>
      {members.map((m) => (
        <ListItem key={m.user_id} disableGutters>
          <ListItemText
            primary={
              <Typography variant="body2">
                {m.first_name} {m.last_name}
                {m.user_id === myUserId && (
                  <Chip label="Я" size="small" color="primary" sx={{ ml: 1, height: 18 }} />
                )}
              </Typography>
            }
          />
          {showScore && (
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
              ср. {m.average_score.toFixed(1)}
            </Typography>
          )}
        </ListItem>
      ))}
    </List>
  )
}

type TeamBlockProps = {
  courseId: string
  assignmentId: string
  assignment: Assignment
  myUserId: string
  onRefresh: () => void
  onProposeClick?: () => void
  onCanSubmitChange?: (can: boolean) => void
}

export function TeamBlock({
  courseId,
  assignmentId,
  assignment,
  myUserId,
  onRefresh,
  onProposeClick,
  onCanSubmitChange,
}: TeamBlockProps) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const rule = assignment.team_submission_rule
  const distributionType = assignment.team_distribution_type
  const rosterLocked = !!assignment.roster_locked_at
  const isVoteRule = rule === 'vote_equal' || rule === 'vote_weighted'
  const isPeerSplit = assignment.team_grading_mode === 'team_peer_split'
  const isTopStudent = rule === 'top_student_only'
  const showScore = isTopStudent || rule === 'vote_weighted'
  const isDeadlinePassed = assignment.deadline ? new Date(assignment.deadline) < new Date() : false
  const isAutoFinalized = !!assignment.deadline_auto_finalized_at

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listTeams(courseId, assignmentId)
      setTeams(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки команд')
    } finally {
      setLoading(false)
    }
  }, [courseId, assignmentId])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const myTeamForCallback = teams.find((t) => t.members.some((m) => m.user_id === myUserId))
  useEffect(() => {
    if (!onCanSubmitChange) return
    if (rule !== 'top_student_only') {
      onCanSubmitChange(true)
      return
    }
    if (!myTeamForCallback) return
    const sorted = [...myTeamForCallback.members].sort((a, b) => b.average_score - a.average_score)
    onCanSubmitChange(sorted[0]?.user_id === myUserId)
  }, [myTeamForCallback, myUserId, rule, onCanSubmitChange])

  const handleRefresh = useCallback(() => {
    fetchTeams()
    onRefresh()
  }, [fetchTeams, onRefresh])

  const myTeam = teams.find((t) => t.members.some((m) => m.user_id === myUserId))

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      await createTeam(courseId, assignmentId, newTeamName.trim() || undefined)
      setShowCreate(false)
      setNewTeamName('')
      handleRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания команды')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async (teamId: string) => {
    setJoining(teamId)
    setError(null)
    try {
      await joinTeam(courseId, assignmentId, teamId)
      handleRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка вступления')
    } finally {
      setJoining(null)
    }
  }

  const handleLeave = async () => {
    setLeaving(true)
    setError(null)
    try {
      await leaveTeam(courseId, assignmentId)
      handleRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка выхода из команды')
    } finally {
      setLeaving(false)
    }
  }

  if (loading) return <LinearProgress sx={{ my: 1 }} />

  return (
    <Box
      className="flex flex-col gap-3"
      sx={{ border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 2, mt: 2 }}
    >
      <Box className="flex items-center gap-2">
        <GroupsOutlinedIcon color="action" />
        <Typography variant="subtitle1" fontWeight={600}>
          Команда
        </Typography>
        {rosterLocked && <Chip label="Состав закреплён" size="small" color="warning" />}
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {myTeam ? (
        // ── I'm in a team ────────────────────────────────────────────────────
        <Box className="flex flex-col gap-2">
          <Box className="flex items-center justify-between">
            <Typography variant="body1" fontWeight={600}>
              {myTeam.name}
            </Typography>
            <TeamStatusChip status={myTeam.status} />
          </Box>

          <MembersList members={myTeam.members} myUserId={myUserId} showScore={showScore} />

          {/* Auto-finalized banner */}
          {isAutoFinalized && (
            <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mt: 1 }}>
              Финальное решение определено автоматически по правилу команды.
            </Alert>
          )}

          {/* Rule-specific UI */}
          {isTopStudent && (
            <TopStudentHint members={myTeam.members} myUserId={myUserId} />
          )}

          {isVoteRule && (
            <VotingPanel
              courseId={courseId}
              assignmentId={assignmentId}
              team={myTeam}
              myUserId={myUserId}
              onRefresh={handleRefresh}
              isDeadlinePassed={isDeadlinePassed}
              onProposeClick={onProposeClick}
            />
          )}

          {isPeerSplit && !isVoteRule && (
            <PeerSplitPanel
              courseId={courseId}
              assignmentId={assignmentId}
              team={myTeam}
              myUserId={myUserId}
              minPercent={assignment.peer_split_min_percent ?? 1}
              maxPercent={assignment.peer_split_max_percent ?? 99}
              onRefresh={handleRefresh}
            />
          )}

          {/* first_submission hint */}
          {rule === 'first_submission' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Первый участник команды, прикрепивший работу, «закрывает» финальное решение.
            </Alert>
          )}

          {/* last_submission hint */}
          {rule === 'last_submission' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Ваша финальная сдача автоматически открепит предыдущие финальные решения
              участников команды.
            </Alert>
          )}

          {!rosterLocked && distributionType === 'free' && (
            <Box>
              <Divider sx={{ my: 1 }} />
              <Button
                size="small"
                color="error"
                variant="text"
                disabled={leaving}
                onClick={handleLeave}
              >
                {leaving ? <CircularProgress size={16} /> : 'Покинуть команду'}
              </Button>
            </Box>
          )}
        </Box>
      ) : (
        // ── Not in a team ────────────────────────────────────────────────────
        <Box className="flex flex-col gap-2">
          <Alert severity="warning">Вы не состоите ни в одной команде.</Alert>

          {!rosterLocked && distributionType === 'free' && (
            <>
              {/* Create team */}
              {showCreate ? (
                <Box className="flex gap-2 items-center">
                  <TextField
                    size="small"
                    label="Название команды (необязательно)"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    disabled={creating}
                  />
                  <Button variant="contained" size="small" disabled={creating} onClick={handleCreate}>
                    {creating ? <CircularProgress size={16} /> : 'Создать'}
                  </Button>
                  <Button size="small" onClick={() => setShowCreate(false)}>
                    Отмена
                  </Button>
                </Box>
              ) : (
                <Button variant="outlined" size="small" onClick={() => setShowCreate(true)}>
                  Создать команду
                </Button>
              )}

              {/* Join existing teams */}
              {teams.length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    Или вступить в существующую:
                  </Typography>
                  <List dense disablePadding>
                    {teams.map((t) => (
                      <ListItem
                        key={t.id}
                        sx={{ border: '1px solid', borderColor: 'grey.100', borderRadius: 1, mb: 0.5 }}
                      >
                        <ListItemText
                          primary={t.name}
                          secondary={`${t.members.length} / ${t.max_members} участников`}
                        />
                        <ListItemSecondaryAction>
                          <Tooltip
                            title={
                              t.members.length >= t.max_members ? 'Команда заполнена' : ''
                            }
                          >
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={t.members.length >= t.max_members || !!joining}
                                onClick={() => handleJoin(t.id)}
                              >
                                {joining === t.id ? <CircularProgress size={14} /> : 'Вступить'}
                              </Button>
                            </span>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </>
          )}

          {(rosterLocked || distributionType !== 'free') && (
            <Alert severity="info">
              {rosterLocked
                ? 'Состав команд закреплён преподавателем. Обратитесь к нему, если вас нет ни в одной команде.'
                : 'Команды формирует преподаватель. Ожидайте распределения.'}
            </Alert>
          )}
        </Box>
      )}
    </Box>
  )
}
