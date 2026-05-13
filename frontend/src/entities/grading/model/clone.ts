import type { Criterion, RuleCondition } from '../../../shared/types/grading'
import { createClientId } from './id'

function remapCondition(condition: RuleCondition, idMap: Map<string, string>): RuleCondition {
  if (condition.type !== 'criterion') return condition
  return {
    ...condition,
    criterionId: idMap.get(condition.criterionId) ?? condition.criterionId,
  }
}

export function cloneCriteriaBlockWithIdRemap(criteria: Criterion[]): Criterion[] {
  const idMap = new Map(criteria.map((criterion) => [criterion.id, createClientId('criterion')]))

  return criteria.map((criterion) => ({
    ...criterion,
    id: idMap.get(criterion.id) ?? createClientId('criterion'),
    conditions: criterion.conditions?.map((group) => ({
      ...group,
      conditions: group.conditions.map((condition) => remapCondition(condition, idMap)),
    })),
  }))
}
