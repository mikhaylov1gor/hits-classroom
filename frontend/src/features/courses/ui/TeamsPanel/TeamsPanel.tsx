import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import BalanceIcon from '@mui/icons-material/Balance'
import HistoryIcon from '@mui/icons-material/History'
import GavelIcon from '@mui/icons-material/Gavel'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SearchIcon from '@mui/icons-material/Search'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  getTeamCreatorDisplayName,
  type Assignment,
  type Member,
  type Submission,
  type TeamAuditEvent,
  type TeamStatus,
  type TeamWithMembers,
} from '../../model/types'
import {
  finalizeSubmissions,
  finalizeVote,
  generateBalancedTeams,
  generateRandomTeams,
  getTeamAudit,
  gradeSubmission,
  gradeTeamMemberSubmission,
  gradeTeamPeerSplit,
  deleteTeamWithRosterCheck,
  listCourseMembers,
  listTeams,
  lockRoster,
} from '../../api/coursesApi'
import { useNavigate } from 'react-router-dom'

const EVENT_TYPE_LABELS: Record<string, string> = {
  team_created: 'Команда создана',
  created: 'Команда создана',
  member_joined: 'Участник вступил в команду',
  member_left: 'Участник покинул команду',
  member_removed: 'Участник удалён из команды',
  roster_locked: 'Состав закреплён',
  roster_changed: 'Изменение состава',
  roster_change: 'Изменение состава',
  submission_proposed: 'Предложено решение',
  submission_created: 'Создано решение',
  submission_attached: 'Решение прикреплено',
  submission_liked: 'Лайк решения',
  vote_cast: 'Голос отдан',
  vote_finalized: 'Голосование завершено',
  voting_started: 'Голосование открыто',
  voting_open: 'Голосование открыто',
  peer_split_submitted: 'Отправлено распределение оценок',
  deadline_auto_finalized: 'Автофиксация по дедлайну',
  deadline_finalized: 'Фиксация по дедлайну',
  auto_finalized: 'Автоматическая фиксация',
  graded: 'Выставлена оценка',
  grade_updated: 'Оценка обновлена',
  grade_applied: 'Выставлена оценка',
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

const ALL_STATUSES: TeamStatus[] = [
  'forming',
  'roster_locked',
  'voting_open',
  'voting',
  'submitted',
  'graded',
  'not_submitted',
]

function TeamStatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={STATUS_LABELS[status] ?? status}
      color={STATUS_COLORS[status] ?? 'default'}
    />
  )
}

