package usecase

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"math"
	"math/rand"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
	"gorm.io/gorm"
)

var animalNames = []string{
	"Fox", "Wolf", "Tiger", "Falcon", "Otter", "Panda", "Lynx", "Bear", "Raven", "Shark",
	"Eagle", "Bison", "Cobra", "Dolphin", "Leopard", "Moose", "Python", "Jaguar", "Koala", "Orca",
}

type TeamMemberInfo struct {
	UserID       string
	FirstName    string
	LastName     string
	AverageScore float64
}

type TeamInfo struct {
	Team    *domain.Team
	Members []TeamMemberInfo
	Status  string
}

type ListAssignmentTeams struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	submissionRepo repository.SubmissionRepository
	voteRepo       repository.TeamVoteRepository
	userRepo       repository.UserRepository
}

func NewListAssignmentTeams(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	submissionRepo repository.SubmissionRepository,
	voteRepo repository.TeamVoteRepository,
	userRepo repository.UserRepository,
) *ListAssignmentTeams {
	return &ListAssignmentTeams{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, submissionRepo: submissionRepo, voteRepo: voteRepo, userRepo: userRepo,
	}
}

func (uc *ListAssignmentTeams) ListAssignmentTeams(courseID, assignmentID, requesterID string) ([]TeamInfo, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, requesterID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	allSubs, _ := uc.submissionRepo.ListByAssignment(assignmentID)
	teams, err := uc.teamRepo.ListByAssignment(assignmentID)
	if err != nil {
		return nil, err
	}
	out := make([]TeamInfo, 0, len(teams))
	for _, t := range teams {
		members, err := uc.teamMemberRepo.ListByTeam(t.ID)
		if err != nil {
			return nil, err
		}
		memberSet := make(map[string]bool, len(members))
		items := make([]TeamMemberInfo, 0, len(members))
		for _, m := range members {
			memberSet[m.UserID] = true
			u, _ := uc.userRepo.GetByID(m.UserID)
			avg, _ := calcNormalizedAverage(courseID, m.UserID, uc.assignmentRepo, uc.submissionRepo)
			item := TeamMemberInfo{UserID: m.UserID, AverageScore: avg}
			if u != nil {
				item.FirstName = u.FirstName
				item.LastName = u.LastName
			}
			items = append(items, item)
		}
		votes, _ := uc.voteRepo.ListByTeam(assignmentID, t.ID)
		st := computeTeamStatus(a, memberSet, allSubs, len(votes))
		out = append(out, TeamInfo{Team: t, Members: items, Status: st})
	}
	return out, nil
}

func computeTeamStatus(a *domain.Assignment, memberSet map[string]bool, allSubs []*domain.Submission, voteCount int) string {
	now := time.Now().UTC()
	attached := 0
	gradedMembers := 0
	memberCount := len(memberSet)
	for _, s := range allSubs {
		if !memberSet[s.UserID] {
			continue
		}
		if s.IsAttached && !s.IsReturned {
			attached++
		}
		if s.Grade != nil {
			gradedMembers++
		}
	}
	if memberCount > 0 && gradedMembers == memberCount {
		return "graded"
	}
	if attached > 0 {
		return "submitted"
	}
	if a.DeadlineAutoFinalizedAt != nil {
		return "not_submitted"
	}
	if a.TeamSubmissionRule == domain.TeamRuleVoteEqual || a.TeamSubmissionRule == domain.TeamRuleVoteWeighted {
		// Голосование разрешено только после фиксации состава; до этого — этап формирования команд.
		if !assignmentRosterLocked(a, now) {
			return "forming"
		}
		if voteCount > 0 {
			return "voting"
		}
		return "voting_open"
	}
	if assignmentRosterLocked(a, now) {
		return "roster_locked"
	}
	if a.Deadline != nil && now.After(*a.Deadline) {
		return "not_submitted"
	}
	return "forming"
}

type ManualTeamInput struct {
	Name      string
	MemberIDs []string
}

type SaveManualTeamsInput struct {
	CourseID     string
	AssignmentID string
	TeacherID    string
	Teams        []ManualTeamInput
}

type SaveManualTeams struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	auditRepo      repository.TeamAuditRepository
}

func NewSaveManualTeams(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, teamRepo repository.TeamRepository, auditRepo repository.TeamAuditRepository) *SaveManualTeams {
	return &SaveManualTeams{memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, auditRepo: auditRepo}
}

