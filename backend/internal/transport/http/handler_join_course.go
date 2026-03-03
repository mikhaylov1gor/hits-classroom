package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/usecase"
)

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

func courseWithRoleResponse(c *domain.Course, role domain.CourseRole) map[string]interface{} {
	out := courseResponse(c)
	out["role"] = string(role)
	return out
}
