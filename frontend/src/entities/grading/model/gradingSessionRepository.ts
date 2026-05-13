import type { GradingSessionDraft } from '../../../shared/types/grading'
import { createClientId } from './id'

const SESSION_STORAGE_PREFIX = 'hits-classroom.grading.session.v1'

function getSessionKey(assignmentId: string, submissionId: string): string {
  return `${SESSION_STORAGE_PREFIX}.${assignmentId}.${submissionId}`
}

export function loadGradingSessionDraft(
  assignmentId: string,
  submissionId: string,
): GradingSessionDraft | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(getSessionKey(assignmentId, submissionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as GradingSessionDraft
    if (parsed.assignmentId !== assignmentId || parsed.submissionId !== submissionId) return null
    return parsed
  } catch {
    return null
  }
}

export function saveGradingSessionDraft(
  draft: Omit<GradingSessionDraft, 'id' | 'updatedAt'> & { id?: string },
): GradingSessionDraft {
  const next: GradingSessionDraft = {
    ...draft,
    id: draft.id ?? createClientId('grading_session'),
    updatedAt: new Date().toISOString(),
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(getSessionKey(next.assignmentId, next.submissionId), JSON.stringify(next))
  }
  return next
}

export function clearGradingSessionDraft(assignmentId: string, submissionId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(getSessionKey(assignmentId, submissionId))
}
