package usecase

import (
	"errors"
	"io/ioutil"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"

	"github.com/google/uuid"
)

type CreatePostInput struct {
	CourseID string
	UserID   string
	Title    string
	Body     string
	Links    []string
	FileIDs  []string
}

type CreatePost struct {
	memberRepo repository.CourseMemberRepository
	postRepo   repository.PostRepository
}

func NewCreatePost(memberRepo repository.CourseMemberRepository, postRepo repository.PostRepository) *CreatePost {
	return &CreatePost{memberRepo: memberRepo, postRepo: postRepo}
}

// CreatePost доступен всем участникам курса (owner, teacher, student).
func (uc *CreatePost) CreatePost(in CreatePostInput) (*domain.Post, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, &ValidationError{Message: "title is required"}
	}
	p := &domain.Post{
		ID:        uuid.New().String(),
		CourseID:  in.CourseID,
		UserID:    in.UserID,
		Title:     title,
		Body:      in.Body,
		Links:     in.Links,
		FileIDs:   in.FileIDs,
		CreatedAt: time.Now().UTC(),
	}
	if err := uc.postRepo.Create(p); err != nil {
		return nil, err
	}
	return p, nil
}

type CreateMaterialInput struct {
	CourseID string
	UserID   string
	Title    string
	Body     string
	Links    []string
	FileIDs  []string
}

type CreateMaterial struct {
	memberRepo   repository.CourseMemberRepository
	materialRepo repository.MaterialRepository
}

func NewCreateMaterial(memberRepo repository.CourseMemberRepository, materialRepo repository.MaterialRepository) *CreateMaterial {
	return &CreateMaterial{memberRepo: memberRepo, materialRepo: materialRepo}
}

func (uc *CreateMaterial) CreateMaterial(in CreateMaterialInput) (*domain.Material, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrValidation
	}
	m := &domain.Material{
		ID:        uuid.New().String(),
		CourseID:  in.CourseID,
		Title:     title,
		Body:      in.Body,
		Links:     in.Links,
		FileIDs:   in.FileIDs,
		CreatedAt: time.Now().UTC(),
	}
	if err := uc.materialRepo.Create(m); err != nil {
		return nil, err
	}
	return m, nil
}

type CreateAssignmentInput struct {
	CourseID               string
	UserID                 string
	Title                  string
	Body                   string
	Links                  []string
	FileIDs                []string
	Deadline               *time.Time
	MaxGrade               int
	AssignmentKind         domain.AssignmentKind
	DesiredTeamSize        int
	TeamDistributionType   domain.TeamDistributionType
	TeamCount              int
	TeamSubmissionRule     domain.TeamSubmissionRule
	VoteTieBreak           domain.VoteTieBreak
	AllowEarlyFinalization *bool
	TeamGradingMode        domain.TeamGradingMode
	PeerSplitMinPercent    float64
	PeerSplitMaxPercent    float64
}

type CreateAssignment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
}

func NewCreateAssignment(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository) *CreateAssignment {
	return &CreateAssignment{memberRepo: memberRepo, assignmentRepo: assignmentRepo}
}

func (uc *CreateAssignment) CreateAssignment(in CreateAssignmentInput) (*domain.Assignment, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrValidation
	}
	maxGrade := in.MaxGrade
	if maxGrade <= 0 {
		maxGrade = 100
	}
	distributionType := in.TeamDistributionType
	if distributionType == "" {
		distributionType = domain.TeamDistributionFree
	}
	teamRule := in.TeamSubmissionRule
	if teamRule == "" {
		teamRule = domain.TeamRuleFirstSubmission
	}
	if in.TeamCount < 0 {
		return nil, &ValidationError{Message: "team_count cannot be negative"}
	}
	students, err := listStudentIDs(in.CourseID, uc.memberRepo)
	if err != nil {
		return nil, err
	}
	n := len(students)
	teamCount := 0
	maxTeamSize := 0
	switch {
	case in.DesiredTeamSize >= 2:
		if n == 0 {
			teamCount = 1
			maxTeamSize = in.DesiredTeamSize
		} else {
			teamCount = int(math.Ceil(float64(n) / float64(in.DesiredTeamSize)))
			if teamCount < 1 {
				teamCount = 1
			}
			maxTeamSize = int(math.Ceil(float64(n) / float64(teamCount)))
			if maxTeamSize < 2 {
				maxTeamSize = 2
			}
		}
	case in.TeamCount > 0:
		teamCount = in.TeamCount
		var cerr error
		maxTeamSize, cerr = calcMaxTeamSize(n, teamCount)
		if cerr != nil {
			return nil, cerr
		}
	}
	kind := in.AssignmentKind
	if kind == "" {
		if teamCount > 0 {
			kind = domain.AssignmentKindGroup
		} else {
			kind = domain.AssignmentKindIndividual
		}
	}
	if kind == domain.AssignmentKindIndividual {
		teamCount = 0
		maxTeamSize = 0
	}
	if kind == domain.AssignmentKindGroup && teamCount <= 0 {
		return nil, &ValidationError{Message: "group assignment requires desired_team_size >= 2 or team_count > 0"}
	}
	gradingMode := in.TeamGradingMode
	if gradingMode == "" {
		gradingMode = domain.TeamGradingIndividual
	}
	if gradingMode == domain.TeamGradingPeerSplit {
		if kind != domain.AssignmentKindGroup {
			return nil, &ValidationError{Message: "peer_split grading applies only to group assignments"}
		}
		if in.PeerSplitMinPercent < 0 || in.PeerSplitMaxPercent > 100 || in.PeerSplitMinPercent > in.PeerSplitMaxPercent {
			return nil, &ValidationError{Message: "peer_split_min_percent and peer_split_max_percent must be between 0 and 100 with min <= max"}
		}
	}
	if gradingMode == domain.TeamGradingTeamUniform && kind != domain.AssignmentKindGroup {
		return nil, &ValidationError{Message: "team_uniform grading applies only to group assignments"}
	}
	voteTie := in.VoteTieBreak
	if voteTie == "" {
		voteTie = domain.VoteTieBreakHighestAuthorAverage
	}
	allowEarly := true
	if in.AllowEarlyFinalization != nil {
		allowEarly = *in.AllowEarlyFinalization
	}
	a := &domain.Assignment{
		ID:                     uuid.New().String(),
		CourseID:               in.CourseID,
		Title:                  title,
		Body:                   in.Body,
		Links:                  in.Links,
		FileIDs:                in.FileIDs,
		Deadline:               in.Deadline,
		MaxGrade:               maxGrade,
		AssignmentKind:         kind,
		DesiredTeamSize:        in.DesiredTeamSize,
		TeamDistributionType:   distributionType,
		TeamCount:              teamCount,
		MaxTeamSize:            maxTeamSize,
		TeamSubmissionRule:     teamRule,
		VoteTieBreak:           voteTie,
		AllowEarlyFinalization: allowEarly,
		TeamGradingMode:        gradingMode,
		PeerSplitMinPercent:    in.PeerSplitMinPercent,
		PeerSplitMaxPercent:    in.PeerSplitMaxPercent,
		CreatedAt:              time.Now().UTC(),
	}
	if err := uc.assignmentRepo.Create(a); err != nil {
		return nil, err
	}
	return a, nil
}

