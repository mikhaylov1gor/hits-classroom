package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository/memory"
	"hits-classroom/internal/usecase"
)

func TestGetInviteCodeHandler_Success(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	now := time.Now().UTC()
	_ = courseRepo.Create(&domain.Course{ID: "c1", Title: "Math", InviteCode: "ABCD1234", CreatedAt: now})
	_ = memberRepo.Create(&domain.CourseMember{CourseID: "c1", UserID: "user-1", Role: domain.RoleOwner})
	uc := usecase.NewGetInviteCode(courseRepo, memberRepo)
	h := NewGetInviteCodeHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/courses/{courseId}/invite-code", injectUserID("user-1", h))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses/c1/invite-code", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var res struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if res.Code != "ABCD1234" {
		t.Errorf("code = %q, want ABCD1234", res.Code)
	}
}

func TestGetInviteCodeHandler_StudentForbidden(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	now := time.Now().UTC()
	_ = courseRepo.Create(&domain.Course{ID: "c1", Title: "Math", InviteCode: "ABCD1234", CreatedAt: now})
	_ = memberRepo.Create(&domain.CourseMember{CourseID: "c1", UserID: "user-1", Role: domain.RoleStudent})
	uc := usecase.NewGetInviteCode(courseRepo, memberRepo)
	h := NewGetInviteCodeHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/courses/{courseId}/invite-code", injectUserID("user-1", h))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses/c1/invite-code", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestGetInviteCodeHandler_NotFound(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewGetInviteCode(courseRepo, memberRepo)
	h := NewGetInviteCodeHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/courses/{courseId}/invite-code", injectUserID("user-1", h))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses/nonexistent/invite-code", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestGetInviteCodeHandler_Unauthorized(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewGetInviteCode(courseRepo, memberRepo)
	h := NewGetInviteCodeHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/courses/{courseId}/invite-code", h)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/courses/c1/invite-code", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}
