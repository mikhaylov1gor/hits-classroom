import type { Criterion, GradingTemplate } from '../../../shared/types/grading'
import { cloneCriteriaBlockWithIdRemap } from './clone'
import { createClientId } from './id'
import { seedCriterionLibrary, seedTemplates } from './seed'

export const GRADING_STORAGE_KEYS = {
  templates: 'hits-classroom.grading.templates.v1',
  criterionLibrary: 'hits-classroom.grading.criterion-library.v1',
}

export type GradingRepository = {
  listTemplates: () => Promise<GradingTemplate[]>
  saveTemplate: (template: GradingTemplate) => Promise<GradingTemplate[]>
  deleteTemplate: (id: string) => Promise<GradingTemplate[]>
  duplicateTemplate: (id: string) => Promise<GradingTemplate[]>
  listCriterionLibrary: () => Promise<Criterion[]>
  saveCriterionToLibrary: (criterion: Criterion) => Promise<Criterion[]>
  deleteCriterionFromLibrary: (id: string) => Promise<Criterion[]>
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function listTemplatesSync(): GradingTemplate[] {
  return readJson(GRADING_STORAGE_KEYS.templates, seedTemplates)
}

function listLibrarySync(): Criterion[] {
  return readJson(GRADING_STORAGE_KEYS.criterionLibrary, seedCriterionLibrary)
}

export const localGradingRepository: GradingRepository = {
  async listTemplates() {
    const templates = listTemplatesSync()
    writeJson(GRADING_STORAGE_KEYS.templates, templates)
    return templates
  },

  async saveTemplate(template) {
    const templates = listTemplatesSync()
    const nextTemplate = { ...template, updatedAt: new Date().toISOString() }
    const next = templates.some((item) => item.id === template.id)
      ? templates.map((item) => (item.id === template.id ? nextTemplate : item))
      : [...templates, nextTemplate]
    writeJson(GRADING_STORAGE_KEYS.templates, next)
    return next
  },

  async deleteTemplate(id) {
    const next = listTemplatesSync().filter((template) => template.id !== id)
    writeJson(GRADING_STORAGE_KEYS.templates, next)
    return next
  },

  async duplicateTemplate(id) {
    const templates = listTemplatesSync()
    const template = templates.find((item) => item.id === id)
    if (!template) return templates
    const clonedCriteria = cloneCriteriaBlockWithIdRemap(template.criteria)
    const oldToNew = new Map(template.criteria.map((criterion, index) => [criterion.id, clonedCriteria[index]?.id ?? criterion.id]))
    const duplicate: GradingTemplate = {
      ...template,
      id: createClientId('template'),
      title: `${template.title} copy`,
      preset: 'custom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      criteria: clonedCriteria,
      modifiers: template.modifiers.map((modifier) => ({
        ...modifier,
        id: createClientId('modifier'),
        target:
          modifier.target.type === 'criteria'
            ? {
                type: 'criteria',
                criterionIds: modifier.target.criterionIds.map((criterionId) => oldToNew.get(criterionId) ?? criterionId),
              }
            : modifier.target,
      })),
    }
    const next = [...templates, duplicate]
    writeJson(GRADING_STORAGE_KEYS.templates, next)
    return next
  },

  async listCriterionLibrary() {
    const criteria = listLibrarySync()
    writeJson(GRADING_STORAGE_KEYS.criterionLibrary, criteria)
    return criteria
  },

  async saveCriterionToLibrary(criterion) {
    const library = listLibrarySync()
    const libraryCriterion: Criterion = {
      ...criterion,
      id: createClientId('library_criterion'),
      title: criterion.title.trim() || 'Новый критерий',
    }
    const next = [...library, libraryCriterion]
    writeJson(GRADING_STORAGE_KEYS.criterionLibrary, next)
    return next
  },

  async deleteCriterionFromLibrary(id) {
    const next = listLibrarySync().filter((criterion) => criterion.id !== id)
    writeJson(GRADING_STORAGE_KEYS.criterionLibrary, next)
    return next
  },
}
