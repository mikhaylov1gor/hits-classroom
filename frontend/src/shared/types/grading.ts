import type { Assignment } from '../../features/courses/model/types'

export type CriterionConditionBehavior = 'disable' | 'hide' | 'readonly' | 'exclude_from_total'

export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '=' | '!=' | 'before' | 'after'

export type AssignmentFieldPath =
  | 'deadline'
  | 'max_grade'
  | 'assignment_kind'
  | 'desired_team_size'
  | 'team_count'
  | 'max_team_size'
  | 'team_submission_rule'
  | 'team_grading_mode'
  | 'peer_split_min_percent'
  | 'peer_split_max_percent'
  | 'allow_early_finalization'
  | 'team_formation_deadline'
  | 'deadline_auto_finalized_at'

export type RuntimeFieldType = 'number' | 'date' | 'boolean' | 'string'

export type AssignmentFieldMeta = {
  path: AssignmentFieldPath
  label: string
  dataType: RuntimeFieldType | 'enum'
  operators: ComparisonOperator[]
}

export type RuntimeFieldDefinition = {
  key: string
  label: string
  type: RuntimeFieldType
}

export type ConstantValueSource = {
  type: 'constant'
  value: number
}

export type RuntimeValueSource = {
  type: 'runtime'
  fieldKey: string
}

export type ValueSource = ConstantValueSource | RuntimeValueSource

export type ConstantCompareSource = {
  source: 'constant'
  value: unknown
}

export type AssignmentFieldCompareSource = {
  source: 'assignment_field'
  field: AssignmentFieldPath
}

export type RuntimeCompareSource = {
  source: 'runtime'
  key: string
}

export type CompareSource =
  | ConstantCompareSource
  | AssignmentFieldCompareSource
  | RuntimeCompareSource

export type ManualCondition = {
  type: 'manual'
  title: string
  value?: boolean
}

export type AssignmentFieldCondition = {
  type: 'assignment_field'
  left: {
    source: 'assignment_field'
    field: AssignmentFieldPath
  }
  operator: ComparisonOperator
  right: CompareSource
}

export type CriterionCondition = {
  type: 'criterion'
  criterionId: string
  operator: ComparisonOperator
  compareValue: unknown
}

export type RuleCondition = ManualCondition | AssignmentFieldCondition | CriterionCondition

export type CriterionConditionGroup = {
  operator: 'AND' | 'OR'
  conditions: RuleCondition[]
}

export type BaseCriterion = {
  id: string
  title: string
  conditions?: CriterionConditionGroup[]
  conditionBehavior?: CriterionConditionBehavior
}

export type PointsCriterion = BaseCriterion & {
  type: 'points'
  maxScore: number
  score?: number
}

export type PassFailCriterion = BaseCriterion & {
  type: 'pass_fail'
  passed?: boolean
}

export type Criterion = PointsCriterion | PassFailCriterion

export type TotalTarget = {
  type: 'total'
}

export type CriteriaTarget = {
  type: 'criteria'
  criterionIds: string[]
}

export type ModifierTarget = TotalTarget | CriteriaTarget

export type SubtractEffect = {
  type: 'subtract'
  valueSource: ValueSource
}

export type MultiplyEffect = {
  type: 'multiply'
  multiplierSource: ValueSource
}

export type ModifierEffect = SubtractEffect | MultiplyEffect

export type Modifier = {
  id: string
  title: string
  enabled: boolean
  condition: RuleCondition
  target: ModifierTarget
  effect: ModifierEffect
}

export type GradingTemplate = {
  id: string
  title: string
  criteria: Criterion[]
  modifiers: Modifier[]
  createdAt: string
  updatedAt: string
  preset?: 'individual' | 'group' | 'custom'
}

export type GradingTemplateExport = {
  schemaVersion: 1
  exportedAt: string
  template: GradingTemplate
}

export type CriterionLibraryExport = {
  schemaVersion: 1
  exportedAt: string
  criteria: Criterion[]
}

export type GradingEvaluationContext = {
  assignment: Assignment
  criteriaValues: Record<string, unknown>
  runtimeValues: Record<string, unknown>
}

export type CriterionEvaluationState = {
  criterionId: string
  visible: boolean
  enabled: boolean
  readonly: boolean
  includedInTotal: boolean
  conditionsPassed: boolean
  reason?: string
}

export type ModifierTrace = {
  modifierId: string
  title: string
  applied: boolean
  reason?: string
  before: number
  after: number
}

export type GradeCalculationResult = {
  baseScore: number
  finalScore: number
  maxScore: number
  criterionScores: Record<string, number>
  criterionStates: CriterionEvaluationState[]
  modifierTraces: ModifierTrace[]
}

export type GradingSessionDraft = {
  id: string
  assignmentId: string
  submissionId: string
  templateId: string
  criteriaValues: Record<string, unknown>
  runtimeValues: Record<string, unknown>
  updatedAt: string
}

export type GradingValidationError = {
  path: string
  message: string
}

export type GradingValidationResult = {
  ok: boolean
  errors: GradingValidationError[]
}
