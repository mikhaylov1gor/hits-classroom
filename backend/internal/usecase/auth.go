package usecase

import (
	"errors"
	"net/mail"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

var (
	ErrEmailExists        = errors.New("email already exists")
	ErrValidation         = errors.New("validation error")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(hash, plain string) error
}

type TokenIssuer interface {
	Issue(userID string) (string, error)
}

type BcryptHasher struct{}

func (BcryptHasher) Hash(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (BcryptHasher) Compare(hash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}

type JWTIssuer struct {
	Secret []byte
	Expiry time.Duration
}

type jwtClaims struct {
	jwt.RegisteredClaims
	Sub string `json:"sub"`
}

func (j *JWTIssuer) Issue(userID string) (string, error) {
	now := time.Now().UTC()
	c := jwtClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(j.Expiry)),
		},
		Sub: userID,
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	return t.SignedString(j.Secret)
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

type LoginInput struct {
	Email    string
	Password string
}

type Login struct {
	repo   repository.UserRepository
	hasher PasswordHasher
	issuer TokenIssuer
}

func NewLogin(repo repository.UserRepository, hasher PasswordHasher, issuer TokenIssuer) *Login {
	return &Login{repo: repo, hasher: hasher, issuer: issuer}
}

func (uc *Login) Login(in LoginInput) (*domain.User, string, error) {
	user, err := uc.repo.ByEmail(in.Email)
	if err != nil {
		return nil, "", err
	}
	if user == nil {
		return nil, "", ErrInvalidCredentials
	}
	if err := uc.hasher.Compare(user.PasswordHash, in.Password); err != nil {
		return nil, "", ErrInvalidCredentials
	}
	token, err := uc.issuer.Issue(user.ID)
	if err != nil {
		return nil, "", err
	}
	return user, token, nil
}
