import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { createCourse, joinCourse, inviteTeacherByEmail } from '../../api/coursesApi'
import { useCourses } from '../../model/CoursesContext'
import type { CourseWithRole } from '../../model/types'

type AddCourseButtonProps = {
  onCourseAdded?: (course: CourseWithRole) => void
  variant?: 'icon' | 'fab'
}

type TabId = 'create' | 'join'

export function AddCourseButton({ onCourseAdded, variant = 'icon' }: AddCourseButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('create')

  const [createTitle, setCreateTitle] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherEmails, setTeacherEmails] = useState<string[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { addCourse } = useCourses() ?? { addCourse: () => {} }

  const resetForm = () => {
    setCreateTitle('')
    setTeacherEmail('')
    setTeacherEmails([])
    setCreateError(null)
    setJoinCode('')
    setJoinError(null)
  }

  const addTeacherEmail = () => {
    const email = teacherEmail.trim().toLowerCase()
    if (!email) return
    if (teacherEmails.includes(email)) return
    setTeacherEmails((prev) => [...prev, email])
    setTeacherEmail('')
  }

  const removeTeacherEmail = (email: string) => {
    setTeacherEmails((prev) => prev.filter((e) => e !== email))
  }

  const handleClose = () => {
    if (!createLoading && !joinLoading) {
      resetForm()
      setDialogOpen(false)
      setActiveTab('create')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    const trimmed = createTitle.trim()
    if (!trimmed) {
      setCreateError('Введите название курса')
      return
    }

    setCreateLoading(true)
    try {
      const created = await createCourse({ title: trimmed })
      for (const email of teacherEmails) {
        try {
          await inviteTeacherByEmail(created.id, email)
        } catch {
        }
      }
      resetForm()
      setDialogOpen(false)
      addCourse(created)
      onCourseAdded?.(created)
      const teacherMsg =
        teacherEmails.length > 0
          ? ` Добавлено преподавателей: ${teacherEmails.length}.`
          : ''
      setSuccessMessage(`Курс «${created.title}» создан.${teacherMsg}`)
    } catch {
      setCreateError('Не удалось создать курс')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(null)

    const trimmed = joinCode.trim()
    if (!trimmed) {
      setJoinError('Неверный или недействительный код курса')
      return
    }

    setJoinLoading(true)
    try {
      const joined = await joinCourse(trimmed)
      setJoinCode('')
      setDialogOpen(false)
      addCourse(joined)
      onCourseAdded?.(joined)
      setSuccessMessage(`Курс «${joined.title}» добавлен`)
    } catch (err) {
      if (err instanceof Error && err.message === 'COURSE_NOT_FOUND') {
        setJoinError('Неверный или недействительный код курса')
      } else {
        setJoinError('Не удалось присоединиться к курсу')
      }
    } finally {
      setJoinLoading(false)
    }
  }

  const triggerProps = {
    onClick: () => setDialogOpen(true),
    'aria-label': 'Добавить курс',
  }

  const isLoading = createLoading || joinLoading

  return (
    <>
      {variant === 'fab' ? (
        <Fab color="primary" size="medium" {...triggerProps}>
          <AddIcon />
        </Fab>
      ) : (
        <IconButton color="primary" size="medium" {...triggerProps}>
          <AddIcon />
        </IconButton>
      )}
      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        aria-labelledby="add-course-dialog-title"
      >
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            if (activeTab === 'create') handleCreate(e)
            else handleJoin(e)
          }}
          noValidate
        >
          <DialogTitle id="add-course-dialog-title">Добавить курс</DialogTitle>
          <Tabs
            value={activeTab}
            onChange={(_, v: TabId) => setActiveTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab label="Создать курс" value="create" />
            <Tab label="Присоединиться по коду" value="join" />
          </Tabs>
          <DialogContent className="flex flex-col gap-4 pt-4">
            {activeTab === 'create' && (
              <Box className="flex flex-col gap-4">
                <TextField
                  label="Название курса"
                  fullWidth
                  size="small"
                  value={createTitle}
                  onChange={(e) => {
                    setCreateTitle(e.target.value)
                    setCreateError(null)
                  }}
                  error={Boolean(createError)}
                  helperText={createError}
                  autoFocus
                />
                <Box className="flex flex-col gap-2">
                  <Typography variant="subtitle2" color="text.secondary">
                    Добавить преподавателей по email
                  </Typography>
                  <Box className="flex gap-2">
                    <TextField
                      size="small"
                      type="email"
                      label="Email преподавателя"
                      placeholder="teacher@example.com"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTeacherEmail()
                        }
                      }}
                      disabled={createLoading}
                      sx={{ flex: 1 }}
                    />
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={addTeacherEmail}
                      disabled={createLoading || !teacherEmail.trim()}
                    >
                      Добавить
                    </Button>
                  </Box>
                  {teacherEmails.length > 0 && (
                    <Box className="flex flex-wrap gap-1">
                      {teacherEmails.map((email) => (
                        <Chip
                          key={email}
                          label={email}
                          size="small"
                          onDelete={() => removeTeacherEmail(email)}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            )}
            {activeTab === 'join' && (
              <TextField
                label="Код курса"
                fullWidth
                size="small"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value)
                  setJoinError(null)
                }}
                error={Boolean(joinError)}
                helperText={joinError}
                autoFocus
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={handleClose} disabled={isLoading}>
              Отмена
            </Button>
            {activeTab === 'create' ? (
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={createLoading || !createTitle.trim()}
              >
                {createLoading ? 'Создание…' : 'Создать'}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={joinLoading || !joinCode.trim()}
              >
                {joinLoading ? 'Присоединение…' : 'Присоединиться'}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
