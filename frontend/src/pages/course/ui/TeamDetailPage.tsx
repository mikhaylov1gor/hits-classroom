import { useEffect, useState } from 'react'
import { useAuth } from '../../../features/auth'
import {
  Alert,
  Avatar,
  Box,
  Button,
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
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HistoryIcon from '@mui/icons-material/History'
import HowToVoteIcon from '@mui/icons-material/HowToVote'
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined'
import TimerOffIcon from '@mui/icons-material/TimerOff'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAssignment,
  getTeamAudit,
  listCourseMembers,
  listSubmissions,
  listTeams,
  listTeamSubmissions,
  toggleSubmissionLike,
  voteForSubmission,
} from '../../../features/courses/api/coursesApi'
import { FileAttachmentLink } from '../../../features/courses/ui/FileAttachmentLink/FileAttachmentLink'
import { getLinkHref, parseSubmissionBodyLinks } from '../../../features/courses/utils/urlValidation'
import type {
  Assignment,
  Member,
  Submission,
  TeamAuditEvent,
  TeamSubmissionForVote,
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
  'roster_change',
  'roster_changed',
])

const VOTING_EVENT_TYPES = new Set([
  'submission_proposed',
  'submission_created',
  'submission_attached',
  'vote_cast',
  'vote_finalized',
  'voting_started',
  'voting_open',
  'submission_liked',
])

