package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository/memory"
	"hits-classroom/internal/usecase"
)

func mustHash(p string) string {
	h, _ := usecase.BcryptHasher{}.Hash(p)
	return h
}

func TestRegisterHandler_Success(t *testing.T) {
	repo := memory.NewUserRepository()
	hasher := usecase.BcryptHasher{}
	uc := usecase.NewRegister(repo, hasher)
	h := NewRegisterHandler(uc)

	body := map[string]string{
		"email":      "u@test.com",
		"password":   "password12",
		"first_name": "John",
		"last_name":  "Doe",
		"birth_date": "1990-01-15",
	}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want 201", rec.Code)
	}
	if rec.Header().Get("Content-Type") != "application/json" {
		t.Errorf("Content-Type = %q", rec.Header().Get("Content-Type"))
	}
	var res struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		BirthDate string `json:"birth_date"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if res.ID == "" || res.Email != "u@test.com" || res.FirstName != "John" || res.LastName != "Doe" || res.BirthDate != "1990-01-15" {
		t.Errorf("response = %+v", res)
	}
}

func TestRegisterHandler_EmailExists(t *testing.T) {
	repo := memory.NewUserRepository()
	_ = repo.Create(&domain.User{ID: "1", Email: "taken@test.com"})
	hasher := usecase.BcryptHasher{}
	uc := usecase.NewRegister(repo, hasher)
	h := NewRegisterHandler(uc)

	body := map[string]string{
		"email":      "taken@test.com",
		"password":   "password12",
		"first_name": "A",
		"last_name":  "B",
		"birth_date": "1990-01-01",
	}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
}

func TestRegisterHandler_Validation(t *testing.T) {
	repo := memory.NewUserRepository()
	uc := usecase.NewRegister(repo, usecase.BcryptHasher{})
	h := NewRegisterHandler(uc)

	body := map[string]string{
		"email":      "bad",
		"password":   "short",
		"first_name": "A",
		"last_name":  "B",
		"birth_date": "1990-01-01",
	}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestLoginHandler_Success(t *testing.T) {
	repo := memory.NewUserRepository()
	hasher := usecase.BcryptHasher{}
	_ = repo.Create(&domain.User{
		ID:           "user-1",
		Email:        "u@test.com",
		PasswordHash: mustHash("password12"),
		FirstName:    "John",
		LastName:     "Doe",
	})
	issuer := &usecase.JWTIssuer{Secret: []byte("secret"), Expiry: 0}
	uc := usecase.NewLogin(repo, hasher, issuer)
	h := NewLoginHandler(uc)

	body := map[string]string{"email": "u@test.com", "password": "password12"}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var res struct {
		Token string `json:"token"`
		User  struct {
			ID        string `json:"id"`
			Email     string `json:"email"`
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
		} `json:"user"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if res.Token == "" || res.User.Email != "u@test.com" {
		t.Errorf("response = %+v", res)
	}
}

func TestLoginHandler_InvalidCredentials(t *testing.T) {
	repo := memory.NewUserRepository()
	uc := usecase.NewLogin(repo, usecase.BcryptHasher{}, &usecase.JWTIssuer{Secret: []byte("s"), Expiry: 0})
	h := NewLoginHandler(uc)

	body := map[string]string{"email": "none@test.com", "password": "any"}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}