function AuditDialog({
  courseId,
  assignmentId,
  teamId,
  teamName,
  open,
  onClose,
}: {
  courseId: string
  assignmentId: string
  teamId: string
  teamName: string
  open: boolean
  onClose: () => void
}) {
  const [events, setEvents] = useState<TeamAuditEvent[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      getTeamAudit(courseId, assignmentId, { team_id: teamId, limit: 50 }),
      listCourseMembers(courseId),
    ])
      .then(([evs, mems]) => {
        setEvents(evs)
        setMembers(mems)
      })
      .catch(() => {
        setEvents([])
        setMembers([])
      })
      .finally(() => setLoading(false))
  }, [open, courseId, assignmentId, teamId])

  function resolveActorName(userId: string): string {
    const m = members.find((x) => x.user_id === userId)
    if (m) return `${m.first_name} ${m.last_name}`.trim()
    return userId.slice(0, 8) + '…'
  }

  function gradeAppliedDetail(ev: TeamAuditEvent): string {
    if (ev.event_type !== 'grade_applied') return ''
    const p = ev.payload as Record<string, unknown>
    const mode = typeof p.mode === 'string' ? p.mode : null
    if (mode === 'team_uniform') return 'одна оценка на команду'
    if (mode === 'peer_split') return 'оценка по peer split'
    if (typeof p.submission_id === 'string') return 'по сдаче'
    return ''
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>История команды «{teamName}»</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <LinearProgress />
        ) : events.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Нет событий
          </Typography>
        ) : (
          <List dense>
            {events.map((ev) => {
              const gradeExtra = gradeAppliedDetail(ev)
              return (
                <ListItem key={ev.id} disableGutters>
                  <ListItemText
                    primary={EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                    secondary={`${resolveActorName(ev.actor_user_id)} · ${new Date(ev.created_at).toLocaleString('ru')}${
                      gradeExtra ? ` · ${gradeExtra}` : ''
                    }`}
                  />
                </ListItem>
              )
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  )
}

function GradePeerSplitDialog({
  courseId,
  assignmentId,
  teamId,
  teamName,
  maxGrade,
  open,
  onClose,
  onDone,
}: {
  courseId: string
  assignmentId: string
  teamId: string
  teamName: string
  maxGrade: number
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [grade, setGrade] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const g = parseFloat(grade)
    if (isNaN(g) || g < 0 || g > maxGrade) {
      setError(`Оценка должна быть от 0 до ${maxGrade}`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await gradeTeamPeerSplit(courseId, assignmentId, teamId, {
        grade: g,
        grade_comment: comment.trim() || undefined,
      })
      onDone()
      onClose()
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Ошибка сохранения'
      setError(
        raw.includes('peer split')
          ? 'Команда ещё не отправила распределение процентов. Дождитесь, пока участники заполнят форму.'
          : raw,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Оценка команды «{teamName}» (peer split)</DialogTitle>
      <DialogContent className="flex flex-col gap-3 pt-2">
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label={`Оценка (0–${maxGrade})`}
          type="number"
          size="small"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          inputProps={{ min: 0, max: maxGrade }}
          fullWidth
        />
        <TextField
          label="Комментарий (необязательно)"
          size="small"
          multiline
          minRows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving} onClick={handleSave}>
          {saving ? <CircularProgress size={16} /> : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function TeamUniformGradeDialog({
  courseId,
  assignmentId,
  submissionId,
  teamName,
  maxGrade,
  open,
  onClose,
  onDone,
}: {
  courseId: string
  assignmentId: string
  submissionId: string
  teamName: string
  maxGrade: number
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [grade, setGrade] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const g = parseFloat(grade)
    if (isNaN(g) || g < 0 || g > maxGrade) {
      setError(`Оценка должна быть от 0 до ${maxGrade}`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await gradeSubmission(courseId, assignmentId, submissionId, {
        grade: g,
        grade_comment: comment.trim() || undefined,
      })
      onDone()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Оценка команды «{teamName}»</DialogTitle>
      <DialogContent className="flex flex-col gap-3 pt-2">
        <Alert severity="info">Оценка применится ко всем участникам команды</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label={`Оценка (0–${maxGrade})`}
          type="number"
          size="small"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          inputProps={{ min: 0, max: maxGrade }}
          fullWidth
          sx={{ mt: 1 }}
        />
        <TextField
          label="Комментарий (необязательно)"
          size="small"
          multiline
          minRows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={saving} onClick={handleSave}>
          {saving ? <CircularProgress size={16} /> : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function FinalSolutionCell({ submission }: { submission: Submission | undefined }) {
  if (!submission) return <Typography variant="body2" color="text.secondary">—</Typography>

  const preview = submission.body?.trim()
  const fileCount = submission.file_ids?.length ?? 0

  if (preview) {
    return (
      <Tooltip title={preview}>
        <Typography variant="body2" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preview.length > 40 ? preview.slice(0, 40) + '…' : preview}
        </Typography>
      </Tooltip>
    )
  }
  if (fileCount > 0) {
    return <Typography variant="body2" color="text.secondary">{fileCount} файл(ов)</Typography>
  }
  return <Typography variant="body2" color="text.secondary">Сдано</Typography>
}

function GradeCell({ submission, maxGrade }: { submission: Submission | undefined; maxGrade: number }) {
  if (!submission) return <Typography variant="body2" color="text.secondary">—</Typography>
  if (submission.grade == null) return <Typography variant="body2" color="text.secondary">Не выставлена</Typography>
  return (
    <Typography variant="body2" fontWeight={600} color="success.main">
      {submission.grade}/{maxGrade}
    </Typography>
  )
}

function TeamRow({
  team,
  courseId,
  assignmentId,
  assignment,
  submissions,
  isDeadlinePassed,
  rosterLocked,
  onRefresh,
  courseMembers,
  allowDeleteTeam,
  onAssignmentUpdated,
}: {
  team: TeamWithMembers
  courseId: string
  assignmentId: string
  assignment: Assignment
  submissions: Submission[]
  isDeadlinePassed: boolean
  /** Закрепление составов по заданию — до этого оценки недоступны */
  rosterLocked: boolean
  onRefresh: () => void
  courseMembers: Member[]
  /** Пока состав не закреплён — можно удалить команду */
  allowDeleteTeam: boolean
  onAssignmentUpdated?: () => void | Promise<void>
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [gradeUniformOpen, setGradeUniformOpen] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [memberGrades, setMemberGrades] = useState<Record<string, string>>({})
  const [memberGradeComments, setMemberGradeComments] = useState<Record<string, string>>({})
  const [memberGradeLoading, setMemberGradeLoading] = useState<Record<string, boolean>>({})
  const [memberGradeErrors, setMemberGradeErrors] = useState<Record<string, string>>({})
  const [deleteTeamConfirm, setDeleteTeamConfirm] = useState(false)
  const [deleteTeamLoading, setDeleteTeamLoading] = useState(false)
  /** Поля ввода оценки участника — только после нажатия «Выставить оценку» */
  const [memberGradeFormOpen, setMemberGradeFormOpen] = useState<Record<string, boolean>>({})

  const isVoteRule =
    assignment.team_submission_rule === 'vote_equal' ||
    assignment.team_submission_rule === 'vote_weighted'
  const isPeerSplit = assignment.team_grading_mode === 'team_peer_split'
  const isUniform = assignment.team_grading_mode === 'team_uniform'
  const isIndividual = assignment.team_grading_mode === 'individual'

  const isTeamForming = team.status === 'forming'
  /** Оценки только после закрепления составов и завершения формирования команды */
  const canGradeAfterFormation = rosterLocked && !isTeamForming

  const memberIds = new Set(team.members.map((m) => m.user_id))
  const teamSubmissions = submissions.filter((s) => memberIds.has(s.user_id))
  const attachedSubmission = teamSubmissions.find((s) => s.is_attached)
  const latestTeamSubmission = [...teamSubmissions].sort(
    (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
  )[0]
  const gradeTargetSubmission = attachedSubmission ?? latestTeamSubmission
  /** Одна кнопка на команду — только для team_uniform (протяжка оценки). В individual всегда оценка по каждому участнику. */
  const showUniformGradeButton =
    isUniform && isDeadlinePassed && !!gradeTargetSubmission
  const hasTeamGrade = teamSubmissions.some((s) => s.grade != null)

  const gradedMembersCount = team.members.reduce((acc, m) => {
    const s = teamSubmissions.find((x) => x.user_id === m.user_id)
    return acc + (s?.grade != null ? 1 : 0)
  }, 0)

  const participantNames = team.members.map((m) => m.last_name).join(', ')

  const handleFinalizeVote = async () => {
    setFinalizing(true)
    setError(null)
    try {
      await finalizeVote(courseId, assignmentId, team.id)
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка финализации')
    } finally {
      setFinalizing(false)
    }
  }

  const handleDeleteTeamStaff = async () => {
    setDeleteTeamLoading(true)
    setError(null)
    try {
      await deleteTeamWithRosterCheck(courseId, assignmentId, team.id)
      setDeleteTeamConfirm(false)
      onRefresh()
      await onAssignmentUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить команду')
    } finally {
      setDeleteTeamLoading(false)
    }
  }

  const handleSaveMemberGrade = async (memberId: string, existingSubmission: Submission | undefined) => {
    const maxGrade = assignment.max_grade ?? 100
    const valStr = memberGrades[memberId] ?? ''
    const val = parseFloat(valStr)
    if (isNaN(val) || val < 0 || val > maxGrade) {
      setMemberGradeErrors((prev) => ({ ...prev, [memberId]: `Оценка 0–${maxGrade}` }))
      return
    }
    setMemberGradeLoading((prev) => ({ ...prev, [memberId]: true }))
    setMemberGradeErrors((prev) => ({ ...prev, [memberId]: '' }))
    const comment = (memberGradeComments[memberId] ?? '').trim() || undefined
    try {
      if (existingSubmission) {
        await gradeSubmission(courseId, assignmentId, existingSubmission.id, {
          grade: val,
          grade_comment: comment,
        })
      } else {
        await gradeTeamMemberSubmission(courseId, assignmentId, memberId, {
          grade: val,
          grade_comment: comment,
        })
      }
      onRefresh()
      setMemberGradeFormOpen((prev) => ({ ...prev, [memberId]: false }))
      setMemberGrades((prev) => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })
      setMemberGradeComments((prev) => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })
      setMemberGradeErrors((prev) => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })
    } catch (e) {
      setMemberGradeErrors((prev) => ({
        ...prev,
        [memberId]: e instanceof Error ? e.message : 'Ошибка',
      }))
    } finally {
      setMemberGradeLoading((prev) => ({ ...prev, [memberId]: false }))
    }
  }

  const closeMemberGradeForm = (userId: string) => {
    setMemberGradeFormOpen((prev) => ({ ...prev, [userId]: false }))
    setMemberGrades((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
    setMemberGradeComments((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
    setMemberGradeErrors((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Box className="flex items-center gap-1">
            <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
            <Box>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
                onClick={() => navigate(`/course/${courseId}/assignment/${assignmentId}/team/${team.id}`)}
              >
                {team.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Создатель: {getTeamCreatorDisplayName(team, courseMembers)}
              </Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell>
          <Tooltip title={team.members.map((m) => `${m.first_name} ${m.last_name}`).join(', ')} placement="top">
            <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {participantNames || '—'}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <TeamStatusChip status={team.status} />
        </TableCell>
        <TableCell>
          <FinalSolutionCell submission={attachedSubmission} />
        </TableCell>
        <TableCell>
          {isIndividual ? (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3 }}>
                Индивидуальная оценка
              </Typography>
              {team.status === 'not_submitted' ? (
                <Typography variant="body2" color="error.main" sx={{ mt: 0.25 }}>
                  0/{assignment.max_grade ?? 100}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {gradedMembersCount > 0
                    ? `${gradedMembersCount}/${team.members.length} с оценкой`
                    : 'Оценки по участникам'}
                </Typography>
              )}
            </Box>
          ) : team.status === 'not_submitted' ? (
            <Typography variant="body2" color="error.main">
              0/{assignment.max_grade ?? 100}
            </Typography>
          ) : (
            <GradeCell submission={attachedSubmission} maxGrade={assignment.max_grade ?? 100} />
          )}
        </TableCell>
        <TableCell>
          <Box className="flex gap-1">
            {isVoteRule && (
              <Tooltip
                title={
                  !canGradeAfterFormation
                    ? isTeamForming
                      ? 'Доступно после завершения формирования команды'
                      : 'Доступно после закрепления составов команд'
                    : 'Финализировать голосование'
                }
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={finalizing || !canGradeAfterFormation}
                    onClick={handleFinalizeVote}
                    color="primary"
                  >
                    {finalizing ? <CircularProgress size={16} /> : <GavelIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {isPeerSplit && (
              <Tooltip
                title={
                  !canGradeAfterFormation
                    ? isTeamForming
                      ? 'Оценка после завершения формирования команды'
                      : 'Оценка после закрепления составов команд'
                    : hasTeamGrade
                      ? 'Изменить оценку (peer split)'
                      : 'Выставить оценку (peer split)'
                }
              >
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  startIcon={<GavelIcon fontSize="small" />}
                  disabled={!canGradeAfterFormation}
                  onClick={() => setGradeOpen(true)}
                >
                  {hasTeamGrade ? 'Изменить оценку' : 'Оценить'}
                </Button>
              </Tooltip>
            )}
            {showUniformGradeButton && (
              <Tooltip
                title={
                  !canGradeAfterFormation
                    ? isTeamForming
                      ? 'Оценивание после завершения формирования команды'
                      : 'Оценивание после закрепления составов команд'
                    : 'Выставить одну оценку на всю команду'
                }
              >
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!canGradeAfterFormation}
                    onClick={() => setGradeUniformOpen(true)}
                    color="primary"
                    startIcon={<GavelIcon fontSize="small" />}
                  >
                    {hasTeamGrade ? 'Изменить оценку' : 'Оценить команду'}
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip title="История">
              <IconButton size="small" onClick={() => setAuditOpen(true)}>
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {allowDeleteTeam &&
              (deleteTeamConfirm ? (
                <Box className="flex items-center gap-0.5 flex-wrap">
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    disabled={deleteTeamLoading}
                    onClick={handleDeleteTeamStaff}
                  >
                    {deleteTeamLoading ? <CircularProgress size={14} /> : 'Да, удалить'}
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    disabled={deleteTeamLoading}
                    onClick={() => setDeleteTeamConfirm(false)}
                  >
                    Нет
                  </Button>
                </Box>
              ) : (
                <Tooltip title="Удалить команду (до фиксации составов)">
                  <IconButton size="small" color="error" onClick={() => setDeleteTeamConfirm(true)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ))}
            <Tooltip title="Подробнее">
              <IconButton
                size="small"
                onClick={() => navigate(`/course/${courseId}/assignment/${assignmentId}/team/${team.id}`)}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded members */}
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ px: 5, py: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Участники
              </Typography>
              {isIndividual && !rosterLocked && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Оценивание будет доступно после закрепления составов команд
                </Alert>
              )}
              {isIndividual && rosterLocked && isTeamForming && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Оценивание будет доступно после завершения формирования команды
                </Alert>
              )}
              {isIndividual && canGradeAfterFormation && !isDeadlinePassed && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Оценивание будет доступно после наступления дедлайна
                </Alert>
              )}
              {team.members.map((m) => {
                /* Одна запись на пользователя; не только с прикреплённым решением */
                const memberSub = teamSubmissions.find((s) => s.user_id === m.user_id)
                const maxGrade = assignment.max_grade ?? 100
                const currentGrade =
                  memberGrades[m.user_id] ??
                  (memberSub?.grade != null ? String(memberSub.grade) : '')
                const currentComment =
                  memberGradeComments[m.user_id] ?? (memberSub?.grade_comment ?? '')
                return (
                  <Box key={m.user_id} sx={{ py: 0.75 }}>
                    <Box className="flex justify-between items-center">
                      <Typography variant="body2">
                        {m.first_name} {m.last_name}
                      </Typography>
                      <Box className="flex items-center gap-2">
                        <Typography variant="caption" color="text.secondary">
                          ср. балл: {m.average_score.toFixed(1)}
                        </Typography>
                        {memberSub?.grade != null && !memberGrades[m.user_id] && (
                          <Typography variant="caption" color="success.main" fontWeight={600}>
                            Оценка: {memberSub.grade}/{maxGrade}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    {isIndividual && isDeadlinePassed && canGradeAfterFormation && (
                      <Box className="flex flex-col gap-1 mt-1">
                        {!memberGradeFormOpen[m.user_id] ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              setMemberGradeFormOpen((prev) => ({ ...prev, [m.user_id]: true }))
                            }
                          >
                            {memberSub?.grade != null ? 'Изменить оценку' : 'Выставить оценку'}
                          </Button>
                        ) : (
                          <>
                            {memberSub && !memberSub.is_attached && (
                              <Typography variant="caption" color="text.secondary">
                                Решение не прикреплено как финальное — оценка относится к этому участнику
                              </Typography>
                            )}
                            {!memberSub && (
                              <Typography variant="caption" color="text.secondary">
                                Нет сдачи от участника — при сохранении будет создана запись для оценки
                              </Typography>
                            )}
                            <Box className="flex gap-2 items-start flex-wrap">
                              <TextField
                                size="small"
                                label={`Оценка (0–${maxGrade})`}
                                type="number"
                                value={currentGrade}
                                onChange={(e) =>
                                  setMemberGrades((prev) => ({ ...prev, [m.user_id]: e.target.value }))
                                }
                                inputProps={{ min: 0, max: maxGrade, step: 1 }}
                                sx={{ width: 130 }}
                                error={!!memberGradeErrors[m.user_id]}
                                helperText={memberGradeErrors[m.user_id]}
                              />
                              <TextField
                                size="small"
                                label="Комментарий"
                                value={currentComment}
                                onChange={(e) =>
                                  setMemberGradeComments((prev) => ({
                                    ...prev,
                                    [m.user_id]: e.target.value,
                                  }))
                                }
                                sx={{ flex: 1, minWidth: 120 }}
                              />
                              <Button
                                size="small"
                                variant="contained"
                                disabled={memberGradeLoading[m.user_id]}
                                onClick={() => handleSaveMemberGrade(m.user_id, memberSub)}
                                sx={{ mt: 0.25 }}
                              >
                                {memberGradeLoading[m.user_id] ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  'Сохранить'
                                )}
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                disabled={memberGradeLoading[m.user_id]}
                                onClick={() => closeMemberGradeForm(m.user_id)}
                                sx={{ mt: 0.25 }}
                              >
                                Отмена
                              </Button>
                            </Box>
                          </>
                        )}
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <AuditDialog
        courseId={courseId}
        assignmentId={assignmentId}
        teamId={team.id}
        teamName={team.name}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
      />

      {isPeerSplit && (
        <GradePeerSplitDialog
          courseId={courseId}
          assignmentId={assignmentId}
          teamId={team.id}
          teamName={team.name}
          maxGrade={assignment.max_grade ?? 100}
          open={gradeOpen}
          onClose={() => setGradeOpen(false)}
          onDone={onRefresh}
        />
      )}

      {showUniformGradeButton && gradeTargetSubmission && (
        <TeamUniformGradeDialog
          courseId={courseId}
          assignmentId={assignmentId}
          submissionId={gradeTargetSubmission.id}
          teamName={team.name}
          maxGrade={assignment.max_grade ?? 100}
          open={gradeUniformOpen}
          onClose={() => setGradeUniformOpen(false)}
          onDone={onRefresh}
        />
      )}
    </>
  )
}

type TeamsPanelProps = {
  courseId: string
  assignmentId: string
  assignment: Assignment
  submissions: Submission[]
  onRefresh: () => void
  courseMembers: Member[]
  /** После закрепления состава — обновить задание в родителе */
  onAssignmentUpdated?: () => void | Promise<void>
}

export function TeamsPanel({
  courseId,
  assignmentId,
  assignment,
  submissions,
  onRefresh,
  courseMembers,
  onAssignmentUpdated,
}: TeamsPanelProps) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rosterLockedLocal, setRosterLockedLocal] = useState(!!assignment.roster_locked_at)
  const [manualFinalizeDone, setManualFinalizeDone] = useState(false)

  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<TeamStatus | null>(null)

  const distributionType = assignment.team_distribution_type
  const rosterLocked = !!assignment.roster_locked_at
  const effectiveRosterLocked = rosterLocked || rosterLockedLocal
  const isDeadlinePassed = assignment.deadline
    ? new Date(assignment.deadline) < new Date()
    : true
  const gradingMode = assignment.team_grading_mode ?? 'individual'
  const needsDeadline = gradingMode === 'individual' || gradingMode === 'team_uniform'
  const canFinalizeSubmissions =
    effectiveRosterLocked && !assignment.deadline_auto_finalized_at && !manualFinalizeDone

  useEffect(() => {
    setRosterLockedLocal(rosterLocked)
  }, [rosterLocked])

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

  const handleRefresh = useCallback(() => {
    fetchTeams()
    onRefresh()
  }, [fetchTeams, onRefresh])

  const runAction = async (action: () => Promise<void>) => {
    setActionLoading(true)
    setError(null)
    try {
      await action()
      handleRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredTeams = teams.filter((team) => {
    if (statusFilter && team.status !== statusFilter) return false
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      const nameMatch = team.name.toLowerCase().includes(q)
      const memberMatch = team.members.some(
        (m) =>
          m.last_name.toLowerCase().includes(q) ||
          m.first_name.toLowerCase().includes(q),
      )
      const creatorMatch = getTeamCreatorDisplayName(team, courseMembers).toLowerCase().includes(q)
      if (!nameMatch && !memberMatch && !creatorMatch) return false
    }
    return true
  })

  const stats = {
    total: teams.length,
    submitted: teams.filter((t) => t.status === 'submitted' || t.status === 'graded').length,
    notSubmitted: teams.filter((t) => t.status === 'not_submitted').length,
    forming: teams.filter((t) => t.status === 'forming').length,
  }

  return (
    <Box
      className="flex flex-col gap-3"
      sx={{ border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 2, mt: 2 }}
    >
      <Box className="flex items-center justify-between flex-wrap gap-2">
        <Box className="flex items-center gap-2">
          <GroupsOutlinedIcon color="action" />
          <Typography variant="subtitle1" fontWeight={600}>
            Команды
          </Typography>
        </Box>

        {/* Teacher action buttons */}
        <Box className="flex gap-1 flex-wrap">
          {distributionType === 'random' && !effectiveRosterLocked && (
            <Button
              size="small"
              startIcon={<ShuffleIcon />}
              disabled={actionLoading}
              onClick={() => runAction(() => generateRandomTeams(courseId, assignmentId))}
            >
              Случайно
            </Button>
          )}
          {distributionType === 'balanced' && !effectiveRosterLocked && (
            <Button
              size="small"
              startIcon={<BalanceIcon />}
              disabled={actionLoading}
              onClick={() => runAction(() => generateBalancedTeams(courseId, assignmentId))}
            >
              По баллам
            </Button>
          )}
          {!effectiveRosterLocked && teams.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<LockOutlinedIcon />}
              disabled={actionLoading}
              onClick={() =>
                runAction(async () => {
                  await lockRoster(courseId, assignmentId)
                  setRosterLockedLocal(true)
                  await onAssignmentUpdated?.()
                })
              }
            >
              Закрепить состав
            </Button>
          )}
          {canFinalizeSubmissions && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={actionLoading}
              onClick={() =>
                runAction(async () => {
                  await finalizeSubmissions(courseId, assignmentId)
                  setManualFinalizeDone(true)
                })
              }
            >
              Завершить прием решений
            </Button>
          )}
        </Box>
      </Box>

      {/* Summary chips */}
      <Box className="flex gap-1 flex-wrap">
        <Chip label={`Всего: ${stats.total}`} size="small" />
        <Chip label={`Сдали: ${stats.submitted}`} size="small" color="success" />
        {stats.notSubmitted > 0 && (
          <Chip label={`Не сдали: ${stats.notSubmitted}`} size="small" color="error" />
        )}
        {stats.forming > 0 && (
          <Chip label={`Формируются: ${stats.forming}`} size="small" color="default" />
        )}
      </Box>

      {/* Search and filter */}
      <Box className="flex flex-wrap gap-2 items-center">
        <TextField
          size="small"
          placeholder="Поиск по названию команды или фамилии"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ minWidth: 280, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Box className="flex gap-1 flex-wrap items-center">
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Статус:
          </Typography>
          <Chip
            size="small"
            label="Все"
            onClick={() => setStatusFilter(null)}
            variant={statusFilter === null ? 'filled' : 'outlined'}
            color={statusFilter === null ? 'primary' : 'default'}
          />
          {ALL_STATUSES.map((s) => (
            <Chip
              key={s}
              size="small"
              label={STATUS_LABELS[s] ?? s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              variant={statusFilter === s ? 'filled' : 'outlined'}
              color={statusFilter === s ? (STATUS_COLORS[s] ?? 'default') : 'default'}
            />
          ))}
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {needsDeadline && !isDeadlinePassed && assignment.deadline && (
        <Alert severity="warning">
          Оценивание станет доступно после наступления дедлайна (
          {new Date(assignment.deadline).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          )
        </Alert>
      )}

      {loading ? (
        <LinearProgress />
      ) : teams.length === 0 ? (
        <Alert severity="info">Команды ещё не созданы.</Alert>
      ) : filteredTeams.length === 0 ? (
        <Alert severity="info">Нет команд, соответствующих фильтру.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Участники</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Финальное решение</TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <Box component="span" sx={{ display: 'block' }}>
                    Оценка
                  </Box>
                  {gradingMode === 'individual' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      индивидуально
                    </Typography>
                  )}
                </TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTeams.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  courseId={courseId}
                  assignmentId={assignmentId}
                  assignment={assignment}
                  submissions={submissions}
                  isDeadlinePassed={isDeadlinePassed}
                  rosterLocked={effectiveRosterLocked}
                  onRefresh={handleRefresh}
                  courseMembers={courseMembers}
                  allowDeleteTeam={!effectiveRosterLocked}
                  onAssignmentUpdated={onAssignmentUpdated}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
