package usecase

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

var ErrInvalidCredentials = errors.New("invalid credentials")

type TokenIssuer interface {
	Issue(userID string) (string, error)
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

type JWTIssuer struct {
	Secret []byte
	Expiry time.Duration
}

type claims struct {
	jwt.RegisteredClaims
	Sub string `json:"sub"`
}

func (j *JWTIssuer) Issue(userID string) (string, error) {
	now := time.Now().UTC()
	c := claims{
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
