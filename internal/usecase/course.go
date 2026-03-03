package usecase

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

var (
	ErrCourseNotFound = errors.New("course not found")
	ErrForbidden      = errors.New("forbidden")
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
		return course, role, nil
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