func (uc *SaveManualTeams) SaveManualTeams(in SaveManualTeamsInput) error {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.TeacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return ErrCourseNotFound
	}
	if a.TeamDistributionType == domain.TeamDistributionFree {
		return &ValidationError{Message: "bulk save is not available for free distribution type"}
	}
	students, err := listStudentIDs(in.CourseID, uc.memberRepo)
	if err != nil {
		return err
	}
	if len(students) < 2 {
		return &ValidationError{Message: "at least 2 students required for team distribution"}
	}
	if err := replaceTeams(in.AssignmentID, in.TeacherID, a.MaxTeamSize, in.Teams, uc.teamRepo); err != nil {
		return err
	}
	tryTeamAudit(uc.auditRepo, in.AssignmentID, "", in.TeacherID, domain.TeamAuditRosterChanged, map[string]string{"source": "manual_save"})
	return nil
}

type GenerateRandomTeamsInput struct {
	CourseID     string
	AssignmentID string
	TeacherID    string
}

type GenerateRandomTeams struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	auditRepo      repository.TeamAuditRepository
}

func NewGenerateRandomTeams(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, teamRepo repository.TeamRepository, auditRepo repository.TeamAuditRepository) *GenerateRandomTeams {
	return &GenerateRandomTeams{memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, auditRepo: auditRepo}
}

func (uc *GenerateRandomTeams) GenerateRandomTeams(in GenerateRandomTeamsInput) error {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.TeacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return ErrCourseNotFound
	}
	if a.TeamDistributionType != domain.TeamDistributionRandom {
		return &ValidationError{Message: "random generation is available only for random distribution type"}
	}
	students, err := listStudentIDs(in.CourseID, uc.memberRepo)
	if err != nil {
		return err
	}
	if len(students) < 2 {
		return &ValidationError{Message: "at least 2 students required for team distribution"}
	}
	if a.TeamCount < 1 {
		return &ValidationError{Message: "assignment team_count must be > 0"}
	}
	maxTeamSize, err := calcMaxTeamSize(len(students), a.TeamCount)
	if err != nil {
		return err
	}
	rnd := rand.New(rand.NewSource(time.Now().UnixNano()))
	rnd.Shuffle(len(students), func(i, j int) { students[i], students[j] = students[j], students[i] })
	teams := buildTeamsFromStudents(students, a.TeamCount, maxTeamSize)
	if err := replaceTeams(in.AssignmentID, in.TeacherID, maxTeamSize, teams, uc.teamRepo); err != nil {
		return err
	}
	tryTeamAudit(uc.auditRepo, in.AssignmentID, "", in.TeacherID, domain.TeamAuditRosterChanged, map[string]string{"source": "generate_random"})
	return nil
}

type GenerateBalancedTeams struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	submissionRepo repository.SubmissionRepository
	auditRepo      repository.TeamAuditRepository
}

func NewGenerateBalancedTeams(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, teamRepo repository.TeamRepository, submissionRepo repository.SubmissionRepository, auditRepo repository.TeamAuditRepository) *GenerateBalancedTeams {
	return &GenerateBalancedTeams{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, submissionRepo: submissionRepo, auditRepo: auditRepo,
	}
}

func (uc *GenerateBalancedTeams) GenerateBalancedTeams(in GenerateRandomTeamsInput) error {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.TeacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return ErrCourseNotFound
	}
	if a.TeamDistributionType != domain.TeamDistributionBalanced {
		return &ValidationError{Message: "balanced generation is available only for balanced distribution type"}
	}
	students, err := listStudentIDs(in.CourseID, uc.memberRepo)
	if err != nil {
		return err
	}
	if len(students) < 2 {
		return &ValidationError{Message: "at least 2 students required for team distribution"}
	}
	if a.TeamCount < 1 {
		return &ValidationError{Message: "assignment team_count must be > 0"}
	}
	maxTeamSize, err := calcMaxTeamSize(len(students), a.TeamCount)
	if err != nil {
		return err
	}
	type scored struct {
		UserID string
		Score  float64
	}
	scoredStudents := make([]scored, 0, len(students))
	for _, s := range students {
		score, _ := calcNormalizedAverage(in.CourseID, s, uc.assignmentRepo, uc.submissionRepo)
		scoredStudents = append(scoredStudents, scored{UserID: s, Score: score})
	}
	sort.Slice(scoredStudents, func(i, j int) bool { return scoredStudents[i].Score > scoredStudents[j].Score })
	buckets := make([][]string, a.TeamCount)
	idx := 0
	direction := 1
	for _, s := range scoredStudents {
		buckets[idx] = append(buckets[idx], s.UserID)
		idx += direction
		if idx == a.TeamCount {
			direction = -1
			idx = a.TeamCount - 1
		}
		if idx < 0 {
			direction = 1
			idx = 0
		}
	}
	teams := make([]ManualTeamInput, 0, len(buckets))
	for _, members := range buckets {
		if len(members) == 0 {
			continue
		}
		teams = append(teams, ManualTeamInput{MemberIDs: members})
	}
	if err := replaceTeams(in.AssignmentID, in.TeacherID, maxTeamSize, teams, uc.teamRepo); err != nil {
		return err
	}
	tryTeamAudit(uc.auditRepo, in.AssignmentID, "", in.TeacherID, domain.TeamAuditRosterChanged, map[string]string{"source": "generate_balanced"})
	return nil
}

