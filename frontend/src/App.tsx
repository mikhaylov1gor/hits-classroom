import { useMemo, useState } from 'react'
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import LoginPage from './pages/login/ui/LoginPage'
import RegisterPage from './pages/register/ui/RegisterPage'
import HomePage from './pages/home/ui/HomePage'
import CoursesTab from './features/courses/ui/CoursesTab/CoursesTab'
import CoursePage from './pages/course/ui/CoursePage'
import ProfileTab from './features/profile/ui/ProfileTab/ProfileTab'
import { AddCourseButton } from './features/courses/ui/AddCourseButton/AddCourseButton'
import { CoursesLoader } from './features/courses/ui/CoursesLoader/CoursesLoader'
import { CoursesProvider, useCourses } from './features/courses/model/CoursesContext'
import { useAuth } from './features/auth/model/AuthContext'
import { useCurrentUserQuery } from './features/profile/model/profileQueries'
import type { User } from './features/auth/model/types'
import type { CourseWithRole } from './features/courses/model/types'
import { RedirectIfAuthenticated } from './app/RedirectIfAuthenticated'
import { RequireAuth } from './app/RequireAuth'

function AppShellContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [isSidebarExpanded, setSidebarExpanded] = useState(false)

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const { courses: allCourses } = useCourses()!

  const { data: currentUser } = useCurrentUserQuery(!user)

  const headerUser = user ?? currentUser ?? profileUser

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'
  const isHomePage = location.pathname === '/'

  const recentCourses = useMemo(() => {
    if (!allCourses.length) {
      return []
    }
    const slice = allCourses.length > 8 ? allCourses.slice(-8) : allCourses
    return [...slice].reverse()
  }, [allCourses])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  const handleGoHome = () => {
    navigate('/')
    handleMenuClose()
  }

  const handleGoToCourse = (courseId: string) => {
    navigate(`/course/${courseId}`)
    handleMenuClose()
  }

  const handleGoToProfile = () => {
    navigate('/profile')
    handleMenuClose()
  }

  return (
    <Box className="min-h-screen flex flex-col">
        {!isAuthPage && <CoursesLoader />}
        {!isAuthPage && (
          <AppBar position="static" color="transparent" elevation={0}>
            <Toolbar className="flex justify-between items-center h-14 min-h-[56px] md:h-20 border-b border-slate-100 bg-white/95 backdrop-blur-sm px-3 md:px-4">
              <Typography
                variant="h6"
                component={RouterLink}
                to="/"
                className="font-semibold tracking-tight text-primary-800 no-underline truncate max-w-[60vw]"
              >
                hits-classroom
              </Typography>

              <Box className="flex items-center gap-1">
                {isHomePage && (
                  <Box sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                    <AddCourseButton />
                  </Box>
                )}
                <Box sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                  <IconButton
                    color="inherit"
                    aria-label="Открыть меню"
                    onClick={handleMenuOpen}
                    size="large"
                  >
                    <MenuIcon fontSize="large" />
                  </IconButton>
                </Box>
              </Box>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              >
                  {headerUser && (
                    <MenuItem disabled>
                      <Typography variant="subtitle2">
                        {`${headerUser.first_name} ${headerUser.last_name}`.trim()}
                      </Typography>
                    </MenuItem>
                  )}
                  <MenuItem
                    onClick={handleGoHome}
                    selected={location.pathname === '/'}
                    className="h-10"
                  >
                    <Box className="flex items-center justify-center gap-2 w-full">
                      <HomeOutlinedIcon fontSize="medium" />
                      <span>Главная</span>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={handleGoToProfile}
                    selected={location.pathname === '/profile'}
                    className="h-10"
                  >
                    <Box className="flex items-center justify-center gap-2 w-full">
                      <AccountCircleOutlinedIcon fontSize="medium" />
                      <span>Профиль</span>
                    </Box>
                  </MenuItem>
                  {recentCourses.map((course) => (
                    <MenuItem
                      key={course.id}
                      onClick={() => handleGoToCourse(course.id)}
                      selected={location.pathname === `/course/${course.id}`}
                      className="h-10"
                    >
                      <Box className="flex items-center justify-center gap-2 w-full">
                        <ClassOutlinedIcon fontSize="medium" />
                        <span>{course.title}</span>
                      </Box>
                    </MenuItem>
                  ))}
              </Menu>
            </Toolbar>
          </AppBar>
        )}

      {!isAuthPage && isHomePage && (
        <Box
          sx={{
            display: { xs: 'block', md: 'none' },
            position: 'fixed',
            bottom: 16,
            right: 16,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            zIndex: 1000,
          }}
        >
          <AddCourseButton variant="fab" />
        </Box>
      )}

      <Box className="flex-1 flex items-stretch relative">
        {!isAuthPage && isDesktop && (
          <Box
            className="hidden md:flex flex-col bg-slate-50 text-slate-800 border-r border-slate-200 transition-all duration-200"
            onMouseEnter={() => setSidebarExpanded(true)}
            onMouseLeave={() => setSidebarExpanded(false)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: isSidebarExpanded ? 240 : 80,
            }}
          >
            <Box className="flex-1 flex flex-col py-4 gap-1">
              <MenuItem
                onClick={handleGoHome}
                selected={location.pathname === '/'}
                className={`h-10 text-sm rounded-r-full ${
                  location.pathname === '/'
                    ? 'bg-slate-200 text-slate-900'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Box className="flex items-center justify-center gap-3 w-full">
                  <HomeOutlinedIcon fontSize="medium" />
                  <span
                    className={`transition-all duration-150 whitespace-nowrap overflow-hidden ${
                      isSidebarExpanded ? 'opacity-100 ml-1' : 'opacity-0 ml-0 w-0'
                    }`}
                  >
                    Главная
                  </span>
                </Box>
              </MenuItem>
              <MenuItem
                onClick={handleGoToProfile}
                selected={location.pathname === '/profile'}
                className={`h-10 text-sm rounded-r-full ${
                  location.pathname === '/profile'
                    ? 'bg-slate-200 text-slate-900'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Box className="flex items-center justify-center gap-3 w-full">
                  <AccountCircleOutlinedIcon fontSize="medium" />
                  <span
                    className={`transition-all duration-150 whitespace-nowrap overflow-hidden ${
                      isSidebarExpanded ? 'opacity-100 ml-1' : 'opacity-0 ml-0 w-0'
                    }`}
                  >
                    Профиль
                  </span>
                </Box>
              </MenuItem>
              {recentCourses.map((course) => (
                <MenuItem
                  key={course.id}
                  onClick={() => handleGoToCourse(course.id)}
                  selected={location.pathname === `/course/${course.id}`}
                  className={`h-10 text-sm rounded-r-full ${
                    location.pathname === `/course/${course.id}`
                      ? 'bg-slate-200 text-slate-900'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Box className="flex items-center justify-center gap-3 w-full">
                    <ClassOutlinedIcon fontSize="medium" />
                    <span
                      className={`transition-all duration-150 whitespace-nowrap overflow-hidden ${
                        isSidebarExpanded ? 'opacity-100 ml-1' : 'opacity-0 ml-0 w-0'
                      }`}
                    >
                      {course.title}
                    </span>
                  </Box>
                </MenuItem>
              ))}
            </Box>
          </Box>
        )}

        <Box
          className="flex-1 flex flex-col transition-[margin-left] duration-200 ease-in-out min-w-0 overflow-x-hidden"
          style={{
            marginLeft: !isAuthPage && isDesktop ? (isSidebarExpanded ? 240 : 80) : 0,
          }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/login"
              element={
                <RedirectIfAuthenticated>
                  <LoginPage />
                </RedirectIfAuthenticated>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthenticated>
                  <RegisterPage />
                </RedirectIfAuthenticated>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfileTab />
                </RequireAuth>
              }
            />
            <Route
              path="/course/:courseId"
              element={
                <RequireAuth>
                  <CoursePage />
                </RequireAuth>
              }
            />
            <Route
              path="*"
              element={
                <RequireAuth>
                  <Navigate to="/" replace />
                </RequireAuth>
              }
            />
          </Routes>
        </Box>
      </Box>
    </Box>
  )
}

function AppShell() {
  return (
    <CoursesProvider>
      <AppShellContent />
    </CoursesProvider>
  )
}

export default AppShell
