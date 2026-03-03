import { useEffect, useState } from 'react'
import { Box, Button, Card, CardContent, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import type { User } from '../../../auth/model/types'
import { useAuth } from '../../../auth/model/AuthContext'
import { useCurrentUserQuery, useUpdateProfileMutation } from '../../model/profileQueries'

type ProfileErrors = {
  fullName?: string
  birthDate?: string
  general?: string
}

export function ProfileTab() {
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useCurrentUserQuery(true)
  const updateProfileMutation = useUpdateProfileMutation()

  useEffect(() => {
    if (data) {
      setUser(data)
      setFullName(`${data.first_name} ${data.last_name}`.trim())
      setBirthDate(data.birth_date)
      setLoading(false)
    } else if (!isLoading) {
      setLoading(false)
      if (isError) {
        setErrors({ general: 'Не удалось загрузить профиль' })
      }
    }
  }, [data, isLoading, isError])

  const handleSave = async () => {
    const nextErrors: ProfileErrors = {}
    if (!fullName.trim()) {
      nextErrors.fullName = 'Укажите ФИО'
    }
    if (!birthDate) {
      nextErrors.birthDate = 'Укажите дату рождения'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const updated = await updateProfileMutation.mutateAsync({
        fullName,
        birthDate,
      })
      setUser(updated)
      setFullName(`${updated.first_name} ${updated.last_name}`.trim())
      setBirthDate(updated.birth_date)
      setIsEditing(false)
    } catch {
      setErrors({ general: 'Не удалось сохранить профиль' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  if (loading && !user) {
    return null
  }

  return (
    <Box className="mt-4 sm:mt-8 md:mt-10 max-w-xl w-full mx-auto px-3 sm:px-4 pb-24 md:pb-10">
      <Card>
        <CardContent className="space-y-4">
          {errors.general && (
            <Typography variant="body2" color="error">
              {errors.general}
            </Typography>
          )}

          <TextField
            label="ФИО"
            fullWidth
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value)
              setErrors((prev) => ({ ...prev, fullName: undefined }))
            }}
            disabled={!isEditing}
            error={Boolean(errors.fullName)}
            helperText={errors.fullName}
          />

          <TextField
            label="Email"
            fullWidth
            value={user?.email ?? ''}
            InputProps={{ readOnly: true }}
          />

          <TextField
            label="Дата рождения"
            type="date"
            fullWidth
            value={birthDate}
            onChange={(event) => {
              setBirthDate(event.target.value)
              setErrors((prev) => ({ ...prev, birthDate: undefined }))
            }}
            disabled={!isEditing}
            error={Boolean(errors.birthDate)}
            helperText={errors.birthDate}
            InputLabelProps={{ shrink: true }}
          />

          <Box className="flex gap-2 mt-2">
            {isEditing ? (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={saving}
              >
                Сохранить
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setIsEditing(true)}
              >
                Редактировать
              </Button>
            )}
            <Button variant="outlined" color="secondary" onClick={handleLogout}>
              Выйти
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default ProfileTab


