package usecase

import (
	"errors"
	"testing"

	"hits-classroom/internal/domain"
)

type stubLoginRepo struct {
	byEmail map[string]*domain.User
}

func (s *stubLoginRepo) Create(u *domain.User) error { return nil }

func (s *stubLoginRepo) ByEmail(email string) (*domain.User, error) {
	return s.byEmail[email], nil
}

type stubTokenIssuer struct {
	token string
	err   error
}

func (s *stubTokenIssuer) Issue(userID string) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	return s.token, nil
}

func TestLogin_Success(t *testing.T) {
	user := &domain.User{
		ID:           "user-1",
		Email:        "u@test.com",
		PasswordHash: mustHash("password12"),
		FirstName:    "John",
		LastName:     "Doe",
	}
	repo := &stubLoginRepo{byEmail: map[string]*domain.User{"u@test.com": user}}
	issuer := &stubTokenIssuer{token: "jwt-token-123"}
	uc := NewLogin(repo, BcryptHasher{}, issuer)

	gotUser, token, err := uc.Login(LoginInput{Email: "u@test.com", Password: "password12"})
	if err != nil {
		t.Fatalf("Login() err = %v", err)
	}
	if gotUser.ID != "user-1" || gotUser.Email != "u@test.com" {
		t.Errorf("user = %+v", gotUser)
	}
	if token != "jwt-token-123" {
		t.Errorf("token = %q", token)
	}
}

func TestLogin_UserNotFound(t *testing.T) {
	repo := &stubLoginRepo{byEmail: make(map[string]*domain.User)}
	uc := NewLogin(repo, BcryptHasher{}, &stubTokenIssuer{})

	_, _, err := uc.Login(LoginInput{Email: "none@test.com", Password: "any"})
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("err = %v", err)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	user := &domain.User{
		ID:           "user-1",
		Email:        "u@test.com",
		PasswordHash: mustHash("correct"),
	}
	repo := &stubLoginRepo{byEmail: map[string]*domain.User{"u@test.com": user}}
	uc := NewLogin(repo, BcryptHasher{}, &stubTokenIssuer{})

	_, _, err := uc.Login(LoginInput{Email: "u@test.com", Password: "wrong"})
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("err = %v", err)
	}
}

func mustHash(p string) string {
	h, _ := BcryptHasher{}.Hash(p)
	return h
}
