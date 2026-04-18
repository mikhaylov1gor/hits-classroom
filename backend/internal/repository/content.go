package repository

import (
	"time"

	"hits-classroom/internal/domain"
)

type PostRepository interface {
	Create(post *domain.Post) error
	GetByID(id string) (*domain.Post, error)
	ListByCourse(courseID string) ([]*domain.Post, error)
	Delete(id string) error
}

type MaterialRepository interface {
	Create(material *domain.Material) error
	GetByID(id string) (*domain.Material, error)
	ListByCourse(courseID string) ([]*domain.Material, error)
	Delete(id string) error
}

type AssignmentRepository interface {
	Create(a *domain.Assignment) error
	GetByID(id string) (*domain.Assignment, error)
	ListByCourse(courseID string) ([]*domain.Assignment, error)
	Update(a *domain.Assignment) error
	ListDueForAutoFinalize(before time.Time) ([]*domain.Assignment, error)
	Delete(id string) error
}

type SubmissionRepository interface {
	Create(s *domain.Submission) error
	GetByID(id string) (*domain.Submission, error)
	GetByAssignmentAndUser(assignmentID, userID string) (*domain.Submission, error)
	ListByAssignment(assignmentID string) ([]*domain.Submission, error)
	Update(s *domain.Submission) error
	DeleteByAssignment(assignmentID string) error
}

type CommentRepository interface {
	Create(c *domain.Comment) error
	GetByID(id string) (*domain.Comment, error)
	Delete(id string) error
	ListByAssignment(assignmentID string) ([]*domain.Comment, error)
	ListByPost(postID string) ([]*domain.Comment, error)
	ListByMaterial(materialID string) ([]*domain.Comment, error)
	DeleteByAssignment(assignmentID string) error
	DeleteByPost(postID string) error
	DeleteByMaterial(materialID string) error
}

type FileRepository interface {
	Create(f *domain.File) error
	GetByID(id string) (*domain.File, error)
	ListByUser(userID string) ([]*domain.File, error)
}

type TeamRepository interface {
	Create(t *domain.Team) error
	GetByID(id string) (*domain.Team, error)
	ListByAssignment(assignmentID string) ([]*domain.Team, error)
	DeleteByAssignment(assignmentID string) error
	// DeleteSingleTeam removes one team and related votes, likes, peer grades, audit rows, members.
	DeleteSingleTeam(assignmentID, teamID string) error
	ReplaceAssignmentTeams(assignmentID string, teams []*domain.Team, teamMembers map[string][]string) error
}

type TeamMemberRepository interface {
	Create(m *domain.TeamMember) error
	Delete(teamID, userID string) error
	DeleteByTeam(teamID string) error
	DeleteByAssignment(assignmentID string) error
	ListByTeam(teamID string) ([]*domain.TeamMember, error)
	ListByAssignment(assignmentID string) ([]*domain.TeamMember, error)
	GetTeamByUser(assignmentID, userID string) (*domain.Team, error)
}

type TeamVoteRepository interface {
	Upsert(v *domain.TeamSubmissionVote) error
	ListByTeam(assignmentID, teamID string) ([]*domain.TeamSubmissionVote, error)
	DeleteByAssignment(assignmentID string) error
}

type TeamSubmissionLikeRepository interface {
	Toggle(assignmentID, teamID, submissionID, userID string) (bool, error)
	ListByTeam(assignmentID, teamID string) ([]*domain.TeamSubmissionLike, error)
	DeleteByAssignment(assignmentID string) error
}

type TeamPeerGradeRepository interface {
	ReplaceTeamAllocations(assignmentID, teamID, submitterUserID string, rows []*domain.TeamPeerGradeAllocation) error
	ListByTeamAndSubmitter(assignmentID, teamID, submitterUserID string) ([]*domain.TeamPeerGradeAllocation, error)
	DeleteByAssignment(assignmentID string) error
}

type TeamAuditRepository interface {
	Append(e *domain.TeamAuditEvent) error
	ListByAssignment(assignmentID string, teamID *string, limit, offset int) ([]*domain.TeamAuditEvent, error)
	DeleteByAssignment(assignmentID string) error
}
