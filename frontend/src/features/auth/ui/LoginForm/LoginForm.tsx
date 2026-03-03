import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Link, TextField, Typography } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { loginApi } from '../../api/authApi'
import type { LoginForm as LoginFormValues } from '../../model/types'
import { useAuth } from '../../model/AuthContext'

type LoginErrors = {
  email?: string
  password?: string
  general?: string
}

export function LoginForm() {
  const [form, setForm] = useState<LoginFormValues>({ email: '', password: '' })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const { applyLogin } = useAuth()
  const navigate = useNavigate()

  const handleChange =
    (field: keyof LoginFormValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }))
    }

  const validate = (): boolean => {
    const nextErrors: LoginErrors = {}

    if (!form.email.trim()) {
      nextErrors.email = 'Укажите email'
    }

    if (!form.password) {
      nextErrors.password = 'Укажите пароль'
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (form.email && !emailPattern.test(form.email)) {
      nextErrors.email = 'Введите корректный email'
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
      const response = await loginApi(form)
      applyLogin(response)
      navigate('/', { replace: true })
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'INVALID_CREDENTIALS'
          ? 'Неверный email или пароль'
          : 'Не удалось выполнить вход. Попробуйте ещё раз.'
      setErrors({ general: message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] flex items-center justify-center py-6 px-4 sm:py-10">
      <Card className="w-full max-w-md shadow-xl border border-slate-100">
        <CardContent className="p-4 sm:p-6 md:p-8 space-y-4">
          <Typography variant="h5" className="font-semibold text-slate-900">
            Вход в hits-classroom
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
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={submitting}
            >
              Войти
            </Button>

            <Typography variant="body2" className="text-slate-600 text-center">
              Нет аккаунта?{' '}
              <Link component={RouterLink} to="/register" color="primary">
                Создать аккаунт
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default LoginForm


