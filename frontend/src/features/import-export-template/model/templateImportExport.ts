import type { GradingTemplate, GradingTemplateExport } from '../../../shared/types/grading'
import { validateGradingTemplate } from '../../../shared/lib/rule-engine/templateValidation'
import { createClientId } from '../../../entities/grading/model/id'

export function exportGradingTemplate(template: GradingTemplate): string {
  const payload: GradingTemplateExport = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    template,
  }
  return JSON.stringify(payload, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function importGradingTemplate(json: string): { template?: GradingTemplate; errors: string[] } {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !isRecord(parsed.template)) {
      return { errors: ['Файл не похож на экспорт шаблона версии 1'] }
    }
    const source = parsed.template as GradingTemplate
    const template: GradingTemplate = {
      ...source,
      id: createClientId('template'),
      title: `${source.title ?? 'Imported template'} import`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      criteria: Array.isArray(source.criteria) ? source.criteria : [],
      modifiers: Array.isArray(source.modifiers) ? source.modifiers : [],
      preset: 'custom',
    }
    const validation = validateGradingTemplate(template)
    if (!validation.ok) {
      return { errors: validation.errors.map((error) => `${error.path}: ${error.message}`) }
    }
    return { template, errors: [] }
  } catch {
    return { errors: ['Не удалось прочитать JSON'] }
  }
}
