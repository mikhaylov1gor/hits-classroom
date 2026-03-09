import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { CourseWithRole } from '../../model/types'

type CourseBannerProps = {
  course: CourseWithRole
}

const SOFT_GRADIENTS = [
  'linear-gradient(135deg, #64b5f6 0%, #42a5f5 50%, #2196f3 100%)',
  'linear-gradient(135deg, #81c784 0%, #66bb6a 50%, #4caf50 100%)',
  'linear-gradient(135deg, #ba68c8 0%, #ab47bc 50%, #9c27b0 100%)',
  'linear-gradient(135deg, #4dd0e1 0%, #26c6da 50%, #00bcd4 100%)',
  'linear-gradient(135deg, #ffb74d 0%, #ffa726 50%, #ff9800 100%)',
  'linear-gradient(135deg, #9575cd 0%, #7e57c2 50%, #673ab7 100%)',
  'linear-gradient(135deg, #f06292 0%, #ec407a 50%, #e91e63 100%)',
  'linear-gradient(135deg, #5c9fd4 0%, #42a5f5 50%, #1e88e5 100%)',
]

function getBannerGradient(courseId: string): string {
  let hash = 0
  for (let i = 0; i < courseId.length; i++) {
    hash = (hash << 5) - hash + courseId.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % SOFT_GRADIENTS.length
  return SOFT_GRADIENTS[index]
}

function CourseIllustration() {
  return (
    <Box
      component="svg"
      viewBox="0 0 200 120"
      className="w-full h-full max-w-[280px] max-h-[140px] opacity-90"
      sx={{ flexShrink: 0 }}
    >
      <rect x="100" y="50" width="50" height="60" rx="2" fill="#FFEB3B" opacity="0.9" />
      <rect x="98" y="52" width="8" height="8" rx="1" fill="#fff" opacity="0.8" />
      <rect x="98" y="64" width="8" height="8" rx="1" fill="#fff" opacity="0.8" />
      <rect x="120" y="50" width="45" height="55" rx="2" fill="#B0BEC5" opacity="0.9" />
      <line x1="125" y1="60" x2="155" y2="60" stroke="#78909C" strokeWidth="1" />
      <line x1="125" y1="70" x2="155" y2="70" stroke="#78909C" strokeWidth="1" />
      <line x1="125" y1="80" x2="145" y2="80" stroke="#78909C" strokeWidth="1" />
      <ellipse cx="60" cy="70" rx="18" ry="12" fill="#fff" opacity="0.95" />
      <ellipse cx="60" cy="70" rx="12" ry="8" fill="#E0E0E0" />
      <ellipse cx="140" cy="70" rx="18" ry="12" fill="#fff" opacity="0.95" />
      <ellipse cx="140" cy="70" rx="12" ry="8" fill="#E0E0E0" />
      <path
        d="M 78 70 Q 100 50 122 70"
        stroke="#fff"
        strokeWidth="4"
        fill="none"
        opacity="0.9"
      />
    </Box>
  )
}

export function CourseBanner({ course }: CourseBannerProps) {
  const gradient = useMemo(() => getBannerGradient(course.id), [course.id])

  return (
    <Box
      className="relative overflow-hidden"
      sx={{
        background: gradient,
        minHeight: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 3, sm: 4, md: 6 },
        py: 3,
        mt: { xs: 0, md: 2 },
        borderRadius: { xs: 0, md: 2 },
      }}
    >
      <Box className="flex-1 min-w-0 flex flex-col gap-1">
        <Typography
          component="h1"
          variant="h4"
          className="font-semibold text-white"
          sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' } }}
        >
          {course.title}
        </Typography>
      </Box>
      <Box
        className="hidden sm:flex items-center justify-end"
        sx={{ minWidth: 120, flexShrink: 0 }}
      >
        <CourseIllustration />
      </Box>
    </Box>
  )
}
