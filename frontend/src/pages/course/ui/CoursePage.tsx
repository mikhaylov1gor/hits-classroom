import { Box, Container } from '@mui/material'
import { CoursePage as CoursePageFeature } from '../../../features/courses/ui/CoursePage/CoursePage'

export function CoursePage() {
  return (
    <Box className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
      <Container maxWidth="lg" className="flex-1 flex flex-col min-w-0" disableGutters>
        <CoursePageFeature />
      </Container>
    </Box>
  )
}

export default CoursePage