type UpdateAssignmentInput struct {
	CourseID               string
	AssignmentID           string
	UserID                 string
	Title                  string
	Body                   string
	Links                  []string
	FileIDs                []string
	Deadline               *time.Time
	MaxGrade               int
	AssignmentKind         domain.AssignmentKind
	DesiredTeamSize        int
	TeamDistributionType   domain.TeamDistributionType
	TeamCount              int
	TeamSubmissionRule     domain.TeamSubmissionRule
	VoteTieBreak           domain.VoteTieBreak
	AllowEarlyFinalization *bool
	TeamGradingMode        domain.TeamGradingMode
	PeerSplitMinPercent    float64
	PeerSplitMaxPercent    float64
}

type UpdateAssignment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
}

func NewUpdateAssignment(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
) *UpdateAssignment {
	return &UpdateAssignment{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo,
	}
}

func (uc *UpdateAssignment) UpdateAssignment(in UpdateAssignmentInput) (*domain.Assignment, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrValidation
	}
	a.Title = title
	a.Body = in.Body
	a.Links = in.Links
	a.FileIDs = in.FileIDs
	a.Deadline = in.Deadline
	if in.MaxGrade > 0 {
		a.MaxGrade = in.MaxGrade
	}
	if in.AssignmentKind != "" {
		a.AssignmentKind = in.AssignmentKind
	}
	a.DesiredTeamSize = in.DesiredTeamSize
	if in.TeamDistributionType != "" {
		a.TeamDistributionType = in.TeamDistributionType
	}
	a.TeamCount = in.TeamCount
	if in.TeamSubmissionRule != "" {
		a.TeamSubmissionRule = in.TeamSubmissionRule
	}
	if in.VoteTieBreak != "" {
		a.VoteTieBreak = in.VoteTieBreak
	}
	if in.AllowEarlyFinalization != nil {
		a.AllowEarlyFinalization = *in.AllowEarlyFinalization
	}
	if in.TeamGradingMode != "" {
		a.TeamGradingMode = in.TeamGradingMode
	}
	a.PeerSplitMinPercent = in.PeerSplitMinPercent
	a.PeerSplitMaxPercent = in.PeerSplitMaxPercent

	// Recalculate team_count/max_team_size when desired_team_size is specified.
	if a.DesiredTeamSize >= 2 {
		students, serr := listStudentIDs(in.CourseID, uc.memberRepo)
		if serr != nil {
			return nil, serr
		}
		n := len(students)
		if n == 0 {
			a.TeamCount = 1
			a.MaxTeamSize = a.DesiredTeamSize
		} else {
			a.TeamCount = int(math.Ceil(float64(n) / float64(a.DesiredTeamSize)))
			if a.TeamCount < 1 {
				a.TeamCount = 1
			}
			a.MaxTeamSize = int(math.Ceil(float64(n) / float64(a.TeamCount)))
			if a.MaxTeamSize < 2 {
				a.MaxTeamSize = 2
			}
		}
	} else if a.TeamCount > 0 {
		students, serr := listStudentIDs(in.CourseID, uc.memberRepo)
		if serr != nil {
			return nil, serr
		}
		maxTeamSize, cerr := calcMaxTeamSize(len(students), a.TeamCount)
		if cerr != nil {
			return nil, cerr
		}
		a.MaxTeamSize = maxTeamSize
	}

	if a.AssignmentKind == domain.AssignmentKindGroup && a.TeamCount <= 0 {
		return nil, &ValidationError{Message: "group assignment requires desired_team_size >= 2 or team_count > 0"}
	}
	if a.AssignmentKind == domain.AssignmentKindIndividual {
		a.TeamCount = 0
		a.MaxTeamSize = 0
	}
	if a.DesiredTeamSize > 0 && a.DesiredTeamSize < 2 {
		return nil, &ValidationError{Message: "team size must be at least 2"}
	}
	if a.TeamGradingMode == domain.TeamGradingPeerSplit {
		if a.AssignmentKind != domain.AssignmentKindGroup {
			return nil, &ValidationError{Message: "peer_split grading applies only to group assignments"}
		}
		if a.PeerSplitMinPercent < 0 || a.PeerSplitMaxPercent > 100 || a.PeerSplitMinPercent > a.PeerSplitMaxPercent {
			return nil, &ValidationError{Message: "peer_split_min_percent and peer_split_max_percent must be between 0 and 100 with min <= max"}
		}
	}
	if uc.teamRepo != nil && uc.teamMemberRepo != nil && a.MaxTeamSize > 0 {
		teams, _ := uc.teamRepo.ListByAssignment(a.ID)
		for _, t := range teams {
			members, _ := uc.teamMemberRepo.ListByTeam(t.ID)
			if len(members) > a.MaxTeamSize {
				return nil, &ValidationError{Message: "existing teams exceed new max_team_size; manual intervention required"}
			}
		}
	}

	if err := uc.assignmentRepo.Update(a); err != nil {
		return nil, err
	}
	return a, nil
}

type GetAssignment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
}

func NewGetAssignment(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository) *GetAssignment {
	return &GetAssignment{memberRepo: memberRepo, assignmentRepo: assignmentRepo}
}

func (uc *GetAssignment) GetAssignment(courseID, assignmentID, userID string) (*domain.Assignment, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	return a, nil
}

type FeedItem struct {
	Type      string
	ID        string
	Title     string
	CreatedAt time.Time
	Deadline  *time.Time
}

