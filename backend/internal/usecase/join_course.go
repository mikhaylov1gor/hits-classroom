package usecase

import (
	"errors"
	"strings"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

var ErrCourseNotFound = errors.New("course not found")

type JoinCourseInput struct {
	UserID string
	Code   string
}

type JoinCourse struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewJoinCourse(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *JoinCourse {
	return &JoinCourse{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *JoinCourse) JoinCourse(in JoinCourseInput) (*domain.Course, domain.CourseRole, error) {
	code := strings.TrimSpace(in.Code)
	if len(code) != 8 || in.UserID == "" {
		return nil, "", ErrValidation
	}
	course, err := uc.courseRepo.GetByInviteCode(code)
	if err != nil {
		return nil, "", err
	}
	if course == nil {
		return nil, "", ErrCourseNotFound
	}
	role, err := uc.memberRepo.GetUserRole(course.ID, in.UserID)
	if err != nil {
		return nil, "", err
	}
	if role != "" {
		return course, role, nil
	}
	member := &domain.CourseMember{
		CourseID: course.ID,
		UserID:   in.UserID,
		Role:     domain.RoleStudent,
	}
	if err := uc.memberRepo.Create(member); err != nil {
		return nil, "", err
	}
	return course, domain.RoleStudent, nil
}
