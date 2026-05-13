const STORAGE_KEY = 'hits-classroom.assignment-grading-preferences.v1'

export type AssignmentGradingPreference = {
  enabled: boolean
  /** Выбранный шаблон для этого задания (локально, до появления API). */
  templateId?: string | null
}

type Store = Record<string, AssignmentGradingPreference>

function readStore(): Store {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: Store): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function getAssignmentGradingPreference(assignmentId: string): AssignmentGradingPreference | null {
  return readStore()[assignmentId] ?? null
}

/** Задания без записи ведут себя как раньше: вкладка и панель рубрики доступны. */
export function isFlexibleGradingEnabledForAssignment(assignmentId: string): boolean {
  const p = getAssignmentGradingPreference(assignmentId)
  if (!p) return true
  return p.enabled
}

export function setAssignmentGradingPreference(
  assignmentId: string,
  preference: AssignmentGradingPreference,
): void {
  const next = { ...readStore(), [assignmentId]: preference }
  writeStore(next)
}