type GetCourseFeed struct {
	memberRepo     repository.CourseMemberRepository
	postRepo       repository.PostRepository
	materialRepo   repository.MaterialRepository
	assignmentRepo repository.AssignmentRepository
}

func NewGetCourseFeed(memberRepo repository.CourseMemberRepository, postRepo repository.PostRepository, materialRepo repository.MaterialRepository, assignmentRepo repository.AssignmentRepository) *GetCourseFeed {
	return &GetCourseFeed{
		memberRepo:     memberRepo,
		postRepo:       postRepo,
		materialRepo:   materialRepo,
		assignmentRepo: assignmentRepo,
	}
}

func (uc *GetCourseFeed) GetCourseFeed(courseID, userID string) ([]FeedItem, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	posts, _ := uc.postRepo.ListByCourse(courseID)
	materials, _ := uc.materialRepo.ListByCourse(courseID)
	assignments, _ := uc.assignmentRepo.ListByCourse(courseID)
	var items []FeedItem
	for _, p := range posts {
		items = append(items, FeedItem{Type: "post", ID: p.ID, Title: p.Title, CreatedAt: p.CreatedAt, Deadline: nil})
	}
	for _, m := range materials {
		items = append(items, FeedItem{Type: "material", ID: m.ID, Title: m.Title, CreatedAt: m.CreatedAt, Deadline: nil})
	}
	for _, a := range assignments {
		items = append(items, FeedItem{Type: "assignment", ID: a.ID, Title: a.Title, CreatedAt: a.CreatedAt, Deadline: a.Deadline})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	return items, nil
}

var ErrAlreadySubmitted = errors.New("already submitted")

type CreateSubmissionInput struct {
	CourseID     string
	AssignmentID string
	UserID       string
	Body         string
	FileIDs      []string
	IsAttached   bool
}

type CreateSubmission struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
	teamMemberRepo repository.TeamMemberRepository
}

func NewCreateSubmission(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository, teamMemberRepo repository.TeamMemberRepository) *CreateSubmission {
	return &CreateSubmission{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo, teamMemberRepo: teamMemberRepo,
	}
}

