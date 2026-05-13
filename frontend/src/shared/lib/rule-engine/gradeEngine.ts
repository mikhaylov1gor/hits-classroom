import type {
  Criterion,
  CriterionEvaluationState,
  GradeCalculationResult,
  GradingEvaluationContext,
  Modifier,
  ModifierTrace,
  ValueSource,
  GradingTemplate,
} from '../../types/grading'
import { evaluateCondition, evaluateConditionGroups } from './conditionEngine'

type ScoreState = {
  criterionScores: Record<string, number>
  totalAdjustment: number
  traces: ModifierTrace[]
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

export function resolveValueSource(
  source: ValueSource,
  context: GradingEvaluationContext,
): number {
  if (source.type === 'constant') return source.value
  const value = context.runtimeValues[source.fieldKey]
  return typeof value === 'number' && Number.isFinite(value) ? value : NaN
}

function getCriterionScore(criterion: Criterion, context: GradingEvaluationContext): number {
  const value = context.criteriaValues[criterion.id]
  if (criterion.type === 'points') {
    const raw = typeof value === 'number' ? value : criterion.score ?? 0
    return clampScore(Math.min(raw, criterion.maxScore))
  }
  return value === true || criterion.passed === true ? 1 : 0
}

function getTotalFromState(state: ScoreState): number {
  const score = Object.values(state.criterionScores).reduce((sum, value) => sum + value, 0)
  return clampScore(score + state.totalAdjustment)
}

function applyEffect(value: number, modifier: Modifier, context: GradingEvaluationContext): number {
  if (modifier.effect.type === 'subtract') {
    return clampScore(value - resolveValueSource(modifier.effect.valueSource, context))
  }
  return clampScore(value * resolveValueSource(modifier.effect.multiplierSource, context))
}

function applyCriteriaModifier(
  state: ScoreState,
  modifier: Modifier,
  context: GradingEvaluationContext,
): ScoreState {
  const ids = modifier.target.type === 'criteria' ? modifier.target.criterionIds : []
  if (modifier.effect.type === 'multiply') {
    const nextScores = { ...state.criterionScores }
    ids.forEach((id) => {
      nextScores[id] = applyEffect(nextScores[id] ?? 0, modifier, context)
    })
    return { ...state, criterionScores: nextScores }
  }

  const subtractValue = resolveValueSource(modifier.effect.valueSource, context)
  const currentBucket = ids.reduce((sum, id) => sum + (state.criterionScores[id] ?? 0), 0)
  if (!Number.isFinite(subtractValue) || currentBucket <= 0) return state

  let remaining = Math.min(subtractValue, currentBucket)
  const nextScores = { ...state.criterionScores }
  ids.forEach((id, index) => {
    const current = nextScores[id] ?? 0
    const isLast = index === ids.length - 1
    const share = isLast ? remaining : Math.min(current, (current / currentBucket) * subtractValue)
    nextScores[id] = clampScore(current - share)
    remaining -= share
  })
  return { ...state, criterionScores: nextScores }
}

export function applyModifier(
  state: ScoreState,
  modifier: Modifier,
  context: GradingEvaluationContext,
): ScoreState {
  const before = getTotalFromState(state)
  if (!modifier.enabled) {
    return {
      ...state,
      traces: [...state.traces, { modifierId: modifier.id, title: modifier.title, applied: false, reason: 'Выключен', before, after: before }],
    }
  }

  if (!evaluateCondition(modifier.condition, context)) {
    return {
      ...state,
      traces: [...state.traces, { modifierId: modifier.id, title: modifier.title, applied: false, reason: 'Условие не выполнено', before, after: before }],
    }
  }

  const next =
    modifier.target.type === 'total'
      ? {
          ...state,
          totalAdjustment:
            modifier.effect.type === 'subtract'
              ? state.totalAdjustment - resolveValueSource(modifier.effect.valueSource, context)
              : getTotalFromState(state) * (resolveValueSource(modifier.effect.multiplierSource, context) - 1),
        }
      : applyCriteriaModifier(state, modifier, context)
  const after = getTotalFromState(next)

  return {
    ...next,
    traces: [...next.traces, { modifierId: modifier.id, title: modifier.title, applied: true, before, after }],
  }
}

function evaluateCriterionState(
  criterion: Criterion,
  context: GradingEvaluationContext,
): CriterionEvaluationState {
  const conditionsPassed = evaluateConditionGroups(criterion.conditions, context)
  const behavior = criterion.conditionBehavior ?? 'disable'
  const baseState: CriterionEvaluationState = {
    criterionId: criterion.id,
    visible: true,
    enabled: true,
    readonly: false,
    includedInTotal: true,
    conditionsPassed,
  }

  if (conditionsPassed) return baseState

  const reason = 'Условия критерия не выполнены'
  if (behavior === 'hide') return { ...baseState, visible: false, enabled: false, includedInTotal: false, reason }
  if (behavior === 'readonly') return { ...baseState, readonly: true, reason }
  if (behavior === 'exclude_from_total') return { ...baseState, includedInTotal: false, reason }
  return { ...baseState, enabled: false, reason }
}

export function calculateGrade(
  template: GradingTemplate,
  context: GradingEvaluationContext,
): GradeCalculationResult {
  const criterionStates = template.criteria.map((criterion) => evaluateCriterionState(criterion, context))
  const stateById = new Map(criterionStates.map((state) => [state.criterionId, state]))
  const criterionScores: Record<string, number> = {}
  let maxScore = 0

  template.criteria.forEach((criterion) => {
    const state = stateById.get(criterion.id)
    if (!state?.visible || !state.includedInTotal || criterion.type !== 'points') return
    criterionScores[criterion.id] = getCriterionScore(criterion, context)
    maxScore += criterion.maxScore
  })

  const initialState: ScoreState = {
    criterionScores,
    totalAdjustment: 0,
    traces: [],
  }
  const finalState = template.modifiers.reduce(
    (state, modifier) => applyModifier(state, modifier, context),
    initialState,
  )
  const baseScore = getTotalFromState(initialState)

  return {
    baseScore,
    finalScore: getTotalFromState(finalState),
    maxScore,
    criterionScores: finalState.criterionScores,
    criterionStates,
    modifierTraces: finalState.traces,
  }
}
