package usecase

import (
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

// FinalizeTeamSubmissionsNow closes team submission window before deadline.
// Teams without attached final submission become not_submitted.
type FinalizeTeamSubmissionsNow struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	autoFinalize   *AutoFinalizeDeadline
}

func NewFinalizeTeamSubmissionsNow(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	autoFinalize *AutoFinalizeDeadline,
) *FinalizeTeamSubmissionsNow {
	return &FinalizeTeamSubmissionsNow{
		memberRepo:     memberRepo,
		assignmentRepo: assignmentRepo,
		autoFinalize:   autoFinalize,
	}
}

func (uc *FinalizeTeamSubmissionsNow) Finalize(courseID, assignmentID, teacherID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, teacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return ErrForbidden
	}
	assignment, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || assignment == nil || assignment.CourseID != courseID {
		return ErrCourseNotFound
	}
	if assignment.AssignmentKind != domain.AssignmentKindGroup {
		return &ValidationError{Message: "manual finalize is available only for group assignments"}
	}
	now := time.Now().UTC()
	if assignment.DeadlineAutoFinalizedAt != nil {
		return &ValidationError{Message: "submission window is already finalized"}
	}
	if err := uc.autoFinalize.finalizeAssignment(assignment); err != nil {
		return err
	}
	assignment.DeadlineAutoFinalizedAt = &now
	if assignment.RosterLockedAt == nil {
		assignment.RosterLockedAt = &now
	}
	if assignment.Deadline == nil || assignment.Deadline.After(now) {
		assignment.Deadline = &now
	}
	return uc.assignmentRepo.Update(assignment)
}
