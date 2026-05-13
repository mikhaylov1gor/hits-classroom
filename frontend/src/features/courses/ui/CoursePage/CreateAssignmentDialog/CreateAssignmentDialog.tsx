import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
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
import LinkIcon from '@mui/icons-material/Link'
import {
  createAssignment,
  deleteAssignment,
  generateBalancedTeams,
  generateRandomTeams,
  saveTeams,
  uploadFiles,
} from '../../../api/coursesApi'
import { isValidUrl } from '../../../utils/urlValidation'
import { getLinkHref } from '../../../utils/urlValidation'
import type { Assignment, AssignmentKind, Member } from '../../../model/types'
import {
  GroupSettingsFields,
  DEFAULT_GROUP_SETTINGS,
  validateGroupSettings,
  buildGroupFields,
} from '../GroupSettingsFields/GroupSettingsFields'
import type { GroupSettingsValue } from '../GroupSettingsFields/GroupSettingsFields'
import { ManualTeamsSetup } from '../../Teams/ManualTeamsSetup'
import type { ManualTeamDraft } from '../../Teams/ManualTeamsSetup'
import { setAssignmentGradingPreference } from '../../../../../entities/grading/model/assignmentGradingPreferences'
import {
  GradingTemplateWorkspace,
  type GradingTemplateWorkspaceActiveSync,
} from '../../../../../features/grading-template-form/ui/GradingTemplateWorkspace'

type CreateAssignmentDialogProps = {
  open: boolean
  onClose: () => void
  courseId: string
  onCreated: () => void
  courseMembers?: Member[]
}