type CreateTeamInput struct {
	CourseID     string
	AssignmentID string
	UserID       string
	Name         string
}

type CreateTeam struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	auditRepo      repository.TeamAuditRepository
}

func NewCreateTeam(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, teamRepo repository.TeamRepository, teamMemberRepo repository.TeamMemberRepository, auditRepo repository.TeamAuditRepository) *CreateTeam {
	return &CreateTeam{memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, auditRepo: auditRepo}
}

func (uc *CreateTeam) CreateTeam(in CreateTeamInput) (*domain.Team, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role != domain.RoleStudent {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	if a.TeamDistributionType != domain.TeamDistributionFree {
		return nil, &ValidationError{Message: "team creation allowed only for free distribution"}
	}
	if assignmentRosterLocked(a, time.Now().UTC()) {
		return nil, &ValidationError{Message: "team roster is locked"}
	}
	existing, err := uc.teamMemberRepo.GetTeamByUser(in.AssignmentID, in.UserID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, &ValidationError{Message: "student is already in a team"}
	}
	teams, err := uc.teamRepo.ListByAssignment(in.AssignmentID)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = generateTeamName(teams)
	}
	t := &domain.Team{
		ID:           uuid.New().String(),
		AssignmentID: in.AssignmentID,
		CreatorID:    in.UserID,
		Name:         name,
		MaxMembers:   a.MaxTeamSize,
		CreatedAt:    time.Now().UTC(),
	}
	if err := uc.teamRepo.Create(t); err != nil {
		return nil, err
	}
	if err := uc.teamMemberRepo.Create(&domain.TeamMember{
		TeamID: t.ID, UserID: in.UserID, JoinedAt: time.Now().UTC(),
	}); err != nil {
		return nil, err
	}
	tryTeamAudit(uc.auditRepo, in.AssignmentID, t.ID, in.UserID, domain.TeamAuditRosterChanged, map[string]string{"action": "create_team", "team_id": t.ID})
	return t, nil
}

type JoinTeam struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	auditRepo      repository.TeamAuditRepository
}

func NewJoinTeam(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, teamRepo repository.TeamRepository, teamMemberRepo repository.TeamMemberRepository, auditRepo repository.TeamAuditRepository) *JoinTeam {
	return &JoinTeam{memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, auditRepo: auditRepo}
}

func (uc *JoinTeam) JoinTeam(courseID, assignmentID, teamID, userID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role != domain.RoleStudent {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return ErrCourseNotFound
	}
	if a.TeamDistributionType != domain.TeamDistributionFree {
		return &ValidationError{Message: "join is allowed only for free distribution"}
	}
	if assignmentRosterLocked(a, time.Now().UTC()) {
		return &ValidationError{Message: "team roster is locked"}
	}
	t, err := uc.teamRepo.GetByID(teamID)
	if err != nil || t == nil || t.AssignmentID != assignmentID {
		return ErrCourseNotFound
	}
	current, err := uc.teamMemberRepo.GetTeamByUser(assignmentID, userID)
	if err != nil {
		return err
	}
	if current != nil {
		return &ValidationError{Message: "student is already in a team"}
	}
	members, err := uc.teamMemberRepo.ListByTeam(teamID)
	if err != nil {
		return err
	}
	if len(members) >= t.MaxMembers {
		return &ValidationError{Message: "team is full"}
	}
	if err := uc.teamMemberRepo.Create(&domain.TeamMember{TeamID: teamID, UserID: userID, JoinedAt: time.Now().UTC()}); err != nil {
		return err
	}
	tryTeamAudit(uc.auditRepo, assignmentID, teamID, userID, domain.TeamAuditRosterChanged, map[string]string{"action": "join"})
	return nil
}

type LeaveTeam struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamMemberRepo repository.TeamMemberRepository
	auditRepo      repository.TeamAuditRepository
}

