package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/usecase"
)

type RegisterHandler struct {
	register *usecase.Register
}

func NewRegisterHandler(register *usecase.Register) *RegisterHandler {
	return &RegisterHandler{register: register}
}

func (h *RegisterHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Email     string `json:"email"`
		Password  string `json:"password"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		BirthDate string `json:"birth_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	user, err := h.register.Register(usecase.RegisterInput{
		Email:     req.Email,
		Password:  req.Password,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		BirthDate: req.BirthDate,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrEmailExists) {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "email already exists"})
			return
		}
		if errors.Is(err, usecase.ErrValidation) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "validation failed"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(userResponse(user))
}

type LoginHandler struct {
	login *usecase.Login
}

func NewLoginHandler(login *usecase.Login) *LoginHandler {
	return &LoginHandler{login: login}
}

func (h *LoginHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	user, token, err := h.login.Login(usecase.LoginInput{Email: req.Email, Password: req.Password})
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid credentials"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user":  userResponse(user),
	})
}

func userResponse(u *domain.User) map[string]interface{} {
	return map[string]interface{}{
		"id":         u.ID,
		"email":      u.Email,
		"first_name": u.FirstName,
		"last_name":  u.LastName,
		"birth_date": u.BirthDate.Format("2006-01-02"),
		"created_at": u.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
