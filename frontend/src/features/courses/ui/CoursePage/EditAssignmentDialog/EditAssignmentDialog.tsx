import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CloseIcon from '@mui/icons-material/Close'
import { getAssignment, updateAssignment, uploadFiles } from '../../../api/coursesApi'
import { isValidUrl } from '../../../utils/urlValidation'
import type { Assignment, AssignmentKind } from '../../../model/types'
import {
  GroupSettingsFields,
  groupSettingsFromAssignment,
  validateGroupSettings,
  buildGroupFields,
} from '../GroupSettingsFields/GroupSettingsFields'
import type { GroupSettingsValue } from '../GroupSettingsFields/GroupSettingsFields'
import {
  getAssignmentGradingPreference,
  setAssignmentGradingPreference,
} from '../../../../../entities/grading/model/assignmentGradingPreferences'
import {
  GradingTemplateWorkspace,
  type GradingTemplateWorkspaceActiveSync,
} from '../../../../../features/grading-template-form/ui/GradingTemplateWorkspace'

type EditAssignmentDialogProps = {
  open: boolean
  onClose: () => void
  courseId: string
  assignmentId: string
  onSaved: () => void
}

/** Возвращает true, если изменились параметры, которые могут затронуть уже сформированные команды */
function hasGroupSettingsChanged(
  original: Assignment,
  newType: AssignmentKind,
  newSettings: GroupSettingsValue,
): boolean {
  if (original.assignment_kind !== 'group') return false
  if (newType !== 'group') return true
  const newSize = parseInt(newSettings.desiredTeamSize, 10)
  const newTeamCount = newSettings.teamCount.trim()
    ? parseInt(newSettings.teamCount, 10)
    : null
  return (
    original.desired_team_size !== newSize ||
    original.team_distribution_type !== newSettings.teamDistributionType ||
    (original.team_count ?? null) !== newTeamCount
  )
}

