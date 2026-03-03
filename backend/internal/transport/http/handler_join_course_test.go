package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository/memory"
	"hits-classroom/internal/usecase"
)

func TestJoinCourseHandler_Success(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	_ = courseRepo.Create(&domain.Course{ID: "c1", Title: "Math", InviteCode: "ABCD1234"})
	uc := usecase.NewJoinCourse(courseRepo, memberRepo)
	h := NewJoinCourseHandler(uc)

	body := map[string]string{"code": "ABCD1234"}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/courses/join", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), UserIDContextKey, "user-1"))
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var res struct {
		ID         string `json:"id"`
		Title      string `json:"title"`
		InviteCode string `json:"invite_code"`
		Role       string `json:"role"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if res.ID != "c1" || res.Role != "student" {
		t.Errorf("response = %+v", res)
	}
}

func TestJoinCourseHandler_NotFound(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewJoinCourse(courseRepo, memberRepo)
	h := NewJoinCourseHandler(uc)

	body := map[string]string{"code": "INVALID1"}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/courses/join", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), UserIDContextKey, "user-1"))
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestJoinCourseHandler_Unauthorized(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewJoinCourse(courseRepo, memberRepo)
	h := NewJoinCourseHandler(uc)

	body := map[string]string{"code": "ABCD1234"}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/courses/join", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}
