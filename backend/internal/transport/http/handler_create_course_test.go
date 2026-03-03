package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"hits-classroom/internal/repository/memory"
	"hits-classroom/internal/usecase"
)

func TestCreateCourseHandler_Success(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewCreateCourse(courseRepo, memberRepo)
	h := NewCreateCourseHandler(uc)

	body := map[string]string{"title": "Math 101"}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/courses", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), UserIDContextKey, "user-1"))
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want 201", rec.Code)
	}
	var res struct {
		ID         string `json:"id"`
		Title      string `json:"title"`
		InviteCode string `json:"invite_code"`
		CreatedAt  string `json:"created_at"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if res.ID == "" || res.Title != "Math 101" || len(res.InviteCode) != 8 {
		t.Errorf("response = %+v", res)
	}
}

func TestCreateCourseHandler_Unauthorized(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewCreateCourse(courseRepo, memberRepo)
	h := NewCreateCourseHandler(uc)

	body := map[string]string{"title": "Math"}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/courses", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestCreateCourseHandler_Validation(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewCreateCourse(courseRepo, memberRepo)
	h := NewCreateCourseHandler(uc)

	body := map[string]string{"title": ""}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/courses", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), UserIDContextKey, "user-1"))
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}
