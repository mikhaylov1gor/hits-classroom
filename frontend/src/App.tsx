import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material'

function App() {
  return (
    <Box className="min-h-screen flex flex-col">
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar className="flex justify-between">
          <Typography
            variant="h6"
            component="div"
            className="font-semibold tracking-tight text-primary-800"
          >
            hits-classroom
          </Typography>

          <Box className="flex gap-2">
            <Button color="primary" variant="text">
              Вход
            </Button>
            <Button color="primary" variant="contained">
              Регистрация
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

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
              Управляйте курсами, заданиями и группами студентов подобно Google Classroom, но под
              ваши процессы. Этот экран — стартовая точка TDD‑разработки.
            </Typography>
            <Box className="flex flex-wrap gap-3">
              <Button color="primary" variant="contained" size="large">
                Создать курс
              </Button>
              <Button color="primary" variant="outlined" size="large">
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
    </Box>
  )
}

export default App
