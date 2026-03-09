import { useState } from 'react'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { updateCourse } from '../../api/coursesApi'
import type { CourseWithRole } from '../../model/types'

type CourseHeaderProps = {
  course: CourseWithRole
  onCourseUpdated: (course: CourseWithRole) => void
}

export function CourseHeader({ course, onCourseUpdated }: CourseHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(course.title)
  const [renameLoading, setRenameLoading] = useState(false)

  const isOwner = course.role === 'owner'

  const handleSaveRename = async () => {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === course.title) {
      setIsEditing(false)
      return
    }
    setRenameLoading(true)
    try {
      const updated = await updateCourse(course.id, { title: trimmed })
      onCourseUpdated(updated)
      setIsEditing(false)
    } catch {
    } finally {
      setRenameLoading(false)
    }
  }

  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex flex-wrap items-center justify-between gap-2">
        <Box className="flex items-center gap-2 flex-1 min-w-0">
          {isEditing ? (
            <Box className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <TextField
                size="small"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename()
                  if (e.key === 'Escape') {
                    setEditTitle(course.title)
                    setIsEditing(false)
                  }
                }}
                autoFocus
                disabled={renameLoading}
                className="flex-1 min-w-0"
                inputProps={{ 'aria-label': 'Название курса' }}
              />
              <Box className="flex gap-2">
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSaveRename}
                  disabled={renameLoading || !editTitle.trim()}
                >
                  Сохранить
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setEditTitle(course.title)
                    setIsEditing(false)
                  }}
                  disabled={renameLoading}
                >
                  Отмена
                </Button>
              </Box>
            </Box>
          ) : (
            <>
              <Typography
                variant="h5"
                className="font-semibold text-slate-900 truncate"
                sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
              >
                {course.title}
              </Typography>
              {isOwner && (
                <IconButton
                  size="small"
                  aria-label="Переименовать курс"
                  onClick={() => setIsEditing(true)}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}
