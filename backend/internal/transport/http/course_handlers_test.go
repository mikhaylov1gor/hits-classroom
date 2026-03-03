package http

import (
	"bytes"
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

func injectUserID(userID string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), UserIDContextKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

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