func (uc *CreateSubmission) CreateSubmission(in CreateSubmissionInput) (*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	if a.IsGroup() {
		team, err := uc.teamMemberRepo.GetTeamByUser(in.AssignmentID, in.UserID)
		if err != nil {
			return nil, err
		}
		if team == nil {
			return nil, ErrForbidden
		}
	}

	if in.IsAttached {
		if a.Deadline != nil && time.Now().UTC().After(*a.Deadline) {
			return nil, ErrAssignmentClosed
		}
	}
	if a.IsGroup() && in.IsAttached {
		now := time.Now().UTC()
		if !a.AllowEarlyFinalization && a.Deadline != nil && now.Before(*a.Deadline) {
			if a.TeamSubmissionRule != domain.TeamRuleVoteEqual && a.TeamSubmissionRule != domain.TeamRuleVoteWeighted {
				return nil, &ValidationError{Message: "final submission is not allowed before deadline"}
			}
		}
		team, err := uc.teamMemberRepo.GetTeamByUser(in.AssignmentID, in.UserID)
		if err != nil {
			return nil, err
		}
		if team == nil {
			return nil, ErrForbidden
		}
		members, err := uc.teamMemberRepo.ListByTeam(team.ID)
		if err != nil {
			return nil, err
		}
		memberSet := make(map[string]bool, len(members))
		for _, m := range members {
			memberSet[m.UserID] = true
		}
		allSubs, err := uc.submissionRepo.ListByAssignment(in.AssignmentID)
		if err != nil {
			return nil, err
		}
		if a.TeamSubmissionRule == domain.TeamRuleFirstSubmission {
			for _, s := range allSubs {
				if memberSet[s.UserID] && s.IsAttached && !s.IsReturned {
					return nil, ErrAlreadySubmitted
				}
			}
		}
		if a.TeamSubmissionRule == domain.TeamRuleTopStudentOnly {
			var bestUser string
			bestScore := -1.0
			for _, m := range members {
				score, _ := calcNormalizedAverage(in.CourseID, m.UserID, uc.assignmentRepo, uc.submissionRepo)
				if score > bestScore {
					bestScore = score
					bestUser = m.UserID
				}
			}
			if bestUser != "" && bestUser != in.UserID {
				return nil, ErrForbidden
			}
		}
		if a.TeamSubmissionRule == domain.TeamRuleVoteEqual || a.TeamSubmissionRule == domain.TeamRuleVoteWeighted {
			return nil, &ValidationError{Message: "use voting finalize endpoint for this assignment"}
		}
	}

	existing, _ := uc.submissionRepo.GetByAssignmentAndUser(in.AssignmentID, in.UserID)
	if existing != nil {
		// Если уже есть черновик или возвращённая отправка, обновляем её
		existing.Body = in.Body
		existing.FileIDs = in.FileIDs
		existing.SubmittedAt = time.Now().UTC()
		existing.IsAttached = in.IsAttached
		if in.IsAttached {
			// При прикреплении очищаем флаг возврата
			existing.IsReturned = false
		}
		if err := uc.submissionRepo.Update(existing); err != nil {
			return nil, err
		}
		if a.IsGroup() && in.IsAttached && a.TeamSubmissionRule == domain.TeamRuleLastSubmission {
			if err := uc.detachAttachedPeers(in.AssignmentID, existing.UserID); err != nil {
				return nil, err
			}
		}
		return existing, nil
	}
	s := &domain.Submission{
		ID:           uuid.New().String(),
		AssignmentID: in.AssignmentID,
		UserID:       in.UserID,
		Body:         in.Body,
		FileIDs:      in.FileIDs,
		SubmittedAt:  time.Now().UTC(),
		IsAttached:   in.IsAttached,
	}
	if err := uc.submissionRepo.Create(s); err != nil {
		return nil, err
	}
	if a.IsGroup() && in.IsAttached && a.TeamSubmissionRule == domain.TeamRuleLastSubmission {
		if err := uc.detachAttachedPeers(in.AssignmentID, in.UserID); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func (uc *CreateSubmission) detachAttachedPeers(assignmentID, exceptUserID string) error {
	team, err := uc.teamMemberRepo.GetTeamByUser(assignmentID, exceptUserID)
	if err != nil || team == nil {
		return err
	}
	members, err := uc.teamMemberRepo.ListByTeam(team.ID)
	if err != nil {
		return err
	}
	memberSet := make(map[string]bool, len(members))
	for _, m := range members {
		memberSet[m.UserID] = true
	}
	allSubs, err := uc.submissionRepo.ListByAssignment(assignmentID)
	if err != nil {
		return err
	}
	for _, sub := range allSubs {
		if !memberSet[sub.UserID] || sub.UserID == exceptUserID || !sub.IsAttached {
			continue
		}
		sub.IsAttached = false
		if err := uc.submissionRepo.Update(sub); err != nil {
			return err
		}
	}
	return nil
}

type ListSubmissions struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewListSubmissions(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *ListSubmissions {
	return &ListSubmissions{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *ListSubmissions) ListSubmissions(courseID, assignmentID, userID string) ([]*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	if role == domain.RoleOwner || role == domain.RoleTeacher {
		return uc.submissionRepo.ListByAssignment(assignmentID)
	}
	// Студент видит только свой ответ
	s, err := uc.submissionRepo.GetByAssignmentAndUser(assignmentID, userID)
	if err != nil {
		return nil, err
	}
	if s == nil {
		return []*domain.Submission{}, nil
	}
	return []*domain.Submission{s}, nil
}

type GradeSubmissionInput struct {
	CourseID     string
	AssignmentID string
	SubmissionID string
	UserID       string
	Grade        int
	GradeComment string
}

type GradeSubmission struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
	teamMemberRepo repository.TeamMemberRepository
	auditRepo      repository.TeamAuditRepository
}

func NewGradeSubmission(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	submissionRepo repository.SubmissionRepository,
	teamMemberRepo repository.TeamMemberRepository,
	auditRepo repository.TeamAuditRepository,
) *GradeSubmission {
	return &GradeSubmission{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo,
		teamMemberRepo: teamMemberRepo, auditRepo: auditRepo,
	}
}

func (uc *GradeSubmission) GradeSubmission(in GradeSubmissionInput) (*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	if a.TeamGradingMode == domain.TeamGradingPeerSplit {
		return nil, &ValidationError{Message: "use POST .../teams/{teamId}/grade-peer-split for this assignment"}
	}
	s, err := uc.submissionRepo.GetByID(in.SubmissionID)
	if err != nil || s == nil || s.AssignmentID != in.AssignmentID {
		return nil, ErrCourseNotFound
	}
	if in.Grade < 0 || in.Grade > a.MaxGrade {
		return nil, &ValidationError{Message: "grade must be between 0 and " + itoa(a.MaxGrade)}
	}
	s.Grade = &in.Grade
	if in.GradeComment != "" {
		s.GradeComment = &in.GradeComment
	}
	if err := uc.submissionRepo.Update(s); err != nil {
		return nil, err
	}
	if a.TeamGradingMode == domain.TeamGradingTeamUniform && a.IsGroup() && uc.teamMemberRepo != nil {
		team, terr := uc.teamMemberRepo.GetTeamByUser(in.AssignmentID, s.UserID)
		if terr == nil && team != nil {
			mems, merr := uc.teamMemberRepo.ListByTeam(team.ID)
			if merr == nil {
				for _, m := range mems {
					if m.UserID == s.UserID {
						continue
					}
					o, _ := uc.submissionRepo.GetByAssignmentAndUser(in.AssignmentID, m.UserID)
					if o == nil {
						continue
					}
					g := in.Grade
					o.Grade = &g
					if in.GradeComment != "" {
						cc := in.GradeComment
						o.GradeComment = &cc
					}
					if err := uc.submissionRepo.Update(o); err != nil {
						return nil, err
					}
				}
				tryTeamAudit(uc.auditRepo, in.AssignmentID, team.ID, in.UserID, domain.TeamAuditGradeApplied, map[string]string{"mode": "team_uniform"})
			}
		}
	} else {
		tryTeamAudit(uc.auditRepo, in.AssignmentID, "", in.UserID, domain.TeamAuditGradeApplied, map[string]string{"submission_id": s.ID})
	}
	return s, nil
}

type DetachAssignmentInput struct {
	CourseID     string
	AssignmentID string
	UserID       string
}

type DetachSubmission struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewDetachSubmission(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *DetachSubmission {
	return &DetachSubmission{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *DetachSubmission) DetachSubmission(in DetachAssignmentInput) (*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	if a.Deadline != nil && time.Now().UTC().After(*a.Deadline) {
		return nil, ErrAssignmentClosed
	}
	s, err := uc.submissionRepo.GetByAssignmentAndUser(in.AssignmentID, in.UserID)
	if err != nil || s == nil {
		return nil, ErrCourseNotFound
	}
	if !s.IsAttached {
		return nil, &ValidationError{Message: "submission is already detached"}
	}
	s.IsAttached = false
	s.Grade = nil
	s.GradeComment = nil
	if err := uc.submissionRepo.Update(s); err != nil {
		return nil, err
	}
	return s, nil
}

type ReturnAssignmentInput struct {
	CourseID     string
	AssignmentID string
	SubmissionID string
	UserID       string
}

type ReturnAssignment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewReturnAssignment(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *ReturnAssignment {
	return &ReturnAssignment{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *ReturnAssignment) ReturnAssignment(in ReturnAssignmentInput) (*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	s, err := uc.submissionRepo.GetByID(in.SubmissionID)
	if err != nil || s == nil || s.AssignmentID != in.AssignmentID {
		return nil, ErrCourseNotFound
	}
	if !s.IsAttached {
		return nil, &ValidationError{Message: "can only return attached submissions"}
	}
	s.IsReturned = true
	if err := uc.submissionRepo.Update(s); err != nil {
		return nil, err
	}
	return s, nil
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}

type SubmissionWithAssignmentItem struct {
	Submission *domain.Submission
	Assignment *domain.Assignment
}

type GetStudentGrades struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewGetStudentGrades(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *GetStudentGrades {
	return &GetStudentGrades{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *GetStudentGrades) GetStudentGrades(courseID, targetUserID, userID string) ([]SubmissionWithAssignmentItem, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if userID != targetUserID && role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	member, _ := uc.memberRepo.Get(courseID, targetUserID)
	if member == nil {
		return nil, ErrCourseNotFound
	}
	assignments, _ := uc.assignmentRepo.ListByCourse(courseID)
	var out []SubmissionWithAssignmentItem
	for _, a := range assignments {
		s, _ := uc.submissionRepo.GetByAssignmentAndUser(a.ID, targetUserID)
		if s != nil {
			out = append(out, SubmissionWithAssignmentItem{Submission: s, Assignment: a})
		}
	}
	return out, nil
}

// ── Comment usecases ──────────────────────────────────────────────────────────

type ListComments struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	commentRepo    repository.CommentRepository
}

func NewListComments(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, commentRepo repository.CommentRepository) *ListComments {
	return &ListComments{memberRepo: memberRepo, assignmentRepo: assignmentRepo, commentRepo: commentRepo}
}

func (uc *ListComments) ListComments(courseID, assignmentID, userID string) ([]*domain.Comment, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	all, err := uc.commentRepo.ListByAssignment(assignmentID)
	if err != nil {
		return nil, err
	}
	return filterPrivateComments(all, userID, role), nil
}

type ListPostComments struct {
	memberRepo  repository.CourseMemberRepository
	postRepo    repository.PostRepository
	commentRepo repository.CommentRepository
}

func NewListPostComments(memberRepo repository.CourseMemberRepository, postRepo repository.PostRepository, commentRepo repository.CommentRepository) *ListPostComments {
	return &ListPostComments{memberRepo: memberRepo, postRepo: postRepo, commentRepo: commentRepo}
}

func (uc *ListPostComments) ListPostComments(courseID, postID, userID string) ([]*domain.Comment, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	p, err := uc.postRepo.GetByID(postID)
	if err != nil || p == nil || p.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	all, err := uc.commentRepo.ListByPost(postID)
	if err != nil {
		return nil, err
	}
	return filterPrivateComments(all, userID, role), nil
}

type CreateCommentInput struct {
	CourseID     string
	AssignmentID string
	PostID       string
	MaterialID   string
	UserID       string
	ParentID     *string
	IsPrivate    bool
	Body         string
	FileIDs      []string
}

type CreateComment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	postRepo       repository.PostRepository
	materialRepo   repository.MaterialRepository
	commentRepo    repository.CommentRepository
}

func NewCreateComment(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, postRepo repository.PostRepository, materialRepo repository.MaterialRepository, commentRepo repository.CommentRepository) *CreateComment {
	return &CreateComment{memberRepo: memberRepo, assignmentRepo: assignmentRepo, postRepo: postRepo, materialRepo: materialRepo, commentRepo: commentRepo}
}

func (uc *CreateComment) CreateComment(in CreateCommentInput) (*domain.Comment, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if strings.TrimSpace(in.Body) == "" {
		return nil, &ValidationError{Message: "body is required"}
	}
	if in.AssignmentID != "" {
		a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
		if err != nil || a == nil || a.CourseID != in.CourseID {
			return nil, ErrCourseNotFound
		}
	} else if in.PostID != "" {
		p, err := uc.postRepo.GetByID(in.PostID)
		if err != nil || p == nil || p.CourseID != in.CourseID {
			return nil, ErrCourseNotFound
		}
	} else if in.MaterialID != "" {
		m, err := uc.materialRepo.GetByID(in.MaterialID)
		if err != nil || m == nil || m.CourseID != in.CourseID {
			return nil, ErrCourseNotFound
		}
	} else {
		return nil, &ValidationError{Message: "assignment_id, post_id, or material_id is required"}
	}
	isPrivate := in.IsPrivate
	if in.ParentID != nil {
		parent, err := uc.commentRepo.GetByID(*in.ParentID)
		if err != nil || parent == nil {
			return nil, ErrCourseNotFound
		}
		if parent.AssignmentID != in.AssignmentID || parent.PostID != in.PostID || parent.MaterialID != in.MaterialID {
			return nil, ErrCourseNotFound
		}
		// Ответ на приватный комментарий автоматически приватный
		if parent.IsPrivate {
			isPrivate = true
		}
	}
	c := &domain.Comment{
		ID:           uuid.New().String(),
		AssignmentID: in.AssignmentID,
		PostID:       in.PostID,
		MaterialID:   in.MaterialID,
		UserID:       in.UserID,
		ParentID:     in.ParentID,
		IsPrivate:    isPrivate,
		Body:         in.Body,
		FileIDs:      in.FileIDs,
		CreatedAt:    time.Now().UTC(),
	}
	if err := uc.commentRepo.Create(c); err != nil {
		return nil, err
	}
	return c, nil
}

var ErrCommentNotFound = errors.New("comment not found")

type DeleteCommentInput struct {
	CourseID  string
	CommentID string
	UserID    string
}

type DeleteComment struct {
	memberRepo  repository.CourseMemberRepository
	commentRepo repository.CommentRepository
}

func NewDeleteComment(memberRepo repository.CourseMemberRepository, commentRepo repository.CommentRepository) *DeleteComment {
	return &DeleteComment{memberRepo: memberRepo, commentRepo: commentRepo}
}

func (uc *DeleteComment) DeleteComment(in DeleteCommentInput) error {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return ErrForbidden
	}
	comment, err := uc.commentRepo.GetByID(in.CommentID)
	if err != nil || comment == nil {
		return ErrCommentNotFound
	}
	// Автор может удалять свои, owner/teacher — любые
	if comment.UserID != in.UserID && role != domain.RoleOwner && role != domain.RoleTeacher {
		return ErrForbidden
	}
	var allComments []*domain.Comment
	if comment.AssignmentID != "" {
		allComments, _ = uc.commentRepo.ListByAssignment(comment.AssignmentID)
	} else if comment.PostID != "" {
		allComments, _ = uc.commentRepo.ListByPost(comment.PostID)
	} else {
		allComments, _ = uc.commentRepo.ListByMaterial(comment.MaterialID)
	}
	toDelete := collectDescendants(in.CommentID, allComments)
	toDelete = append(toDelete, in.CommentID)
	for _, id := range toDelete {
		if err := uc.commentRepo.Delete(id); err != nil {
			return err
		}
	}
	return nil
}

// collectDescendants рекурсивно собирает ID всех дочерних комментариев.
func collectDescendants(parentID string, all []*domain.Comment) []string {
	var ids []string
	for _, c := range all {
		if c.ParentID != nil && *c.ParentID == parentID {
			ids = append(ids, c.ID)
			ids = append(ids, collectDescendants(c.ID, all)...)
		}
	}
	return ids
}

// ── GetPost ───────────────────────────────────────────────────────────────────

type GetPost struct {
	memberRepo repository.CourseMemberRepository
	postRepo   repository.PostRepository
}

func NewGetPost(memberRepo repository.CourseMemberRepository, postRepo repository.PostRepository) *GetPost {
	return &GetPost{memberRepo: memberRepo, postRepo: postRepo}
}

func (uc *GetPost) GetPost(courseID, postID, userID string) (*domain.Post, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	p, err := uc.postRepo.GetByID(postID)
	if err != nil || p == nil || p.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	return p, nil
}

// ── GetMaterial ───────────────────────────────────────────────────────────────

type GetMaterial struct {
	memberRepo   repository.CourseMemberRepository
	materialRepo repository.MaterialRepository
}

func NewGetMaterial(memberRepo repository.CourseMemberRepository, materialRepo repository.MaterialRepository) *GetMaterial {
	return &GetMaterial{memberRepo: memberRepo, materialRepo: materialRepo}
}

func (uc *GetMaterial) GetMaterial(courseID, materialID, userID string) (*domain.Material, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	m, err := uc.materialRepo.GetByID(materialID)
	if err != nil || m == nil || m.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	return m, nil
}

// ── GetMySubmission ───────────────────────────────────────────────────────────

type GetMySubmission struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewGetMySubmission(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *GetMySubmission {
	return &GetMySubmission{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *GetMySubmission) GetMySubmission(courseID, assignmentID, userID string) (*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	s, err := uc.submissionRepo.GetByAssignmentAndUser(assignmentID, userID)
	if err != nil {
		return nil, err
	}
	if s == nil {
		return nil, ErrCourseNotFound
	}
	return s, nil
}

// ── DeletePost ────────────────────────────────────────────────────────────────

type DeletePost struct {
	memberRepo  repository.CourseMemberRepository
	postRepo    repository.PostRepository
	commentRepo repository.CommentRepository
}

func NewDeletePost(memberRepo repository.CourseMemberRepository, postRepo repository.PostRepository, commentRepo repository.CommentRepository) *DeletePost {
	return &DeletePost{memberRepo: memberRepo, postRepo: postRepo, commentRepo: commentRepo}
}

func (uc *DeletePost) DeletePost(courseID, postID, userID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return ErrForbidden
	}
	p, err := uc.postRepo.GetByID(postID)
	if err != nil || p == nil || p.CourseID != courseID {
		return ErrCourseNotFound
	}
	if p.UserID != userID && role != domain.RoleOwner && role != domain.RoleTeacher {
		return ErrForbidden
	}
	_ = uc.commentRepo.DeleteByPost(postID)
	return uc.postRepo.Delete(postID)
}

// ── DeleteMaterial ────────────────────────────────────────────────────────────

type DeleteMaterial struct {
	memberRepo   repository.CourseMemberRepository
	materialRepo repository.MaterialRepository
	commentRepo  repository.CommentRepository
}

func NewDeleteMaterial(memberRepo repository.CourseMemberRepository, materialRepo repository.MaterialRepository, commentRepo repository.CommentRepository) *DeleteMaterial {
	return &DeleteMaterial{memberRepo: memberRepo, materialRepo: materialRepo, commentRepo: commentRepo}
}

func (uc *DeleteMaterial) DeleteMaterial(courseID, materialID, userID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return ErrForbidden
	}
	m, err := uc.materialRepo.GetByID(materialID)
	if err != nil || m == nil || m.CourseID != courseID {
		return ErrCourseNotFound
	}
	_ = uc.commentRepo.DeleteByMaterial(materialID)
	return uc.materialRepo.Delete(materialID)
}

// ── DeleteAssignment ──────────────────────────────────────────────────────────

type DeleteAssignment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
	commentRepo    repository.CommentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	teamVoteRepo   repository.TeamVoteRepository
	peerRepo       repository.TeamPeerGradeRepository
	auditRepo      repository.TeamAuditRepository
}

func NewDeleteAssignment(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	submissionRepo repository.SubmissionRepository,
	commentRepo repository.CommentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	teamVoteRepo repository.TeamVoteRepository,
	peerRepo repository.TeamPeerGradeRepository,
	auditRepo repository.TeamAuditRepository,
) *DeleteAssignment {
	return &DeleteAssignment{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo, commentRepo: commentRepo,
		teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, teamVoteRepo: teamVoteRepo, peerRepo: peerRepo, auditRepo: auditRepo,
	}
}

func (uc *DeleteAssignment) DeleteAssignment(courseID, assignmentID, userID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return ErrCourseNotFound
	}
	_ = uc.commentRepo.DeleteByAssignment(assignmentID)
	_ = uc.submissionRepo.DeleteByAssignment(assignmentID)
	if uc.teamVoteRepo != nil {
		_ = uc.teamVoteRepo.DeleteByAssignment(assignmentID)
	}
	if uc.peerRepo != nil {
		_ = uc.peerRepo.DeleteByAssignment(assignmentID)
	}
	if uc.auditRepo != nil {
		_ = uc.auditRepo.DeleteByAssignment(assignmentID)
	}
	if uc.teamMemberRepo != nil {
		_ = uc.teamMemberRepo.DeleteByAssignment(assignmentID)
	}
	if uc.teamRepo != nil {
		_ = uc.teamRepo.DeleteByAssignment(assignmentID)
	}
	return uc.assignmentRepo.Delete(assignmentID)
}

// ── ListMaterialComments ──────────────────────────────────────────────────────

type ListMaterialComments struct {
	memberRepo   repository.CourseMemberRepository
	materialRepo repository.MaterialRepository
	commentRepo  repository.CommentRepository
}

func NewListMaterialComments(memberRepo repository.CourseMemberRepository, materialRepo repository.MaterialRepository, commentRepo repository.CommentRepository) *ListMaterialComments {
	return &ListMaterialComments{memberRepo: memberRepo, materialRepo: materialRepo, commentRepo: commentRepo}
}

func (uc *ListMaterialComments) ListMaterialComments(courseID, materialID, userID string) ([]*domain.Comment, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	m, err := uc.materialRepo.GetByID(materialID)
	if err != nil || m == nil || m.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	all, err := uc.commentRepo.ListByMaterial(materialID)
	if err != nil {
		return nil, err
	}
	return filterPrivateComments(all, userID, role), nil
}

// filterPrivateComments для owner/teacher возвращает всё.
// Для студента: публичные комментарии + все приватные ветки, в которых студент
// является участником (автором хотя бы одного сообщения в ветке).
// Это позволяет преподу инициировать приватный диалог, и студент его увидит.
func filterPrivateComments(all []*domain.Comment, userID string, role domain.CourseRole) []*domain.Comment {
	if role == domain.RoleOwner || role == domain.RoleTeacher {
		return all
	}
	// Строим карту: parentID → дочерние комментарии
	byParent := make(map[string][]string)
	for _, c := range all {
		key := ""
		if c.ParentID != nil {
			key = *c.ParentID
		}
		byParent[key] = append(byParent[key], c.ID)
	}
	byID := make(map[string]*domain.Comment, len(all))
	for _, c := range all {
		byID[c.ID] = c
	}

	// Для каждого приватного корня проверяем, есть ли в его ветке сообщение студента.
	// Если да — вся ветка видима студенту.
	var branchContainsUser func(rootID string) bool
	branchContainsUser = func(rootID string) bool {
		c, ok := byID[rootID]
		if !ok {
			return false
		}
		if c.UserID == userID {
			return true
		}
		for _, childID := range byParent[rootID] {
			if branchContainsUser(childID) {
				return true
			}
		}
		return false
	}

	// Собираем ID всех видимых приватных веток
	visible := make(map[string]bool)
	var markVisible func(id string)
	markVisible = func(id string) {
		visible[id] = true
		for _, childID := range byParent[id] {
			markVisible(childID)
		}
	}
	for _, c := range all {
		if c.IsPrivate && c.ParentID == nil && branchContainsUser(c.ID) {
			markVisible(c.ID)
		}
	}

	var out []*domain.Comment
	for _, c := range all {
		if !c.IsPrivate || visible[c.ID] {
			out = append(out, c)
		}
	}
	return out
}

// ── GetSubmissionFile ─────────────────────────────────────────────────────────

type GetSubmissionFileInput struct {
	CourseID     string
	AssignmentID string
	SubmissionID string
	FileID       string
	RequesterID  string
}

type GetSubmissionFile struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
	fileRepo       repository.FileRepository
	storagePath    string
}

func NewGetSubmissionFile(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	submissionRepo repository.SubmissionRepository,
	fileRepo repository.FileRepository,
) *GetSubmissionFile {
	storagePath := os.Getenv("FILES_STORAGE_PATH")
	if storagePath == "" {
		storagePath = "./storage/files"
	}
	return &GetSubmissionFile{
		memberRepo:     memberRepo,
		assignmentRepo: assignmentRepo,
		submissionRepo: submissionRepo,
		fileRepo:       fileRepo,
		storagePath:    storagePath,
	}
}

func (uc *GetSubmissionFile) GetSubmissionFile(in GetSubmissionFileInput) (*domain.File, []byte, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.RequesterID)
	if err != nil || role == "" {
		return nil, nil, ErrForbidden
	}

	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, nil, ErrCourseNotFound
	}

	s, err := uc.submissionRepo.GetByID(in.SubmissionID)
	if err != nil || s == nil || s.AssignmentID != in.AssignmentID {
		return nil, nil, ErrCourseNotFound
	}

	// Студент может скачать только файлы своего решения
	if role == domain.RoleStudent && s.UserID != in.RequesterID {
		return nil, nil, ErrForbidden
	}

	// Проверяем что запрошенный файл действительно прикреплён к решению
	found := false
	for _, fid := range s.FileIDs {
		if fid == in.FileID {
			found = true
			break
		}
	}
	if !found {
		return nil, nil, ErrCourseNotFound
	}

	f, err := uc.fileRepo.GetByID(in.FileID)
	if err != nil || f == nil {
		return nil, nil, ErrCourseNotFound
	}

	filePath := filepath.Join(uc.storagePath, f.UserID, f.ID+"_"+f.FileName)
	data, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, nil, &ValidationError{Message: "file not found on disk"}
	}

	return f, data, nil
}

