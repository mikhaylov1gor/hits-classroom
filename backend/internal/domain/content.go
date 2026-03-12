package domain

import "time"

type Post struct {
	ID        string
	CourseID  string
	UserID    string
	Title     string
	Body      string
	Links     []string
	FileIDs   []string
	CreatedAt time.Time
}

type Material struct {
	ID        string
	CourseID  string
	Title     string
	Body      string
	Links     []string
	FileIDs   []string
	CreatedAt time.Time
}

type Assignment struct {
	ID        string
	CourseID  string
	Title     string
	Body      string
	Links     []string
	FileIDs   []string
	Deadline  *time.Time
	MaxGrade  int
	CreatedAt time.Time
}

type Submission struct {
	ID           string
	AssignmentID string
	UserID       string
	Body         string
	FileIDs      []string
	SubmittedAt  time.Time
	Grade        *int
	GradeComment *string
}

// Comment используется для комментариев к заданиям, постам и материалам.
// Ровно одно из AssignmentID / PostID / MaterialID непусто.
// IsPrivate = true означает личный комментарий: виден только автору и owner/teacher.
type Comment struct {
	ID           string
	AssignmentID string
	PostID       string
	MaterialID   string
	UserID       string
	ParentID     *string
	IsPrivate    bool
	Body         string
	FileIDs      []string
	CreatedAt    time.Time
}
