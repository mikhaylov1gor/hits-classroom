package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"hits-classroom/internal/usecase"
)

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
