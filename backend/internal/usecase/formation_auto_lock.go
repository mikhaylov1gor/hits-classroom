package usecase

import (
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

// AutoLockTeamFormation фиксирует составы по дедлайну формирования команд (свободное вступление + allow_early_finalization).
type AutoLockTeamFormation struct {
	assignmentRepo repository.AssignmentRepository
	auditRepo      repository.TeamAuditRepository
}

func NewAutoLockTeamFormation(
	assignmentRepo repository.AssignmentRepository,
	auditRepo repository.TeamAuditRepository,
) *AutoLockTeamFormation {
	return &AutoLockTeamFormation{assignmentRepo: assignmentRepo, auditRepo: auditRepo}
}

func (uc *AutoLockTeamFormation) Run(now time.Time) error {
	assignments, err := uc.assignmentRepo.ListDueForFormationAutoLock(now)
	if err != nil {
		return err
	}
	for _, a := range assignments {
		if a == nil || a.RosterLockedAt != nil {
			continue
		}
		lock := now.UTC()
		a.RosterLockedAt = &lock
		if err := uc.assignmentRepo.Update(a); err != nil {
			continue
		}
		tryTeamAudit(uc.auditRepo, a.ID, "", "", domain.TeamAuditRosterLocked, map[string]string{
			"assignment_id": a.ID,
			"source":        "formation_deadline",
		})
	}
	return nil
}