// ── GetPostFile ───────────────────────────────────────────────────────────────

type GetPostFileInput struct {
	CourseID    string
	PostID      string
	FileID      string
	RequesterID string
}

type GetPostFile struct {
	memberRepo  repository.CourseMemberRepository
	postRepo    repository.PostRepository
	fileRepo    repository.FileRepository
	storagePath string
}

func NewGetPostFile(memberRepo repository.CourseMemberRepository, postRepo repository.PostRepository, fileRepo repository.FileRepository) *GetPostFile {
	storagePath := os.Getenv("FILES_STORAGE_PATH")
	if storagePath == "" {
		storagePath = "./storage/files"
	}
	return &GetPostFile{memberRepo: memberRepo, postRepo: postRepo, fileRepo: fileRepo, storagePath: storagePath}
}

func (uc *GetPostFile) GetPostFile(in GetPostFileInput) (*domain.File, []byte, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.RequesterID)
	if err != nil || role == "" {
		return nil, nil, ErrForbidden
	}
	p, err := uc.postRepo.GetByID(in.PostID)
	if err != nil || p == nil || p.CourseID != in.CourseID {
		return nil, nil, ErrCourseNotFound
	}
	found := false
	for _, fid := range p.FileIDs {
		if fid == in.FileID {
			found = true
			break
		}
	}
	if !found {
		return nil, nil, ErrCourseNotFound
	}
	f, err := uc.fileRepo.GetByID(in.FileID)
	if err != nil || f == nil {
		return nil, nil, ErrCourseNotFound
	}
	data, err := ioutil.ReadFile(filepath.Join(uc.storagePath, f.UserID, f.ID+"_"+f.FileName))
	if err != nil {
		return nil, nil, &ValidationError{Message: "file not found on disk"}
	}
	return f, data, nil
}

