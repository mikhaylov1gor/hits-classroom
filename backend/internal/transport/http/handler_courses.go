package http

import "net/http"

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