func NewLeaveTeam(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, teamMemberRepo repository.TeamMemberRepository, auditRepo repository.TeamAuditRepository) *LeaveTeam {
	return &LeaveTeam{memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamMemberRepo: teamMemberRepo, auditRepo: auditRepo}
}

func (uc *LeaveTeam) LeaveTeam(courseID, assignmentID, userID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role != domain.RoleStudent {
		return ErrForbidden
	}
	assignment, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || assignment == nil || assignment.CourseID != courseID {
		return ErrCourseNotFound
	}
	if assignmentRosterLocked(assignment, time.Now().UTC()) {
		return &ValidationError{Message: "team roster is locked"}
	}
	t, err := uc.teamMemberRepo.GetTeamByUser(assignmentID, userID)
	if err != nil {
		return err
	}
	if t == nil {
		return nil
	}
	if err := uc.teamMemberRepo.Delete(t.ID, userID); err != nil {
		return err
	}
	tryTeamAudit(uc.auditRepo, assignmentID, t.ID, userID, domain.TeamAuditRosterChanged, map[string]string{"action": "leave"})
	return nil
}

type DeleteTeam struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	auditRepo      repository.TeamAuditRepository
}

func NewDeleteTeam(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	auditRepo repository.TeamAuditRepository,
) *DeleteTeam {
	return &DeleteTeam{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, auditRepo: auditRepo,
	}
}

func (uc *DeleteTeam) Delete(courseID, assignmentID, teamID, userID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return ErrCourseNotFound
	}
	if assignmentRosterLocked(a, time.Now().UTC()) {
		return &ValidationError{Message: "team roster is locked"}
	}
	t, err := uc.teamRepo.GetByID(teamID)
	if err != nil {
		return err
	}
	if t == nil || t.AssignmentID != assignmentID {
		return ErrCourseNotFound
	}

	isStaff := role == domain.RoleTeacher || role == domain.RoleOwner
	if isStaff {
		if err := uc.teamRepo.DeleteSingleTeam(assignmentID, teamID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCourseNotFound
			}
			return err
		}
		tryTeamAudit(uc.auditRepo, assignmentID, teamID, userID, domain.TeamAuditRosterChanged, map[string]string{"action": "delete_team", "by": "staff"})
		return nil
	}

	if role != domain.RoleStudent {
		return ErrForbidden
	}
	if a.TeamDistributionType != domain.TeamDistributionFree {
		return &ValidationError{Message: "team deletion is allowed only for free distribution"}
	}
	if t.CreatorID != userID {
		return &ValidationError{Message: "only team creator can delete the team"}
	}
	members, err := uc.teamMemberRepo.ListByTeam(teamID)
	if err != nil {
		return err
	}
	creatorInTeam := false
	for _, m := range members {
		if m.UserID == t.CreatorID {
			creatorInTeam = true
			break
		}
	}
	if len(members) > 0 && !creatorInTeam {
		return &ValidationError{Message: "creator must be a team member unless the team is empty"}
	}
	if err := uc.teamRepo.DeleteSingleTeam(assignmentID, teamID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrCourseNotFound
		}
		return err
	}
	tryTeamAudit(uc.auditRepo, assignmentID, teamID, userID, domain.TeamAuditRosterChanged, map[string]string{"action": "delete_team"})
	return nil
}

func listStudentIDs(courseID string, memberRepo repository.CourseMemberRepository) ([]string, error) {
	members, err := memberRepo.ListByCourse(courseID)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(members))
	for _, m := range members {
		if m.Role == domain.RoleStudent && m.Status == domain.MemberStatusApproved {
			out = append(out, m.UserID)
		}
	}
	return out, nil
}

func calcMaxTeamSize(studentsCount, teamCount int) (int, error) {
	if teamCount <= 0 {
		return 0, &ValidationError{Message: "team_count must be > 0"}
	}
	if studentsCount > 0 && teamCount > studentsCount {
		return 0, &ValidationError{Message: "team_count cannot exceed approved students count"}
	}
	maxSize := int(math.Ceil(float64(studentsCount) / float64(teamCount)))
	if maxSize < 2 {
		maxSize = 2
	}
	return maxSize, nil
}

