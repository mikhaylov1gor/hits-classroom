package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/usecase"
)

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

func courseResponse(c *domain.Course) map[string]interface{} {
	return map[string]interface{}{
		"id":          c.ID,
		"title":       c.Title,
		"invite_code": c.InviteCode,
		"created_at":  c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
