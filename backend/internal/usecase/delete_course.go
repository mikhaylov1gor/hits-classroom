package usecase

import (
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

type DeleteCourse struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewDeleteCourse(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *DeleteCourse {
	return &DeleteCourse{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *DeleteCourse) DeleteCourse(courseID, userID string) error {
	course, err := uc.courseRepo.GetByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return ErrCourseNotFound
	}
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil {
		return err
	}
	if role != domain.RoleOwner {
		return ErrForbidden
	}
	if err := uc.memberRepo.DeleteByCourse(courseID); err != nil {
		return err
	}
	return uc.courseRepo.Delete(courseID)
}
