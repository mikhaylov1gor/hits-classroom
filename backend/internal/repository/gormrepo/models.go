package gormrepo

import "time"

type userModel struct {
	ID           string    `gorm:"primaryKey;type:text"`
	Email        string    `gorm:"uniqueIndex;type:text;not null"`
	PasswordHash string    `gorm:"type:text;not null"`
	FirstName    string    `gorm:"type:text;not null"`
	LastName     string    `gorm:"type:text;not null"`
	BirthDate    time.Time `gorm:"not null"`
	CreatedAt    time.Time `gorm:"not null"`
}

type courseModel struct {
	ID         string    `gorm:"primaryKey;type:text"`
	Title      string    `gorm:"type:text;not null"`
	InviteCode string    `gorm:"uniqueIndex;type:text;not null"`
	CreatedAt  time.Time `gorm:"not null"`
}

type courseMemberModel struct {
	CourseID     string    `gorm:"primaryKey;type:text"`
	UserID       string    `gorm:"primaryKey;type:text"`
	Role         string    `gorm:"type:text;not null"`
	Status       string    `gorm:"type:text;not null;default:'approved';index"`
	RequestedAt  time.Time `gorm:"not null"`
	DecidedAt    *time.Time
	DecidedBy    string `gorm:"type:text;not null;default:''"`
	DecisionNote string `gorm:"type:text;not null;default:''"`
}

type postModel struct {
	ID        string    `gorm:"primaryKey;type:text"`
	CourseID  string    `gorm:"index;type:text;not null"`
	UserID    string    `gorm:"type:text;not null"`
	Title     string    `gorm:"type:text;not null"`
	Body      string    `gorm:"type:text;not null"`
	Links     []string  `gorm:"serializer:json"`
	FileIDs   []string  `gorm:"serializer:json"`
	CreatedAt time.Time `gorm:"not null"`
}

type materialModel struct {
	ID        string    `gorm:"primaryKey;type:text"`
	CourseID  string    `gorm:"index;type:text;not null"`
	Title     string    `gorm:"type:text;not null"`
	Body      string    `gorm:"type:text;not null"`
	Links     []string  `gorm:"serializer:json"`
	FileIDs   []string  `gorm:"serializer:json"`
	CreatedAt time.Time `gorm:"not null"`
}

type assignmentModel struct {
	ID                      string   `gorm:"primaryKey;type:text"`
	CourseID                string   `gorm:"index;type:text;not null"`
	Title                   string   `gorm:"type:text;not null"`
	Body                    string   `gorm:"type:text;not null"`
	Links                   []string `gorm:"serializer:json"`
	FileIDs                 []string `gorm:"serializer:json"`
	Deadline                *time.Time
	MaxGrade                int     `gorm:"not null"`
	AssignmentKind          string  `gorm:"type:text;not null;default:'individual'"`
	DesiredTeamSize         int     `gorm:"not null;default:0"`
	TeamDistributionType    string  `gorm:"type:text;not null;default:'free'"`
	TeamCount               int     `gorm:"not null;default:0"`
	MaxTeamSize             int     `gorm:"not null;default:0"`
	TeamSubmissionRule      string  `gorm:"type:text;not null;default:'first_submission'"`
	VoteTieBreak            string  `gorm:"type:text;not null;default:'highest_author_average'"`
	AllowEarlyFinalization  bool    `gorm:"not null;default:true"`
	TeamGradingMode         string  `gorm:"type:text;not null;default:'individual'"`
	PeerSplitMinPercent     float64 `gorm:"not null;default:0"`
	PeerSplitMaxPercent     float64 `gorm:"not null;default:0"`
	RosterLockedAt          *time.Time
	DeadlineAutoFinalizedAt *time.Time
	CreatedAt               time.Time `gorm:"not null"`
}

type submissionModel struct {
	ID           string    `gorm:"primaryKey;type:text"`
	AssignmentID string    `gorm:"index;type:text;not null"`
	UserID       string    `gorm:"index;type:text;not null"`
	Body         string    `gorm:"type:text;not null"`
	FileIDs      []string  `gorm:"serializer:json"`
	SubmittedAt  time.Time `gorm:"not null"`
	Grade        *int
	GradeComment *string
	IsAttached   bool `gorm:"not null;default:false"`
	IsReturned   bool `gorm:"not null;default:false"`
}

