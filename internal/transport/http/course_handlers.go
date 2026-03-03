package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/usecase"
)

type CoursesHandler struct {
	List   *ListCoursesHandler
	Create *CreateCourseHandler
}

func NewCoursesHandler(list *ListCoursesHandler, create *CreateCourseHandler) *CoursesHandler {
	return &CoursesHandler{List: list, Create: create}
}

func (h *CoursesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.List.ServeHTTP(w, r)
	case http.MethodPost:
		h.Create.ServeHTTP(w, r)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

type CreateCourseHandler struct {
	createCourse *usecase.CreateCourse
}

func NewCreateCourseHandler(createCourse *usecase.CreateCourse) *CreateCourseHandler {
	return &CreateCourseHandler{createCourse: createCourse}
}

func (h *CreateCourseHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	var req struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	course, err := h.createCourse.CreateCourse(usecase.CreateCourseInput{
		OwnerID: userID,
		Title:   req.Title,
	})
	if err != nil {
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
	_ = json.NewEncoder(w).Encode(courseResponse(course))
}

type JoinCourseHandler struct {
	joinCourse *usecase.JoinCourse
}

func NewJoinCourseHandler(joinCourse *usecase.JoinCourse) *JoinCourseHandler {
	return &JoinCourseHandler{joinCourse: joinCourse}
}

func (h *JoinCourseHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	course, role, err := h.joinCourse.JoinCourse(usecase.JoinCourseInput{UserID: userID, Code: req.Code})
	if err != nil {
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "course not found or invalid code"})
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
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(courseWithRoleResponse(course, role))
}

type ListCoursesHandler struct {
	listCourses *usecase.ListCourses
}

func NewListCoursesHandler(listCourses *usecase.ListCourses) *ListCoursesHandler {
	return &ListCoursesHandler{listCourses: listCourses}
}

func (h *ListCoursesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	items, err := h.listCourses.ListCourses(userID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	out := make([]map[string]interface{}, 0, len(items))
	for _, it := range items {
		out = append(out, courseWithRoleResponse(it.Course, it.Role))
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(out)
}

type GetCourseHandler struct {
	getCourse *usecase.GetCourse
}

func NewGetCourseHandler(getCourse *usecase.GetCourse) *GetCourseHandler {
	return &GetCourseHandler{getCourse: getCourse}
}

func (h *GetCourseHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	courseID := r.PathValue("courseId")
	if courseID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	course, role, err := h.getCourse.GetCourse(courseID, userID)
	if err != nil {
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
			return
		}
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(courseWithRoleResponse(course, role))
}

type GetInviteCodeHandler struct {
	getInviteCode *usecase.GetInviteCode
}

func NewGetInviteCodeHandler(getInviteCode *usecase.GetInviteCode) *GetInviteCodeHandler {
	return &GetInviteCodeHandler{getInviteCode: getInviteCode}
}

func (h *GetInviteCodeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	courseID := r.PathValue("courseId")
	if courseID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	code, err := h.getInviteCode.GetInviteCode(courseID, userID)
	if err != nil {
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
			return
		}
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"code": code})
}

type DeleteCourseHandler struct {
	deleteCourse *usecase.DeleteCourse
}

func NewDeleteCourseHandler(deleteCourse *usecase.DeleteCourse) *DeleteCourseHandler {
	return &DeleteCourseHandler{deleteCourse: deleteCourse}
}

func (h *DeleteCourseHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	courseID := r.PathValue("courseId")
	if courseID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	err := h.deleteCourse.DeleteCourse(courseID, userID)
	if err != nil {
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
			return
		}
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func courseResponse(c *domain.Course) map[string]interface{} {
	return map[string]interface{}{
		"id":          c.ID,
		"title":       c.Title,
		"invite_code": c.InviteCode,
		"created_at":  c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func courseWithRoleResponse(c *domain.Course, role domain.CourseRole) map[string]interface{} {
	out := courseResponse(c)
	out["role"] = string(role)
	return out
}
