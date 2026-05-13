import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import type { Assignment } from '../../../features/courses/model/types'
import { cloneCriteriaBlockWithIdRemap } from '../../../entities/grading/model/clone'
import { localGradingRepository } from '../../../entities/grading/model/gradingRepository'
import { createClientId } from '../../../entities/grading/model/id'
import {
  exportGradingTemplate,
  importGradingTemplate,
} from '../../import-export-template/model/templateImportExport'
import { calculateGrade } from '../../../shared/lib/rule-engine/gradeEngine'
import { collectRuntimeFieldDefinitions } from '../../../shared/lib/rule-engine/runtimeFields'
import { validateGradingTemplate } from '../../../shared/lib/rule-engine/templateValidation'
import type {
  Criterion,
  CriterionConditionBehavior,
  GradingTemplate,
  Modifier,
  RuleCondition,
  RuntimeFieldDefinition,
} from '../../../shared/types/grading'

export type GradingTemplateWorkspaceActiveSync = {
  selectedTemplateId: string
  templates: GradingTemplate[]
}

type GradingTemplateWorkspaceProps = {
  assignment?: Assignment
  onApplyGrade?: (grade: number) => void
  /** Локально привязанный шаблон к заданию (из предпочтений в браузере). */
  preferredTemplateId?: string | null
  /** Вкладка на странице задания: компактнее шапка и сетка. */
  embedded?: boolean
  /** Диалог создания/редактирования задания: одна колонка, без лишней ширины. */
  inModal?: boolean
  /** Сообщить родителю выбранный шаблон (для привязки к заданию до появления API). */
  onActiveTemplateChange?: (state: GradingTemplateWorkspaceActiveSync) => void
}

type ConditionPreset = 'manual_true' | 'deadline_late' | 'on_time_failed' | 'team_undersized'

function createBlankTemplate(): GradingTemplate {
  const now = new Date().toISOString()
  return {
    id: createClientId('template'),
    title: 'Новый шаблон',
    preset: 'custom',
    criteria: [],
    modifiers: [],
    createdAt: now,
    updatedAt: now,
  }
}

function createBlankCriterion(): Criterion {
  return {
    id: createClientId('criterion'),
    title: 'Новый критерий',
    type: 'points',
    maxScore: 10,
    score: 0,
  }
}

function createConditionPreset(preset: ConditionPreset, criteria: Criterion[]): RuleCondition {
  if (preset === 'deadline_late') {
    return {
      type: 'assignment_field',
      left: { source: 'assignment_field', field: 'deadline' },
      operator: 'before',
      right: { source: 'runtime', key: 'submissionDate' },
    }
  }
  if (preset === 'on_time_failed') {
    const passFail = criteria.find((criterion) => criterion.type === 'pass_fail')
    return {
      type: 'criterion',
      criterionId: passFail?.id ?? criteria[0]?.id ?? '',
      operator: '=',
      compareValue: false,
    }
  }
  if (preset === 'team_undersized') {
    return {
      type: 'assignment_field',
      left: { source: 'assignment_field', field: 'team_count' },
      operator: '<',
      right: { source: 'assignment_field', field: 'desired_team_size' },
    }
  }
  return { type: 'manual', title: 'Включить правило', value: true }
}

function createBlankModifier(criteria: Criterion[]): Modifier {
  return {
    id: createClientId('modifier'),
    title: 'Новый модификатор',
    enabled: true,
    condition: createConditionPreset('manual_true', criteria),
    target: { type: 'total' },
    effect: { type: 'subtract', valueSource: { type: 'constant', value: 0 } },
  }
}

function getConditionPreset(condition: RuleCondition): ConditionPreset {
  if (condition.type === 'assignment_field' && condition.left.field === 'deadline') return 'deadline_late'
  if (condition.type === 'assignment_field' && condition.left.field === 'team_count') return 'team_undersized'
  if (condition.type === 'criterion') return 'on_time_failed'
  return 'manual_true'
}