function isoToLocalDatetime(iso?: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

export function EditAssignmentDialog({
  open,
  onClose,
  courseId,
  assignmentId,
  onSaved,
}: EditAssignmentDialogProps) {
  const [loadingData, setLoadingData] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [original, setOriginal] = useState<Assignment | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [links, setLinks] = useState('')
  const [deadline, setDeadline] = useState('')
  const [maxGrade, setMaxGrade] = useState<string>('100')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [assignmentKind, setAssignmentKind] = useState<AssignmentKind>('individual')
  const [groupSettings, setGroupSettings] = useState<GroupSettingsValue>(
    groupSettingsFromAssignment(null),
  )

  const [confirmOpen, setConfirmOpen] = useState(false)

  const [flexibleGradingEnabled, setFlexibleGradingEnabled] = useState(true)
  const [gradingTemplateId, setGradingTemplateId] = useState('')
  /** Только из localStorage при открытии — не обновлять при onActiveTemplateChange, иначе сбросит черновик в редакторе. */
  const [workspacePreferredTemplateId, setWorkspacePreferredTemplateId] = useState<string | undefined>()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGradingWorkspaceSync = useCallback((state: GradingTemplateWorkspaceActiveSync) => {
    setGradingTemplateId(state.selectedTemplateId)
  }, [])

  // Загружаем полные данные задания при каждом открытии
  useEffect(() => {
    if (!open || !assignmentId) return
    setLoadingData(true)
    setLoadError(null)
    setOriginal(null)

    getAssignment(courseId, assignmentId)
      .then((a) => {
        setOriginal(a)
        setTitle(a.title)
        setContent(a.body ?? '')
        setLinks((a.links ?? []).join('\n'))
        setDeadline(isoToLocalDatetime(a.deadline))
        setMaxGrade(String(a.max_grade ?? 100))
        setFiles([])
        setError(null)
        // Если assignment_kind не вернулся — определяем по наличию групповых полей
        const inferredKind: AssignmentKind =
          a.assignment_kind === 'group' ||
          a.desired_team_size != null ||
          a.team_distribution_type != null ||
          a.team_submission_rule != null
            ? 'group'
            : 'individual'
        setAssignmentKind(inferredKind)
        setGroupSettings(groupSettingsFromAssignment(a))
        const pref = getAssignmentGradingPreference(assignmentId)
        setFlexibleGradingEnabled(pref == null ? true : pref.enabled)
        const tid = pref?.templateId ?? ''
        setGradingTemplateId(tid)
        setWorkspacePreferredTemplateId(tid || undefined)
      })
      .catch(() => setLoadError('Не удалось загрузить задание'))
      .finally(() => setLoadingData(false))
  }, [open, courseId, assignmentId])

  const handleClose = () => {
    if (!loading) onClose()
  }

  const runSave = async () => {
    if (!original) return
    setLoading(true)
    setError(null)
    try {
      const trimmedTitle = title.trim()
      const trimmedContent = content.trim()
      const trimmedDeadline = deadline.trim()

      const fileIds = files.length > 0 ? await uploadFiles(files) : (original.file_ids ?? [])
      const deadlineIso =
        trimmedDeadline && !isNaN(new Date(trimmedDeadline).getTime())
          ? new Date(trimmedDeadline).toISOString()
          : undefined

      const linkLines = links
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

      await updateAssignment(courseId, assignmentId, {
        title: trimmedTitle,
        body: trimmedContent,
        links: linkLines.length > 0 ? linkLines : undefined,
        deadline: deadlineIso,
        max_grade: parseInt(maxGrade, 10),
        file_ids: fileIds,
        assignment_kind: assignmentKind,
        ...(assignmentKind === 'group' ? buildGroupFields(groupSettings) : {}),
      })
      setAssignmentGradingPreference(assignmentId, {
        enabled: flexibleGradingEnabled,
        templateId:
          flexibleGradingEnabled && gradingTemplateId ? gradingTemplateId : null,
      })
      onClose()
      onSaved()
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'FILE_TOO_LARGE') {
          setError('Файл слишком большой')
        } else if (err.message === 'FORBIDDEN') {
          setError('Нет прав для редактирования задания')
        } else if (err.message === 'NOT_FOUND') {
          setError('Задание не найдено')
        } else {
          setError('Не удалось сохранить задание')
        }
      } else {
        setError('Не удалось сохранить задание')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    if (!trimmedTitle) {
      setError('Введите название задания')
      return
    }
    if (!trimmedContent) {
      setError('Введите описание задания')
      return
    }

    const parsedMaxGrade = maxGrade.trim() ? parseInt(maxGrade, 10) : 100
    if (isNaN(parsedMaxGrade) || parsedMaxGrade < 1 || parsedMaxGrade > 1000) {
      setError('Максимальный балл должен быть от 1 до 1000')
      return
    }

    const trimmedDeadline = deadline.trim()
    if (trimmedDeadline) {
      const deadlineDate = new Date(trimmedDeadline)
      if (isNaN(deadlineDate.getTime())) {
        setError('Некорректная дата дедлайна')
        return
      }
    }

    const linkLines = links
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    if (linkLines.length > 0) {
      const invalidIndex = linkLines.findIndex((line) => !isValidUrl(line))
      if (invalidIndex >= 0) {
        setError(`Некорректная ссылка в строке ${invalidIndex + 1}: «${linkLines[invalidIndex]}»`)
        return
      }
    }

    if (assignmentKind === 'group') {
      const groupError = validateGroupSettings(groupSettings, {
        assignmentDeadline: trimmedDeadline || undefined,
      })
      if (groupError) {
        setError(groupError)
        return
      }
    }

    // Предупреждение, если меняются настройки, влияющие на существующие команды
    if (original && hasGroupSettingsChanged(original, assignmentKind, groupSettings)) {
      setConfirmOpen(true)
      return
    }

    await runSave()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected) {
      setFiles((prev) => [...prev, ...Array.from(selected)])
    }
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={flexibleGradingEnabled ? 'xl' : 'sm'}
        fullWidth
        aria-labelledby="edit-assignment-dialog-title"
      >
        <DialogTitle id="edit-assignment-dialog-title">Редактировать задание</DialogTitle>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <DialogContent
            className="flex flex-col gap-4"
            sx={flexibleGradingEnabled ? { maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto' } : undefined}
          >
            {loadingData ? (
              <Box className="flex justify-center py-8">
                <CircularProgress size={32} />
              </Box>
            ) : loadError ? (
              <Typography variant="body2" color="error">
                {loadError}
              </Typography>
            ) : (
              <>
                <TextField
                  label="Название"
                  required
                  fullWidth
                  size="small"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  inputProps={{ 'aria-label': 'Название задания' }}
                />
                <TextField
                  label="Описание"
                  required
                  fullWidth
                  multiline
                  minRows={4}
                  size="small"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  inputProps={{ 'aria-label': 'Описание задания' }}
                />
                <TextField
                  label="Ссылки (опционально, по одной на строку)"
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  value={links}
                  onChange={(e) => setLinks(e.target.value)}
                  placeholder="https://example.com"
                  inputProps={{ 'aria-label': 'Ссылки' }}
                />
                <TextField
                  label="Дедлайн"
                  fullWidth
                  size="small"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ 'aria-label': 'Дедлайн' }}
                  helperText="Оставьте пустым, чтобы убрать дедлайн"
                />
                <TextField
                  label="Максимальный балл"
                  fullWidth
                  size="small"
                  type="number"
                  value={maxGrade}
                  onChange={(e) => setMaxGrade(e.target.value)}
                  inputProps={{ min: 1, max: 1000, 'aria-label': 'Максимальный балл' }}
                  helperText="1 = зачёт/незачёт, >1 = числовая шкала"
                />

                <FormControl fullWidth size="small">
                  <InputLabel id="edit-assignment-type-label">Тип задания</InputLabel>
                  <Select
                    labelId="edit-assignment-type-label"
                    label="Тип задания"
                    value={assignmentKind}
                    onChange={(e) => setAssignmentKind(e.target.value as AssignmentKind)}
                  >
                    <MenuItem value="individual">Индивидуальное</MenuItem>
                    <MenuItem value="group">Групповое</MenuItem>
                  </Select>
                </FormControl>

                {assignmentKind === 'group' && (
                  <GroupSettingsFields
                    value={groupSettings}
                    onChange={setGroupSettings}
                    disabled={loading}
                    assignmentDeadline={deadline}
                  />
                )}

                <Divider />
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={flexibleGradingEnabled}
                        onChange={(_, checked) => {
                          setFlexibleGradingEnabled(checked)
                          if (!checked) setGradingTemplateId('')
                        }}
                        disabled={loading}
                        inputProps={{ 'aria-label': 'Гибкое оценивание' }}
                      />
                    }
                    label="Гибкое оценивание"
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: -0.5, mb: 1 }}>
                    Локально в браузере. Ниже — редактор шаблона; выбранный шаблон подставится в задание при сохранении.
                  </Typography>
                  {flexibleGradingEnabled && original && (
                    <Box
                      sx={{
                        minHeight: 260,
                        maxHeight: { xs: '52vh', sm: '58vh' },
                        overflow: 'auto',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        p: { xs: 0.5, sm: 1 },
                      }}
                    >
                      <GradingTemplateWorkspace
                        assignment={original}
                        embedded
                        inModal
                        preferredTemplateId={workspacePreferredTemplateId}
                        onActiveTemplateChange={handleGradingWorkspaceSync}
                      />
                    </Box>
                  )}
                </Box>

                <Box>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    aria-label="Прикрепить файлы"
                  />
                  <Button
                    component="span"
                    variant="outlined"
                    size="small"
                    startIcon={<AttachFileOutlinedIcon />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Прикрепить файлы
                  </Button>
                  {files.length > 0 && (
                    <Box className="mt-2 flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <Box
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm"
                        >
                          <Typography variant="body2" className="truncate max-w-[120px]">
                            {f.name}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label={`Удалить ${f.name}`}
                            onClick={() => removeFile(i)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>

                {error && (
                  <Typography variant="body2" color="error">
                    {error}
                  </Typography>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={loading}>
              Отмена
            </Button>
            {!loadingData && !loadError && (
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? 'Сохранение…' : 'Сохранить'}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>

      {/* Предупреждение при изменении настроек, затрагивающих существующие команды */}
      <Dialog
        open={confirmOpen}
        onClose={() => !loading && setConfirmOpen(false)}
        aria-labelledby="confirm-group-change-title"
      >
        <DialogTitle id="confirm-group-change-title">Изменение групповых настроек</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы изменили размер команды или способ формирования команд. Это может затронуть уже
            сформированные команды: некоторые из них могут превысить новый лимит или стать
            некорректными. Потребуется ручное вмешательство.
          </DialogContentText>
          <DialogContentText sx={{ mt: 1 }}>
            Продолжить сохранение?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            color="warning"
            variant="contained"
            disabled={loading}
            onClick={async () => {
              setConfirmOpen(false)
              await runSave()
            }}
          >
            {loading ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
