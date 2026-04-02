package usecase

import (
	"math"
	"time"

	"github.com/google/uuid"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

const peerPercentEpsilon = 0.01

type SubmitPeerGradeSplitInput struct {
	CourseID     string
	AssignmentID string
	TeamID       string
	UserID       string
	Percents     map[string]float64 // user_id -> percent
}

type SubmitPeerGradeSplit struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	peerRepo       repository.TeamPeerGradeRepository
	auditRepo      repository.TeamAuditRepository
}

func NewSubmitPeerGradeSplit(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	peerRepo repository.TeamPeerGradeRepository,
	auditRepo repository.TeamAuditRepository,
) *SubmitPeerGradeSplit {
	return &SubmitPeerGradeSplit{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo,
		peerRepo: peerRepo, auditRepo: auditRepo,
	}
}

func (uc *SubmitPeerGradeSplit) Submit(in SubmitPeerGradeSplitInput) error {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role != domain.RoleStudent {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return ErrCourseNotFound
	}
	if a.TeamGradingMode != domain.TeamGradingPeerSplit {
		return &ValidationError{Message: "peer split is not enabled for this assignment"}
	}
	if a.Deadline != nil && time.Now().UTC().After(*a.Deadline) {
		return ErrAssignmentClosed
	}
	t, err := uc.teamRepo.GetByID(in.TeamID)
	if err != nil || t == nil || t.AssignmentID != in.AssignmentID {
		return ErrCourseNotFound
	}
	userTeam, err := uc.teamMemberRepo.GetTeamByUser(in.AssignmentID, in.UserID)
	if err != nil || userTeam == nil || userTeam.ID != in.TeamID {
		return ErrForbidden
	}
	members, err := uc.teamMemberRepo.ListByTeam(in.TeamID)
	if err != nil {
		return err
	}
	memberSet := make(map[string]bool, len(members))
	for _, m := range members {
		memberSet[m.UserID] = true
	}
	var sum float64
	rows := make([]*domain.TeamPeerGradeAllocation, 0, len(in.Percents))
	for uid, p := range in.Percents {
		if !memberSet[uid] {
			return &ValidationError{Message: "percent entry for non-team member"}
		}
		if p < a.PeerSplitMinPercent-peerPercentEpsilon || p > a.PeerSplitMaxPercent+peerPercentEpsilon {
			return &ValidationError{Message: "percent out of allowed range for member"}
		}
		sum += p
		rows = append(rows, &domain.TeamPeerGradeAllocation{
			ID:           uuid.NewString(),
			AssignmentID: in.AssignmentID,
			TeamID:       in.TeamID,
			UserID:       uid,
			Percent:      p,
			UpdatedAt:    time.Now().UTC(),
		})
	}
	if len(rows) != len(members) {
		return &ValidationError{Message: "must submit percent for every team member"}
	}
	if math.Abs(sum-100.0) > peerPercentEpsilon {
		return &ValidationError{Message: "percents must sum to 100% (±0.01)"}
	}
	if err := uc.peerRepo.ReplaceTeamAllocations(in.AssignmentID, in.TeamID, rows); err != nil {
		return err
	}
	tryTeamAudit(uc.auditRepo, in.AssignmentID, in.TeamID, in.UserID, domain.TeamAuditPeerSplitSubmitted, map[string]string{"submitter": in.UserID})
	return nil
}

type GradeTeamPeerSplit struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	submissionRepo repository.SubmissionRepository
	teamMemberRepo repository.TeamMemberRepository
	peerRepo       repository.TeamPeerGradeRepository
	auditRepo      repository.TeamAuditRepository
}

func NewGradeTeamPeerSplit(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	submissionRepo repository.SubmissionRepository,
	teamMemberRepo repository.TeamMemberRepository,
	peerRepo repository.TeamPeerGradeRepository,
	auditRepo repository.TeamAuditRepository,
) *GradeTeamPeerSplit {
	return &GradeTeamPeerSplit{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, submissionRepo: submissionRepo,
		teamMemberRepo: teamMemberRepo, peerRepo: peerRepo, auditRepo: auditRepo,
	}
}

type GradeTeamPeerSplitInput struct {
	CourseID     string
	AssignmentID string
	TeamID       string
	TeacherID    string
	Grade        int
	GradeComment string
}

func (uc *GradeTeamPeerSplit) GradeTeam(in GradeTeamPeerSplitInput) error {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.TeacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return ErrCourseNotFound
	}
	if a.TeamGradingMode != domain.TeamGradingPeerSplit {
		return &ValidationError{Message: "peer split grading is not enabled for this assignment"}
	}
	if in.Grade < 0 || in.Grade > a.MaxGrade {
		return &ValidationError{Message: "grade must be between 0 and max_grade"}
	}
	t, err := uc.teamRepo.GetByID(in.TeamID)
	if err != nil || t == nil || t.AssignmentID != in.AssignmentID {
		return ErrCourseNotFound
	}
	allocs, err := uc.peerRepo.ListByTeam(in.AssignmentID, in.TeamID)
	if err != nil {
		return err
	}
	if len(allocs) == 0 {
		return &ValidationError{Message: "team has not submitted peer split yet"}
	}
	members, err := uc.teamMemberRepo.ListByTeam(in.TeamID)
	if err != nil {
		return err
	}
	if len(allocs) != len(members) {
		return &ValidationError{Message: "peer split incomplete for team"}
	}
	var sum float64
	byUser := make(map[string]float64, len(allocs))
	for _, row := range allocs {
		sum += row.Percent
		byUser[row.UserID] = row.Percent
	}
	if math.Abs(sum-100.0) > peerPercentEpsilon {
		return &ValidationError{Message: "stored percents must sum to 100%"}
	}
	remaining := in.Grade
	for i, m := range members {
		p := byUser[m.UserID]
		g := int(math.Round(float64(in.Grade) * p / 100.0))
		if i == len(members)-1 {
			g = remaining
		} else {
			remaining -= g
		}
		sub, _ := uc.submissionRepo.GetByAssignmentAndUser(in.AssignmentID, m.UserID)
		if sub == nil {
			sub = &domain.Submission{
				ID: uuid.NewString(), AssignmentID: in.AssignmentID, UserID: m.UserID,
				Body: "", FileIDs: nil, SubmittedAt: time.Now().UTC(), IsAttached: false,
			}
			if err := uc.submissionRepo.Create(sub); err != nil {
				return err
			}
		}
		sub.Grade = &g
		if in.GradeComment != "" {
			c := in.GradeComment
			sub.GradeComment = &c
		}
		if err := uc.submissionRepo.Update(sub); err != nil {
			return err
		}
	}
	tryTeamAudit(uc.auditRepo, in.AssignmentID, in.TeamID, in.TeacherID, domain.TeamAuditGradeApplied, map[string]string{"mode": "peer_split"})
	return nil
}
