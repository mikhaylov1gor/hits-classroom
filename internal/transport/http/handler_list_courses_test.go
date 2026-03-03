package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository/memory"
	"hits-classroom/internal/usecase"
)

func TestListCoursesHandler_Success(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	now := time.Now().UTC()
	_ = courseRepo.Create(&domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: now})
	_ = memberRepo.Create(&domain.CourseMember{CourseID: "c1", UserID: "user-1", Role: domain.RoleOwner})
	uc := usecase.NewListCourses(courseRepo, memberRepo)
	h := NewListCoursesHandler(uc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses", nil)
	req = req.WithContext(context.WithValue(req.Context(), UserIDContextKey, "user-1"))
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var res []map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(res) != 1 {
		t.Fatalf("len = %d, want 1", len(res))
	}
	if res[0]["id"] != "c1" || res[0]["title"] != "Math" || res[0]["role"] != "owner" {
		t.Errorf("item = %+v", res[0])
	}
}

func TestListCoursesHandler_EmptyList(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewListCourses(courseRepo, memberRepo)
	h := NewListCoursesHandler(uc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses", nil)
	req = req.WithContext(context.WithValue(req.Context(), UserIDContextKey, "user-1"))
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var res []map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(res) != 0 {
		t.Errorf("len = %d, want 0", len(res))
	}
}

func TestListCoursesHandler_Unauthorized(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewListCourses(courseRepo, memberRepo)
	h := NewListCoursesHandler(uc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}
