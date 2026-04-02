package usecase

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

type AutoFinalizeDeadline struct {
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	submissionRepo repository.SubmissionRepository
	finalizeVote   *FinalizeTeamVoteSubmission
	auditRepo      repository.TeamAuditRepository
}

func NewAutoFinalizeDeadline(
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	submissionRepo repository.SubmissionRepository,
	finalizeVote *FinalizeTeamVoteSubmission,
	auditRepo repository.TeamAuditRepository,
) *AutoFinalizeDeadline {
	return &AutoFinalizeDeadline{
		assignmentRepo: assignmentRepo,
		teamRepo:       teamRepo,
		teamMemberRepo: teamMemberRepo,
		submissionRepo: submissionRepo,
		finalizeVote:   finalizeVote,
		auditRepo:      auditRepo,
	}
}

func (uc *AutoFinalizeDeadline) Run(now time.Time) error {
	assignments, err := uc.assignmentRepo.ListDueForAutoFinalize(now)
	if err != nil {
		return err
	}
	for _, a := range assignments {
		if err := uc.finalizeAssignment(a); err != nil {
			continue
		}
		lock := now.UTC()
		a.RosterLockedAt = &lock
		a.DeadlineAutoFinalizedAt = &lock
		if err := uc.assignmentRepo.Update(a); err != nil {
			continue
		}
	}
	return nil
}

func (uc *AutoFinalizeDeadline) finalizeAssignment(a *domain.Assignment) error {
	teams, err := uc.teamRepo.ListByAssignment(a.ID)
	if err != nil {
		return err
	}
	for _, t := range teams {
		switch a.TeamSubmissionRule {
		case domain.TeamRuleVoteEqual, domain.TeamRuleVoteWeighted:
			_, _ = uc.finalizeVote.FinalizeVoteForTeam(a.CourseID, a.ID, t.ID, true, "")
		default:
			_ = uc.attachNonVoteRule(a, t.ID)
		}
		_ = uc.logAudit(a.ID, t.ID, "", domain.TeamAuditDeadlineAutoFinal, map[string]string{"assignment_id": a.ID, "team_id": t.ID})
	}
	return nil
}

func (uc *AutoFinalizeDeadline) attachNonVoteRule(a *domain.Assignment, teamID string) error {
	members, err := uc.teamMemberRepo.ListByTeam(teamID)
	if err != nil {
		return err
	}
	memberSet := make(map[string]bool, len(members))
	for _, m := range members {
		memberSet[m.UserID] = true
	}
	allSubs, err := uc.submissionRepo.ListByAssignment(a.ID)
	if err != nil {
		return err
	}
	var pick *domain.Submission
	switch a.TeamSubmissionRule {
	case domain.TeamRuleFirstSubmission:
		for _, s := range allSubs {
			if !memberSet[s.UserID] {
				continue
			}
			if !s.IsAttached || s.IsReturned {
				continue
			}
			if pick == nil || s.SubmittedAt.Before(pick.SubmittedAt) {
				pick = s
			}
		}
	case domain.TeamRuleLastSubmission:
		for _, s := range allSubs {
			if !memberSet[s.UserID] {
				continue
			}
			if pick == nil || s.SubmittedAt.After(pick.SubmittedAt) {
				pick = s
			}
		}
	case domain.TeamRuleTopStudentOnly:
		var bestUser string
		bestScore := -1.0
		for uid := range memberSet {
			score, _ := calcNormalizedAverage(a.CourseID, uid, uc.assignmentRepo, uc.submissionRepo)
			if score > bestScore {
				bestScore = score
				bestUser = uid
			}
		}
		if bestUser == "" {
			for uid := range memberSet {
				bestUser = uid
				break
			}
		}
		for _, s := range allSubs {
			if s.UserID != bestUser {
				continue
			}
			if pick == nil || s.SubmittedAt.After(pick.SubmittedAt) {
				pick = s
			}
		}
	default:
		return nil
	}
	if pick == nil {
		return nil
	}
	for _, s := range allSubs {
		if !memberSet[s.UserID] {
			continue
		}
		if s.ID == pick.ID {
			s.IsAttached = true
			s.IsReturned = false
		} else {
			s.IsAttached = false
		}
		if err := uc.submissionRepo.Update(s); err != nil {
			return err
		}
	}
	return nil
}

func (uc *AutoFinalizeDeadline) logAudit(assignmentID, teamID, actorID string, typ domain.TeamAuditEventType, payload map[string]string) error {
	if uc.auditRepo == nil {
		return nil
	}
	b, _ := json.Marshal(payload)
	return uc.auditRepo.Append(&domain.TeamAuditEvent{
		ID:           uuid.NewString(),
		AssignmentID: assignmentID,
		TeamID:       teamID,
		ActorUserID:  actorID,
		EventType:    typ,
		Payload:      string(b),
		CreatedAt:    time.Now().UTC(),
	})
}