// ── GetMaterialFile ───────────────────────────────────────────────────────────

type GetMaterialFileInput struct {
	CourseID    string
	MaterialID  string
	FileID      string
	RequesterID string
}

type GetMaterialFile struct {
	memberRepo   repository.CourseMemberRepository
	materialRepo repository.MaterialRepository
	fileRepo     repository.FileRepository
	storagePath  string
}

func NewGetMaterialFile(memberRepo repository.CourseMemberRepository, materialRepo repository.MaterialRepository, fileRepo repository.FileRepository) *GetMaterialFile {
	storagePath := os.Getenv("FILES_STORAGE_PATH")
	if storagePath == "" {
		storagePath = "./storage/files"
	}
	return &GetMaterialFile{memberRepo: memberRepo, materialRepo: materialRepo, fileRepo: fileRepo, storagePath: storagePath}
}

func (uc *GetMaterialFile) GetMaterialFile(in GetMaterialFileInput) (*domain.File, []byte, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.RequesterID)
	if err != nil || role == "" {
		return nil, nil, ErrForbidden
	}
	m, err := uc.materialRepo.GetByID(in.MaterialID)
	if err != nil || m == nil || m.CourseID != in.CourseID {
		return nil, nil, ErrCourseNotFound
	}
	found := false
	for _, fid := range m.FileIDs {
		if fid == in.FileID {
			found = true
			break
		}
	}
	if !found {
		return nil, nil, ErrCourseNotFound
	}
	f, err := uc.fileRepo.GetByID(in.FileID)
	if err != nil || f == nil {
		return nil, nil, ErrCourseNotFound
	}
	data, err := ioutil.ReadFile(filepath.Join(uc.storagePath, f.UserID, f.ID+"_"+f.FileName))
	if err != nil {
		return nil, nil, &ValidationError{Message: "file not found on disk"}
	}
	return f, data, nil
}

