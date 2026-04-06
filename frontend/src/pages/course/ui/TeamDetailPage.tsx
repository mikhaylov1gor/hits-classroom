import { useEffect, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HistoryIcon from '@mui/icons-material/History'
import HowToVoteIcon from '@mui/icons-material/HowToVote'
import TimerOffIcon from '@mui/icons-material/TimerOff'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAssignment,
  getTeamAudit,
  listCourseMembers,
  listSubmissions,
  listTeams,
} from '../../../features/courses/api/coursesApi'
import type {
  Assignment,
  Member,
  Submission,
  TeamAuditEvent,
  TeamWithMembers,
} from '../../../features/courses/model/types'

// ── Event type classification ───────────────────────────────────────────────

const COMPOSITION_EVENT_TYPES = new Set([
  'team_created',
  'created',
  'member_joined',
  'member_left',
  'member_removed',
  'roster_locked',
])

const VOTING_EVENT_TYPES = new Set([
  'submission_proposed',
  'submission_created',
  'submission_attached',
  'vote_cast',
  'vote_finalized',
  'voting_started',
  'voting_open',
])

const DEADLINE_EVENT_TYPES = new Set([
  'deadline_auto_finalized',
  'deadline_finalized',
  'auto_finalized',
])

const EVENT_TYPE_LABELS: Record<string, string> = {
  team_created: 'Команда создана',
  created: 'Команда создана',
  member_joined: 'Участник вступил в команду',
  member_left: 'Участник покинул команду',
  member_removed: 'Участник удалён из команды',
  roster_locked: 'Состав закреплён',
  submission_proposed: 'Предложено решение',
  submission_created: 'Создано решение',
  submission_attached: 'Решение прикреплено',
  vote_cast: 'Голос отдан',
  vote_finalized: 'Голосование завершено',
  voting_started: 'Голосование открыто',
  voting_open: 'Голосование открыто',
  deadline_auto_finalized: 'Автоматическая фиксация по дедлайну',
  deadline_finalized: 'Фиксация дедлайна',
  auto_finalized: 'Автоматическая фиксация',
}

const SUBMISSION_RULE_LABELS: Record<string, string> = {
  first_submission: 'Первое решение',
  last_submission: 'Последнее решение',
  top_student_only: 'Решение лучшего студента',
  vote_equal: 'Голосование (равные голоса)',
  vote_weighted: 'Голосование (взвешенные голоса)',
}

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getPersonName(
  userId: string,
  members: Member[],
  teamMembers: TeamWithMembers['members'],
): string {
  const m = members.find((x) => x.user_id === userId)
  if (m) return `${m.first_name} ${m.last_name}`.trim()
  const tm = teamMembers.find((x) => x.user_id === userId)
  if (tm) return `${tm.first_name} ${tm.last_name}`.trim()
  return `Пользователь ${userId.slice(0, 8)}…`
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box className="flex items-center gap-2 mb-2">
      {icon}
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
    </Box>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
      {text}
    </Typography>
  )
}

