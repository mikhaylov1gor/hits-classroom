import type {
  AssignmentFieldMeta,
  RuntimeFieldDefinition,
} from '../../../shared/types/grading'

const numericOperators = ['>', '<', '>=', '<=', '=', '!='] as const
const dateOperators = ['before', 'after', '=', '!='] as const
const equalityOperators = ['=', '!='] as const

export const ASSIGNMENT_FIELD_REGISTRY: AssignmentFieldMeta[] = [
  { path: 'deadline', label: 'Дедлайн', dataType: 'date', operators: [...dateOperators] },
  { path: 'max_grade', label: 'Максимальная оценка', dataType: 'number', operators: [...numericOperators] },
  { path: 'assignment_kind', label: 'Тип задания', dataType: 'enum', operators: [...equalityOperators] },
  { path: 'desired_team_size', label: 'Желаемый размер команды', dataType: 'number', operators: [...numericOperators] },
  { path: 'team_count', label: 'Количество команд', dataType: 'number', operators: [...numericOperators] },
  { path: 'max_team_size', label: 'Максимальный размер команды', dataType: 'number', operators: [...numericOperators] },
  { path: 'team_submission_rule', label: 'Правило сдачи команды', dataType: 'enum', operators: [...equalityOperators] },
  { path: 'team_grading_mode', label: 'Режим оценки команды', dataType: 'enum', operators: [...equalityOperators] },
  { path: 'peer_split_min_percent', label: 'Минимум peer split', dataType: 'number', operators: [...numericOperators] },
  { path: 'peer_split_max_percent', label: 'Максимум peer split', dataType: 'number', operators: [...numericOperators] },
  { path: 'allow_early_finalization', label: 'Досрочная фиксация команд', dataType: 'boolean', operators: [...equalityOperators] },
  { path: 'team_formation_deadline', label: 'Дедлайн формирования команд', dataType: 'date', operators: [...dateOperators] },
  { path: 'deadline_auto_finalized_at', label: 'Автофиксация по дедлайну', dataType: 'date', operators: [...dateOperators] },
]

export const RUNTIME_FIELD_REGISTRY: RuntimeFieldDefinition[] = [
  { key: 'submissionDate', label: 'Дата сдачи', type: 'date' },
  { key: 'latePenaltyPoints', label: 'Штраф за опоздание', type: 'number' },
  { key: 'runtimeMultiplier', label: 'Множитель', type: 'number' },
  { key: 'penaltyAmount', label: 'Размер штрафа', type: 'number' },
  { key: 'submissionsCount', label: 'Количество сдач команды', type: 'number' },
  { key: 'teamRosterSize', label: 'Размер команды при оценке', type: 'number' },
]

export function getAssignmentFieldMeta(path: string): AssignmentFieldMeta | undefined {
  return ASSIGNMENT_FIELD_REGISTRY.find((field) => field.path === path)
}

export function getRuntimeFieldDefinition(key: string): RuntimeFieldDefinition | undefined {
  return RUNTIME_FIELD_REGISTRY.find((field) => field.key === key)
}
