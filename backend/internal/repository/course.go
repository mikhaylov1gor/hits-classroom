package repository

import "hits-classroom/internal/domain"

type CourseRepository interface {
	Create(course *domain.Course) error
	GetByID(id string) (*domain.Course, error)
	GetByInviteCode(code string) (*domain.Course, error)
	Delete(id string) error
}

type CourseMemberRepository interface {
	Create(member *domain.CourseMember) error
	GetUserRole(courseID, userID string) (domain.CourseRole, error)
	ListByCourse(courseID string) ([]*domain.CourseMember, error)
	ListByUser(userID string) ([]*domain.CourseMember, error)
	DeleteByCourse(courseID string) error
}
