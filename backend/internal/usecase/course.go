package usecase

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrCourseNotFound   = errors.New("course not found")
	ErrForbidden        = errors.New("forbidden")
	ErrAlreadyMember    = errors.New("already a member")
	ErrAssignmentClosed = errors.New("assignment is closed")
)

const inviteCodeLen = 8
const inviteCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

type CourseWithRoleItem struct {
	Course *domain.Course
	Role   domain.CourseRole
	Status domain.CourseMemberStatus
}

func generateInviteCode() (string, error) {
	b := make([]byte, inviteCodeLen)
	max := big.NewInt(int64(len(inviteCodeChars)))
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = inviteCodeChars[n.Int64()]
	}
	return string(b), nil
}

type CreateCourseInput struct {
	OwnerID string
	Title   string
}

type CreateCourse struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewCreateCourse(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *CreateCourse {
	return &CreateCourse{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *CreateCourse) CreateCourse(in CreateCourseInput) (*domain.Course, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" || in.OwnerID == "" {
		return nil, ErrValidation
	}
	code, err := generateInviteCode()
	if err != nil {
		return nil, err
	}
	course := &domain.Course{
		ID:         uuid.New().String(),
		Title:      title,
		InviteCode: code,
		CreatedAt:  time.Now().UTC(),
	}
	if err := uc.courseRepo.Create(course); err != nil {
		return nil, err
	}
	member := &domain.CourseMember{
		CourseID:    course.ID,
		UserID:      in.OwnerID,
		Role:        domain.RoleOwner,
		Status:      domain.MemberStatusApproved,
		RequestedAt: time.Now().UTC(),
	}
	if err := uc.memberRepo.Create(member); err != nil {
		return nil, err
	}
	return course, nil
}

type JoinCourseInput struct {
	UserID string
	Code   string
}

type JoinCourse struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewJoinCourse(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *JoinCourse {
	return &JoinCourse{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *JoinCourse) JoinCourse(in JoinCourseInput) (*domain.Course, domain.CourseRole, error) {
	code := strings.TrimSpace(in.Code)
	if len(code) != 8 || in.UserID == "" {
		return nil, "", ErrValidation
	}
	course, err := uc.courseRepo.GetByInviteCode(code)
	if err != nil {
		return nil, "", err
	}
	if course == nil {
		return nil, "", ErrCourseNotFound
	}
	member, err := uc.memberRepo.Get(course.ID, in.UserID)
	if err != nil {
		return nil, "", err
	}
	if member != nil {
		if member.Role != domain.RoleStudent || member.Status == domain.MemberStatusApproved {
			return nil, "", ErrAlreadyMember
		}
		member.Status = domain.MemberStatusApproved
		member.RequestedAt = time.Now().UTC()
		now := time.Now().UTC()
		member.DecidedAt = &now
		member.DecidedBy = in.UserID
		member.DecisionNote = ""
		if err := uc.memberRepo.Update(member); err != nil {
			return nil, "", err
		}
		return course, domain.RoleStudent, nil
	}
	member = &domain.CourseMember{
		CourseID:    course.ID,
		UserID:      in.UserID,
		Role:        domain.RoleStudent,
		Status:      domain.MemberStatusApproved,
		RequestedAt: time.Now().UTC(),
		DecidedAt:   nil,
	}
	if err := uc.memberRepo.Create(member); err != nil {
		return nil, "", err
	}
	return course, domain.RoleStudent, nil
}

type ListCourses struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewListCourses(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *ListCourses {
	return &ListCourses{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *ListCourses) ListCourses(userID string) ([]CourseWithRoleItem, error) {
	members, err := uc.memberRepo.ListByUser(userID)
	if err != nil {
		return nil, err
	}
	var out []CourseWithRoleItem
	for _, m := range members {
		course, err := uc.courseRepo.GetByID(m.CourseID)
		if err != nil || course == nil {
			continue
		}
		out = append(out, CourseWithRoleItem{Course: course, Role: m.Role, Status: m.Status})
	}
	return out, nil
}

type GetCourse struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewGetCourse(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *GetCourse {
	return &GetCourse{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *GetCourse) GetCourse(courseID, userID string) (*domain.Course, domain.CourseRole, error) {
	course, err := uc.courseRepo.GetByID(courseID)
	if err != nil {
		return nil, "", err
	}
	if course == nil {
		return nil, "", ErrCourseNotFound
	}
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil {
		return nil, "", err
	}
	if role == "" {
		return nil, "", ErrForbidden
	}
	return course, role, nil
}

type GetInviteCode struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewGetInviteCode(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *GetInviteCode {
	return &GetInviteCode{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *GetInviteCode) GetInviteCode(courseID, userID string) (string, error) {
	course, err := uc.courseRepo.GetByID(courseID)
	if err != nil {
		return "", err
	}
	if course == nil {
		return "", ErrCourseNotFound
	}
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil {
		return "", err
	}
	if role == "" {
		return "", ErrForbidden
	}
	if role == domain.RoleStudent {
		return "", ErrForbidden
	}
	return course.InviteCode, nil
}

type DeleteCourse struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewDeleteCourse(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *DeleteCourse {
	return &DeleteCourse{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *DeleteCourse) DeleteCourse(courseID, userID string) error {
	course, err := uc.courseRepo.GetByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return ErrCourseNotFound
	}
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil {
		return err
	}
	if role != domain.RoleOwner {
		return ErrForbidden
	}
	if err := uc.memberRepo.DeleteByCourse(courseID); err != nil {
		return err
	}
	return uc.courseRepo.Delete(courseID)
}

type UpdateCourseInput struct {
	CourseID string
	UserID   string
	Title    string
}

type UpdateCourse struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewUpdateCourse(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *UpdateCourse {
	return &UpdateCourse{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *UpdateCourse) UpdateCourse(in UpdateCourseInput) (*domain.Course, error) {
	course, err := uc.courseRepo.GetByID(in.CourseID)
	if err != nil || course == nil {
		return nil, ErrCourseNotFound
	}
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
	course.Title = title
	if err := uc.courseRepo.Update(course); err != nil {
		return nil, err
	}
	return course, nil
}

type MemberWithUser struct {
	UserID       string
	Email        string
	FirstName    string
	LastName     string
	Role         domain.CourseRole
	Status       domain.CourseMemberStatus
	RequestedAt  time.Time
	DecidedAt    *time.Time
	DecidedBy    string
	DecisionNote string
}

type ListCourseMembers struct {
	memberRepo repository.CourseMemberRepository
	userRepo   repository.UserRepository
}

func NewListCourseMembers(memberRepo repository.CourseMemberRepository, userRepo repository.UserRepository) *ListCourseMembers {
	return &ListCourseMembers{memberRepo: memberRepo, userRepo: userRepo}
}

func (uc *ListCourseMembers) ListCourseMembers(courseID, userID string) ([]MemberWithUser, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	members, err := uc.memberRepo.ListByCourse(courseID)
	if err != nil {
		return nil, err
	}
	out := make([]MemberWithUser, 0, len(members))
	for _, m := range members {
		u, _ := uc.userRepo.GetByID(m.UserID)
		email, firstName, lastName := "", "", ""
		if u != nil {
			email, firstName, lastName = u.Email, u.FirstName, u.LastName
		}
		out = append(out, MemberWithUser{
			UserID:       m.UserID,
			Email:        email,
			FirstName:    firstName,
			LastName:     lastName,
			Role:         m.Role,
			Status:       m.Status,
			RequestedAt:  m.RequestedAt,
			DecidedAt:    m.DecidedAt,
			DecidedBy:    m.DecidedBy,
			DecisionNote: m.DecisionNote,
		})
	}
	return out, nil
}

type DecideJoinRequestInput struct {
	CourseID  string
	TeacherID string
	UserID    string
	Approve   bool
	Note      string
}

type DecideJoinRequest struct {
	memberRepo repository.CourseMemberRepository
}

func NewDecideJoinRequest(memberRepo repository.CourseMemberRepository) *DecideJoinRequest {
	return &DecideJoinRequest{memberRepo: memberRepo}
}

func (uc *DecideJoinRequest) Decide(in DecideJoinRequestInput) (*domain.CourseMember, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.TeacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return nil, ErrForbidden
	}
	member, err := uc.memberRepo.Get(in.CourseID, in.UserID)
	if err != nil || member == nil {
		return nil, ErrCourseNotFound
	}
	if member.Role != domain.RoleStudent && member.Role != domain.RoleTeacher {
		return nil, &ValidationError{Message: "only pending student or teacher requests can be decided"}
	}
	if member.Status != domain.MemberStatusPending {
		return nil, &ValidationError{Message: "request is already decided"}
	}
	now := time.Now().UTC()
	if in.Approve {
		member.Status = domain.MemberStatusApproved
	} else {
		member.Status = domain.MemberStatusRejected
	}
	member.DecidedAt = &now
	member.DecidedBy = in.TeacherID
	member.DecisionNote = strings.TrimSpace(in.Note)
	if err := uc.memberRepo.Update(member); err != nil {
		return nil, err
	}
	return member, nil
}

type ListJoinRequests struct {
	memberRepo repository.CourseMemberRepository
	userRepo   repository.UserRepository
}

func NewListJoinRequests(memberRepo repository.CourseMemberRepository, userRepo repository.UserRepository) *ListJoinRequests {
	return &ListJoinRequests{memberRepo: memberRepo, userRepo: userRepo}
}

func (uc *ListJoinRequests) List(courseID, teacherID string, status domain.CourseMemberStatus) ([]MemberWithUser, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, teacherID)
	if err != nil || (role != domain.RoleOwner && role != domain.RoleTeacher) {
		return nil, ErrForbidden
	}
	rows, err := uc.memberRepo.ListByCourseAndStatus(courseID, status)
	if err != nil {
		return nil, err
	}
	out := make([]MemberWithUser, 0, len(rows))
	for _, m := range rows {
		u, _ := uc.userRepo.GetByID(m.UserID)
		email, firstName, lastName := "", "", ""
		if u != nil {
			email, firstName, lastName = u.Email, u.FirstName, u.LastName
		}
		out = append(out, MemberWithUser{
			UserID:       m.UserID,
			Email:        email,
			FirstName:    firstName,
			LastName:     lastName,
			Role:         m.Role,
			Status:       m.Status,
			RequestedAt:  m.RequestedAt,
			DecidedAt:    m.DecidedAt,
			DecidedBy:    m.DecidedBy,
			DecisionNote: m.DecisionNote,
		})
	}
	return out, nil
}

type AssignTeacherInput struct {
	CourseID     string
	UserID       string
	TargetUserID string
}

type AssignTeacher struct {
	memberRepo repository.CourseMemberRepository
}

func NewAssignTeacher(memberRepo repository.CourseMemberRepository) *AssignTeacher {
	return &AssignTeacher{memberRepo: memberRepo}
}

func (uc *AssignTeacher) AssignTeacher(in AssignTeacherInput) error {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role != domain.RoleOwner {
		return ErrForbidden
	}
	member, err := uc.memberRepo.Get(in.CourseID, in.TargetUserID)
	if err != nil || member == nil {
		return ErrCourseNotFound
	}
	member.Role = domain.RoleTeacher
	member.Status = domain.MemberStatusApproved
	return uc.memberRepo.Update(member)
}

// ── InviteTeacher — новая фича: пригласить пользователя на роль учителя по email ──

var (
	ErrUserNotFound = errors.New("user not found")
	ErrAlreadyRole  = errors.New("user already has this role")
)

type InviteTeacherInput struct {
	CourseID string
	UserID   string // кто приглашает (должен быть owner)
	Email    string
}

type InviteTeacher struct {
	memberRepo repository.CourseMemberRepository
	userRepo   repository.UserRepository
}

func NewInviteTeacher(memberRepo repository.CourseMemberRepository, userRepo repository.UserRepository) *InviteTeacher {
	return &InviteTeacher{memberRepo: memberRepo, userRepo: userRepo}
}

func (uc *InviteTeacher) InviteTeacher(in InviteTeacherInput) (*domain.CourseMember, error) {
	// Только owner может приглашать учителей
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role != domain.RoleOwner {
		return nil, ErrForbidden
	}

	email := strings.TrimSpace(strings.ToLower(in.Email))
	if email == "" {
		return nil, &ValidationError{Message: "email is required"}
	}

	// Найти пользователя по email
	target, err := uc.userRepo.ByEmail(email)
	if err != nil || target == nil {
		return nil, ErrUserNotFound
	}

	// Нельзя приглашать самого себя
	if target.ID == in.UserID {
		return nil, &ValidationError{Message: "cannot invite yourself"}
	}

	// Проверить, есть ли уже в курсе
	existing, err := uc.memberRepo.Get(in.CourseID, target.ID)
	if err != nil {
		return nil, err
	}

	if existing != nil {
		switch existing.Role {
		case domain.RoleOwner:
			return nil, &ValidationError{Message: "user is the course owner"}
		case domain.RoleTeacher:
			if existing.Status == domain.MemberStatusApproved {
				return nil, ErrAlreadyRole
			}
			return nil, &ValidationError{Message: "invitation already pending"}
		case domain.RoleStudent:
			if existing.Status != domain.MemberStatusApproved {
				return nil, &ValidationError{Message: "user has a pending join request"}
			}
			// Приглашение стать преподавателем — до принятия доступ как у ожидающего
			existing.Role = domain.RoleTeacher
			existing.Status = domain.MemberStatusPending
			existing.RequestedAt = time.Now().UTC()
			existing.DecidedAt = nil
			existing.DecidedBy = ""
			existing.DecisionNote = ""
			if err := uc.memberRepo.Update(existing); err != nil {
				return nil, err
			}
			return existing, nil
		}
	}

	// Приглашение: преподаватель подтверждает участие сам (или владелец через заявки)
	member := &domain.CourseMember{
		CourseID:    in.CourseID,
		UserID:      target.ID,
		Role:        domain.RoleTeacher,
		Status:      domain.MemberStatusPending,
		RequestedAt: time.Now().UTC(),
	}
	if err := uc.memberRepo.Create(member); err != nil {
		return nil, err
	}
	return member, nil
}

// AcceptCourseInvitation — приглашённый преподаватель принимает приглашение (pending → approved).
type AcceptCourseInvitation struct {
	memberRepo repository.CourseMemberRepository
}

func NewAcceptCourseInvitation(memberRepo repository.CourseMemberRepository) *AcceptCourseInvitation {
	return &AcceptCourseInvitation{memberRepo: memberRepo}
}

func (uc *AcceptCourseInvitation) Accept(courseID, userID string) (*domain.CourseMember, error) {
	m, err := uc.memberRepo.Get(courseID, userID)
	if err != nil || m == nil {
		return nil, ErrForbidden
	}
	if m.Status != domain.MemberStatusPending {
		return nil, &ValidationError{Message: "no pending invitation"}
	}
	if m.Role != domain.RoleTeacher {
		return nil, &ValidationError{Message: "only teacher invitations can be accepted here"}
	}
	now := time.Now().UTC()
	m.Status = domain.MemberStatusApproved
	m.DecidedAt = &now
	m.DecidedBy = userID
	if err := uc.memberRepo.Update(m); err != nil {
		return nil, err
	}
	return m, nil
}

var ErrLastOwner = errors.New("cannot remove the last owner")

type LeaveCourseInput struct {
	CourseID string
	UserID   string
}

type LeaveCourse struct {
	memberRepo repository.CourseMemberRepository
}

func NewLeaveCourse(memberRepo repository.CourseMemberRepository) *LeaveCourse {
	return &LeaveCourse{memberRepo: memberRepo}
}

func (uc *LeaveCourse) LeaveCourse(in LeaveCourseInput) error {
	member, err := uc.memberRepo.Get(in.CourseID, in.UserID)
	if err != nil || member == nil {
		return ErrForbidden
	}
	if member.Role == domain.RoleOwner {
		if err := checkNotLastOwner(uc.memberRepo, in.CourseID, in.UserID); err != nil {
			return err
		}
	}
	return uc.memberRepo.Delete(in.CourseID, in.UserID)
}

type RemoveMemberInput struct {
	CourseID     string
	UserID       string
	TargetUserID string
}

type RemoveMember struct {
	memberRepo repository.CourseMemberRepository
}

func NewRemoveMember(memberRepo repository.CourseMemberRepository) *RemoveMember {
	return &RemoveMember{memberRepo: memberRepo}
}

func (uc *RemoveMember) RemoveMember(in RemoveMemberInput) error {
	callerRole, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || callerRole == "" {
		return ErrForbidden
	}
	if in.UserID == in.TargetUserID {
		return &ValidationError{Message: "use leave endpoint to remove yourself"}
	}
	target, err := uc.memberRepo.Get(in.CourseID, in.TargetUserID)
	if err != nil || target == nil {
		return ErrCourseNotFound
	}
	switch callerRole {
	case domain.RoleOwner:
		if target.Role == domain.RoleOwner {
			return &ValidationError{Message: "cannot remove another owner"}
		}
	case domain.RoleTeacher:
		if target.Role != domain.RoleStudent {
			return ErrForbidden
		}
	default:
		return ErrForbidden
	}
	return uc.memberRepo.Delete(in.CourseID, in.TargetUserID)
}

type ChangeMemberRoleInput struct {
	CourseID     string
	UserID       string
	TargetUserID string
	NewRole      domain.CourseRole
}

type ChangeMemberRole struct {
	memberRepo repository.CourseMemberRepository
}

func NewChangeMemberRole(memberRepo repository.CourseMemberRepository) *ChangeMemberRole {
	return &ChangeMemberRole{memberRepo: memberRepo}
}

func (uc *ChangeMemberRole) ChangeMemberRole(in ChangeMemberRoleInput) (*domain.CourseMember, error) {
	callerRole, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || callerRole != domain.RoleOwner {
		return nil, ErrForbidden
	}
	if in.NewRole != domain.RoleOwner && in.NewRole != domain.RoleTeacher && in.NewRole != domain.RoleStudent {
		return nil, &ValidationError{Message: "invalid role"}
	}
	target, err := uc.memberRepo.Get(in.CourseID, in.TargetUserID)
	if err != nil || target == nil {
		return nil, ErrCourseNotFound
	}
	if target.Role == in.NewRole {
		return target, nil
	}
	// If demoting an owner, verify another owner exists
	if target.Role == domain.RoleOwner && in.NewRole != domain.RoleOwner {
		if err := checkNotLastOwner(uc.memberRepo, in.CourseID, in.TargetUserID); err != nil {
			return nil, err
		}
	}
	target.Role = in.NewRole
	if err := uc.memberRepo.Update(target); err != nil {
		return nil, err
	}
	return target, nil
}

func checkNotLastOwner(memberRepo repository.CourseMemberRepository, courseID, excludeUserID string) error {
	members, err := memberRepo.ListByCourse(courseID)
	if err != nil {
		return err
	}
	ownerCount := 0
	for _, m := range members {
		if m.Role == domain.RoleOwner && m.UserID != excludeUserID {
			ownerCount++
		}
	}
	if ownerCount == 0 {
		return ErrLastOwner
	}
	return nil
}

type RegenerateInviteCode struct {
	courseRepo repository.CourseRepository
	memberRepo repository.CourseMemberRepository
}

func NewRegenerateInviteCode(courseRepo repository.CourseRepository, memberRepo repository.CourseMemberRepository) *RegenerateInviteCode {
	return &RegenerateInviteCode{courseRepo: courseRepo, memberRepo: memberRepo}
}

func (uc *RegenerateInviteCode) RegenerateInviteCode(courseID, userID string) (*domain.Course, error) {
	course, err := uc.courseRepo.GetByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, ErrCourseNotFound
	}
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil {
		return nil, err
	}
	if role == "" || role == domain.RoleStudent {
		return nil, ErrForbidden
	}
	code, err := generateInviteCode()
	if err != nil {
		return nil, err
	}
	course.InviteCode = code
	if err := uc.courseRepo.Update(course); err != nil {
		return nil, err
	}
	return course, nil
}
