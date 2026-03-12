package usecase

import (
	"errors"
	"net/mail"
	"strings"
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

// ValidationError содержит конкретное сообщение для клиента.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

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
	issuer TokenIssuer
}

func NewRegister(repo repository.UserRepository, hasher PasswordHasher, issuer TokenIssuer) *Register {
	return &Register{repo: repo, hasher: hasher, issuer: issuer}
}

func (uc *Register) Register(in RegisterInput) (*domain.User, string, error) {
	in.Email = strings.TrimSpace(strings.ToLower(in.Email))
	if in.Email == "" {
		return nil, "", &ValidationError{Message: "email is required"}
	}
	if _, err := mail.ParseAddress(in.Email); err != nil {
		return nil, "", &ValidationError{Message: "email must be a valid email address"}
	}
	if len(in.Password) < 8 {
		return nil, "", &ValidationError{Message: "password must be at least 8 characters"}
	}
	if in.FirstName == "" {
		return nil, "", &ValidationError{Message: "first_name is required"}
	}
	if in.LastName == "" {
		return nil, "", &ValidationError{Message: "last_name is required"}
	}
	if in.BirthDate == "" {
		return nil, "", &ValidationError{Message: "birth_date is required"}
	}
	birth, err := time.Parse("2006-01-02", in.BirthDate)
	if err != nil {
		return nil, "", &ValidationError{Message: "birth_date must be in format YYYY-MM-DD"}
	}
	if err := validateBirthDate(birth); err != nil {
		return nil, "", err
	}
	existing, err := uc.repo.ByEmail(in.Email)
	if err != nil {
		return nil, "", err
	}
	if existing != nil {
		return nil, "", ErrEmailExists
	}
	hash, err := uc.hasher.Hash(in.Password)
	if err != nil {
		return nil, "", err
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
		return nil, "", err
	}
	token, err := uc.issuer.Issue(user.ID)
	if err != nil {
		return nil, "", err
	}
	return user, token, nil
}

// validateBirthDate проверяет, что дата рождения в прошлом и возраст разумный.
func validateBirthDate(birth time.Time) error {
	now := time.Now().UTC()
	if birth.After(now) {
		return &ValidationError{Message: "birth_date cannot be in the future"}
	}
	age := now.Year() - birth.Year()
	if birth.AddDate(age, 0, 0).After(now) {
		age--
	}
	if age < 14 {
		return &ValidationError{Message: "user must be at least 14 years old"}
	}
	if age > 150 {
		return &ValidationError{Message: "birth_date is not realistic"}
	}
	return nil
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
	email := strings.TrimSpace(strings.ToLower(in.Email))
	if email == "" {
		return nil, "", ErrInvalidCredentials
	}
	user, err := uc.repo.ByEmail(email)
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

type CheckEmailExists struct {
	repo repository.UserRepository
}

func NewCheckEmailExists(repo repository.UserRepository) *CheckEmailExists {
	return &CheckEmailExists{repo: repo}
}

func (uc *CheckEmailExists) CheckEmailExists(email string) (bool, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return false, &ValidationError{Message: "email is required"}
	}
	u, err := uc.repo.ByEmail(email)
	if err != nil {
		return false, err
	}
	return u != nil, nil
}

type GetMe struct {
	repo repository.UserRepository
}

func NewGetMe(repo repository.UserRepository) *GetMe {
	return &GetMe{repo: repo}
}

func (uc *GetMe) GetMe(userID string) (*domain.User, error) {
	return uc.repo.GetByID(userID)
}

type UpdateProfileInput struct {
	UserID    string
	FirstName string
	LastName  string
	BirthDate string
}

type UpdateMe struct {
	repo repository.UserRepository
}

func NewUpdateMe(repo repository.UserRepository) *UpdateMe {
	return &UpdateMe{repo: repo}
}

func (uc *UpdateMe) UpdateMe(in UpdateProfileInput) (*domain.User, error) {
	user, err := uc.repo.GetByID(in.UserID)
	if err != nil || user == nil {
		return nil, ErrValidation
	}
	if in.FirstName != "" {
		user.FirstName = in.FirstName
	}
	if in.LastName != "" {
		user.LastName = in.LastName
	}
	if in.BirthDate != "" {
		birth, err := time.Parse("2006-01-02", in.BirthDate)
		if err != nil {
			return nil, &ValidationError{Message: "birth_date must be in format YYYY-MM-DD"}
		}
		if err := validateBirthDate(birth); err != nil {
			return nil, err
		}
		user.BirthDate = birth
	}
	if err := uc.repo.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}
