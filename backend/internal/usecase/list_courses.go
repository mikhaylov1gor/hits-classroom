package usecase

import (
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

type CourseWithRoleItem struct {
	Course *domain.Course
	Role   domain.CourseRole
}

type ListCourses struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewListCourses(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *ListCourses {
	return &ListCourses{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *ListCourses) ListCourses(userID string) ([]CourseWithRoleItem, error) {
	members, err := uc.memberRepo.ListByUser(userID)
	if err != nil {
		return nil, err
	}
	var out []CourseWithRoleItem
	for _, m := range members {
		course, err := uc.courseRepo.GetByID(m.CourseID)
		if err != nil || course == nil {
			continue
		}
		out = append(out, CourseWithRoleItem{Course: course, Role: m.Role})
	}
	return out, nil
}
