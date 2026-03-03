import { useEffect, useMemo, useState } from 'react'
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
import { Link as RouterLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import LoginPage from './pages/login/ui/LoginPage'
import RegisterPage from './pages/register/ui/RegisterPage'
import HomePage from './pages/home/ui/HomePage'
import CoursesTab from './features/courses/ui/CoursesTab/CoursesTab'
import ProfileTab from './features/profile/ui/ProfileTab/ProfileTab'
import { useAuth } from './features/auth/model/AuthContext'
import { fetchCurrentUser } from './features/profile/api/profileApi'
import type { User } from './features/auth/model/types'
import type { CourseWithRole } from './features/courses/model/types'
import { RequireAuth } from './app/RequireAuth'

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [isSidebarExpanded, setSidebarExpanded] = useState(false)

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [allCourses, setAllCourses] = useState<CourseWithRole[]>([])
  const [profileUser, setProfileUser] = useState<User | null>(null)

  const headerUser = user ?? profileUser

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  useEffect(() => {
    let cancelled = false

    fetchCurrentUser()
      .then((data) => {
        if (!cancelled) {
          setProfileUser(data)
        }
      })
      .catch(() => {
        // ignore header load errors
      })

    return () => {
      cancelled = true
    }
  }, [])

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
      {!isAuthPage && (
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar className="flex justify-between h-16 md:h-20 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
            <Typography
              variant="h6"
              component={RouterLink}
              to="/"
              className="font-semibold tracking-tight text-primary-800 no-underline"
            >
              hits-classroom
            </Typography>

            <Box className="flex gap-2 items-center">
              <>
                <IconButton
                  color="inherit"
                  aria-label="Открыть меню"
                  onClick={handleMenuOpen}
                  size="large"
                >
                  <MenuIcon fontSize="large" />
                </IconButton>
                <Menu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={handleMenuClose}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
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
              </>
            </Box>
          </Toolbar>
        </AppBar>
      )}

      <Box className="flex-1 flex items-stretch relative">
        {/* Левый нав-бар на десктопе, как в Google Classroom: иконки + подписи, расширение по hover */}
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
          className="flex-1 flex flex-col"
          style={{ marginLeft: !isAuthPage && isDesktop ? 80 : 0 }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <RequireAuth>
                  <HomePage onCoursesLoaded={setAllCourses} />
                </RequireAuth>
              }
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
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
                  <CoursesTab />
                </RequireAuth>
              }
            />
          </Routes>
        </Box>
      </Box>
    </Box>
  )
}

export default AppShell
