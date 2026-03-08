package usecase

import (
	"errors"
	"testing"

	"hits-classroom/internal/domain"
)

type stubUserRepo struct {
	createErr error
	byEmail   map[string]*domain.User
	byID      map[string]*domain.User
}

func (s *stubUserRepo) Create(u *domain.User) error {
	if s.createErr != nil {
		return s.createErr
	}
	if s.byEmail == nil {
		s.byEmail = make(map[string]*domain.User)
	}
	if s.byID == nil {
		s.byID = make(map[string]*domain.User)
	}
	s.byEmail[u.Email] = u
	s.byID[u.ID] = u
	return nil
}

func (s *stubUserRepo) ByEmail(email string) (*domain.User, error) {
	if u, ok := s.byEmail[email]; ok {
		return u, nil
	}
	return nil, nil
}

func (s *stubUserRepo) GetByID(id string) (*domain.User, error) {
	if s.byID != nil {
		return s.byID[id], nil
	}
	return nil, nil
}

func (s *stubUserRepo) Update(u *domain.User) error {
	if s.byEmail != nil {
		s.byEmail[u.Email] = u
	}
	if s.byID != nil {
		s.byID[u.ID] = u
	}
	return nil
}

type stubHasher struct{}

func (stubHasher) Hash(password string) (string, error) {
	return "hashed_" + password, nil
}

func (stubHasher) Compare(hash, plain string) error {
	return nil
}

type stubLoginRepo struct {
	byEmail map[string]*domain.User
}

func (s *stubLoginRepo) Create(u *domain.User) error { return nil }

func (s *stubLoginRepo) ByEmail(email string) (*domain.User, error) {
	if s.byEmail == nil {
		return nil, nil
	}
	return s.byEmail[email], nil
}

func (s *stubLoginRepo) GetByID(id string) (*domain.User, error) {
	for _, u := range s.byEmail {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, nil
}

func (s *stubLoginRepo) Update(u *domain.User) error { return nil }

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

func mustHash(p string) string {
	h, _ := BcryptHasher{}.Hash(p)
	return h
}

func TestRegister_Success(t *testing.T) {
	repo := &stubUserRepo{byEmail: make(map[string]*domain.User)}
	issuer := &stubTokenIssuer{token: "test-token"}
	uc := NewRegister(repo, stubHasher{}, issuer)

	user, token, err := uc.Register(RegisterInput{
		Email:     "u@test.com",
		Password:  "password12",
		FirstName: "John",
		LastName:  "Doe",
		BirthDate: "1990-01-15",
	})
	if err != nil {
		t.Fatalf("Register() err = %v", err)
	}
	if user.ID == "" {
		t.Error("user.ID is empty")
	}
	if user.Email != "u@test.com" {
		t.Errorf("user.Email = %q", user.Email)
	}
	if user.PasswordHash != "hashed_password12" {
		t.Errorf("user.PasswordHash = %q", user.PasswordHash)
	}
	if user.FirstName != "John" || user.LastName != "Doe" {
		t.Errorf("name = %s %s", user.FirstName, user.LastName)
	}
	if user.CreatedAt.IsZero() {
		t.Error("user.CreatedAt is zero")
	}
	if token != "test-token" {
		t.Errorf("token = %q, want test-token", token)
	}
}

func TestRegister_EmailExists(t *testing.T) {
	existing := &domain.User{ID: "1", Email: "taken@test.com"}
	repo := &stubUserRepo{byEmail: map[string]*domain.User{"taken@test.com": existing}}
	issuer := &stubTokenIssuer{token: "t"}
	uc := NewRegister(repo, stubHasher{}, issuer)

	_, _, err := uc.Register(RegisterInput{
		Email:     "taken@test.com",
		Password:  "password12",
		FirstName: "A",
		LastName:  "B",
		BirthDate: "1990-01-01",
	})
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrEmailExists) {
		t.Errorf("err = %v, want ErrEmailExists", err)
	}
}

func TestRegister_Validation(t *testing.T) {
	repo := &stubUserRepo{byEmail: make(map[string]*domain.User)}
	issuer := &stubTokenIssuer{token: "t"}
	uc := NewRegister(repo, stubHasher{}, issuer)

	tests := []struct {
		name string
		in   RegisterInput
	}{
		{"empty email", RegisterInput{Email: "", Password: "password12", FirstName: "A", LastName: "B", BirthDate: "1990-01-01"}},
		{"bad email", RegisterInput{Email: "notanemail", Password: "password12", FirstName: "A", LastName: "B", BirthDate: "1990-01-01"}},
		{"short password", RegisterInput{Email: "a@b.com", Password: "short", FirstName: "A", LastName: "B", BirthDate: "1990-01-01"}},
		{"empty first name", RegisterInput{Email: "a@b.com", Password: "password12", FirstName: "", LastName: "B", BirthDate: "1990-01-01"}},
		{"empty last name", RegisterInput{Email: "a@b.com", Password: "password12", FirstName: "A", LastName: "", BirthDate: "1990-01-01"}},
		{"bad birth_date", RegisterInput{Email: "a@b.com", Password: "password12", FirstName: "A", LastName: "B", BirthDate: "invalid"}},
		{"future birth_date", RegisterInput{Email: "a@b.com", Password: "password12", FirstName: "A", LastName: "B", BirthDate: "2099-01-01"}},
		{"too young", RegisterInput{Email: "a@b.com", Password: "password12", FirstName: "A", LastName: "B", BirthDate: "2020-01-01"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := uc.Register(tt.in)
			if err == nil {
				t.Fatal("expected validation err")
			}
			var vErr *ValidationError
			if !errors.As(err, &vErr) {
				t.Errorf("err = %v, want *ValidationError", err)
			}
		})
	}
}

func TestRegister_RepoError(t *testing.T) {
	repo := &stubUserRepo{byEmail: make(map[string]*domain.User), createErr: errors.New("db error")}
	issuer := &stubTokenIssuer{token: "t"}
	uc := NewRegister(repo, stubHasher{}, issuer)

	_, _, err := uc.Register(RegisterInput{
		Email:     "u@test.com",
		Password:  "password12",
		FirstName: "A",
		LastName:  "B",
		BirthDate: "1990-01-01",
	})
	if err == nil {
		t.Fatal("expected err")
	}
	var vErr *ValidationError
	if errors.As(err, &vErr) || errors.Is(err, ErrEmailExists) {
		t.Errorf("expected repo err, got %v", err)
	}
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