func replaceTeams(assignmentID, creatorID string, maxTeamSize int, input []ManualTeamInput, teamRepo repository.TeamRepository) error {
	teams := make([]*domain.Team, 0, len(input))
	teamMembers := make(map[string][]string, len(input))
	used := make(map[string]bool)
	for _, it := range input {
		if len(it.MemberIDs) > maxTeamSize {
			return &ValidationError{Message: "team size exceeds max_team_size"}
		}
		for _, u := range it.MemberIDs {
			if used[u] {
				return &ValidationError{Message: "student cannot be in multiple teams"}
			}
			used[u] = true
		}
		team := &domain.Team{
			ID:           uuid.New().String(),
			AssignmentID: assignmentID,
			CreatorID:    creatorID,
			Name:         strings.TrimSpace(it.Name),
			MaxMembers:   maxTeamSize,
			CreatedAt:    time.Now().UTC(),
		}
		if team.Name == "" {
			team.Name = generateTeamName(teams)
		}
		teams = append(teams, team)
		teamMembers[team.ID] = append([]string{}, it.MemberIDs...)
	}
	return teamRepo.ReplaceAssignmentTeams(assignmentID, teams, teamMembers)
}

func buildTeamsFromStudents(students []string, teamCount, maxTeamSize int) []ManualTeamInput {
	teams := make([]ManualTeamInput, teamCount)
	for i, s := range students {
		idx := i % teamCount
		if len(teams[idx].MemberIDs) >= maxTeamSize {
			for j := 0; j < teamCount; j++ {
				next := (idx + j) % teamCount
				if len(teams[next].MemberIDs) < maxTeamSize {
					idx = next
					break
				}
			}
		}
		teams[idx].MemberIDs = append(teams[idx].MemberIDs, s)
	}
	out := make([]ManualTeamInput, 0, teamCount)
	for _, t := range teams {
		if len(t.MemberIDs) > 0 {
			out = append(out, t)
		}
	}
	return out
}

func generateTeamName(existing []*domain.Team) string {
	used := map[string]bool{}
	for _, t := range existing {
		used[t.Name] = true
	}
	for _, a := range animalNames {
		if !used[a] {
			return a
		}
	}
	return "Team-" + uuid.NewString()[:8]
}

func calcNormalizedAverage(courseID, userID string, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) (float64, error) {
	assignments, err := assignmentRepo.ListByCourse(courseID)
	if err != nil {
		return 0, err
	}
	var sum float64
	var count int
	for _, a := range assignments {
		if a.MaxGrade <= 0 {
			continue
		}
		s, _ := submissionRepo.GetByAssignmentAndUser(a.ID, userID)
		if s == nil || s.Grade == nil {
			continue
		}
		sum += float64(*s.Grade) / float64(a.MaxGrade)
		count++
	}
	if count == 0 {
		return 0, nil
	}
	return sum / float64(count), nil
}

type VoteTeamSubmission struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	submissionRepo repository.SubmissionRepository
	voteRepo       repository.TeamVoteRepository
	auditRepo      repository.TeamAuditRepository
}

func NewVoteTeamSubmission(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	submissionRepo repository.SubmissionRepository,
	voteRepo repository.TeamVoteRepository,
	auditRepo repository.TeamAuditRepository,
) *VoteTeamSubmission {
	return &VoteTeamSubmission{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, submissionRepo: submissionRepo, voteRepo: voteRepo, auditRepo: auditRepo,
	}
}

func (uc *VoteTeamSubmission) Vote(courseID, assignmentID, teamID, submissionID, userID string) error {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role != domain.RoleStudent {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return ErrCourseNotFound
	}
	if !assignmentRosterLocked(a, time.Now().UTC()) {
		return &ValidationError{Message: "voting is not allowed before team roster is locked"}
	}
	if a.TeamSubmissionRule != domain.TeamRuleVoteEqual && a.TeamSubmissionRule != domain.TeamRuleVoteWeighted {
		return &ValidationError{Message: "voting is available only for vote rules"}
	}
	t, err := uc.teamRepo.GetByID(teamID)
	if err != nil || t == nil || t.AssignmentID != assignmentID {
		return ErrCourseNotFound
	}
	userTeam, err := uc.teamMemberRepo.GetTeamByUser(assignmentID, userID)
	if err != nil || userTeam == nil || userTeam.ID != teamID {
		return ErrForbidden
	}
	s, err := uc.submissionRepo.GetByID(submissionID)
	if err != nil || s == nil || s.AssignmentID != assignmentID {
		return ErrCourseNotFound
	}
	members, err := uc.teamMemberRepo.ListByTeam(teamID)
	if err != nil {
		return err
	}
	ok := false
	for _, m := range members {
		if m.UserID == s.UserID {
			ok = true
			break
		}
	}
	if !ok {
		return ErrForbidden
	}
	weight := 1.0
	if a.TeamSubmissionRule == domain.TeamRuleVoteWeighted {
		avg, _ := calcNormalizedAverage(courseID, userID, uc.assignmentRepo, uc.submissionRepo)
		weight = avg
		if weight <= 0 {
			weight = 0.01
		}
	}
	if err := uc.voteRepo.Upsert(&domain.TeamSubmissionVote{
		ID:           uuid.NewString(),
		AssignmentID: assignmentID,
		TeamID:       teamID,
		SubmissionID: submissionID,
		VoterID:      userID,
		Weight:       weight,
		CreatedAt:    time.Now().UTC(),
	}); err != nil {
		return err
	}
	tryTeamAudit(uc.auditRepo, assignmentID, teamID, userID, domain.TeamAuditVoteCast, map[string]string{"submission_id": submissionID})
	return nil
}

