import {
  Box,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import type { GroupSettings, SolutionRule, TeamFormationMode } from '../../../model/types'

export type GroupSettingsValue = {
  teamSize: string
  teamFormation: TeamFormationMode
  solutionRule: SolutionRule
  minVoteShare: string
  maxVoteShare: string
}

export const DEFAULT_GROUP_SETTINGS: GroupSettingsValue = {
  teamSize: '2',
  teamFormation: 'free_join',
  solutionRule: 'last',
  minVoteShare: '',
  maxVoteShare: '',
}

export function groupSettingsFromAssignment(
  gs: GroupSettings | null | undefined,
): GroupSettingsValue {
  if (!gs) return DEFAULT_GROUP_SETTINGS
  return {
    teamSize: String(gs.team_size),
    teamFormation: gs.team_formation,
    solutionRule: gs.solution_rule,
    minVoteShare: gs.min_vote_share != null ? String(gs.min_vote_share) : '',
    maxVoteShare: gs.max_vote_share != null ? String(gs.max_vote_share) : '',
  }
}

export function validateGroupSettings(v: GroupSettingsValue): string | null {
  const size = parseInt(v.teamSize, 10)
  if (isNaN(size) || size < 2) {
    return 'Размер команды должен быть не менее 2 участников'
  }
  if (v.solutionRule === 'vote_weighted') {
    const min = v.minVoteShare.trim() ? parseFloat(v.minVoteShare) : NaN
    const max = v.maxVoteShare.trim() ? parseFloat(v.maxVoteShare) : NaN
    if (isNaN(min) || min < 1 || min > 99) {
      return 'Минимальная доля голоса должна быть от 1 до 99%'
    }
    if (isNaN(max) || max < 1 || max > 99) {
      return 'Максимальная доля голоса должна быть от 1 до 99%'
    }
    if (min >= max) {
      return 'Минимальная доля голоса должна быть меньше максимальной'
    }
  }
  return null
}

export function buildGroupSettings(v: GroupSettingsValue): GroupSettings {
  const settings: GroupSettings = {
    team_size: parseInt(v.teamSize, 10),
    team_formation: v.teamFormation,
    solution_rule: v.solutionRule,
  }
  if (v.solutionRule === 'vote_weighted') {
    settings.min_vote_share = v.minVoteShare.trim() ? parseFloat(v.minVoteShare) : null
    settings.max_vote_share = v.maxVoteShare.trim() ? parseFloat(v.maxVoteShare) : null
  }
  return settings
}

const TEAM_FORMATION_OPTIONS: { value: TeamFormationMode; label: string }[] = [
  { value: 'free_join', label: 'Свободное вступление' },
  { value: 'random', label: 'Рандомное распределение' },
  { value: 'by_score', label: 'Распределение по баллам' },
  { value: 'manual', label: 'Ручное распределение' },
]

const SOLUTION_RULE_OPTIONS: { value: SolutionRule; label: string }[] = [
  { value: 'first', label: 'Первое решение' },
  { value: 'last', label: 'Последнее решение' },
  { value: 'top_scorer', label: 'Решение участника с наивысшим баллом' },
  { value: 'vote_equal', label: 'Голосование (равные голоса)' },
  { value: 'vote_weighted', label: 'Разделение (взвешенные голоса)' },
]

type GroupSettingsFieldsProps = {
  value: GroupSettingsValue
  onChange: (next: GroupSettingsValue) => void
  disabled?: boolean
}

export function GroupSettingsFields({ value, onChange, disabled }: GroupSettingsFieldsProps) {
  const isWeighted = value.solutionRule === 'vote_weighted'

  const set = (patch: Partial<GroupSettingsValue>) => onChange({ ...value, ...patch })

  return (
    <Box className="flex flex-col gap-3">
      <Divider />
      <Typography variant="subtitle2" className="text-slate-700 font-semibold">
        Настройки группового задания
      </Typography>

      <TextField
        label="Размер команды"
        required
        fullWidth
        size="small"
        type="number"
        value={value.teamSize}
        onChange={(e) => set({ teamSize: e.target.value })}
        disabled={disabled}
        inputProps={{ min: 2, 'aria-label': 'Размер команды' }}
        helperText="Минимум 2 участника"
      />

      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id="team-formation-label">Способ формирования команд</InputLabel>
        <Select
          labelId="team-formation-label"
          label="Способ формирования команд"
          value={value.teamFormation}
          onChange={(e) => set({ teamFormation: e.target.value as TeamFormationMode })}
        >
          {TEAM_FORMATION_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id="solution-rule-label">Правило определения финального решения</InputLabel>
        <Select
          labelId="solution-rule-label"
          label="Правило определения финального решения"
          value={value.solutionRule}
          onChange={(e) => set({ solutionRule: e.target.value as SolutionRule })}
        >
          {SOLUTION_RULE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
        {isWeighted && (
          <FormHelperText>
            Для «Разделения» также нужно указать диапазон долей голосов
          </FormHelperText>
        )}
      </FormControl>

      {isWeighted && (
        <Box className="flex gap-3">
          <TextField
            label="Мин. доля голоса (%)"
            required
            fullWidth
            size="small"
            type="number"
            value={value.minVoteShare}
            onChange={(e) => set({ minVoteShare: e.target.value })}
            disabled={disabled}
            inputProps={{ min: 1, max: 98, step: 1, 'aria-label': 'Минимальная доля голоса' }}
            helperText="От 1 до 99%"
          />
          <TextField
            label="Макс. доля голоса (%)"
            required
            fullWidth
            size="small"
            type="number"
            value={value.maxVoteShare}
            onChange={(e) => set({ maxVoteShare: e.target.value })}
            disabled={disabled}
            inputProps={{ min: 2, max: 99, step: 1, 'aria-label': 'Максимальная доля голоса' }}
            helperText="От 1 до 99%, > мин."
          />
        </Box>
      )}
    </Box>
  )
}
