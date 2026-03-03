package usecase

import (
	"crypto/rand"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

const inviteCodeLen = 8
const inviteCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

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