type FinalizeTeamVoteSubmission struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	submissionRepo repository.SubmissionRepository
	voteRepo       repository.TeamVoteRepository
	likeRepo       repository.TeamSubmissionLikeRepository
	auditRepo      repository.TeamAuditRepository
}

func NewFinalizeTeamVoteSubmission(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	submissionRepo repository.SubmissionRepository,
	voteRepo repository.TeamVoteRepository,
	likeRepo repository.TeamSubmissionLikeRepository,
	auditRepo repository.TeamAuditRepository,
) *FinalizeTeamVoteSubmission {
	return &FinalizeTeamVoteSubmission{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, submissionRepo: submissionRepo, voteRepo: voteRepo, likeRepo: likeRepo, auditRepo: auditRepo,
	}
}

func resolveVoteWinner(
	a *domain.Assignment,
	courseID, assignmentID, teamID string,
	scoreBySubmission map[string]float64,
	allSubs []*domain.Submission,
	memberSet map[string]bool,
	assignmentRepo repository.AssignmentRepository,
	submissionRepo repository.SubmissionRepository,
	likeCountBySubmission map[string]int,
) string {
	type cand struct {
		sid   string
		score float64
	}
	var cands []cand
	for sid, sc := range scoreBySubmission {
		var sub *domain.Submission
		for i := range allSubs {
			if allSubs[i].ID == sid {
				sub = allSubs[i]
				break
			}
		}
		if sub == nil || !memberSet[sub.UserID] {
			continue
		}
		cands = append(cands, cand{sid: sid, score: sc})
	}
	if len(cands) == 0 {
		return ""
	}
	maxScore := cands[0].score
	for _, c := range cands[1:] {
		if c.score > maxScore {
			maxScore = c.score
		}
	}
	tied := make([]string, 0)
	for _, c := range cands {
		if c.score == maxScore {
			tied = append(tied, c.sid)
		}
	}
	sort.Strings(tied)
	if len(tied) == 1 {
		return tied[0]
	}
	bestByLikes := tied[0]
	bestLikes := likeCountBySubmission[bestByLikes]
	for _, sid := range tied[1:] {
		lc := likeCountBySubmission[sid]
		if lc > bestLikes || (lc == bestLikes && sid < bestByLikes) {
			bestLikes = lc
			bestByLikes = sid
		}
	}
	likeTied := make([]string, 0, len(tied))
	for _, sid := range tied {
		if likeCountBySubmission[sid] == bestLikes {
			likeTied = append(likeTied, sid)
		}
	}
	if len(likeTied) == 1 {
		return likeTied[0]
	}
	tb := a.VoteTieBreak
	if tb == domain.VoteTieBreakRandom {
		h := sha256.Sum256([]byte(assignmentID + teamID + likeTied[0]))
		seed := int64(binary.BigEndian.Uint64(h[:8]))
		r := rand.New(rand.NewSource(seed))
		return likeTied[r.Intn(len(likeTied))]
	}
	bestSID := likeTied[0]
	bestAvg := -1.0
	for _, sid := range likeTied {
		var uid string
		for i := range allSubs {
			if allSubs[i].ID == sid {
				uid = allSubs[i].UserID
				break
			}
		}
		avg, _ := calcNormalizedAverage(courseID, uid, assignmentRepo, submissionRepo)
		if avg > bestAvg || (avg == bestAvg && sid < bestSID) {
			bestAvg = avg
			bestSID = sid
		}
	}
	return bestSID
}

func (uc *FinalizeTeamVoteSubmission) applyAttachedWinner(assignmentID string, memberSet map[string]bool, allSubs []*domain.Submission, winnerID string) (*domain.Submission, error) {
	var winner *domain.Submission
	for _, s := range allSubs {
		if !memberSet[s.UserID] {
			continue
		}
		if s.ID == winnerID {
			s.IsAttached = true
			s.IsReturned = false
			winner = s
		} else {
			s.IsAttached = false
		}
		if err := uc.submissionRepo.Update(s); err != nil {
			return nil, err
		}
	}
	if winner == nil {
		return nil, ErrCourseNotFound
	}
	return winner, nil
}

