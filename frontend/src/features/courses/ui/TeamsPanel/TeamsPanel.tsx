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
  Divider,
  IconButton,
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
import type { Assignment, Submission, TeamAuditEvent, TeamWithMembers } from '../../model/types'
import {
  finalizeVote,
  generateBalancedTeams,
  generateRandomTeams,
  getTeamAudit,
  gradeTeamPeerSplit,
  listTeams,
  lockRoster,
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getTeamAudit(courseId, assignmentId, { team_id: teamId, limit: 50 })
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [open, courseId, assignmentId, teamId])

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
            {events.map((ev) => (
              <ListItem key={ev.id} disableGutters>
                <ListItemText
                  primary={ev.event_type}
                  secondary={new Date(ev.created_at).toLocaleString('ru')}
                />
              </ListItem>
            ))}
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
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
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

function TeamRow({
  team,
  courseId,
  assignmentId,
  assignment,
  submissions,
  onRefresh,
}: {
  team: TeamWithMembers
  courseId: string
  assignmentId: string
  assignment: Assignment
  submissions: Submission[]
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isVoteRule =
    assignment.team_submission_rule === 'vote_equal' ||
    assignment.team_submission_rule === 'vote_weighted'
  const isPeerSplit = assignment.team_grading_mode === 'team_peer_split'

  const memberIds = new Set(team.members.map((m) => m.user_id))
  const teamSubmissions = submissions.filter((s) => memberIds.has(s.user_id))

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

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Box className="flex items-center gap-1">
            <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
            <Typography variant="body2" fontWeight={600}>
              {team.name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <TeamStatusChip status={team.status} />
        </TableCell>
        <TableCell>
          {team.members.length} / {team.max_members}
        </TableCell>
        <TableCell>
          {teamSubmissions.filter((s) => s.is_attached).length} финальных
        </TableCell>
        <TableCell>
          <Box className="flex gap-1">
            {isVoteRule && (
              <Tooltip title="Финализировать голосование">
                <span>
                  <IconButton
                    size="small"
                    disabled={finalizing}
                    onClick={handleFinalizeVote}
                    color="primary"
                  >
                    {finalizing ? <CircularProgress size={16} /> : <GavelIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {isPeerSplit && (
              <Tooltip title="Выставить оценку (peer split)">
                <IconButton size="small" onClick={() => setGradeOpen(true)} color="secondary">
                  <GavelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="История">
              <IconButton size="small" onClick={() => setAuditOpen(true)}>
                <HistoryIcon fontSize="small" />
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
        <TableCell colSpan={5} sx={{ p: 0, border: 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ px: 5, py: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Участники
              </Typography>
              {team.members.map((m) => (
                <Box key={m.user_id} className="flex justify-between py-0.5">
                  <Typography variant="body2">
                    {m.first_name} {m.last_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ср. балл: {m.average_score.toFixed(1)}
                  </Typography>
                </Box>
              ))}
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
    </>
  )
}

type TeamsPanelProps = {
  courseId: string
  assignmentId: string
  assignment: Assignment
  submissions: Submission[]
  onRefresh: () => void
}

export function TeamsPanel({
  courseId,
  assignmentId,
  assignment,
  submissions,
  onRefresh,
}: TeamsPanelProps) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const distributionType = assignment.team_distribution_type
  const rosterLocked = !!assignment.roster_locked_at

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
          {rosterLocked && <Chip label="Состав закреплён" size="small" color="warning" />}
        </Box>

        {/* Teacher action buttons */}
        <Box className="flex gap-1 flex-wrap">
          {distributionType === 'random' && (
            <Button
              size="small"
              startIcon={<ShuffleIcon />}
              disabled={actionLoading}
              onClick={() => runAction(() => generateRandomTeams(courseId, assignmentId))}
            >
              Случайно
            </Button>
          )}
          {distributionType === 'balanced' && (
            <Button
              size="small"
              startIcon={<BalanceIcon />}
              disabled={actionLoading}
              onClick={() => runAction(() => generateBalancedTeams(courseId, assignmentId))}
            >
              По баллам
            </Button>
          )}
          {!rosterLocked && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<LockOutlinedIcon />}
              disabled={actionLoading}
              onClick={() => runAction(() => lockRoster(courseId, assignmentId))}
            >
              Закрепить состав
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

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <LinearProgress />
      ) : teams.length === 0 ? (
        <Alert severity="info">Команды ещё не созданы.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Команда</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Участники</TableCell>
                <TableCell>Сдачи</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  courseId={courseId}
                  assignmentId={assignmentId}
                  assignment={assignment}
                  submissions={submissions}
                  onRefresh={handleRefresh}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
