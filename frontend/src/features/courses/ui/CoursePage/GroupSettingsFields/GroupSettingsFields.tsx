import {
  Box,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import type {
  Assignment,
  TeamDistributionType,
  TeamGradingMode,
  TeamSubmissionRule,
  VoteTieBreak,
} from '../../../model/types'
import type { AssignmentPayload } from '../../../api/coursesApi'

export type GroupSettingsValue = {
  desiredTeamSize: string
  teamCount: string
  teamDistributionType: TeamDistributionType
  teamFormationDeadline: string
  teamSubmissionRule: TeamSubmissionRule
  voteTieBreak: VoteTieBreak
  allowEarlyFinalization: boolean
  teamGradingMode: TeamGradingMode
  peerSplitMinPercent: string
  peerSplitMaxPercent: string
}

export const DEFAULT_GROUP_SETTINGS: GroupSettingsValue = {
  desiredTeamSize: '2',
  teamCount: '',
  teamDistributionType: 'free',
  teamFormationDeadline: '',
  teamSubmissionRule: 'last_submission',
  voteTieBreak: 'random',
  allowEarlyFinalization: false,
  teamGradingMode: 'individual',
  peerSplitMinPercent: '',
  peerSplitMaxPercent: '',
}

export function groupSettingsFromAssignment(a: Assignment | null | undefined): GroupSettingsValue {
  if (!a) return DEFAULT_GROUP_SETTINGS
  // Если assignment_kind не вернулся с сервера, определяем по наличию групповых полей
  const isGroup =
    a.assignment_kind === 'group' ||
    a.desired_team_size != null ||
    a.team_distribution_type != null ||
    a.team_submission_rule != null
  if (!isGroup) return DEFAULT_GROUP_SETTINGS
  return {
    desiredTeamSize: a.desired_team_size != null ? String(a.desired_team_size) : '2',
    teamCount: a.team_count != null ? String(a.team_count) : '',
    teamDistributionType: a.team_distribution_type ?? 'free',
    teamFormationDeadline: a.team_formation_deadline
      ? new Date(a.team_formation_deadline).toISOString().slice(0, 16)
      : '',
    teamSubmissionRule: a.team_submission_rule ?? 'last_submission',
    voteTieBreak: a.vote_tie_break ?? 'random',
    allowEarlyFinalization: a.allow_early_finalization ?? false,
    teamGradingMode: a.team_grading_mode ?? 'individual',
    peerSplitMinPercent: a.peer_split_min_percent != null ? String(a.peer_split_min_percent) : '',
    peerSplitMaxPercent: a.peer_split_max_percent != null ? String(a.peer_split_max_percent) : '',
  }
}

export function validateGroupSettings(
  v: GroupSettingsValue,
  opts?: { assignmentDeadline?: string },
): string | null {
  const size = parseInt(v.desiredTeamSize, 10)
  if (isNaN(size) || size < 2) {
    return 'Размер команды должен быть не менее 2 участников'
  }
  const trimmedTeamCount = v.teamCount.trim()
  if (trimmedTeamCount) {
    const parsedTeamCount = parseInt(trimmedTeamCount, 10)
    if (isNaN(parsedTeamCount) || parsedTeamCount < 1) {
      return 'Количество команд должно быть не меньше 1'
    }
  }
  if (v.teamDistributionType === 'free' && v.teamFormationDeadline.trim()) {
    const fd = new Date(v.teamFormationDeadline)
    if (isNaN(fd.getTime())) {
      return 'Некорректная дата дедлайна формирования команд'
    }
    const adStr = opts?.assignmentDeadline?.trim()
    if (adStr) {
      const ad = new Date(adStr)
      if (!isNaN(ad.getTime()) && fd.getTime() > ad.getTime()) {
        return 'Дедлайн формирования команд не может быть позже дедлайна сдачи задания'
      }
    }
  }
  if (v.teamGradingMode === 'team_peer_split') {
    const min = v.peerSplitMinPercent.trim() ? parseFloat(v.peerSplitMinPercent) : NaN
    const max = v.peerSplitMaxPercent.trim() ? parseFloat(v.peerSplitMaxPercent) : NaN
    if (isNaN(min) || min < 1 || min > 99) {
      return 'Минимальный процент разбивки должен быть от 1 до 99'
    }
    if (isNaN(max) || max < 1 || max > 99) {
      return 'Максимальный процент разбивки должен быть от 1 до 99'
    }
    if (min >= max) {
      return 'Минимальный процент разбивки должен быть меньше максимального'
    }
  }
  return null
}

/** Возвращает плоские поля для AssignmentPayload */
export function buildGroupFields(v: GroupSettingsValue): Partial<AssignmentPayload> {
  const fields: Partial<AssignmentPayload> = {
    desired_team_size: parseInt(v.desiredTeamSize, 10),
    team_distribution_type: v.teamDistributionType,
    team_submission_rule: v.teamSubmissionRule,
    allow_early_finalization: v.allowEarlyFinalization,
    team_grading_mode: v.teamGradingMode,
  }
  const trimmedTeamCount = v.teamCount.trim()
  if (trimmedTeamCount) {
    fields.team_count = parseInt(trimmedTeamCount, 10)
  }
  const hasVoteTieBreak =
    v.teamSubmissionRule === 'vote_equal' || v.teamSubmissionRule === 'vote_weighted'
  if (hasVoteTieBreak) {
    fields.vote_tie_break = v.voteTieBreak
  }
  const hasPeerSplit = v.teamGradingMode === 'team_peer_split'
  if (hasPeerSplit) {
    fields.peer_split_min_percent = v.peerSplitMinPercent.trim()
      ? parseFloat(v.peerSplitMinPercent)
      : null
    fields.peer_split_max_percent = v.peerSplitMaxPercent.trim()
      ? parseFloat(v.peerSplitMaxPercent)
      : null
  }
  if (v.teamDistributionType === 'free') {
    fields.team_formation_deadline =
      v.teamFormationDeadline.trim() !== ''
        ? new Date(v.teamFormationDeadline).toISOString()
        : null
  }
  return fields
}

const TEAM_DISTRIBUTION_OPTIONS: { value: TeamDistributionType; label: string }[] = [
  { value: 'free', label: 'Свободное вступление' },
  { value: 'random', label: 'Рандомное распределение' },
  { value: 'balanced', label: 'Распределение по баллам' },
  { value: 'manual', label: 'Ручное распределение' },
]

const TEAM_SUBMISSION_RULE_OPTIONS: { value: TeamSubmissionRule; label: string }[] = [
  { value: 'first_submission', label: 'Первое решение' },
  { value: 'last_submission', label: 'Последнее решение' },
  { value: 'top_student_only', label: 'Решение участника с наивысшим баллом' },
  { value: 'vote_equal', label: 'Голосование (равные голоса)' },
  { value: 'vote_weighted', label: 'Голосование (взвешенные голоса)' },
]

const VOTE_TIE_BREAK_OPTIONS: { value: VoteTieBreak; label: string }[] = [
  { value: 'random', label: 'Случайный выбор' },
  { value: 'highest_author_average', label: 'Победитель по среднему баллу автора' },
]

const TEAM_GRADING_MODE_OPTIONS: { value: TeamGradingMode; label: string }[] = [
  { value: 'individual', label: 'Отдельная оценка каждому студенту' },
  { value: 'team_uniform', label: 'Одна оценка на всю команду' },
  { value: 'team_peer_split', label: 'Студенты делят проценты (peer split)' },
]

type GroupSettingsFieldsProps = {
  value: GroupSettingsValue
  onChange: (next: GroupSettingsValue) => void
  disabled?: boolean
  /** Дедлайн сдачи задания (datetime-local) — для проверки, что дедлайн формирования команд не позже */
  assignmentDeadline?: string
}

export function GroupSettingsFields({
  value,
  onChange,
  disabled,
  assignmentDeadline = '',
}: GroupSettingsFieldsProps) {
  const hasVoteTieBreak =
    value.teamSubmissionRule === 'vote_equal' || value.teamSubmissionRule === 'vote_weighted'
  const hasPeerSplit = value.teamGradingMode === 'team_peer_split'

  const set = (patch: Partial<GroupSettingsValue>) => onChange({ ...value, ...patch })

  return (
    <Box className="flex flex-col gap-3">
      <Divider />
      <Typography variant="subtitle2" className="text-slate-700 font-semibold">
        Настройки группового задания
      </Typography>

      <TextField
        label="Желаемый размер команды"
        required
        fullWidth
        size="small"
        type="number"
        value={value.desiredTeamSize}
        onChange={(e) => set({ desiredTeamSize: e.target.value })}
        disabled={disabled}
        inputProps={{ min: 2, 'aria-label': 'Желаемый размер команды' }}
        helperText="Минимум 2 участника"
      />
      <TextField
        label="Количество команд (опционально)"
        fullWidth
        size="small"
        type="number"
        value={value.teamCount}
        onChange={(e) => set({ teamCount: e.target.value })}
        disabled={disabled}
        inputProps={{ min: 1, 'aria-label': 'Количество команд' }}
        helperText="Если не указано, количество команд вычислится автоматически"
      />

      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id="team-distribution-label">Способ формирования команд</InputLabel>
        <Select
          labelId="team-distribution-label"
          label="Способ формирования команд"
          value={value.teamDistributionType}
          onChange={(e) => set({ teamDistributionType: e.target.value as TeamDistributionType })}
        >
          {TEAM_DISTRIBUTION_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {value.teamDistributionType === 'free' && (
        <TextField
          label="Дедлайн формирования команд"
          fullWidth
          size="small"
          type="datetime-local"
          value={value.teamFormationDeadline}
          onChange={(e) => set({ teamFormationDeadline: e.target.value })}
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
          inputProps={{
            'aria-label': 'Дедлайн формирования команд',
            max: assignmentDeadline.trim() ? assignmentDeadline : undefined,
          }}
          helperText="До этой даты студенты могут создавать команды и вступать в них. Не позже дедлайна сдачи задания."
        />
      )}

      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id="team-submission-rule-label">Правило определения финального решения</InputLabel>
        <Select
          labelId="team-submission-rule-label"
          label="Правило определения финального решения"
          value={value.teamSubmissionRule}
          onChange={(e) => set({ teamSubmissionRule: e.target.value as TeamSubmissionRule })}
        >
          {TEAM_SUBMISSION_RULE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {hasVoteTieBreak && (
        <FormControl fullWidth size="small" disabled={disabled}>
          <InputLabel id="vote-tie-break-label">Разрешение ничьей при голосовании</InputLabel>
          <Select
            labelId="vote-tie-break-label"
            label="Разрешение ничьей при голосовании"
            value={value.voteTieBreak}
            onChange={(e) => set({ voteTieBreak: e.target.value as VoteTieBreak })}
          >
            {VOTE_TIE_BREAK_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id="team-grading-mode-label">Режим оценивания команды</InputLabel>
        <Select
          labelId="team-grading-mode-label"
          label="Режим оценивания команды"
          value={value.teamGradingMode}
          onChange={(e) => set({ teamGradingMode: e.target.value as TeamGradingMode })}
        >
          {TEAM_GRADING_MODE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {hasPeerSplit && (
        <Box className="flex gap-3">
          <TextField
            label="Мин. доля (%)"
            required
            fullWidth
            size="small"
            type="number"
            value={value.peerSplitMinPercent}
            onChange={(e) => set({ peerSplitMinPercent: e.target.value })}
            disabled={disabled}
            inputProps={{ min: 1, max: 98, step: 1, 'aria-label': 'Минимальная доля' }}
            helperText="От 1 до 99%"
          />
          <TextField
            label="Макс. доля (%)"
            required
            fullWidth
            size="small"
            type="number"
            value={value.peerSplitMaxPercent}
            onChange={(e) => set({ peerSplitMaxPercent: e.target.value })}
            disabled={disabled}
            inputProps={{ min: 2, max: 99, step: 1, 'aria-label': 'Максимальная доля' }}
            helperText="От 1 до 99%, > мин."
          />
        </Box>
      )}

      <FormControlLabel
        control={
          <Checkbox
            checked={value.allowEarlyFinalization}
            onChange={(e) => set({ allowEarlyFinalization: e.target.checked })}
            disabled={disabled}
            size="small"
          />
        }
        label="Разрешить досрочную финализацию команд"
      />
      {value.teamDistributionType === 'free' && value.allowEarlyFinalization && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: -1 }}>
          По истечении срока команды формируются автоматически, затем начнётся выполнение задания.
        </Typography>
      )}
    </Box>
  )
}