// FinalizeVoteForTeam resolves votes and marks the winning submission attached. allowWithoutVotes is used by the deadline job when there are no votes (no winner). actorUserID is stored in audit when non-empty.
func (uc *FinalizeTeamVoteSubmission) FinalizeVoteForTeam(courseID, assignmentID, teamID string, allowWithoutVotes bool, actorUserID string) (*domain.Submission, error) {
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	if !assignmentRosterLocked(a, time.Now().UTC()) {
		return nil, &ValidationError{Message: "finalize is not allowed before team roster is locked"}
	}
	if a.TeamSubmissionRule != domain.TeamRuleVoteEqual && a.TeamSubmissionRule != domain.TeamRuleVoteWeighted {
		return nil, &ValidationError{Message: "finalize voting is available only for vote rules"}
	}
	t, err := uc.teamRepo.GetByID(teamID)
	if err != nil || t == nil || t.AssignmentID != assignmentID {
		return nil, ErrCourseNotFound
	}
	members, err := uc.teamMemberRepo.ListByTeam(teamID)
	if err != nil {
		return nil, err
	}
	memberSet := make(map[string]bool, len(members))
	for _, m := range members {
		memberSet[m.UserID] = true
	}
	votes, err := uc.voteRepo.ListByTeam(assignmentID, teamID)
	if err != nil {
		return nil, err
	}
	scoreBySubmission := make(map[string]float64)
	for _, v := range votes {
		scoreBySubmission[v.SubmissionID] += v.Weight
	}
	if len(scoreBySubmission) == 0 {
		if allowWithoutVotes {
			return nil, nil
		}
		return nil, &ValidationError{Message: "no votes yet"}
	}
	allSubs, err := uc.submissionRepo.ListByAssignment(assignmentID)
	if err != nil {
		return nil, err
	}
	likeCountBySubmission := make(map[string]int)
	if uc.likeRepo != nil {
		likes, _ := uc.likeRepo.ListByTeam(assignmentID, teamID)
		for _, l := range likes {
			likeCountBySubmission[l.SubmissionID]++
		}
	}
	winnerID := resolveVoteWinner(a, courseID, assignmentID, teamID, scoreBySubmission, allSubs, memberSet, uc.assignmentRepo, uc.submissionRepo, likeCountBySubmission)
	if winnerID == "" {
		if allowWithoutVotes {
			return nil, nil
		}
		return nil, &ValidationError{Message: "could not resolve vote winner"}
	}
	winner, err := uc.applyAttachedWinner(assignmentID, memberSet, allSubs, winnerID)
	if err != nil {
		return nil, err
	}
	if winner != nil && actorUserID != "" {
		tryTeamAudit(uc.auditRepo, assignmentID, teamID, actorUserID, domain.TeamAuditVoteFinalized, map[string]string{"submission_id": winner.ID})
	}
	return winner, nil
}

type TeamSubmissionVoteStats struct {
	SubmissionID string
	VoteWeight   float64
	VoteCount    int
	LikeCount    int
}

type TeamSubmissionForVote struct {
	Submission *domain.Submission
	Stats      TeamSubmissionVoteStats
}

type ListTeamSubmissionsForVote struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	submissionRepo repository.SubmissionRepository
	voteRepo       repository.TeamVoteRepository
	likeRepo       repository.TeamSubmissionLikeRepository
}

func NewListTeamSubmissionsForVote(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	submissionRepo repository.SubmissionRepository,
	voteRepo repository.TeamVoteRepository,
	likeRepo repository.TeamSubmissionLikeRepository,
) *ListTeamSubmissionsForVote {
	return &ListTeamSubmissionsForVote{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, submissionRepo: submissionRepo, voteRepo: voteRepo, likeRepo: likeRepo,
	}
}

