import { Container } from '@mui/material'
import CoursesTab from '../../../features/courses/ui/CoursesTab/CoursesTab'
import type { CourseWithRole } from '../../../features/courses/model/types'

type HomePageProps = {
  onCoursesLoaded?: (courses: CourseWithRole[]) => void
}

export function HomePage({ onCoursesLoaded }: HomePageProps) {
  return (
    <Container maxWidth="lg" className="flex-1 flex flex-col py-4 px-3 sm:py-6 sm:px-4 md:py-8 md:px-6">
      <CoursesTab onCoursesLoaded={onCoursesLoaded} />
    </Container>
  )
}

export default HomePage