type commentModel struct {
	ID           string    `gorm:"primaryKey;type:text"`
	AssignmentID string    `gorm:"index;type:text"`
	PostID       string    `gorm:"index;type:text"`
	MaterialID   string    `gorm:"index;type:text"`
	UserID       string    `gorm:"type:text;not null"`
	ParentID     *string   `gorm:"index;type:text"`
	IsPrivate    bool      `gorm:"not null;default:false"`
	Body         string    `gorm:"type:text;not null"`
	FileIDs      []string  `gorm:"serializer:json"`
	CreatedAt    time.Time `gorm:"not null"`
}

type fileModel struct {
	ID        string    `gorm:"primaryKey;type:text"`
	UserID    string    `gorm:"index;type:text;not null"`
	FileName  string    `gorm:"type:text;not null"`
	FileSize  int64     `gorm:"not null"`
	MimeType  string    `gorm:"type:text;not null"`
	CreatedAt time.Time `gorm:"not null"`
}

type teamModel struct {
	ID           string    `gorm:"primaryKey;type:text"`
	AssignmentID string    `gorm:"type:text;not null;uniqueIndex:ux_team_name_per_assignment"`
	CreatorID    string    `gorm:"type:text;not null"`
	Name         string    `gorm:"type:text;not null;uniqueIndex:ux_team_name_per_assignment"`
	MaxMembers   int       `gorm:"not null"`
	CreatedAt    time.Time `gorm:"not null"`
}

type teamMemberModel struct {
	TeamID   string    `gorm:"primaryKey;type:text"`
	UserID   string    `gorm:"primaryKey;type:text"`
	JoinedAt time.Time `gorm:"not null"`
}

type teamSubmissionVoteModel struct {
	ID           string    `gorm:"primaryKey;type:text"`
	AssignmentID string    `gorm:"index;uniqueIndex:ux_vote_per_user;type:text;not null"`
	TeamID       string    `gorm:"index;uniqueIndex:ux_vote_per_user;type:text;not null"`
	SubmissionID string    `gorm:"index;type:text;not null"`
	VoterID      string    `gorm:"index;uniqueIndex:ux_vote_per_user;type:text;not null"`
	Weight       float64   `gorm:"not null"`
	CreatedAt    time.Time `gorm:"not null"`
}

type teamSubmissionLikeModel struct {
	ID           string    `gorm:"primaryKey;type:text"`
	AssignmentID string    `gorm:"index;uniqueIndex:ux_team_submission_like;type:text;not null"`
	TeamID       string    `gorm:"index;uniqueIndex:ux_team_submission_like;type:text;not null"`
	SubmissionID string    `gorm:"index;uniqueIndex:ux_team_submission_like;type:text;not null"`
	UserID       string    `gorm:"uniqueIndex:ux_team_submission_like;type:text;not null"`
	CreatedAt    time.Time `gorm:"not null"`
}

type teamPeerGradeModel struct {
	ID           string    `gorm:"primaryKey;type:text"`
	AssignmentID string    `gorm:"uniqueIndex:ux_team_peer_alloc;type:text;not null"`
	TeamID       string    `gorm:"uniqueIndex:ux_team_peer_alloc;type:text;not null"`
	UserID       string    `gorm:"uniqueIndex:ux_team_peer_alloc;type:text;not null"`
	Percent      float64   `gorm:"not null"`
	UpdatedAt    time.Time `gorm:"not null"`
}

type teamAuditModel struct {
	ID           string    `gorm:"primaryKey;type:text"`
	AssignmentID string    `gorm:"index;type:text;not null"`
	TeamID       string    `gorm:"index;type:text;not null"`
	ActorUserID  string    `gorm:"type:text;not null"`
	EventType    string    `gorm:"type:text;not null"`
	Payload      string    `gorm:"type:text;not null"`
	CreatedAt    time.Time `gorm:"not null"`
}