// ── File usecases ────────────────────────────────────────────────────────────
type UploadFileInput struct {
	UserID   string
	FileName string
	FileSize int64
	MimeType string
	FileData []byte
}

type UploadFile struct {
	fileRepo     repository.FileRepository
	storageePath string
}

func NewUploadFile(fileRepo repository.FileRepository) *UploadFile {
	storagePath := os.Getenv("FILES_STORAGE_PATH")
	if storagePath == "" {
		storagePath = "./storage/files"
	}
	return &UploadFile{fileRepo: fileRepo, storageePath: storagePath}
}

func (uc *UploadFile) UploadFile(in UploadFileInput) (*domain.File, error) {
	if in.UserID == "" {
		return nil, ErrForbidden
	}
	if in.FileName == "" {
		return nil, &ValidationError{Message: "file name is required"}
	}
	if in.FileSize <= 0 {
		return nil, &ValidationError{Message: "file size must be greater than 0"}
	}
	const maxFileSize = 50 * 1024 * 1024 // 50 MB
	if in.FileSize > maxFileSize {
		return nil, &ValidationError{Message: "file is too large (max 50 MB)"}
	}

	f := &domain.File{
		ID:        uuid.New().String(),
		UserID:    in.UserID,
		FileName:  in.FileName,
		FileSize:  in.FileSize,
		MimeType:  in.MimeType,
		CreatedAt: time.Now().UTC(),
	}

	// Сохраняем файл на диск
	if err := uc.saveFile(f, in.FileData); err != nil {
		return nil, err
	}

	// Сохраняем метаданные в БД
	if err := uc.fileRepo.Create(f); err != nil {
		return nil, err
	}
	return f, nil
}

