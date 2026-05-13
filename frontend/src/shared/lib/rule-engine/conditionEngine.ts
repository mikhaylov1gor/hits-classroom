import type {
  AssignmentFieldCondition,
  AssignmentFieldPath,
  CompareSource,
  ComparisonOperator,
  CriterionConditionGroup,
  GradingEvaluationContext,
  RuleCondition,
} from '../../types/grading'

function getAssignmentValue(
  assignment: GradingEvaluationContext['assignment'],
  field: AssignmentFieldPath,
): unknown {
  return assignment[field]
}

function resolveCompareSource(source: CompareSource, context: GradingEvaluationContext): unknown {
  if (source.source === 'constant') return source.value
  if (source.source === 'assignment_field') return getAssignmentValue(context.assignment, source.field)
  return context.runtimeValues[source.key]
}

function toComparableDate(value: unknown): number | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function toComparableNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  return null
}

export function compareValues(left: unknown, operator: ComparisonOperator, right: unknown): boolean {
  if (left == null || right == null) return false

  if (operator === 'before' || operator === 'after') {
    const leftDate = toComparableDate(left)
    const rightDate = toComparableDate(right)
    if (leftDate == null || rightDate == null) return false
    return operator === 'before' ? leftDate < rightDate : leftDate > rightDate
  }

  if (operator === '=' || operator === '!=') {
    const result = String(left) === String(right)
    return operator === '=' ? result : !result
  }

  const leftNumber = toComparableNumber(left)
  const rightNumber = toComparableNumber(right)
  if (leftNumber == null || rightNumber == null) return false

  if (operator === '>') return leftNumber > rightNumber
  if (operator === '<') return leftNumber < rightNumber
  if (operator === '>=') return leftNumber >= rightNumber
  return leftNumber <= rightNumber
}

function evaluateAssignmentFieldCondition(
  condition: AssignmentFieldCondition,
  context: GradingEvaluationContext,
): boolean {
  const left = getAssignmentValue(context.assignment, condition.left.field)
  const right = resolveCompareSource(condition.right, context)
  return compareValues(left, condition.operator, right)
}

export function evaluateCondition(
  condition: RuleCondition,
  context: GradingEvaluationContext,
): boolean {
  if (condition.type === 'manual') {
    return condition.value === true
  }

  if (condition.type === 'assignment_field') {
    return evaluateAssignmentFieldCondition(condition, context)
  }

  return compareValues(
    context.criteriaValues[condition.criterionId],
    condition.operator,
    condition.compareValue,
  )
}

export function evaluateConditionGroup(
  group: CriterionConditionGroup,
  context: GradingEvaluationContext,
): boolean {
  if (group.conditions.length === 0) return true
  if (group.operator === 'OR') {
    return group.conditions.some((condition) => evaluateCondition(condition, context))
  }
  return group.conditions.every((condition) => evaluateCondition(condition, context))
}

export function evaluateConditionGroups(
  groups: CriterionConditionGroup[] | undefined,
  context: GradingEvaluationContext,
): boolean {
  if (!groups || groups.length === 0) return true
  return groups.every((group) => evaluateConditionGroup(group, context))
}
