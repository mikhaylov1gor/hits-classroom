package usecase

import (
	"errors"
	"net/mail"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

var (
	ErrEmailExists = errors.New("email already exists")
	ErrValidation  = errors.New("validation error")
)

type PasswordHasher interface {
	Hash(password string) (string, error)
}

type RegisterInput struct {
	Email     string
	Password  string
	FirstName string
	LastName  string
	BirthDate string
}

type Register struct {
	repo   repository.UserRepository
	hasher PasswordHasher
}

func NewRegister(repo repository.UserRepository, hasher PasswordHasher) *Register {
	return &Register{repo: repo, hasher: hasher}
}

type BcryptHasher struct{}

func (BcryptHasher) Hash(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (uc *Register) Register(in RegisterInput) (*domain.User, error) {
	if in.Email == "" || in.FirstName == "" || in.LastName == "" || in.BirthDate == "" {
		return nil, ErrValidation
	}
	if _, err := mail.ParseAddress(in.Email); err != nil {
		return nil, ErrValidation
	}
	if len(in.Password) < 8 {
		return nil, ErrValidation
	}
	existing, err := uc.repo.ByEmail(in.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailExists
	}
	birth, err := time.Parse("2006-01-02", in.BirthDate)
	if err != nil {
		return nil, ErrValidation
	}
	hash, err := uc.hasher.Hash(in.Password)
	if err != nil {
		return nil, err
	}
	user := &domain.User{
		ID:           uuid.New().String(),
		Email:        in.Email,
		PasswordHash: hash,
		FirstName:    in.FirstName,
		LastName:     in.LastName,
		BirthDate:    birth,
		CreatedAt:    time.Now().UTC(),
	}
	if err := uc.repo.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}
