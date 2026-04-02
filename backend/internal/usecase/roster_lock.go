package usecase

import (
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

func assignmentRosterLocked(a *domain.Assignment, now time.Time) bool {
	if a == nil || a.RosterLockedAt == nil {
		return false
	}
	return !now.Before(*a.RosterLockedAt)
}

type LockTeamRoster struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	auditRepo      repository.TeamAuditRepository
}

func NewLockTeamRoster(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, auditRepo repository.TeamAuditRepository) *LockTeamRoster {
	return &LockTeamRoster{memberRepo: memberRepo, assignmentRepo: assignmentRepo, auditRepo: auditRepo}
}

func (uc *LockTeamRoster) Lock(courseID, assignmentID, teacherID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, teacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return ErrCourseNotFound
	}
	if !a.IsGroup() {
		return &ValidationError{Message: "roster lock applies only to group assignments"}
	}
	now := time.Now().UTC()
	a.RosterLockedAt = &now
	if err := uc.assignmentRepo.Update(a); err != nil {
		return err
	}
	tryTeamAudit(uc.auditRepo, assignmentID, "", teacherID, domain.TeamAuditRosterLocked, map[string]string{"assignment_id": assignmentID})
	return nil
}

type ListTeamAudit struct {
	memberRepo repository.CourseMemberRepository
	auditRepo  repository.TeamAuditRepository
}

func NewListTeamAudit(memberRepo repository.CourseMemberRepository, auditRepo repository.TeamAuditRepository) *ListTeamAudit {
	return &ListTeamAudit{memberRepo: memberRepo, auditRepo: auditRepo}
}

func (uc *ListTeamAudit) List(courseID, assignmentID, userID string, teamID *string, limit, offset int) ([]*domain.TeamAuditEvent, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return nil, ErrForbidden
	}
	return uc.auditRepo.ListByAssignment(assignmentID, teamID, limit, offset)
}
