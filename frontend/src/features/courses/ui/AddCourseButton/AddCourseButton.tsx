import { useState } from 'react'
import {
  Box,
  Button,
  Fab,
  IconButton,
  Popover,
  Snackbar,
  TextField,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { joinCourse } from '../../api/coursesApi'
import { useCourses } from '../../model/CoursesContext'
import type { CourseWithRole } from '../../model/types'

type AddCourseButtonProps = {
  onCourseAdded?: (course: CourseWithRole) => void
  variant?: 'icon' | 'fab'
}

export function AddCourseButton({ onCourseAdded, variant = 'icon' }: AddCourseButtonProps) {
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { addCourse } = useCourses() ?? { addCourse: () => {} }

  const isPopoverOpen = Boolean(popoverAnchor)

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault()
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
      setPopoverAnchor(null)
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
    onClick: (e: React.MouseEvent<HTMLElement>) => setPopoverAnchor(e.currentTarget),
    'aria-label': 'Добавить курс',
  }

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
      <Popover
        open={isPopoverOpen}
        anchorEl={popoverAnchor}
        onClose={() => {
          setPopoverAnchor(null)
          setJoinError(null)
        }}
        anchorOrigin={
          variant === 'fab'
            ? { vertical: 'top', horizontal: 'center' }
            : { vertical: 'bottom', horizontal: 'left' }
        }
        transformOrigin={
          variant === 'fab'
            ? { vertical: 'bottom', horizontal: 'center' }
            : { vertical: 'top', horizontal: 'left' }
        }
        slotProps={{
          paper: {
            sx:
              variant === 'fab'
                ? { width: 'min(320px, calc(100vw - 32px))', maxWidth: 'calc(100vw - 32px)' }
                : undefined,
          },
        }}
      >
        <Box
          component="form"
          noValidate
          onSubmit={handleJoin}
          className="flex flex-col gap-3 p-4 min-w-[280px] max-w-full"
        >
          <TextField
            label="Код курса"
            fullWidth
            size="small"
            value={joinCode}
            onChange={(event) => {
              setJoinCode(event.target.value)
              setJoinError(null)
            }}
            error={Boolean(joinError)}
            helperText={joinError}
            autoFocus
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={joinLoading}
          >
            Присоединиться
          </Button>
        </Box>
      </Popover>
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
