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
		CourseID: course.ID,
		UserID:   in.OwnerID,
		Role:     domain.RoleOwner,
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
	role, err := uc.memberRepo.GetUserRole(course.ID, in.UserID)
	if err != nil {
		return nil, "", err
	}
	if role != "" {
		return nil, "", ErrAlreadyMember
	}
	member := &domain.CourseMember{
		CourseID: course.ID,
		UserID:   in.UserID,
		Role:     domain.RoleStudent,
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
		out = append(out, CourseWithRoleItem{Course: course, Role: m.Role})
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
	UserID    string
	Email     string
	FirstName string
	LastName  string
	Role      domain.CourseRole
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
			UserID:    m.UserID,
			Email:     email,
			FirstName: firstName,
			LastName:  lastName,
			Role:      m.Role,
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
			return nil, ErrAlreadyRole
		case domain.RoleStudent:
			// Обновляем роль студента до учителя
			existing.Role = domain.RoleTeacher
			if err := uc.memberRepo.Update(existing); err != nil {
				return nil, err
			}
			return existing, nil
		}
	}

	// Пользователь не в курсе — добавляем сразу как учителя
	member := &domain.CourseMember{
		CourseID: in.CourseID,
		UserID:   target.ID,
		Role:     domain.RoleTeacher,
	}
	if err := uc.memberRepo.Create(member); err != nil {
		return nil, err
	}
	return member, nil
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
