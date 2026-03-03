package usecase

import (
	"errors"
	"testing"

	"hits-classroom/internal/domain"
)

type stubUserRepo struct {
	createErr error
	byEmail   map[string]*domain.User
}

func (s *stubUserRepo) Create(u *domain.User) error {
	if s.createErr != nil {
		return s.createErr
	}
	if s.byEmail == nil {
		s.byEmail = make(map[string]*domain.User)
	}
	s.byEmail[u.Email] = u
	return nil
}

func (s *stubUserRepo) ByEmail(email string) (*domain.User, error) {
	if u, ok := s.byEmail[email]; ok {
		return u, nil
	}
	return nil, nil
}

type stubHasher struct{}

func (stubHasher) Hash(password string) (string, error) {
	return "hashed_" + password, nil
}

func (stubHasher) Compare(hash, plain string) error {
	return nil
}

func TestRegister_Success(t *testing.T) {
	repo := &stubUserRepo{byEmail: make(map[string]*domain.User)}
	uc := NewRegister(repo, stubHasher{})

	user, err := uc.Register(RegisterInput{
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
}

func TestRegister_EmailExists(t *testing.T) {
	existing := &domain.User{ID: "1", Email: "taken@test.com"}
	repo := &stubUserRepo{byEmail: map[string]*domain.User{"taken@test.com": existing}}
	uc := NewRegister(repo, stubHasher{})

	_, err := uc.Register(RegisterInput{
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
	uc := NewRegister(repo, stubHasher{})

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
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := uc.Register(tt.in)
			if err == nil {
				t.Fatal("expected validation err")
			}
			if !errors.Is(err, ErrValidation) {
				t.Errorf("err = %v, want ErrValidation", err)
			}
		})
	}
}

func TestRegister_RepoError(t *testing.T) {
	repo := &stubUserRepo{byEmail: make(map[string]*domain.User), createErr: errors.New("db error")}
	uc := NewRegister(repo, stubHasher{})

	_, err := uc.Register(RegisterInput{
		Email:     "u@test.com",
		Password:  "password12",
		FirstName: "A",
		LastName:  "B",
		BirthDate: "1990-01-01",
	})
	if err == nil {
		t.Fatal("expected err")
	}
	if errors.Is(err, ErrValidation) || errors.Is(err, ErrEmailExists) {
		t.Errorf("expected repo err, got %v", err)
	}
}