func (uc *UploadFile) saveFile(f *domain.File, data []byte) error {
	// Создаём директорию для пользователя если её нет
	userDir := filepath.Join(uc.storageePath, f.UserID)
	if err := os.MkdirAll(userDir, 0755); err != nil {
		return &ValidationError{Message: "failed to create storage directory"}
	}

	// Генерируем путь к файлу
	filePath := filepath.Join(userDir, f.ID+"_"+f.FileName)

	// Записываем файл на диск
	if err := ioutil.WriteFile(filePath, data, 0644); err != nil {
		return &ValidationError{Message: "failed to save file"}
	}

	return nil
}

type ListUserFilesInput struct {
	UserID string
}

type ListUserFiles struct {
	fileRepo repository.FileRepository
}

func NewListUserFiles(fileRepo repository.FileRepository) *ListUserFiles {
	return &ListUserFiles{fileRepo: fileRepo}
}

func (uc *ListUserFiles) ListUserFiles(in ListUserFilesInput) ([]*domain.File, error) {
	if in.UserID == "" {
		return nil, ErrForbidden
	}
	files, err := uc.fileRepo.ListByUser(in.UserID)
	if err != nil {
		return nil, err
	}
	if files == nil {
		return []*domain.File{}, nil
	}
	return files, nil
}

type GetFileInput struct {
	FileID string
	UserID string
}

type GetFile struct {
	fileRepo     repository.FileRepository
	storageePath string
}

func NewGetFile(fileRepo repository.FileRepository) *GetFile {
	storagePath := os.Getenv("FILES_STORAGE_PATH")
	if storagePath == "" {
		storagePath = "./storage/files"
	}
	return &GetFile{fileRepo: fileRepo, storageePath: storagePath}
}

func (uc *GetFile) GetFile(in GetFileInput) (*domain.File, []byte, error) {
	if in.FileID == "" || in.UserID == "" {
		return nil, nil, ErrForbidden
	}

	f, err := uc.fileRepo.GetByID(in.FileID)
	if err != nil || f == nil {
		return nil, nil, ErrForbidden
	}

	// Проверяем что файл принадлежит пользователю или запрашивающий - учитель
	if f.UserID != in.UserID {
		return nil, nil, ErrForbidden
	}

	// Читаем файл с диска
	filePath := filepath.Join(uc.storageePath, f.UserID, f.ID+"_"+f.FileName)
	data, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, nil, &ValidationError{Message: "file not found"}
	}

	return f, data, nil
}

type GetFileInfoInput struct {
	FileID string
	UserID string
}

type GetFileInfo struct {
	fileRepo repository.FileRepository
}

func NewGetFileInfo(fileRepo repository.FileRepository) *GetFileInfo {
	return &GetFileInfo{fileRepo: fileRepo}
}

func (uc *GetFileInfo) GetFileInfo(in GetFileInfoInput) (*domain.File, error) {
	if in.FileID == "" || in.UserID == "" {
		return nil, ErrForbidden
	}

	f, err := uc.fileRepo.GetByID(in.FileID)
	if err != nil || f == nil {
		return nil, &ValidationError{Message: "file not found"}
	}

	return f, nil
}