export function CreateAssignmentDialog({
  open,
  onClose,
  courseId,
  onCreated,
  courseMembers = [],
}: CreateAssignmentDialogProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [links, setLinks] = useState<string[]>([])
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null)
  const [deadline, setDeadline] = useState('')
  const [maxGrade, setMaxGrade] = useState<string>('100')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [assignmentKind, setAssignmentKind] = useState<AssignmentKind>('individual')
  const [groupSettings, setGroupSettings] = useState<GroupSettingsValue>(DEFAULT_GROUP_SETTINGS)
  const [manualTeams, setManualTeams] = useState<ManualTeamDraft[]>([])

  const [flexibleGradingEnabled, setFlexibleGradingEnabled] = useState(false)
  const [gradingTemplateId, setGradingTemplateId] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isManual = assignmentKind === 'group' && groupSettings.teamDistributionType === 'manual'
  const students = courseMembers.filter((m) => m.role === 'student')
  const desiredSize = parseInt(groupSettings.desiredTeamSize, 10)
  const maxPerTeam = !isNaN(desiredSize) && desiredSize >= 2 ? desiredSize : undefined

  const trimmedExpectedTeams = groupSettings.teamCount.trim()
  const parsedExpectedTeams =
    trimmedExpectedTeams !== '' ? parseInt(trimmedExpectedTeams, 10) : NaN
  const hasValidExpectedTeamCount =
    !isNaN(parsedExpectedTeams) && parsedExpectedTeams >= 1
  const manualTeamsExceedExpected =
    isManual && hasValidExpectedTeamCount && manualTeams.length > parsedExpectedTeams

  const gradingPreviewAssignment = useMemo((): Assignment => {
    const mg = parseInt(maxGrade, 10)
    let deadlineIso: string | null = null
    if (deadline.trim()) {
      const d = new Date(deadline)
      if (!isNaN(d.getTime())) deadlineIso = d.toISOString()
    }
    const base: Assignment = {
      id: 'create-assignment-draft',
      course_id: courseId,
      title: title.trim() || 'Черновик задания',
      body: content.trim() || undefined,
      max_grade: !isNaN(mg) && mg >= 1 ? mg : 100,
      deadline: deadlineIso,
      assignment_kind: assignmentKind,
    }
    if (assignmentKind === 'group') {
      return { ...base, ...buildGroupFields(groupSettings) } as Assignment
    }
    return base
  }, [courseId, title, content, maxGrade, deadline, assignmentKind, groupSettings])

  const handleGradingWorkspaceSync = useCallback((state: GradingTemplateWorkspaceActiveSync) => {
    setGradingTemplateId(state.selectedTemplateId)
  }, [])

  const resetForm = () => {
    setTitle('')
    setContent('')
    setLinks([])
    setShowLinkDialog(false)
    setLinkUrl('')
    setLinkUrlError(null)
    setDeadline('')
    setMaxGrade('100')
    setFiles([])
    setError(null)
    setAssignmentKind('individual')
    setGroupSettings(DEFAULT_GROUP_SETTINGS)
    setManualTeams([])
    setFlexibleGradingEnabled(false)
    setGradingTemplateId('')
  }

  const handleClose = () => {
    if (!loading) {
      resetForm()
      onClose()
    }
  }

  const handleAddLink = () => {
    const trimmed = linkUrl.trim()
    if (!trimmed) return
    if (!isValidUrl(trimmed)) {
      setLinkUrlError('Некорректная ссылка')
      return
    }
    setLinkUrlError(null)
    setLinks((prev) => [...prev, trimmed])
    setLinkUrl('')
    setShowLinkDialog(false)
  }

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
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
      if (deadlineDate <= new Date()) {
        setError('Дедлайн должен быть в будущем')
        return
      }
    }

    if (assignmentKind === 'group') {
      if (students.length < 2) {
        setError('Для группового задания нужно не менее 2 студентов в классе')
        return
      }
      const groupError = validateGroupSettings(groupSettings, {
        assignmentDeadline: trimmedDeadline || undefined,
      })
      if (groupError) {
        setError(groupError)
        return
      }
    }

    if (isManual) {
      if (manualTeamsExceedExpected) {
        setError(
          `Создано команд (${manualTeams.length}) больше, чем указано в поле «Количество команд» (${parsedExpectedTeams}). Удалите лишние команды внизу списка или увеличьте число.`,
        )
        return
      }
      if (manualTeams.length === 0) {
        setError('Добавьте хотя бы одну команду')
        return
      }
      const emptyTeam = manualTeams.find((t) => t.memberIds.length === 0)
      if (emptyTeam) {
        setError(`Команда «${emptyTeam.name}» пуста — удалите её или добавьте участников`)
        return
      }
      if (maxPerTeam !== undefined) {
        const overflowTeam = manualTeams.find((t) => t.memberIds.length > maxPerTeam)
        if (overflowTeam) {
          setError(`Команда «${overflowTeam.name}» превышает максимальный размер (${maxPerTeam})`)
          return
        }
      }
    }

    setLoading(true)
    try {
      const fileIds = files.length > 0 ? await uploadFiles(files) : []
      const deadlineIso =
        trimmedDeadline && !isNaN(new Date(trimmedDeadline).getTime())
          ? new Date(trimmedDeadline).toISOString()
          : undefined

      const created = await createAssignment(courseId, {
        title: trimmedTitle,
        body: trimmedContent,
        links: links.length > 0 ? links : undefined,
        deadline: deadlineIso,
        max_grade: parsedMaxGrade,
        file_ids: fileIds,
        assignment_kind: assignmentKind,
        ...(assignmentKind === 'group' ? buildGroupFields(groupSettings) : {}),
      })

      if (assignmentKind === 'group') {
        const distType = groupSettings.teamDistributionType
        try {
          if (distType === 'random') {
            await generateRandomTeams(courseId, created.id)
          } else if (distType === 'balanced') {
            await generateBalancedTeams(courseId, created.id)
          } else if (distType === 'manual' && manualTeams.length > 0) {
            await saveTeams(
              courseId,
              created.id,
              manualTeams.map((t) => ({ name: t.name, member_ids: t.memberIds })),
            )
          }
        } catch (teamErr) {
          // Откатываем: удаляем только что созданное задание
          await deleteAssignment(courseId, created.id).catch(() => undefined)
          throw teamErr
        }
      }

      setAssignmentGradingPreference(created.id, {
        enabled: flexibleGradingEnabled,
        templateId:
          flexibleGradingEnabled && gradingTemplateId
            ? gradingTemplateId
            : null,
      })

      resetForm()
      onClose()
      onCreated()
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'FILE_TOO_LARGE') {
          setError('Файл слишком большой')
        } else if (err.message === 'FORBIDDEN') {
          setError('Нет прав для создания задания')
        } else {
          setError('Не удалось создать задание')
        }
      } else {
        setError('Не удалось создать задание')
      }
    } finally {
      setLoading(false)
    }
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
      maxWidth={
        flexibleGradingEnabled
          ? 'xl'
          : isManual && students.length > 0
            ? 'md'
            : 'sm'
      }
      fullWidth
      aria-labelledby="create-assignment-dialog-title"
    >
      <DialogTitle id="create-assignment-dialog-title">Новое задание</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent
          className="flex flex-col gap-4"
          sx={flexibleGradingEnabled ? { maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto' } : undefined}
        >
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
            label="Дедлайн"
            fullWidth
            size="small"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              'aria-label': 'Дедлайн',
              min: new Date(Date.now() + 60000).toISOString().slice(0, 16),
            }}
            helperText="Только дата в будущем"
          />
          <TextField
            label="Максимальный балл"
            fullWidth
            size="small"
            type="number"
            value={maxGrade}
            onChange={(e) => setMaxGrade(e.target.value)}
            inputProps={{ min: 1, max: 1000, 'aria-label': 'Максимальный балл' }}
            helperText="1 = зачёт/незачёт, >1 = числовая шкала (по умолчанию 100)"
          />

          <FormControl fullWidth size="small">
            <InputLabel id="assignment-type-label">Тип задания</InputLabel>
            <Select
              labelId="assignment-type-label"
              label="Тип задания"
              value={assignmentKind}
              onChange={(e) => setAssignmentKind(e.target.value as AssignmentKind)}
            >
              <MenuItem value="individual">Индивидуальное</MenuItem>
              <MenuItem value="group">Групповое</MenuItem>
            </Select>
          </FormControl>

          {assignmentKind === 'group' && students.length < 2 && (
            <Alert severity="warning">
              В классе недостаточно студентов для группового задания (есть {students.length}, нужно минимум 2)
            </Alert>
          )}

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
              label="Гибкое оценивание (шаблоны в браузере)"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: -0.5, mb: 1 }}>
              Вкладка на странице задания и рубрика при проверке. Ниже — полный редактор шаблонов (localStorage).
            </Typography>
            {flexibleGradingEnabled && (
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
                  assignment={gradingPreviewAssignment}
                  embedded
                  inModal
                  onActiveTemplateChange={handleGradingWorkspaceSync}
                />
              </Box>
            )}
          </Box>

          {isManual && students.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Распределение по командам
                </Typography>
                {manualTeamsExceedExpected && (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    Команд больше, чем в поле «Количество команд» ({parsedExpectedTeams}). Лишние
                    отмечены ниже — удалите их или измените число.
                  </Alert>
                )}
                <ManualTeamsSetup
                  students={students}
                  teams={manualTeams}
                  onChange={setManualTeams}
                  maxMembersPerTeam={maxPerTeam}
                  expectedTeamCount={hasValidExpectedTeamCount ? parsedExpectedTeams : null}
                  disabled={loading}
                />
              </Box>
            </>
          )}

          <Box>
            <Box className="flex flex-wrap gap-2">
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkIcon />}
                onClick={() => setShowLinkDialog(true)}
              >
                Добавить ссылку
              </Button>
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
            </Box>
            {(links.length > 0 || files.length > 0) && (
              <Box className="mt-2 flex flex-col gap-2 w-full">
                {links.map((url, i) => (
                  <Box
                    key={`link-${i}`}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm w-full"
                  >
                    <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography
                      variant="body2"
                      component="a"
                      href={getLinkHref(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate max-w-[160px] text-primary-600 hover:underline"
                    >
                      {url}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="Удалить ссылку"
                      onClick={() => removeLink(i)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                {files.map((f, i) => (
                  <Box
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm w-full"
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={loading || manualTeamsExceedExpected}>
            {loading ? 'Создание…' : 'Создать'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
    <Dialog
      open={showLinkDialog}
      onClose={() => {
        if (!loading) {
          setShowLinkDialog(false)
          setLinkUrl('')
          setLinkUrlError(null)
        }
      }}
      maxWidth="xs"
      fullWidth
      aria-labelledby="add-assignment-link-dialog-title"
    >
      <DialogTitle id="add-assignment-link-dialog-title">Добавить ссылку</DialogTitle>
      <DialogContent className="flex flex-col gap-2">
        <TextField
          autoFocus
          label="URL"
          fullWidth
          size="small"
          value={linkUrl}
          onChange={(e) => {
            setLinkUrl(e.target.value)
            if (linkUrlError) setLinkUrlError(null)
          }}
          error={Boolean(linkUrlError)}
          helperText={linkUrlError ?? 'Пример: https://example.com'}
          inputProps={{ 'aria-label': 'URL ссылки' }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setShowLinkDialog(false)
            setLinkUrl('')
            setLinkUrlError(null)
          }}
        >
          Отмена
        </Button>
        <Button onClick={handleAddLink} variant="contained" disabled={!linkUrl.trim()}>
          Добавить
        </Button>
      </DialogActions>
    </Dialog>
    </>
  )
}
