import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import type { Assignment, Submission } from '../../../features/courses/model/types'
import { localGradingRepository } from '../../../entities/grading/model/gradingRepository'
import {
  clearGradingSessionDraft,
  loadGradingSessionDraft,
  saveGradingSessionDraft,
} from '../../../entities/grading/model/gradingSessionRepository'
import { calculateGrade } from '../../../shared/lib/rule-engine/gradeEngine'
import { collectRuntimeFieldDefinitions } from '../../../shared/lib/rule-engine/runtimeFields'
import type {
  Criterion,
  GradeCalculationResult,
  GradingTemplate,
  RuntimeFieldDefinition,
} from '../../../shared/types/grading'

type RubricGradingPanelProps = {
  assignment: Assignment
  submission: Submission
  /** Шаблон по умолчанию для задания (локальные предпочтения). */
  assignmentPreferredTemplateId?: string | null
  onApplyGrade: (grade: number, comment: string) => void
}

function getDefaultCriterionValue(criterion: Criterion): unknown {
  if (criterion.type === 'points') return criterion.score ?? 0
  return criterion.passed ?? false
}

function getDefaultRuntimeValue(field: RuntimeFieldDefinition, submission: Submission): unknown {
  if (field.key === 'submissionDate') return submission.submitted_at ?? new Date().toISOString()
  if (field.key === 'runtimeMultiplier') return 0.8
  if (field.type === 'number') return 0
  if (field.type === 'boolean') return false
  if (field.type === 'date') return new Date().toISOString()
  return ''
}

function normalizeCriteriaValues(
  template: GradingTemplate,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    template.criteria.map((criterion) => [
      criterion.id,
      values[criterion.id] ?? getDefaultCriterionValue(criterion),
    ]),
  )
}

function normalizeRuntimeValues(
  fields: RuntimeFieldDefinition[],
  values: Record<string, unknown>,
  submission: Submission,
): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      values[field.key] ?? getDefaultRuntimeValue(field, submission),
    ]),
  )
}

