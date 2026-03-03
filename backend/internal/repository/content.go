package repository

import "hits-classroom/internal/domain"

type PostRepository interface {
	Create(post *domain.Post) error
	ListByCourse(courseID string) ([]*domain.Post, error)
}

type MaterialRepository interface {
	Create(material *domain.Material) error
	ListByCourse(courseID string) ([]*domain.Material, error)
}

type AssignmentRepository interface {
	Create(a *domain.Assignment) error
	GetByID(id string) (*domain.Assignment, error)
	ListByCourse(courseID string) ([]*domain.Assignment, error)
}

type SubmissionRepository interface {
	Create(s *domain.Submission) error
	GetByID(id string) (*domain.Submission, error)
	GetByAssignmentAndUser(assignmentID, userID string) (*domain.Submission, error)
	ListByAssignment(assignmentID string) ([]*domain.Submission, error)
	Update(s *domain.Submission) error
}

type CommentRepository interface {
	Create(c *domain.Comment) error
	ListByAssignment(assignmentID string) ([]*domain.Comment, error)
}
