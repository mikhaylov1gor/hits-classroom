import { Container } from '@mui/material'
import { CoursePage as CoursePageFeature } from '../../../features/courses/ui/CoursePage/CoursePage'

export function CoursePage() {
  return (
    <Container maxWidth="lg" className="flex-1 flex flex-col py-4 px-3 sm:py-6 sm:px-4 md:py-8 md:px-6 min-w-0 overflow-x-hidden">
      <CoursePageFeature />
    </Container>
  )
}

export default CoursePage