function formatRubricComment(template: GradingTemplate, result: GradeCalculationResult): string {
  const criterionLines = template.criteria
    .filter((criterion) => criterion.type === 'points')
    .map((criterion) => {
      const score = result.criterionScores[criterion.id] ?? 0
      return `- ${criterion.title}: ${score.toFixed(1)} / ${criterion.maxScore}`
    })
  const modifierLines = result.modifierTraces.map((trace) =>
    trace.applied
      ? `- ${trace.title}: ${trace.before.toFixed(1)} -> ${trace.after.toFixed(1)}`
      : `- ${trace.title}: не применён (${trace.reason ?? 'условие не выполнено'})`,
  )

  return [
    `Оценка по шаблону "${template.title}": ${result.finalScore.toFixed(1)} / ${result.maxScore}`,
    criterionLines.length > 0 ? `Критерии:\n${criterionLines.join('\n')}` : '',
    modifierLines.length > 0 ? `Модификаторы:\n${modifierLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function RubricGradingPanel({
  assignment,
  submission,
  assignmentPreferredTemplateId,
  onApplyGrade,
}: RubricGradingPanelProps) {
  const [templates, setTemplates] = useState<GradingTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [criteriaValues, setCriteriaValues] = useState<Record<string, unknown>>({})
  const [runtimeValues, setRuntimeValues] = useState<Record<string, unknown>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    localGradingRepository
      .listTemplates()
      .then((loadedTemplates) => {
        if (!active) return
        const savedDraft = loadGradingSessionDraft(assignment.id, submission.id)
        const fallbackTemplate =
          loadedTemplates.find((template) => template.preset === assignment.assignment_kind) ??
          loadedTemplates[0]
        const fromPreference =
          assignmentPreferredTemplateId != null && assignmentPreferredTemplateId !== ''
            ? loadedTemplates.find((t) => t.id === assignmentPreferredTemplateId)
            : undefined
        const selectedTemplate =
          loadedTemplates.find((template) => template.id === savedDraft?.templateId) ??
          fromPreference ??
          fallbackTemplate
        setTemplates(loadedTemplates)
        setSelectedTemplateId(selectedTemplate?.id ?? '')
        setCriteriaValues(savedDraft?.criteriaValues ?? {})
        setRuntimeValues(savedDraft?.runtimeValues ?? {})
        setSavedAt(savedDraft?.updatedAt ?? null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [assignment.assignment_kind, assignment.id, submission.id, assignmentPreferredTemplateId])

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId, templates],
  )

  const runtimeFields = useMemo(
    () => (selectedTemplate ? collectRuntimeFieldDefinitions(selectedTemplate) : []),
    [selectedTemplate],
  )

  const result = useMemo(() => {
    if (!selectedTemplate) return null
    const normalizedCriteria = normalizeCriteriaValues(selectedTemplate, criteriaValues)
    const normalizedRuntime = normalizeRuntimeValues(runtimeFields, runtimeValues, submission)
    return calculateGrade(selectedTemplate, {
      assignment,
      criteriaValues: normalizedCriteria,
      runtimeValues: normalizedRuntime,
    })
  }, [assignment, criteriaValues, runtimeFields, runtimeValues, selectedTemplate, submission])

  const saveDraft = () => {
    if (!selectedTemplate) return
    const saved = saveGradingSessionDraft({
      assignmentId: assignment.id,
      submissionId: submission.id,
      templateId: selectedTemplate.id,
      criteriaValues: normalizeCriteriaValues(selectedTemplate, criteriaValues),
      runtimeValues: normalizeRuntimeValues(runtimeFields, runtimeValues, submission),
    })
    setSavedAt(saved.updatedAt)
  }

  const clearDraft = () => {
    clearGradingSessionDraft(assignment.id, submission.id)
    setCriteriaValues({})
    setRuntimeValues({})
    setSavedAt(null)
  }

  if (loading) {
    return (
      <Box className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <CircularProgress size={18} />
      </Box>
    )
  }

  if (!selectedTemplate) {
    return (
      <Alert severity="info">
        Создайте шаблон во вкладке «Гибкое оценивание», чтобы проверять работу по критериям.
      </Alert>
    )
  }

  return (
    <Box className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <Box className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Box>
          <Typography variant="subtitle2" className="font-semibold text-slate-900">
            Проверка по шаблону
          </Typography>
          {savedAt && (
            <Typography variant="caption" color="text.secondary">
              Черновик сохранён {new Date(savedAt).toLocaleString('ru-RU')}
            </Typography>
          )}
        </Box>
        {result && (
          <Chip
            color="primary"
            label={`${result.finalScore.toFixed(1)} / ${result.maxScore}`}
            sx={{ borderRadius: 1 }}
          />
        )}
      </Box>

      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Шаблон</InputLabel>
        <Select
          label="Шаблон"
          value={selectedTemplateId}
          onChange={(event) => {
            setSelectedTemplateId(event.target.value)
            setCriteriaValues({})
            setRuntimeValues({})
            setSavedAt(null)
          }}
        >
          {templates.map((template) => (
            <MenuItem key={template.id} value={template.id}>
              {template.title}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {selectedTemplate.criteria.map((criterion) => {
          const state = result?.criterionStates.find((item) => item.criterionId === criterion.id)
          if (state && !state.visible) return null
          if (criterion.type === 'points') {
            return (
              <TextField
                key={criterion.id}
                size="small"
                type="number"
                label={`${criterion.title} (0-${criterion.maxScore})`}
                value={criteriaValues[criterion.id] ?? criterion.score ?? 0}
                disabled={state?.enabled === false}
                inputProps={{ min: 0, max: criterion.maxScore }}
                helperText={state?.reason}
                onChange={(event) =>
                  setCriteriaValues((current) => ({
                    ...current,
                    [criterion.id]: Number(event.target.value),
                  }))
                }
              />
            )
          }
          return (
            <FormControlLabel
              key={criterion.id}
              control={
                <Checkbox
                  checked={(criteriaValues[criterion.id] as boolean | undefined) ?? criterion.passed ?? false}
                  disabled={state?.enabled === false}
                  onChange={(event) =>
                    setCriteriaValues((current) => ({
                      ...current,
                      [criterion.id]: event.target.checked,
                    }))
                  }
                />
              }
              label={criterion.title}
            />
          )
        })}
      </Box>

      {runtimeFields.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {runtimeFields.map((field) => (
              <TextField
                key={field.key}
                size="small"
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'datetime-local' : 'text'}
                label={field.label}
                value={String(runtimeValues[field.key] ?? getDefaultRuntimeValue(field, submission))}
                onChange={(event) =>
                  setRuntimeValues((current) => ({
                    ...current,
                    [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value,
                  }))
                }
              />
            ))}
          </Box>
        </>
      )}

      {result && (
        <Box className="mt-2 flex flex-col gap-0.5">
          {result.modifierTraces.map((trace) => (
            <Typography
              key={trace.modifierId}
              variant="caption"
              color={trace.applied ? 'success.main' : 'text.secondary'}
            >
              {trace.title}: {trace.applied ? `${trace.before.toFixed(1)} -> ${trace.after.toFixed(1)}` : trace.reason}
            </Typography>
          ))}
        </Box>
      )}

      <Box className="mt-3 flex flex-wrap gap-1">
        <Button size="small" startIcon={<SaveOutlinedIcon />} variant="outlined" onClick={saveDraft}>
          Сохранить черновик
        </Button>
        <Button size="small" startIcon={<DeleteOutlineIcon />} variant="text" color="secondary" onClick={clearDraft}>
          Очистить
        </Button>
        {result && (
          <Button
            size="small"
            startIcon={<AutoAwesomeOutlinedIcon />}
            variant="contained"
            onClick={() => onApplyGrade(result.finalScore, formatRubricComment(selectedTemplate, result))}
          >
            Подставить оценку
          </Button>
        )}
      </Box>
    </Box>
  )
}
