import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Link, TextField, Typography } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { loginApi, registerApi } from '../../api/authApi'
import type { RegisterForm as RegisterFormValues } from '../../model/types'
import { useAuth } from '../../model/AuthContext'

type RegisterErrors = {
  email?: string
  password?: string
  confirmPassword?: string
  fullName?: string
  birthDate?: string
  general?: string
}

export function RegisterForm() {
  const [form, setForm] = useState<RegisterFormValues>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    birthDate: '',
  })
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const { applyLogin } = useAuth()
  const navigate = useNavigate()

  const handleChange =
    (field: keyof RegisterFormValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }))
    }

  const validate = (): boolean => {
    const nextErrors: RegisterErrors = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!form.email.trim()) {
      nextErrors.email = 'Укажите email'
    } else if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = 'Введите корректный email'
    }

    if (!form.password) {
      nextErrors.password = 'Укажите пароль'
    }

    const trimmedFullName = form.fullName.trim()
    const words = trimmedFullName.split(/\s+/).filter(Boolean)
    if (!trimmedFullName) {
      nextErrors.fullName = 'Укажите ФИО'
    } else if (words.length < 2) {
      nextErrors.fullName = 'Введите имя и фамилию (минимум два слова)'
    }

    if (!form.birthDate) {
      nextErrors.birthDate = 'Укажите дату рождения'
    } else {
      const birthDate = new Date(form.birthDate + 'T00:00:00')
      const today = new Date()
      const minBirthDate = new Date(
        today.getFullYear() - 14,
        today.getMonth(),
        today.getDate(),
      )
      if (birthDate > minBirthDate) {
        nextErrors.birthDate = 'Вам должно быть не менее 14 лет'
      }
    }

    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Пароли не совпадают'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) {
      return
    }

    setSubmitting(true)
    try {
      await registerApi(form)

      const loginResponse = await loginApi({
        email: form.email,
        password: form.password,
      })

      applyLogin(loginResponse)
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
        setErrors({ email: 'Email уже занят' })
      } else {
        setErrors({ general: 'Не удалось завершить регистрацию. Попробуйте ещё раз.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] flex items-center justify-center py-6 px-4 sm:py-10">
      <Card className="w-full max-w-md shadow-xl border border-slate-100">
        <CardContent className="p-4 sm:p-6 md:p-8 space-y-4">
          <Typography variant="h5" className="font-semibold text-slate-900">
            Регистрация в hits-classroom
          </Typography>

          {errors.general && (
            <Alert severity="error" role="alert">
              {errors.general}
            </Alert>
          )}

          <Box component="form" noValidate onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={form.email}
              onChange={handleChange('email')}
              error={Boolean(errors.email)}
              helperText={errors.email}
              autoComplete="email"
            />

            <TextField
              label="Пароль"
              type="password"
              fullWidth
              value={form.password}
              onChange={handleChange('password')}
              error={Boolean(errors.password)}
              helperText={errors.password}
              autoComplete="new-password"
            />

            <TextField
              label="Подтвердите пароль"
              type="password"
              fullWidth
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword}
              autoComplete="new-password"
            />

            <TextField
              label="ФИО"
              fullWidth
              value={form.fullName}
              onChange={handleChange('fullName')}
              error={Boolean(errors.fullName)}
              helperText={errors.fullName}
              placeholder="Имя Фамилия"
            />

            <TextField
              label="Дата рождения"
              type="date"
              fullWidth
              value={form.birthDate}
              onChange={handleChange('birthDate')}
              error={Boolean(errors.birthDate)}
              helperText={errors.birthDate}
              InputLabelProps={{ shrink: true }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={submitting}
            >
              Создать аккаунт
            </Button>

            <Typography variant="body2" className="text-slate-600 text-center">
              Уже есть аккаунт?{' '}
              <Link component={RouterLink} to="/login" color="primary">
                Войти
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default RegisterForm