function createPreviewAssignment(source?: Assignment, kind: 'individual' | 'group' = 'individual'): Assignment {
  return {
    id: source?.id ?? 'preview_assignment',
    course_id: source?.course_id ?? 'preview_course',
    title: source?.title ?? 'Preview assignment',
    deadline: source?.deadline ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    max_grade: source?.max_grade ?? 100,
    assignment_kind: kind,
    desired_team_size: source?.desired_team_size ?? 4,
    team_count: source?.team_count ?? (kind === 'group' ? 3 : null),
    max_team_size: source?.max_team_size ?? 5,
    team_grading_mode: source?.team_grading_mode ?? 'team_uniform',
  }
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function criterionValueFromState(criterion: Criterion, values: Record<string, unknown>): unknown {
  const value = values[criterion.id]
  if (criterion.type === 'points') return typeof value === 'number' ? value : criterion.score ?? 0
  return typeof value === 'boolean' ? value : criterion.passed ?? false
}

function defaultRuntimeValue(field: RuntimeFieldDefinition): unknown {
  if (field.type === 'number') return field.key === 'runtimeMultiplier' ? 0.8 : 0
  if (field.type === 'boolean') return false
  if (field.type === 'date') return new Date().toISOString()
  return ''
}

export function GradingTemplateWorkspace({
  assignment,
  onApplyGrade,
  preferredTemplateId,
  embedded = false,
  inModal = false,
  onActiveTemplateChange,
}: GradingTemplateWorkspaceProps) {
  const [templates, setTemplates] = useState<GradingTemplate[]>([])
  const [library, setLibrary] = useState<Criterion[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [draft, setDraft] = useState<GradingTemplate>(createBlankTemplate)
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set())
  const [criteriaValues, setCriteriaValues] = useState<Record<string, unknown>>({})
  const [runtimeValues, setRuntimeValues] = useState<Record<string, unknown>>({})
  const [assignmentKind, setAssignmentKind] = useState<'individual' | 'group'>(
    assignment?.assignment_kind === 'group' ? 'group' : 'individual',
  )
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const onActiveTemplateChangeRef = useRef(onActiveTemplateChange)
  onActiveTemplateChangeRef.current = onActiveTemplateChange

  useEffect(() => {
    onActiveTemplateChangeRef.current?.({ selectedTemplateId, templates })
  }, [selectedTemplateId, templates])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      localGradingRepository.listTemplates(),
      localGradingRepository.listCriterionLibrary(),
    ]).then(([loadedTemplates, loadedLibrary]) => {
      if (cancelled) return
      setTemplates(loadedTemplates)
      setLibrary(loadedLibrary)
      const preferred =
        preferredTemplateId != null && preferredTemplateId !== ''
          ? loadedTemplates.find((template) => template.id === preferredTemplateId)
          : undefined
      const pick = preferred ?? loadedTemplates[0] ?? createBlankTemplate()
      setSelectedTemplateId(pick.id)
      setDraft(pick)
    })
    return () => {
      cancelled = true
    }
  }, [assignment?.id, preferredTemplateId])

  const runtimeFields = useMemo(() => collectRuntimeFieldDefinitions(draft), [draft])
  const validation = useMemo(() => validateGradingTemplate(draft), [draft])
  const previewAssignment = useMemo(
    () => createPreviewAssignment(assignment, assignmentKind),
    [assignment, assignmentKind],
  )
  const preview = useMemo(() => {
    const mergedCriteriaValues = Object.fromEntries(
      draft.criteria.map((criterion) => [criterion.id, criterionValueFromState(criterion, criteriaValues)]),
    )
    const mergedRuntimeValues = Object.fromEntries(
      runtimeFields.map((field) => [field.key, runtimeValues[field.key] ?? defaultRuntimeValue(field)]),
    )
    return calculateGrade(draft, {
      assignment: previewAssignment,
      criteriaValues: mergedCriteriaValues,
      runtimeValues: mergedRuntimeValues,
    })
  }, [criteriaValues, draft, previewAssignment, runtimeFields, runtimeValues])

  const selectTemplate = (template: GradingTemplate) => {
    setSelectedTemplateId(template.id)
    setDraft(template)
    setCriteriaValues({})
    setRuntimeValues({})
    setNotice(null)
  }

  const refreshTemplates = (next: GradingTemplate[]) => {
    setTemplates(next)
    const selected = next.find((template) => template.id === selectedTemplateId) ?? next[0]
    if (selected) {
      setSelectedTemplateId(selected.id)
      setDraft(selected)
    }
  }

  const saveDraft = async () => {
    if (!validation.ok) return
    const next = await localGradingRepository.saveTemplate(draft)
    setTemplates(next)
    setNotice('Шаблон сохранён локально')
  }

  const addCriterion = () => {
    setDraft((current) => ({ ...current, criteria: [...current.criteria, createBlankCriterion()] }))
  }

  const updateCriterion = (id: string, patch: Partial<Criterion>) => {
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((criterion) =>
        criterion.id === id ? ({ ...criterion, ...patch } as Criterion) : criterion,
      ),
    }))
  }

  const removeCriterion = (id: string) => {
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.filter((criterion) => criterion.id !== id),
      modifiers: current.modifiers.map((modifier) => ({
        ...modifier,
        target:
          modifier.target.type === 'criteria'
            ? {
                type: 'criteria',
                criterionIds: modifier.target.criterionIds.filter((criterionId) => criterionId !== id),
              }
            : modifier.target,
      })),
    }))
  }

  const moveCriterion = (id: string, direction: -1 | 1) => {
    setDraft((current) => {
      const index = current.criteria.findIndex((criterion) => criterion.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.criteria.length) return current
      const criteria = [...current.criteria]
      const [item] = criteria.splice(index, 1)
      if (!item) return current
      criteria.splice(nextIndex, 0, item)
      return { ...current, criteria }
    })
  }

  const insertFromLibrary = () => {
    const selected = library.filter((criterion) => selectedLibraryIds.has(criterion.id))
    if (selected.length === 0) return
    const cloned = cloneCriteriaBlockWithIdRemap(selected)
    setDraft((current) => ({ ...current, criteria: [...current.criteria, ...cloned] }))
    setSelectedLibraryIds(new Set())
  }

  const saveCriterionToLibrary = async (criterion: Criterion) => {
    const next = await localGradingRepository.saveCriterionToLibrary(criterion)
    setLibrary(next)
    setNotice('Критерий добавлен в библиотеку')
  }

  const addModifier = () => {
    setDraft((current) => ({ ...current, modifiers: [...current.modifiers, createBlankModifier(current.criteria)] }))
  }

  const updateModifier = (id: string, patch: Partial<Modifier>) => {
    setDraft((current) => ({
      ...current,
      modifiers: current.modifiers.map((modifier) =>
        modifier.id === id ? ({ ...modifier, ...patch } as Modifier) : modifier,
      ),
    }))
  }

  const deleteTemplate = async () => {
    if (!deleteId) return
    const next = await localGradingRepository.deleteTemplate(deleteId)
    setDeleteId(null)
    refreshTemplates(next)
  }

  const duplicateTemplate = async (id: string) => {
    const next = await localGradingRepository.duplicateTemplate(id)
    refreshTemplates(next)
  }

  const importTemplate = async () => {
    const result = importGradingTemplate(importText)
    if (result.errors.length > 0 || !result.template) {
      setImportErrors(result.errors)
      return
    }
    const next = await localGradingRepository.saveTemplate(result.template)
    setTemplates(next)
    selectTemplate(result.template)
    setImportOpen(false)
    setImportText('')
    setImportErrors([])
  }

  return (
    <Box
      className="flex flex-col gap-4"
      sx={{
        width: '100%',
        minWidth: 0,
        ...(embedded && { gap: 2, pt: 0.5 }),
        ...(inModal && { gap: 1.5, pt: 0 }),
      }}
    >
      <Box className="flex flex-wrap items-center justify-between gap-2" sx={{ minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant={embedded || inModal ? 'h6' : 'h5'}
            className="font-semibold text-slate-900"
            sx={{ wordBreak: 'break-word' }}
          >
            Гибкое оценивание
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: embedded || inModal ? 720 : undefined }}>
            {inModal
              ? 'Редактор шаблона в диалоге: данные в localStorage этого браузера. Сохраните шаблон перед созданием задания, если нужен новый.'
              : embedded
                ? 'Шаблоны хранятся локально в браузере. Сохраняйте экспорт JSON для резервной копии.'
                : 'Локальные шаблоны, библиотека критериев, runtime-поля и rule engine.'}
          </Typography>
        </Box>
        <Box className="flex flex-wrap gap-1" sx={{ flexShrink: 0 }}>
          <Button startIcon={<UploadFileOutlinedIcon />} variant="outlined" onClick={() => setImportOpen(true)}>
            Импорт
          </Button>
          <Button
            startIcon={<DownloadOutlinedIcon />}
            variant="outlined"
            onClick={() => downloadText(`${draft.title}.grading.json`, exportGradingTemplate(draft))}
          >
            Экспорт
          </Button>
          <Button
            startIcon={<SaveOutlinedIcon />}
            variant="contained"
            disabled={!validation.ok}
            onClick={saveDraft}
          >
            Сохранить
          </Button>
        </Box>
      </Box>

      {notice && <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      {!validation.ok && (
        <Alert severity="warning">
          {validation.errors.slice(0, 4).map((error) => `${error.path}: ${error.message}`).join('; ')}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: inModal ? 1.5 : 2,
          width: '100%',
          minWidth: 0,
          ...(inModal
            ? { gridTemplateColumns: 'minmax(0, 1fr)' }
            : {
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  md: 'minmax(0, 260px) minmax(0, 1fr)',
                  xl: 'minmax(0, 260px) minmax(0, 1fr) minmax(0, 300px)',
                },
              }),
        }}
      >
        <Box className="rounded-lg border border-slate-200 bg-white p-3" sx={{ minWidth: 0 }}>
          <Box className="mb-2 flex items-center justify-between gap-2">
            <Typography variant="subtitle2" className="font-semibold">
              Шаблоны
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => selectTemplate(createBlankTemplate())}>
              Новый
            </Button>
          </Box>
          <Box className="flex flex-col gap-2">
            {templates.map((template) => (
              <Box
                key={template.id}
                className="rounded-md border border-slate-200 p-2"
                sx={{ bgcolor: template.id === selectedTemplateId ? 'grey.100' : 'white' }}
              >
                <Button
                  fullWidth
                  sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 0.5 }}
                  onClick={() => selectTemplate(template)}
                >
                  <Box className="min-w-0 text-left" sx={{ width: '100%' }}>
                    <Typography variant="body2" className="truncate font-medium">
                      {template.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {template.criteria.length} критериев · {new Date(template.createdAt).toLocaleDateString('ru-RU')}
                    </Typography>
                  </Box>
                </Button>
                <Box className="mt-1 flex flex-wrap gap-1">
                  <Button size="small" startIcon={<ContentCopyOutlinedIcon />} onClick={() => duplicateTemplate(template.id)}>
                    Дубль
                  </Button>
                  <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteId(template.id)}>
                    Удалить
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box className="flex min-w-0 flex-col gap-4" sx={{ minWidth: 0 }}>
          <Box className="rounded-lg border border-slate-200 bg-white p-4" sx={{ minWidth: 0 }}>
            <Box className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <TextField
                label="Название шаблона"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Пресет</InputLabel>
                <Select
                  label="Пресет"
                  value={draft.preset ?? 'custom'}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      preset: event.target.value as GradingTemplate['preset'],
                    }))
                  }
                >
                  <MenuItem value="custom">Custom</MenuItem>
                  <MenuItem value="individual">Individual</MenuItem>
                  <MenuItem value="group">Group</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box className="rounded-lg border border-slate-200 bg-white p-4">
            <Box className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Typography variant="h6" className="font-semibold">
                Критерии
              </Typography>
              <Button startIcon={<AddIcon />} variant="outlined" onClick={addCriterion}>
                Добавить
              </Button>
            </Box>
            <Box className="flex flex-col gap-3">
              {draft.criteria.map((criterion, index) => (
                <Box key={criterion.id} className="rounded-lg border border-slate-200 p-3">
                  <Box className="mb-2 flex flex-wrap items-center gap-2">
                    <Chip size="small" label={`#${index + 1}`} />
                    <Button size="small" startIcon={<ArrowUpwardIcon />} onClick={() => moveCriterion(criterion.id, -1)}>
                      Вверх
                    </Button>
                    <Button size="small" startIcon={<ArrowDownwardIcon />} onClick={() => moveCriterion(criterion.id, 1)}>
                      Вниз
                    </Button>
                    <Button size="small" startIcon={<LibraryAddOutlinedIcon />} onClick={() => saveCriterionToLibrary(criterion)}>
                      В библиотеку
                    </Button>
                    <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => removeCriterion(criterion.id)}>
                      Удалить
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        sm: 'minmax(0, 1fr) minmax(0, 130px)',
                        lg: 'minmax(0, 1fr) 120px 110px 160px',
                      },
                    }}
                  >
                    <TextField
                      label="Название"
                      value={criterion.title}
                      onChange={(event) => updateCriterion(criterion.id, { title: event.target.value })}
                    />
                    <FormControl>
                      <InputLabel>Тип</InputLabel>
                      <Select
                        label="Тип"
                        value={criterion.type}
                        onChange={(event) => {
                          const type = event.target.value as Criterion['type']
                          updateCriterion(
                            criterion.id,
                            type === 'points'
                              ? { type, maxScore: 10, score: 0 }
                              : { type, passed: true },
                          )
                        }}
                      >
                        <MenuItem value="points">Баллы</MenuItem>
                        <MenuItem value="pass_fail">Pass/fail</MenuItem>
                      </Select>
                    </FormControl>
                    {criterion.type === 'points' ? (
                      <TextField
                        label="Макс."
                        type="number"
                        value={criterion.maxScore}
                        onChange={(event) =>
                          updateCriterion(criterion.id, { maxScore: Number(event.target.value) })
                        }
                      />
                    ) : (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={criterion.passed === true}
                            onChange={(event) => updateCriterion(criterion.id, { passed: event.target.checked })}
                          />
                        }
                        label="Пройден"
                      />
                    )}
                    <FormControl>
                      <InputLabel>Поведение</InputLabel>
                      <Select
                        label="Поведение"
                        value={criterion.conditionBehavior ?? 'disable'}
                        onChange={(event) =>
                          updateCriterion(criterion.id, {
                            conditionBehavior: event.target.value as CriterionConditionBehavior,
                          })
                        }
                      >
                        <MenuItem value="disable">Disable</MenuItem>
                        <MenuItem value="hide">Hide</MenuItem>
                        <MenuItem value="readonly">Readonly</MenuItem>
                        <MenuItem value="exclude_from_total">Exclude</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <FormControlLabel
                    sx={{ mt: 1 }}
                    control={
                      <Checkbox
                        checked={Boolean(criterion.conditions?.length)}
                        onChange={(event) =>
                          updateCriterion(criterion.id, {
                            conditions: event.target.checked
                              ? [
                                  {
                                    operator: 'AND',
                                    conditions: [
                                      {
                                        type: 'assignment_field',
                                        left: { source: 'assignment_field', field: 'assignment_kind' },
                                        operator: '=',
                                        right: { source: 'constant', value: 'group' },
                                      },
                                    ],
                                  },
                                ]
                              : undefined,
                          })
                        }
                      />
                    }
                    label="Показывать условно: только для group assignment"
                  />
                </Box>
              ))}
            </Box>
          </Box>

          <Box className="rounded-lg border border-slate-200 bg-white p-4">
            <Box className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Typography variant="h6" className="font-semibold">
                Модификаторы
              </Typography>
              <Button startIcon={<AddIcon />} variant="outlined" onClick={addModifier}>
                Добавить
              </Button>
            </Box>
            <Box className="flex flex-col gap-3">
              {draft.modifiers.map((modifier) => (
                <Box key={modifier.id} className="rounded-lg border border-slate-200 p-3">
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        sm: 'minmax(0, 1fr) minmax(0, 120px)',
                        lg: 'minmax(0, 1fr) 130px 170px 140px',
                      },
                    }}
                  >
                    <TextField
                      label="Название"
                      value={modifier.title}
                      onChange={(event) => updateModifier(modifier.id, { title: event.target.value })}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={modifier.enabled}
                          onChange={(event) => updateModifier(modifier.id, { enabled: event.target.checked })}
                        />
                      }
                      label="Включён"
                    />
                    <FormControl>
                      <InputLabel>Условие</InputLabel>
                      <Select
                        label="Условие"
                        value={getConditionPreset(modifier.condition)}
                        onChange={(event) =>
                          updateModifier(modifier.id, {
                            condition: createConditionPreset(event.target.value as ConditionPreset, draft.criteria),
                          })
                        }
                      >
                        <MenuItem value="manual_true">Всегда</MenuItem>
                        <MenuItem value="deadline_late">Дата сдачи после дедлайна</MenuItem>
                        <MenuItem value="on_time_failed">Pass/fail критерий false</MenuItem>
                        <MenuItem value="team_undersized">Команд меньше желаемого</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <InputLabel>Цель</InputLabel>
                      <Select
                        label="Цель"
                        value={modifier.target.type}
                        onChange={(event) =>
                          updateModifier(modifier.id, {
                            target:
                              event.target.value === 'criteria'
                                ? { type: 'criteria', criterionIds: draft.criteria.filter((criterion) => criterion.type === 'points').map((criterion) => criterion.id) }
                                : { type: 'total' },
                          })
                        }
                      >
                        <MenuItem value="total">Итог</MenuItem>
                        <MenuItem value="criteria">Критерии</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  {modifier.target.type === 'criteria' && (
                    <Box className="mt-2 flex flex-wrap gap-1">
                      {draft.criteria.filter((criterion) => criterion.type === 'points').map((criterion) => (
                        <FormControlLabel
                          key={criterion.id}
                          control={
                            <Checkbox
                              checked={modifier.target.type === 'criteria' && modifier.target.criterionIds.includes(criterion.id)}
                              onChange={(event) => {
                                const currentIds = modifier.target.type === 'criteria' ? modifier.target.criterionIds : []
                                updateModifier(modifier.id, {
                                  target: {
                                    type: 'criteria',
                                    criterionIds: event.target.checked
                                      ? [...currentIds, criterion.id]
                                      : currentIds.filter((id) => id !== criterion.id),
                                  },
                                })
                              }}
                            />
                          }
                          label={criterion.title}
                        />
                      ))}
                    </Box>
                  )}
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      mt: 1.5,
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        md: '160px 160px minmax(0, 1fr)',
                      },
                    }}
                  >
                    <FormControl>
                      <InputLabel>Эффект</InputLabel>
                      <Select
                        label="Эффект"
                        value={modifier.effect.type}
                        onChange={(event) =>
                          updateModifier(modifier.id, {
                            effect:
                              event.target.value === 'multiply'
                                ? { type: 'multiply', multiplierSource: { type: 'constant', value: 1 } }
                                : { type: 'subtract', valueSource: { type: 'constant', value: 0 } },
                          })
                        }
                      >
                        <MenuItem value="subtract">Subtract</MenuItem>
                        <MenuItem value="multiply">Multiply</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <InputLabel>Источник</InputLabel>
                      <Select
                        label="Источник"
                        value={
                          modifier.effect.type === 'subtract'
                            ? modifier.effect.valueSource.type
                            : modifier.effect.multiplierSource.type
                        }
                        onChange={(event) => {
                          const sourceType = event.target.value as 'constant' | 'runtime'
                          updateModifier(modifier.id, {
                            effect:
                              modifier.effect.type === 'subtract'
                                ? {
                                    type: 'subtract',
                                    valueSource:
                                      sourceType === 'runtime'
                                        ? { type: 'runtime', fieldKey: 'latePenaltyPoints' }
                                        : { type: 'constant', value: 0 },
                                  }
                                : {
                                    type: 'multiply',
                                    multiplierSource:
                                      sourceType === 'runtime'
                                        ? { type: 'runtime', fieldKey: 'runtimeMultiplier' }
                                        : { type: 'constant', value: 1 },
                                  },
                          })
                        }}
                      >
                        <MenuItem value="constant">Константа</MenuItem>
                        <MenuItem value="runtime">Runtime</MenuItem>
                      </Select>
                    </FormControl>
                    {modifier.effect.type === 'subtract' && modifier.effect.valueSource.type === 'constant' && (
                      <TextField
                        label="Значение"
                        type="number"
                        value={modifier.effect.valueSource.value}
                        onChange={(event) =>
                          updateModifier(modifier.id, {
                            effect: { type: 'subtract', valueSource: { type: 'constant', value: Number(event.target.value) } },
                          })
                        }
                      />
                    )}
                    {modifier.effect.type === 'multiply' && modifier.effect.multiplierSource.type === 'constant' && (
                      <TextField
                        label="Множитель"
                        type="number"
                        value={modifier.effect.multiplierSource.value}
                        onChange={(event) =>
                          updateModifier(modifier.id, {
                            effect: { type: 'multiply', multiplierSource: { type: 'constant', value: Number(event.target.value) } },
                          })
                        }
                      />
                    )}
                    {modifier.effect.type === 'subtract' && modifier.effect.valueSource.type === 'runtime' && (
                      <TextField
                        label="Runtime key"
                        value={modifier.effect.valueSource.fieldKey}
                        onChange={(event) =>
                          updateModifier(modifier.id, {
                            effect: { type: 'subtract', valueSource: { type: 'runtime', fieldKey: event.target.value } },
                          })
                        }
                      />
                    )}
                    {modifier.effect.type === 'multiply' && modifier.effect.multiplierSource.type === 'runtime' && (
                      <TextField
                        label="Runtime key"
                        value={modifier.effect.multiplierSource.fieldKey}
                        onChange={(event) =>
                          updateModifier(modifier.id, {
                            effect: { type: 'multiply', multiplierSource: { type: 'runtime', fieldKey: event.target.value } },
                          })
                        }
                      />
                    )}
                  </Box>
                  <Button
                    sx={{ mt: 1 }}
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        modifiers: current.modifiers.filter((item) => item.id !== modifier.id),
                      }))
                    }
                  >
                    Удалить модификатор
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box
          className="flex min-w-0 flex-col gap-4"
          sx={{
            minWidth: 0,
            ...(inModal
              ? { gridColumn: 'auto' }
              : { gridColumn: { md: '1 / -1', xl: 'auto' } }),
          }}
        >
          <Box className="rounded-lg border border-slate-200 bg-white p-4" sx={{ minWidth: 0 }}>
            <Typography variant="h6" className="font-semibold">
              Библиотека критериев
            </Typography>
            <Box className="mt-2 flex flex-col gap-1">
              {library.map((criterion) => (
                <FormControlLabel
                  key={criterion.id}
                  control={
                    <Checkbox
                      checked={selectedLibraryIds.has(criterion.id)}
                      onChange={(event) => {
                        const next = new Set(selectedLibraryIds)
                        if (event.target.checked) next.add(criterion.id)
                        else next.delete(criterion.id)
                        setSelectedLibraryIds(next)
                      }}
                    />
                  }
                  label={`${criterion.title} · ${criterion.type}`}
                />
              ))}
            </Box>
            <Button
              sx={{ mt: 1 }}
              fullWidth
              variant="outlined"
              disabled={selectedLibraryIds.size === 0}
              onClick={insertFromLibrary}
            >
              Добавить выбранные
            </Button>
          </Box>

          <Box className="rounded-lg border border-slate-200 bg-white p-4" sx={{ minWidth: 0 }}>
            <Box className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Typography variant="h6" className="font-semibold">
                Предпросмотр
              </Typography>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Сценарий</InputLabel>
                <Select
                  label="Сценарий"
                  value={assignmentKind}
                  onChange={(event) => setAssignmentKind(event.target.value as 'individual' | 'group')}
                >
                  <MenuItem value="individual">Individual</MenuItem>
                  <MenuItem value="group">Group</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box className="flex flex-col gap-2">
              {draft.criteria.map((criterion) =>
                criterion.type === 'points' ? (
                  <TextField
                    key={criterion.id}
                    size="small"
                    type="number"
                    label={criterion.title}
                    value={criteriaValues[criterion.id] ?? criterion.score ?? 0}
                    onChange={(event) =>
                      setCriteriaValues((current) => ({
                        ...current,
                        [criterion.id]: Number(event.target.value),
                      }))
                    }
                  />
                ) : (
                  <FormControlLabel
                    key={criterion.id}
                    control={
                      <Checkbox
                        checked={(criteriaValues[criterion.id] as boolean | undefined) ?? criterion.passed ?? false}
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
                ),
              )}
              {runtimeFields.length > 0 && <Divider sx={{ my: 1 }} />}
              {runtimeFields.map((field) => (
                <TextField
                  key={field.key}
                  size="small"
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'datetime-local' : 'text'}
                  label={field.label}
                  value={String(runtimeValues[field.key] ?? defaultRuntimeValue(field))}
                  onChange={(event) =>
                    setRuntimeValues((current) => ({
                      ...current,
                      [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value,
                    }))
                  }
                />
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h4" className="font-semibold">
              {preview.finalScore.toFixed(1)} / {preview.maxScore}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              База: {preview.baseScore.toFixed(1)}
            </Typography>
            <Box className="mt-2 flex flex-col gap-1">
              {preview.criterionStates.map((state) => (
                <Typography key={state.criterionId} variant="caption" color="text.secondary">
                  {draft.criteria.find((criterion) => criterion.id === state.criterionId)?.title}: {state.visible ? 'visible' : 'hidden'}, {state.includedInTotal ? 'in total' : 'excluded'}
                  {state.reason ? ` · ${state.reason}` : ''}
                </Typography>
              ))}
              {preview.modifierTraces.map((trace) => (
                <Typography key={trace.modifierId} variant="caption" color={trace.applied ? 'success.main' : 'text.secondary'}>
                  {trace.title}: {trace.applied ? `${trace.before.toFixed(1)} → ${trace.after.toFixed(1)}` : trace.reason}
                </Typography>
              ))}
            </Box>
            {onApplyGrade && (
              <Button sx={{ mt: 2 }} fullWidth variant="contained" onClick={() => onApplyGrade(preview.finalScore)}>
                Подставить итоговую оценку
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Импорт JSON-шаблона</DialogTitle>
        <DialogContent>
          {importErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {importErrors.join('; ')}
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            minRows={12}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder="{ ... }"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={importTemplate}>
            Импортировать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteId != null} onClose={() => setDeleteId(null)}>
        <DialogTitle>Удалить шаблон?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Шаблон останется доступен только если ранее был экспортирован в JSON.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button color="error" variant="contained" onClick={deleteTemplate}>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
