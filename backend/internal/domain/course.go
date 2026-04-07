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

type CourseMemberStatus string

const (
	MemberStatusPending  CourseMemberStatus = "pending"
	MemberStatusApproved CourseMemberStatus = "approved"
	MemberStatusRejected CourseMemberStatus = "rejected"
)

type CourseMember struct {
	CourseID     string
	UserID       string
	Role         CourseRole
	Status       CourseMemberStatus
	RequestedAt  time.Time
	DecidedAt    *time.Time
	DecidedBy    string
	DecisionNote string
}