func (uc *ListTeamSubmissionsForVote) List(courseID, assignmentID, teamID, requesterID string) ([]TeamSubmissionForVote, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, requesterID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	t, err := uc.teamRepo.GetByID(teamID)
	if err != nil || t == nil || t.AssignmentID != assignmentID {
		return nil, ErrCourseNotFound
	}
	if role == domain.RoleStudent {
		myTeam, terr := uc.teamMemberRepo.GetTeamByUser(assignmentID, requesterID)
		if terr != nil || myTeam == nil || myTeam.ID != teamID {
			return nil, ErrForbidden
		}
	}
	members, err := uc.teamMemberRepo.ListByTeam(teamID)
	if err != nil {
		return nil, err
	}
	memberSet := map[string]bool{}
	for _, m := range members {
		memberSet[m.UserID] = true
	}
	allSubs, err := uc.submissionRepo.ListByAssignment(assignmentID)
	if err != nil {
		return nil, err
	}
	votes, _ := uc.voteRepo.ListByTeam(assignmentID, teamID)
	voteWeight := map[string]float64{}
	voteCount := map[string]int{}
	for _, v := range votes {
		voteWeight[v.SubmissionID] += v.Weight
		voteCount[v.SubmissionID]++
	}
	likeCount := map[string]int{}
	if uc.likeRepo != nil {
		likes, _ := uc.likeRepo.ListByTeam(assignmentID, teamID)
		for _, l := range likes {
			likeCount[l.SubmissionID]++
		}
	}
	out := make([]TeamSubmissionForVote, 0)
	for _, s := range allSubs {
		if !memberSet[s.UserID] {
			continue
		}
		out = append(out, TeamSubmissionForVote{
			Submission: s,
			Stats: TeamSubmissionVoteStats{
				SubmissionID: s.ID,
				VoteWeight:   voteWeight[s.ID],
				VoteCount:    voteCount[s.ID],
				LikeCount:    likeCount[s.ID],
			},
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Submission.SubmittedAt.Before(out[j].Submission.SubmittedAt) })
	return out, nil
}

type ToggleSubmissionLike struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	teamRepo       repository.TeamRepository
	teamMemberRepo repository.TeamMemberRepository
	submissionRepo repository.SubmissionRepository
	likeRepo       repository.TeamSubmissionLikeRepository
	auditRepo      repository.TeamAuditRepository
}

func NewToggleSubmissionLike(
	memberRepo repository.CourseMemberRepository,
	assignmentRepo repository.AssignmentRepository,
	teamRepo repository.TeamRepository,
	teamMemberRepo repository.TeamMemberRepository,
	submissionRepo repository.SubmissionRepository,
	likeRepo repository.TeamSubmissionLikeRepository,
	auditRepo repository.TeamAuditRepository,
) *ToggleSubmissionLike {
	return &ToggleSubmissionLike{
		memberRepo: memberRepo, assignmentRepo: assignmentRepo, teamRepo: teamRepo, teamMemberRepo: teamMemberRepo, submissionRepo: submissionRepo, likeRepo: likeRepo, auditRepo: auditRepo,
	}
}

func (uc *ToggleSubmissionLike) Toggle(courseID, assignmentID, teamID, submissionID, userID string) (bool, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role != domain.RoleStudent {
		return false, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return false, ErrCourseNotFound
	}
	t, err := uc.teamRepo.GetByID(teamID)
	if err != nil || t == nil || t.AssignmentID != assignmentID {
		return false, ErrCourseNotFound
	}
	myTeam, err := uc.teamMemberRepo.GetTeamByUser(assignmentID, userID)
	if err != nil || myTeam == nil || myTeam.ID != teamID {
		return false, ErrForbidden
	}
	sub, err := uc.submissionRepo.GetByID(submissionID)
	if err != nil || sub == nil || sub.AssignmentID != assignmentID {
		return false, ErrCourseNotFound
	}
	teamMembers, err := uc.teamMemberRepo.ListByTeam(teamID)
	if err != nil {
		return false, err
	}
	inTeam := false
	for _, m := range teamMembers {
		if m.UserID == sub.UserID {
			inTeam = true
			break
		}
	}
	if !inTeam {
		return false, ErrForbidden
	}
	liked, err := uc.likeRepo.Toggle(assignmentID, teamID, submissionID, userID)
	if err != nil {
		return false, err
	}
	state := "unliked"
	if liked {
		state = "liked"
	}
	tryTeamAudit(uc.auditRepo, assignmentID, teamID, userID, domain.TeamAuditSubmissionLiked, map[string]string{
		"submission_id": submissionID,
		"state":         state,
	})
	return liked, nil
}

func (uc *FinalizeTeamVoteSubmission) Finalize(courseID, assignmentID, teamID, teacherID string) (*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, teacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	if !a.AllowEarlyFinalization && a.Deadline != nil && time.Now().UTC().Before(*a.Deadline) {
		return nil, &ValidationError{Message: "finalize not allowed before deadline"}
	}
	return uc.FinalizeVoteForTeam(courseID, assignmentID, teamID, false, teacherID)
}
