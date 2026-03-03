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

func TestGetCourseHandler_Success(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	now := time.Now().UTC()
	_ = courseRepo.Create(&domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: now})
	_ = memberRepo.Create(&domain.CourseMember{CourseID: "c1", UserID: "user-1", Role: domain.RoleOwner})
	uc := usecase.NewGetCourse(courseRepo, memberRepo)
	h := NewGetCourseHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/courses/{courseId}", injectUserID("user-1", h))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses/c1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var res map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if res["id"] != "c1" || res["title"] != "Math" || res["role"] != "owner" {
		t.Errorf("response = %+v", res)
	}
}

func TestGetCourseHandler_NotFound(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewGetCourse(courseRepo, memberRepo)
	h := NewGetCourseHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/courses/{courseId}", injectUserID("user-1", h))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses/nonexistent", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestGetCourseHandler_Forbidden(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	now := time.Now().UTC()
	_ = courseRepo.Create(&domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: now})
	uc := usecase.NewGetCourse(courseRepo, memberRepo)
	h := NewGetCourseHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/courses/{courseId}", injectUserID("other-user", h))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses/c1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestGetCourseHandler_Unauthorized(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewGetCourse(courseRepo, memberRepo)
	h := NewGetCourseHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/courses/{courseId}", h)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses/c1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func injectUserID(userID string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), UserIDContextKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
