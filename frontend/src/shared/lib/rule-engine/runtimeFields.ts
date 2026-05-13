import { getRuntimeFieldDefinition } from '../../../entities/grading/model/registries'
import type {
  CriterionConditionGroup,
  GradingTemplate,
  RuleCondition,
  RuntimeFieldDefinition,
} from '../../types/grading'

function addRuntimeKey(
  keys: Set<string>,
  definitions: RuntimeFieldDefinition[],
  key: string,
): void {
  if (keys.has(key)) return
  keys.add(key)
  definitions.push(
    getRuntimeFieldDefinition(key) ?? {
      key,
      label: key,
      type: 'string',
    },
  )
}

function collectFromCondition(
  condition: RuleCondition,
  keys: Set<string>,
  definitions: RuntimeFieldDefinition[],
): void {
  if (condition.type === 'assignment_field' && condition.right.source === 'runtime') {
    addRuntimeKey(keys, definitions, condition.right.key)
  }
}

function collectFromGroups(
  groups: CriterionConditionGroup[] | undefined,
  keys: Set<string>,
  definitions: RuntimeFieldDefinition[],
): void {
  groups?.forEach((group) => {
    group.conditions.forEach((condition) => collectFromCondition(condition, keys, definitions))
  })
}

export function collectRuntimeFieldDefinitions(template: GradingTemplate): RuntimeFieldDefinition[] {
  const keys = new Set<string>()
  const definitions: RuntimeFieldDefinition[] = []

  template.criteria.forEach((criterion) => {
    collectFromGroups(criterion.conditions, keys, definitions)
  })

  template.modifiers.forEach((modifier) => {
    collectFromCondition(modifier.condition, keys, definitions)
    if (modifier.effect.type === 'subtract' && modifier.effect.valueSource.type === 'runtime') {
      addRuntimeKey(keys, definitions, modifier.effect.valueSource.fieldKey)
    }
    if (modifier.effect.type === 'multiply' && modifier.effect.multiplierSource.type === 'runtime') {
      addRuntimeKey(keys, definitions, modifier.effect.multiplierSource.fieldKey)
    }
  })

  return definitions
}