const PEER_SPLIT_EVENT_TYPES = new Set([
  'peer_split_submitted',
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
  roster_locked: 'Состав заблокирован',
  roster_change: 'Изменение состава',
  roster_changed: 'Изменение состава',
  submission_proposed: 'Предложено решение',
  submission_created: 'Создано решение',
  submission_attached: 'Решение прикреплено',
  vote_cast: 'Голос отдан',
  vote_finalized: 'Голосование завершено',
  voting_started: 'Голосование открыто',
  voting_open: 'Голосование открыто',
  submission_liked: 'Лайк решения',
  peer_split_submitted: 'Отправлено распределение оценок',
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
  if (event.event_type === 'roster_change' || event.event_type === 'roster_changed') {
    const action = typeof payload.action === 'string' ? payload.action : null
    const targetId = typeof payload.user_id === 'string' ? payload.user_id : null
    const targetName = targetId ? getPersonName(targetId, members, teamMembers) : null
    const actionLabel =
      action === 'join' ? 'Вступление' : action === 'leave' ? 'Выход' : action ?? '—'
    detail = `${actionLabel}${targetName ? `: ${targetName}` : ''}`
  } else if (event.event_type === 'submission_liked') {
    const sid = typeof payload.submission_id === 'string' ? payload.submission_id : null
    const liked = payload.liked
    detail = `Решение: ${sid ? sid.slice(0, 8) + '…' : '—'}, лайк: ${liked ? 'поставлен' : 'снят'}`
  } else if (event.event_type === 'peer_split_submitted') {
    let percents: Record<string, number> | undefined
    if (typeof payload.percents === 'string') {
      try {
        percents = JSON.parse(payload.percents) as Record<string, number>
      } catch {
        percents = undefined
      }
    } else if (payload.percents && typeof payload.percents === 'object') {
      percents = payload.percents as Record<string, number>
    }
    if (percents) {
      const parts = Object.entries(percents)
        .map(([uid, pct]) => `${getPersonName(uid, members, teamMembers)}: ${pct}%`)
        .join(', ')
      detail = `Распределение: ${parts}`
    }
  } else {
    if (payload.user_id && typeof payload.user_id === 'string') {
      const targetName = getPersonName(payload.user_id as string, members, teamMembers)
      if (payload.user_id !== event.actor_user_id) {
        detail = `Участник: ${targetName}`
      }
    }
    if (payload.first_name || payload.last_name) {
      detail = `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim()
    }
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
  finalSubmissionId,
}: {
  events: TeamAuditEvent[]
  submissions: Submission[]
  members: Member[]
  teamMembers: TeamWithMembers['members']
  finalSubmissionId: string | null
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

  const finalSub = finalSubmissionId
    ? submissions.find((s) => s.id === finalSubmissionId)
    : undefined
  const finalLinks = parseSubmissionBodyLinks(finalSub?.body)

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
                const isFinal = finalSubmissionId === sub.id
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
      {finalSub ? (
        <Box sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200', borderRadius: 1, p: 1.5 }}>
          <Typography variant="body2" fontWeight={500}>
            Автор: {getPersonName(finalSub.user_id, members, teamMembers)}
          </Typography>
          {finalSub.submitted_at && (
            <Typography variant="caption" color="text.secondary">
              Прикреплено: {formatDateTime(finalSub.submitted_at)}
            </Typography>
          )}
          {finalLinks.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Ссылки:
              </Typography>
              {finalLinks.map((url, idx) => (
                <Typography
                  key={`final-link-${idx}`}
                  component="a"
                  href={getLinkHref(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  sx={{ display: 'block', wordBreak: 'break-all' }}
                >
                  {url}
                </Typography>
              ))}
            </Box>
          )}
          {(finalSub.file_ids?.length ?? 0) > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Прикреплённые файлы:
              </Typography>
              {finalSub.file_ids?.map((fid) => (
                <Box key={fid} sx={{ mt: 0.5 }}>
                  <FileAttachmentLink attachment={{ id: fid, name: '' }} showDownload={true} />
                </Box>
              ))}
            </Box>
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
    : rule === 'last_submission'
      ? [...submissions].sort(
          (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
        )[0]
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

// ── Team submissions for vote ─────────────────────────────────────────────────

function TeamSubmissionsSection({
  courseId,
  assignmentId,
  submissions,
  finalSubmissionId,
  members,
  teamMembers,
  onVote,
  onLike,
  voteLoading,
  likeLoading,
  canVote,
}: {
  courseId?: string
  assignmentId?: string
  submissions: TeamSubmissionForVote[]
  finalSubmissionId: string | null
  members: Member[]
  teamMembers: TeamWithMembers['members']
  onVote: (submissionId: string) => void
  onLike: (submissionId: string, currentLiked: boolean) => void
  voteLoading: string | null
  likeLoading: string | null
  canVote: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <SectionTitle icon={<ThumbUpAltOutlinedIcon color="action" />} title="Решения команды (голосование)" />
      {submissions.length === 0 ? (
        <EmptyState text="Нет решений для голосования" />
      ) : (
        <Box className="flex flex-col gap-2">
          {submissions.map((item) => {
            const { submission, stats } = item
            const authorName = getPersonName(submission.user_id, members, teamMembers)
            const isVoting = voteLoading === submission.id
            const isLiking = likeLoading === submission.id
            const isExpanded = expandedId === submission.id
            const body = submission.body?.trim()
            const fileCount = submission.file_ids?.length ?? 0
            const links = parseSubmissionBodyLinks(submission.body)
            const isFinal = finalSubmissionId === submission.id
            return (
              <Box
                key={submission.id}
                sx={{
                  border: '1px solid',
                  borderColor: isFinal ? 'success.300' : 'grey.200',
                  borderRadius: 1,
                  p: 1.5,
                  bgcolor: isFinal ? 'success.50' : 'background.paper',
                }}
              >
                <Box className="flex items-center gap-2 flex-wrap mb-1">
                  <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: 'secondary.light' }}>
                    {getInitials(authorName)}
                  </Avatar>
                  <Typography variant="body2" fontWeight={500}>{authorName}</Typography>
                  {isFinal && (
                    <Chip size="small" label="Финальное" color="success" sx={{ fontSize: '0.7rem' }} />
                  )}
                  <Box className="flex items-center gap-1 ml-auto">
                    <Chip
                      size="small"
                      icon={<HowToVoteIcon sx={{ fontSize: '0.85rem !important' }} />}
                      label={`${stats?.vote_count ?? 0} (${(stats?.vote_weight ?? 0).toFixed(1)})`}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                    <Chip
                      size="small"
                      icon={<FavoriteIcon sx={{ fontSize: '0.85rem !important', color: 'error.main' }} />}
                      label={stats?.like_count ?? 0}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </Box>
                </Box>

                {!isExpanded && (
                  <Box className="flex items-center gap-2 mt-1">
                    {fileCount > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {fileCount} файл(ов)
                      </Typography>
                    )}
                    {links.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {links.length} ссылка(ки)
                      </Typography>
                    )}
                  </Box>
                )}




                {/* Full content (expanded) */}
                {isExpanded && (
                  <Box sx={{ mt: 1 }}>
                    {submission.file_ids && submission.file_ids.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Прикреплённые файлы:
                        </Typography>
                        {submission.file_ids.map((fid) => (
                          <Box key={fid} sx={{ mt: 0.5 }}>
                            <FileAttachmentLink
                              attachment={{ id: fid, name: '' }}
                              fileSource={
                                courseId && assignmentId
                                  ? {
                                      type: 'submission',
                                      courseId,
                                      assignmentId,
                                      submissionId: submission.id,
                                    }
                                  : undefined
                              }
                              showDownload={true}
                            />
                          </Box>
                        ))}
                      </Box>
                    )}
                    {links.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Ссылки:
                        </Typography>
                        {links.map((url, idx) => (
                          <Typography
                            key={`submission-link-${submission.id}-${idx}`}
                            component="a"
                            href={getLinkHref(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            sx={{ display: 'block', wordBreak: 'break-all' }}
                          >
                            {url}
                          </Typography>
                        ))}
                      </Box>
                    )}
                    {submission.submitted_at && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Отправлено: {formatDateTime(submission.submitted_at)}
                      </Typography>
                    )}
                  </Box>
                )}

                <Box className="flex gap-2 mt-1.5 flex-wrap items-center">
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                    sx={{ fontSize: '0.75rem', py: 0.25 }}
                  >
                    {isExpanded ? 'Скрыть решение' : 'Посмотреть решение'}
                  </Button>
                  {canVote && (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<HowToVoteIcon fontSize="small" />}
                        onClick={() => onVote(submission.id)}
                        disabled={isVoting}
                        sx={{ fontSize: '0.75rem', py: 0.25 }}
                      >
                        {isVoting ? 'Голосование…' : 'Голосовать'}
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => onLike(submission.id, false)}
                        disabled={isLiking}
                        aria-label="Лайк"
                      >
                        {isLiking ? (
                          <CircularProgress size={16} />
                        ) : (
                          <FavoriteBorderIcon fontSize="small" sx={{ color: 'error.main' }} />
                        )}
                      </IconButton>
                    </>
                  )}
                </Box>
              </Box>
            )
          })}
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
  const { user } = useAuth()

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [team, setTeam] = useState<TeamWithMembers | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [teamSubmissionsForVote, setTeamSubmissionsForVote] = useState<TeamSubmissionForVote[]>([])
  const [auditEvents, setAuditEvents] = useState<TeamAuditEvent[]>([])
  const [courseMembers, setCourseMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voteLoading, setVoteLoading] = useState<string | null>(null)
  const [likeLoading, setLikeLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
      listTeamSubmissions(courseId, assignmentId, teamId).catch(() => []),
    ])
      .then(([asgn, teams, subs, audit, members, teamSubs]) => {
        setAssignment(asgn)
        const found = teams.find((t) => t.id === teamId) ?? null
        setTeam(found)
        if (found) {
          const memberIds = new Set(found.members.map((m) => m.user_id))
          setSubmissions(subs.filter((s) => memberIds.has(s.user_id)))
        }
        setAuditEvents(audit)
        setCourseMembers(members)
        setTeamSubmissionsForVote(
          (teamSubs as TeamSubmissionForVote[]).sort(
            (a, b) => (b.stats?.vote_weight ?? 0) - (a.stats?.vote_weight ?? 0),
          ),
        )
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки данных')
      })
      .finally(() => setLoading(false))
  }, [courseId, assignmentId, teamId])

  const handleVote = async (submissionId: string) => {
    if (!courseId || !assignmentId || !teamId) return
    setVoteLoading(submissionId)
    setActionError(null)
    try {
      await voteForSubmission(courseId, assignmentId, teamId, submissionId)
      const updated = await listTeamSubmissions(courseId, assignmentId, teamId)
      setTeamSubmissionsForVote(updated.sort((a, b) => (b.stats?.vote_weight ?? 0) - (a.stats?.vote_weight ?? 0)))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Ошибка голосования')
    } finally {
      setVoteLoading(null)
    }
  }

  const handleLike = async (submissionId: string) => {
    if (!courseId || !assignmentId || !teamId) return
    setLikeLoading(submissionId)
    setActionError(null)
    // Optimistic update
    setTeamSubmissionsForVote((prev) =>
      prev.map((item) =>
        item.submission.id === submissionId
          ? { ...item, stats: { ...item.stats, like_count: item.stats.like_count + 1 } }
          : item,
      ),
    )
    try {
      await toggleSubmissionLike(courseId, assignmentId, teamId, submissionId)
      const updated = await listTeamSubmissions(courseId, assignmentId, teamId)
      setTeamSubmissionsForVote(updated.sort((a, b) => (b.stats?.vote_weight ?? 0) - (a.stats?.vote_weight ?? 0)))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Ошибка лайка')
      // Revert optimistic update
      const reverted = await listTeamSubmissions(courseId, assignmentId, teamId).catch(() => teamSubmissionsForVote)
      setTeamSubmissionsForVote((reverted as TeamSubmissionForVote[]).sort((a, b) => (b.stats?.vote_weight ?? 0) - (a.stats?.vote_weight ?? 0)))
    } finally {
      setLikeLoading(null)
    }
  }

  const compositionEvents = auditEvents.filter((e) => COMPOSITION_EVENT_TYPES.has(e.event_type))
  const votingEvents = auditEvents.filter((e) => VOTING_EVENT_TYPES.has(e.event_type) || PEER_SPLIT_EVENT_TYPES.has(e.event_type))
  const deadlineEvents = auditEvents.filter((e) => DEADLINE_EVENT_TYPES.has(e.event_type))

  const attachedSubmission = submissions.find((s) => s.is_attached === true)
  const lastSubmission =
    submissions.length > 0
      ? [...submissions].sort(
          (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
        )[0]
      : undefined
  const finalSubmission =
    assignment?.team_submission_rule === 'last_submission'
      ? (lastSubmission ?? attachedSubmission)
      : attachedSubmission
  const gradedSubmission =
    finalSubmission?.grade != null
      ? finalSubmission
      : submissions.find((s) => s.grade != null) ?? null

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
            {(finalSubmission || gradedSubmission) && (
              <Box className="flex items-center gap-2 mt-2">
                <Typography variant="caption" color="text.secondary">Оценка:</Typography>
                {gradedSubmission?.grade != null ? (
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {gradedSubmission.grade}/{assignment?.max_grade ?? 100}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">Не выставлена</Typography>
                )}
              </Box>
            )}
          </Paper>

          {actionError && (
            <Alert severity="error" sx={{ mb: 1 }} onClose={() => setActionError(null)}>
              {actionError}
            </Alert>
          )}

          {/* Team submissions for vote */}
          <TeamSubmissionsSection
            courseId={courseId}
            assignmentId={assignmentId}
            submissions={teamSubmissionsForVote}
            finalSubmissionId={finalSubmission?.id ?? null}
            members={courseMembers}
            teamMembers={teamMembers}
            onVote={handleVote}
            onLike={handleLike}
            voteLoading={voteLoading}
            likeLoading={likeLoading}
            canVote={
              courseMembers.find((m) => m.user_id === user?.id)?.role === 'student'
            }
          />

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
            finalSubmissionId={finalSubmission?.id ?? null}
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
