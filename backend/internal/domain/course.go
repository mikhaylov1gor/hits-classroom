package domain

import "time"

type Course struct {
	ID         string
	Title      string
	InviteCode string
	CreatedAt  time.Time
}

type CourseRole string

const (
	RoleOwner   CourseRole = "owner"
	RoleTeacher CourseRole = "teacher"
	RoleStudent CourseRole = "student"
)

type CourseMember struct {
	CourseID string
	UserID   string
	Role     CourseRole
}
