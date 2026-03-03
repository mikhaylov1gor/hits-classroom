package http

import (
	"encoding/json"
	"net/http"

	"hits-classroom/internal/usecase"
)

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
