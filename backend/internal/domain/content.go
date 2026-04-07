package domain

import "time"

type TeamDistributionType string

const (
	TeamDistributionFree     TeamDistributionType = "free"
	TeamDistributionRandom   TeamDistributionType = "random"
	TeamDistributionBalanced TeamDistributionType = "balanced"
	TeamDistributionManual   TeamDistributionType = "manual"
)

type TeamSubmissionRule string

const (
	TeamRuleFirstSubmission TeamSubmissionRule = "first_submission"
	TeamRuleLastSubmission  TeamSubmissionRule = "last_submission"
	TeamRuleTopStudentOnly  TeamSubmissionRule = "top_student_only"
	TeamRuleVoteEqual       TeamSubmissionRule = "vote_equal"
	TeamRuleVoteWeighted    TeamSubmissionRule = "vote_weighted"
)

type AssignmentKind string

const (
	AssignmentKindIndividual AssignmentKind = "individual"
	AssignmentKindGroup      AssignmentKind = "group"
)

type VoteTieBreak string

const (
	VoteTieBreakRandom               VoteTieBreak = "random"
	VoteTieBreakHighestAuthorAverage VoteTieBreak = "highest_author_average"
)

type TeamGradingMode string

const (
	TeamGradingIndividual  TeamGradingMode = "individual"
	TeamGradingTeamUniform TeamGradingMode = "team_uniform"
	TeamGradingPeerSplit   TeamGradingMode = "team_peer_split"
)

// IsGroup returns true for group assignments (explicit kind or legacy team_count > 0).
func (a *Assignment) IsGroup() bool {
	if a == nil {
		return false
	}
	if a.AssignmentKind == AssignmentKindIndividual {
		return false
	}
	if a.AssignmentKind == AssignmentKindGroup {
		return true
	}
	return a.TeamCount > 0
}

type Post struct {
	ID        string
	CourseID  string
	UserID    string
	Title     string
	Body      string
	Links     []string
	FileIDs   []string
	CreatedAt time.Time
}

type Material struct {
	ID        string
	CourseID  string
	Title     string
	Body      string
	Links     []string
	FileIDs   []string
	CreatedAt time.Time
}

type Assignment struct {
	ID                      string
	CourseID                string
	Title                   string
	Body                    string
	Links                   []string
	FileIDs                 []string
	Deadline                *time.Time
	MaxGrade                int
	AssignmentKind          AssignmentKind
	DesiredTeamSize         int
	TeamDistributionType    TeamDistributionType
	TeamCount               int
	MaxTeamSize             int
	TeamSubmissionRule      TeamSubmissionRule
	VoteTieBreak            VoteTieBreak
	AllowEarlyFinalization  bool
	TeamGradingMode         TeamGradingMode
	PeerSplitMinPercent     float64
	PeerSplitMaxPercent     float64
	RosterLockedAt          *time.Time
	DeadlineAutoFinalizedAt *time.Time
	CreatedAt               time.Time
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
	IsReturned   bool
}

// Comment используется для комментариев к заданиям, постам и материалам.
// Ровно одно из AssignmentID / PostID / MaterialID непусто.
// IsPrivate = true означает личный комментарий: виден только автору и owner/teacher.
type Comment struct {
	ID           string
	AssignmentID string
	PostID       string
	MaterialID   string
	UserID       string
	ParentID     *string
	IsPrivate    bool
	Body         string
	FileIDs      []string
	CreatedAt    time.Time
}

type File struct {
	ID        string
	UserID    string
	FileName  string
	FileSize  int64
	MimeType  string
	CreatedAt time.Time
}

type Team struct {
	ID           string
	AssignmentID string
	CreatorID    string
	Name         string
	MaxMembers   int
	CreatedAt    time.Time
}

type TeamMember struct {
	TeamID   string
	UserID   string
	JoinedAt time.Time
}

type TeamSubmissionVote struct {
	ID           string
	AssignmentID string
	TeamID       string
	SubmissionID string
	VoterID      string
	Weight       float64
	CreatedAt    time.Time
}

type TeamSubmissionLike struct {
	ID           string
	AssignmentID string
	TeamID       string
	SubmissionID string
	UserID       string
	CreatedAt    time.Time
}

// TeamPeerGradeAllocation splits 100% of a team grade among members (team_peer_split mode).
type TeamPeerGradeAllocation struct {
	ID           string
	AssignmentID string
	TeamID       string
	UserID       string
	Percent      float64
	UpdatedAt    time.Time
}

type TeamAuditEventType string

const (
	TeamAuditRosterChanged      TeamAuditEventType = "roster_changed"
	TeamAuditVoteCast           TeamAuditEventType = "vote_cast"
	TeamAuditVoteFinalized      TeamAuditEventType = "vote_finalized"
	TeamAuditSubmissionAttached TeamAuditEventType = "submission_attached"
	TeamAuditDeadlineAutoFinal  TeamAuditEventType = "deadline_auto_finalized"
	TeamAuditGradeApplied       TeamAuditEventType = "grade_applied"
	TeamAuditRosterLocked       TeamAuditEventType = "roster_locked"
	TeamAuditPeerSplitSubmitted TeamAuditEventType = "peer_split_submitted"
	TeamAuditSubmissionLiked    TeamAuditEventType = "submission_liked"
)

type TeamAuditEvent struct {
	ID           string
	AssignmentID string
	TeamID       string
	ActorUserID  string
	EventType    TeamAuditEventType
	Payload      string // JSON
	CreatedAt    time.Time
}
