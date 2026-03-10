package domain

import "time"

type Post struct {
	ID        string
	CourseID  string
	UserID    string
	Title     string
	Body      string
	FileIDs   []string
	CreatedAt time.Time
}

type Material struct {
	ID        string
	CourseID  string
	Title     string
	Body      string
	FileIDs   []string
	CreatedAt time.Time
}

type Assignment struct {
	ID        string
	CourseID  string
	Title     string
	Body      string
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
	IsAttached   bool
}

// Comment используется и для комментариев к заданиям, и к постам.
// Ровно одно из AssignmentID / PostID непусто.
type Comment struct {
	ID           string
	AssignmentID string
	PostID       string
	UserID       string
	ParentID     *string
	Body         string
	FileIDs      []string
	CreatedAt    time.Time
}
