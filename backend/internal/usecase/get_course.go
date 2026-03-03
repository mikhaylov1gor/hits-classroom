package usecase

import (
	"errors"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

var ErrForbidden = errors.New("forbidden")

type GetCourse struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewGetCourse(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *GetCourse {
	return &GetCourse{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *GetCourse) GetCourse(courseID, userID string) (*domain.Course, domain.CourseRole, error) {
	course, err := uc.courseRepo.GetByID(courseID)
	if err != nil {
		return nil, "", err
	}
	if course == nil {
		return nil, "", ErrCourseNotFound
	}
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil {
		return nil, "", err
	}
	if role == "" {
		return nil, "", ErrForbidden
	}
	return course, role, nil
}
