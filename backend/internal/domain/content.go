package domain

import "time"

type Post struct {
	ID        string
	CourseID  string
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
}

type Comment struct {
	ID           string
	AssignmentID string
	UserID       string
	Body         string
	FileIDs      []string
	CreatedAt    time.Time
}
