package usecase

import (
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

type GetInviteCode struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewGetInviteCode(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *GetInviteCode {
	return &GetInviteCode{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *GetInviteCode) GetInviteCode(courseID, userID string) (string, error) {
	course, err := uc.courseRepo.GetByID(courseID)
	if err != nil {
		return "", err
	}
	if course == nil {
		return "", ErrCourseNotFound
	}
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil {
		return "", err
	}
	if role == "" {
		return "", ErrForbidden
	}
	if role == domain.RoleStudent {
		return "", ErrForbidden
	}
	return course.InviteCode, nil
}
