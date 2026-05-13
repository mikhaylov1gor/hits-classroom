import { getAssignmentFieldMeta } from '../../../entities/grading/model/registries'
import type {
  Criterion,
  GradingTemplate,
  GradingValidationError,
  GradingValidationResult,
  RuleCondition,
} from '../../types/grading'

function conditionCriterionRefs(condition: RuleCondition): string[] {
  return condition.type === 'criterion' ? [condition.criterionId] : []
}

function collectCriterionRefs(criterion: Criterion): string[] {
  return (
    criterion.conditions?.flatMap((group) =>
      group.conditions.flatMap((condition) => conditionCriterionRefs(condition)),
    ) ?? []
  )
}

function addError(errors: GradingValidationError[], path: string, message: string): void {
  errors.push({ path, message })
}

function hasCycle(template: GradingTemplate): boolean {
  const graph = new Map<string, string[]>()
  template.criteria.forEach((criterion) => graph.set(criterion.id, collectCriterionRefs(criterion)))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const refs = graph.get(id) ?? []
    const result = refs.some((ref) => graph.has(ref) && visit(ref))
    visiting.delete(id)
    visited.add(id)
    return result
  }

  return [...graph.keys()].some((id) => visit(id))
}

export function validateGradingTemplate(template: GradingTemplate): GradingValidationResult {
  const errors: GradingValidationError[] = []
  const criterionIds = new Set<string>()

  template.criteria.forEach((criterion, index) => {
    if (criterionIds.has(criterion.id)) {
      addError(errors, `/criteria/${index}/id`, 'Повторяющийся id критерия')
    }
    criterionIds.add(criterion.id)

    if (!criterion.title.trim()) addError(errors, `/criteria/${index}/title`, 'Название обязательно')
    if (criterion.type === 'points') {
      if (!Number.isFinite(criterion.maxScore) || criterion.maxScore <= 0) {
        addError(errors, `/criteria/${index}/maxScore`, 'Максимальный балл должен быть больше 0')
      }
      if (criterion.score != null && (criterion.score < 0 || criterion.score > criterion.maxScore)) {
        addError(errors, `/criteria/${index}/score`, 'Балл должен попадать в диапазон критерия')
      }
    }

    criterion.conditions?.forEach((group, groupIndex) => {
      group.conditions.forEach((condition, conditionIndex) => {
        const path = `/criteria/${index}/conditions/${groupIndex}/conditions/${conditionIndex}`
        if (condition.type === 'criterion') {
          if (condition.criterionId === criterion.id) addError(errors, path, 'Критерий не может ссылаться на себя')
          if (!criterionIds.has(condition.criterionId) && !template.criteria.some((item) => item.id === condition.criterionId)) {
            addError(errors, path, 'Условие ссылается на несуществующий критерий')
          }
        }
        if (condition.type === 'assignment_field') {
          const meta = getAssignmentFieldMeta(condition.left.field)
          if (!meta?.operators.includes(condition.operator)) {
            addError(errors, path, 'Оператор несовместим с полем задания')
          }
        }
      })
    })
  })

  template.modifiers.forEach((modifier, index) => {
    if (!modifier.title.trim()) addError(errors, `/modifiers/${index}/title`, 'Название обязательно')
    if (modifier.target.type === 'criteria') {
      if (modifier.target.criterionIds.length === 0) {
        addError(errors, `/modifiers/${index}/target/criterionIds`, 'Выберите хотя бы один критерий')
      }
      modifier.target.criterionIds.forEach((id) => {
        if (!criterionIds.has(id)) {
          addError(errors, `/modifiers/${index}/target/criterionIds`, 'Модификатор ссылается на несуществующий критерий')
        }
      })
    }
    if (modifier.condition.type === 'criterion' && !criterionIds.has(modifier.condition.criterionId)) {
      addError(errors, `/modifiers/${index}/condition`, 'Условие ссылается на несуществующий критерий')
    }
    if (modifier.effect.type === 'multiply') {
      const source = modifier.effect.multiplierSource
      if (source.type === 'constant' && (!Number.isFinite(source.value) || source.value < 0)) {
        addError(errors, `/modifiers/${index}/effect`, 'Множитель должен быть неотрицательным числом')
      }
    }
    if (modifier.effect.type === 'subtract') {
      const source = modifier.effect.valueSource
      if (source.type === 'constant' && (!Number.isFinite(source.value) || source.value < 0)) {
        addError(errors, `/modifiers/${index}/effect`, 'Вычитаемое значение должно быть неотрицательным числом')
      }
    }
  })

  if (hasCycle(template)) addError(errors, '/criteria', 'Найдена циклическая зависимость критериев')

  return { ok: errors.length === 0, errors }
}