function EventRow({
  event,
  members,
  teamMembers,
}: {
  event: TeamAuditEvent
  members: Member[]
  teamMembers: TeamWithMembers['members']
}) {
  const actorName = getPersonName(event.actor_user_id, members, teamMembers)
  const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type

  // Try to get subject from payload (e.g., who joined/left)
  let detail = ''
  const payload = event.payload as Record<string, unknown>
  if (payload.user_id && typeof payload.user_id === 'string') {
    const targetName = getPersonName(payload.user_id as string, members, teamMembers)
    if (payload.user_id !== event.actor_user_id) {
      detail = `Участник: ${targetName}`
    }
  }
  if (payload.first_name || payload.last_name) {
    detail = `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim()
  }

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2">{formatDateTime(event.created_at)}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary">{detail}</Typography>
        )}
      </TableCell>
      <TableCell>
        <Box className="flex items-center gap-1">
          <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: 'primary.light' }}>
            {getInitials(actorName)}
          </Avatar>
          <Typography variant="body2">{actorName}</Typography>
        </Box>
      </TableCell>
    </TableRow>
  )
}

// ── Composition history ───────────────────────────────────────────────────────

function CompositionHistory({
  events,
  members,
  teamMembers,
}: {
  events: TeamAuditEvent[]
  members: Member[]
  teamMembers: TeamWithMembers['members']
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <SectionTitle icon={<HistoryIcon color="action" />} title="История изменений состава" />
      {events.length === 0 ? (
        <EmptyState text="Нет записей об изменениях состава" />
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата и время</TableCell>
                <TableCell>Событие</TableCell>
                <TableCell>Инициатор</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((ev) => (
                <EventRow key={ev.id} event={ev} members={members} teamMembers={teamMembers} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  )
}

// ── Solutions and voting history ──────────────────────────────────────────────

function SubmissionPreview({ submission }: { submission: Submission }) {
  const body = submission.body?.trim()
  const fileCount = submission.file_ids?.length ?? 0

  if (body) {
    return (
      <Tooltip title={body} placement="top">
        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {body.length > 60 ? body.slice(0, 60) + '…' : body}
        </Typography>
      </Tooltip>
    )
  }
  if (fileCount > 0) {
    return <Typography variant="body2" color="text.secondary">{fileCount} файл(ов)</Typography>
  }
  return <Typography variant="body2" color="text.secondary">(без содержимого)</Typography>
}

function VotingHistory({
  events,
  submissions,
  members,
  teamMembers,
  attachedSubmission,
}: {
  events: TeamAuditEvent[]
  submissions: Submission[]
  members: Member[]
  teamMembers: TeamWithMembers['members']
  attachedSubmission: Submission | undefined
}) {
  // Group events: proposals and votes
  const proposalEvents = events.filter((e) =>
    ['submission_proposed', 'submission_created', 'submission_attached'].includes(e.event_type),
  )
  const voteEvents = events.filter((e) => e.event_type === 'vote_cast')

  // Find vote weight from payload
  function getVoteWeight(ev: TeamAuditEvent): number | null {
    const w = (ev.payload as Record<string, unknown>).vote_weight
    if (typeof w === 'number') return w
    return null
  }

  function getSubmissionId(ev: TeamAuditEvent): string | null {
    const sid = (ev.payload as Record<string, unknown>).submission_id
    if (typeof sid === 'string') return sid
    return null
  }

  function findSubmission(id: string | null): Submission | undefined {
    if (!id) return undefined
    return submissions.find((s) => s.id === id)
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <SectionTitle icon={<HowToVoteIcon color="action" />} title="История решений и голосования" />

      {/* Proposed submissions */}
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1, mt: 0.5 }}>
        Предложенные решения
      </Typography>
      {submissions.length === 0 ? (
        <EmptyState text="Нет предложенных решений" />
      ) : (
        <TableContainer sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Автор</TableCell>
                <TableCell>Содержимое</TableCell>
                <TableCell>Время</TableCell>
                <TableCell>Финальное</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {submissions.map((sub) => {
                const authorName = getPersonName(sub.user_id, members, teamMembers)
                const isFinal = sub.is_attached === true
                return (
                  <TableRow key={sub.id} hover sx={isFinal ? { bgcolor: 'success.50' } : undefined}>
                    <TableCell>
                      <Box className="flex items-center gap-1">
                        <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: 'secondary.light' }}>
                          {getInitials(authorName)}
                        </Avatar>
                        <Typography variant="body2">{authorName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><SubmissionPreview submission={sub} /></TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {sub.submitted_at ? formatDateTime(sub.submitted_at) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {isFinal && <Chip size="small" label="Финальное" color="success" />}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Voting results */}
      {voteEvents.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
            Результаты голосования
          </Typography>
          <TableContainer sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Проголосовал</TableCell>
                  <TableCell>За решение</TableCell>
                  <TableCell>Вес голоса</TableCell>
                  <TableCell>Время</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {voteEvents.map((ev) => {
                  const voterName = getPersonName(ev.actor_user_id, members, teamMembers)
                  const subId = getSubmissionId(ev)
                  const votedFor = findSubmission(subId)
                  const weight = getVoteWeight(ev)
                  const authorName = votedFor
                    ? getPersonName(votedFor.user_id, members, teamMembers)
                    : subId
                      ? `Решение ${subId.slice(0, 8)}…`
                      : '—'
                  return (
                    <TableRow key={ev.id} hover>
                      <TableCell>
                        <Box className="flex items-center gap-1">
                          <Avatar sx={{ width: 22, height: 22, fontSize: 9 }}>
                            {getInitials(voterName)}
                          </Avatar>
                          <Typography variant="body2">{voterName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{authorName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {weight != null ? weight.toFixed(2) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDateTime(ev.created_at)}</Typography>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Final solution summary */}
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        Итоговое финальное решение
      </Typography>
      {attachedSubmission ? (
        <Box sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200', borderRadius: 1, p: 1.5 }}>
          <Typography variant="body2" fontWeight={500}>
            Автор: {getPersonName(attachedSubmission.user_id, members, teamMembers)}
          </Typography>
          {attachedSubmission.submitted_at && (
            <Typography variant="caption" color="text.secondary">
              Прикреплено: {formatDateTime(attachedSubmission.submitted_at)}
            </Typography>
          )}
          {attachedSubmission.body && (
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {attachedSubmission.body}
            </Typography>
          )}
          {(attachedSubmission.file_ids?.length ?? 0) > 0 && (
            <Typography variant="caption" color="text.secondary">
              Файлов: {attachedSubmission.file_ids!.length}
            </Typography>
          )}
        </Box>
      ) : (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          Финальное решение не выбрано
        </Alert>
      )}
    </Paper>
  )
}

// ── Deadline fixation record ──────────────────────────────────────────────────

function DeadlineFixationRecord({
  events,
  assignment,
  submissions,
  members,
  teamMembers,
}: {
  events: TeamAuditEvent[]
  assignment: Assignment
  submissions: Submission[]
  members: Member[]
  teamMembers: TeamWithMembers['members']
}) {
  const attachedSubmission = submissions.find((s) => s.is_attached === true)
  const deadlineEvent = events.find((e) => DEADLINE_EVENT_TYPES.has(e.event_type))
  const autoFinalizedAt = assignment.deadline_auto_finalized_at

  // If neither event nor flag — nothing to show
  const hasFixation = deadlineEvent != null || autoFinalizedAt != null

  const fixationTime = deadlineEvent?.created_at ?? autoFinalizedAt ?? null

  const payload = (deadlineEvent?.payload ?? {}) as Record<string, unknown>
  const ruleFromPayload =
    typeof payload.rule === 'string' ? payload.rule : null
  const rule = ruleFromPayload ?? assignment.team_submission_rule ?? null

  const selectedSubId =
    typeof payload.submission_id === 'string' ? payload.submission_id : null
  const reason =
    typeof payload.reason === 'string' ? payload.reason : null

  const selectedSub = selectedSubId
    ? submissions.find((s) => s.id === selectedSubId)
    : attachedSubmission

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <SectionTitle icon={<TimerOffIcon color="action" />} title="Запись о фиксации дедлайна" />

      {!hasFixation ? (
        <EmptyState text="Автоматическая фиксация по дедлайну не выполнялась" />
      ) : (
        <Box className="flex flex-col gap-2">
          <Box className="flex gap-6 flex-wrap">
            <Box>
              <Typography variant="caption" color="text.secondary">Время фиксации</Typography>
              <Typography variant="body2" fontWeight={500}>
                {fixationTime ? formatDateTime(fixationTime) : '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Применённое правило</Typography>
              <Typography variant="body2" fontWeight={500}>
                {rule ? (SUBMISSION_RULE_LABELS[rule] ?? rule) : '—'}
              </Typography>
            </Box>
          </Box>

          {reason && (
            <Box>
              <Typography variant="caption" color="text.secondary">Причина</Typography>
              <Typography variant="body2">{reason}</Typography>
            </Box>
          )}

          <Divider />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Выбранное решение
            </Typography>
            {selectedSub ? (
              <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200', borderRadius: 1, p: 1.5 }}>
                <Typography variant="body2" fontWeight={500}>
                  Автор: {getPersonName(selectedSub.user_id, members, teamMembers)}
                </Typography>
                {selectedSub.submitted_at && (
                  <Typography variant="caption" color="text.secondary">
                    Подано: {formatDateTime(selectedSub.submitted_at)}
                  </Typography>
                )}
                {selectedSub.body && (
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {selectedSub.body}
                  </Typography>
                )}
              </Box>
            ) : (
              <Alert severity="error" sx={{ py: 0.5 }}>
                Задание не сдано
              </Alert>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TeamDetailPage() {
  const { courseId, assignmentId, teamId } = useParams<{
    courseId: string
    assignmentId: string
    teamId: string
  }>()
  const navigate = useNavigate()

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [team, setTeam] = useState<TeamWithMembers | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [auditEvents, setAuditEvents] = useState<TeamAuditEvent[]>([])
  const [courseMembers, setCourseMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId || !assignmentId || !teamId) return

    setLoading(true)
    setError(null)

    Promise.all([
      getAssignment(courseId, assignmentId),
      listTeams(courseId, assignmentId),
      listSubmissions(courseId, assignmentId),
      getTeamAudit(courseId, assignmentId, { team_id: teamId, limit: 500 }),
      listCourseMembers(courseId),
    ])
      .then(([asgn, teams, subs, audit, members]) => {
        setAssignment(asgn)
        const found = teams.find((t) => t.id === teamId) ?? null
        setTeam(found)
        if (found) {
          const memberIds = new Set(found.members.map((m) => m.user_id))
          setSubmissions(subs.filter((s) => memberIds.has(s.user_id)))
        }
        setAuditEvents(audit)
        setCourseMembers(members)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки данных')
      })
      .finally(() => setLoading(false))
  }, [courseId, assignmentId, teamId])

  const compositionEvents = auditEvents.filter((e) => COMPOSITION_EVENT_TYPES.has(e.event_type))
  const votingEvents = auditEvents.filter((e) => VOTING_EVENT_TYPES.has(e.event_type))
  const deadlineEvents = auditEvents.filter((e) => DEADLINE_EVENT_TYPES.has(e.event_type))

  const attachedSubmission = submissions.find((s) => s.is_attached === true)

  const teamMembers = team?.members ?? []

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box className="flex items-center gap-2 mb-3">
        <IconButton
          size="small"
          onClick={() => navigate(`/course/${courseId}/assignment/${assignmentId}`)}
          aria-label="Назад к заданию"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          {loading ? 'Загрузка…' : team ? team.name : 'Команда не найдена'}
        </Typography>
        {team && (
          <Chip
            size="small"
            label={STATUS_LABELS[team.status] ?? team.status}
            color={STATUS_COLORS[team.status] ?? 'default'}
          />
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box className="flex justify-center py-10">
          <CircularProgress />
        </Box>
      ) : !team ? (
        <Alert severity="warning">Команда не найдена</Alert>
      ) : (
        <Box className="flex flex-col gap-3">
          {/* Team members summary */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box className="flex items-center gap-2 mb-2">
              <GroupsOutlinedIcon color="action" />
              <Typography variant="subtitle1" fontWeight={700}>
                Состав команды
              </Typography>
            </Box>
            <Box className="flex flex-wrap gap-2">
              {team.members.map((m) => (
                <Chip
                  key={m.user_id}
                  size="small"
                  avatar={
                    <Avatar sx={{ fontSize: 10 }}>
                      {getInitials(`${m.first_name} ${m.last_name}`)}
                    </Avatar>
                  }
                  label={`${m.first_name} ${m.last_name}`}
                />
              ))}
            </Box>
            {attachedSubmission && (
              <Box className="flex items-center gap-2 mt-2">
                <Typography variant="caption" color="text.secondary">Оценка:</Typography>
                {attachedSubmission.grade != null ? (
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {attachedSubmission.grade}/{assignment?.max_grade ?? 100}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">Не выставлена</Typography>
                )}
              </Box>
            )}
          </Paper>

          {/* Composition history */}
          <CompositionHistory
            events={compositionEvents}
            members={courseMembers}
            teamMembers={teamMembers}
          />

          {/* Solutions and voting */}
          <VotingHistory
            events={votingEvents}
            submissions={submissions}
            members={courseMembers}
            teamMembers={teamMembers}
            attachedSubmission={attachedSubmission}
          />

          {/* Deadline fixation */}
          {assignment && (
            <DeadlineFixationRecord
              events={deadlineEvents}
              assignment={assignment}
              submissions={submissions}
              members={courseMembers}
              teamMembers={teamMembers}
            />
          )}
        </Box>
      )}
    </Container>
  )
}
