import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material'
import { Link as RouterLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import LoginPage from './pages/login/ui/LoginPage'
import RegisterPage from './pages/register/ui/RegisterPage'

function LandingPage() {
  return (
    <Container maxWidth="lg" className="flex-1 flex items-center py-10">
      <Box className="grid md:grid-cols-2 gap-10 items-center w-full">
        <Box>
          <Typography
            variant="h3"
            component="h1"
            className="font-semibold mb-4 leading-tight text-slate-900"
          >
            Цифровая платформа для обучения <span className="text-primary-600">hits-classroom</span>
          </Typography>
          <Typography variant="body1" className="mb-6 text-slate-700">
            Управляйте курсами, заданиями и группами студентов подобно Google Classroom, но под ваши
            процессы. Этот экран — стартовая точка TDD‑разработки.
          </Typography>
          <Box className="flex flex-wrap gap-3">
            <Button color="primary" variant="contained" size="large" disabled>
              Создать курс
            </Button>
            <Button color="primary" variant="outlined" size="large" disabled>
              Присоединиться по коду
            </Button>
          </Box>
        </Box>

        <Box className="rounded-3xl bg-white/80 shadow-xl border border-slate-100 p-6 md:p-8">
          <Typography variant="subtitle2" className="uppercase tracking-wide text-slate-500 mb-3">
            Предстоящие задания
          </Typography>

          <Box className="space-y-3">
            <Box className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 bg-slate-50">
              <Box>
                <Typography variant="body1" className="font-medium text-slate-900">
                  Архитектура hits-classroom
                </Typography>
                <Typography variant="body2" className="text-slate-500">
                  Дизайн доменной модели и модулей
                </Typography>
              </Box>
              <Typography variant="body2" className="text-primary-600 font-medium">
                Сегодня
              </Typography>
            </Box>

            <Box className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
              <Box>
                <Typography variant="body1" className="font-medium text-slate-900">
                  TDD сценарии
                </Typography>
                <Typography variant="body2" className="text-slate-500">
                  Определить ключевые пользовательские потоки
                </Typography>
              </Box>
              <Typography variant="body2" className="text-slate-500">
                Завтра
              </Typography>
            </Box>

            <Box className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 px-4 py-3">
              <Typography variant="body2" className="text-slate-500">
                Добавьте новое задание, чтобы начать TDD‑цикл
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  )
}

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLoginClick = () => {
    if (location.pathname !== '/login') {
      navigate('/login')
    }
  }

  const handleRegisterClick = () => {
    if (location.pathname !== '/register') {
      navigate('/register')
    }
  }

  return (
    <Box className="min-h-screen flex flex-col">
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar className="flex justify-between">
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            className="font-semibold tracking-tight text-primary-800 no-underline"
          >
            hits-classroom
          </Typography>

          <Box className="flex gap-2">
            <Button color="primary" variant="text" onClick={handleLoginClick}>
              Вход
            </Button>
            <Button color="primary" variant="contained" onClick={handleRegisterClick}>
              Регистрация
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </Box>
    </Box>
  )
}

export default AppShell
