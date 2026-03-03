package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository/memory"
	"hits-classroom/internal/usecase"
)

func TestDeleteCourseHandler_Success(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	now := time.Now().UTC()
	_ = courseRepo.Create(&domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: now})
	_ = memberRepo.Create(&domain.CourseMember{CourseID: "c1", UserID: "user-1", Role: domain.RoleOwner})
	uc := usecase.NewDeleteCourse(courseRepo, memberRepo)
	h := NewDeleteCourseHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("DELETE /api/v1/courses/{courseId}", injectUserID("user-1", h))
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/courses/c1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Error("body should be empty")
	}
	c, _ := courseRepo.GetByID("c1")
	if c != nil {
		t.Error("course should be deleted")
	}
}

func TestDeleteCourseHandler_TeacherForbidden(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	now := time.Now().UTC()
	_ = courseRepo.Create(&domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: now})
	_ = memberRepo.Create(&domain.CourseMember{CourseID: "c1", UserID: "user-1", Role: domain.RoleTeacher})
	uc := usecase.NewDeleteCourse(courseRepo, memberRepo)
	h := NewDeleteCourseHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("DELETE /api/v1/courses/{courseId}", injectUserID("user-1", h))
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/courses/c1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestDeleteCourseHandler_NotFound(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewDeleteCourse(courseRepo, memberRepo)
	h := NewDeleteCourseHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("DELETE /api/v1/courses/{courseId}", injectUserID("user-1", h))
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/courses/nonexistent", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestDeleteCourseHandler_Unauthorized(t *testing.T) {
	courseRepo := memory.NewCourseRepository()
	memberRepo := memory.NewCourseMemberRepository()
	uc := usecase.NewDeleteCourse(courseRepo, memberRepo)
	h := NewDeleteCourseHandler(uc)

	mux := http.NewServeMux()
	mux.Handle("DELETE /api/v1/courses/{courseId}", h)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/courses/c1", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}
