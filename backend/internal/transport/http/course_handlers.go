package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
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
		if errors.Is(err, usecase.ErrAlreadyMember) {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "already a member of this course"})
			return
		}
		if errors.Is(err, usecase.ErrValidation) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invite code must be 8 characters"})
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
	_ = json.NewEncoder(w).Encode(map[string]string{
		"code":        code,
		"invite_link": "/join?code=" + code,
	})
}

type RegenerateInviteCodeHandler struct {
	regenerate *usecase.RegenerateInviteCode
}

func NewRegenerateInviteCodeHandler(regenerate *usecase.RegenerateInviteCode) *RegenerateInviteCodeHandler {
	return &RegenerateInviteCodeHandler{regenerate: regenerate}
}

func (h *RegenerateInviteCodeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
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
	course, err := h.regenerate.RegenerateInviteCode(courseID, userID)
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
	_ = json.NewEncoder(w).Encode(map[string]string{
		"code":        course.InviteCode,
		"invite_link": "/join?code=" + course.InviteCode,
	})
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

type UpdateCourseHandler struct {
	updateCourse *usecase.UpdateCourse
}

func NewUpdateCourseHandler(updateCourse *usecase.UpdateCourse) *UpdateCourseHandler {
	return &UpdateCourseHandler{updateCourse: updateCourse}
}

func (h *UpdateCourseHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
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
	var req struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	course, err := h.updateCourse.UpdateCourse(usecase.UpdateCourseInput{CourseID: courseID, UserID: userID, Title: req.Title})
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
	_ = json.NewEncoder(w).Encode(courseResponse(course))
}

func memberResponse(m usecase.MemberWithUser) map[string]interface{} {
	return map[string]interface{}{
		"user_id":    m.UserID,
		"email":      m.Email,
		"first_name": m.FirstName,
		"last_name":  m.LastName,
		"role":       string(m.Role),
	}
}

type ListCourseMembersHandler struct {
	listMembers *usecase.ListCourseMembers
}

func NewListCourseMembersHandler(listMembers *usecase.ListCourseMembers) *ListCourseMembersHandler {
	return &ListCourseMembersHandler{listMembers: listMembers}
}

func (h *ListCourseMembersHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	members, err := h.listMembers.ListCourseMembers(courseID, userID)
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	out := make([]map[string]interface{}, 0, len(members))
	for _, m := range members {
		out = append(out, memberResponse(m))
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(out)
}

type AssignTeacherHandler struct {
	assignTeacher *usecase.AssignTeacher
	userRepo      repository.UserRepository
}

func NewAssignTeacherHandler(assignTeacher *usecase.AssignTeacher, userRepo repository.UserRepository) *AssignTeacherHandler {
	return &AssignTeacherHandler{assignTeacher: assignTeacher, userRepo: userRepo}
}

func (h *AssignTeacherHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
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
	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	if req.UserID == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "user_id required"})
		return
	}
	err := h.assignTeacher.AssignTeacher(usecase.AssignTeacherInput{CourseID: courseID, UserID: userID, TargetUserID: req.UserID})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	u, _ := h.userRepo.GetByID(req.UserID)
	m := usecase.MemberWithUser{UserID: req.UserID, Role: domain.RoleTeacher}
	if u != nil {
		m.Email, m.FirstName, m.LastName = u.Email, u.FirstName, u.LastName
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(memberResponse(m))
}

func postResponse(p *domain.Post) map[string]interface{} {
	if p == nil {
		return nil
	}
	return map[string]interface{}{
		"id":         p.ID,
		"course_id":  p.CourseID,
		"title":      p.Title,
		"body":       p.Body,
		"created_at": p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func materialResponse(m *domain.Material) map[string]interface{} {
	if m == nil {
		return nil
	}
	return map[string]interface{}{
		"id":         m.ID,
		"course_id":  m.CourseID,
		"title":      m.Title,
		"body":       m.Body,
		"created_at": m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func assignmentResponse(a *domain.Assignment) map[string]interface{} {
	if a == nil {
		return nil
	}
	out := map[string]interface{}{
		"id":         a.ID,
		"course_id":  a.CourseID,
		"title":      a.Title,
		"body":       a.Body,
		"created_at": a.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if a.Deadline != nil {
		out["deadline"] = a.Deadline.Format("2006-01-02T15:04:05Z07:00")
	} else {
		out["deadline"] = nil
	}
	return out
}

func submissionResponse(s *domain.Submission) map[string]interface{} {
	if s == nil {
		return nil
	}
	out := map[string]interface{}{
		"id":            s.ID,
		"assignment_id": s.AssignmentID,
		"user_id":       s.UserID,
		"body":          s.Body,
		"submitted_at":  s.SubmittedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if s.Grade != nil {
		out["grade"] = *s.Grade
	} else {
		out["grade"] = nil
	}
	return out
}

func commentResponse(c *domain.Comment) map[string]interface{} {
	return commentResponseWithReplies(c, nil)
}

func commentResponseWithReplies(c *domain.Comment, replies []map[string]interface{}) map[string]interface{} {
	if c == nil {
		return nil
	}
	out := map[string]interface{}{
		"id":            c.ID,
		"assignment_id": c.AssignmentID,
		"user_id":       c.UserID,
		"parent_id":     nil,
		"body":          c.Body,
		"created_at":    c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"replies":       []map[string]interface{}{},
	}
	if c.ParentID != nil {
		out["parent_id"] = *c.ParentID
	}
	if replies != nil {
		out["replies"] = replies
	}
	return out
}

// buildCommentTree строит дерево комментариев из плоского списка.
func buildCommentTree(all []*domain.Comment) []map[string]interface{} {
	byParent := make(map[string][]*domain.Comment)
	for _, c := range all {
		key := ""
		if c.ParentID != nil {
			key = *c.ParentID
		}
		byParent[key] = append(byParent[key], c)
	}
	var buildNode func(c *domain.Comment) map[string]interface{}
	buildNode = func(c *domain.Comment) map[string]interface{} {
		children := byParent[c.ID]
		var replies []map[string]interface{}
		for _, ch := range children {
			replies = append(replies, buildNode(ch))
		}
		if replies == nil {
			replies = []map[string]interface{}{}
		}
		return commentResponseWithReplies(c, replies)
	}
	roots := byParent[""]
	out := make([]map[string]interface{}, 0, len(roots))
	for _, r := range roots {
		out = append(out, buildNode(r))
	}
	return out
}

func feedItemResponse(item usecase.FeedItem) map[string]interface{} {
	out := map[string]interface{}{
		"type":       item.Type,
		"id":         item.ID,
		"title":      item.Title,
		"created_at": item.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if item.Deadline != nil {
		out["deadline"] = item.Deadline.Format("2006-01-02T15:04:05Z07:00")
	} else {
		out["deadline"] = nil
	}
	return out
}

type GetCourseFeedHandler struct {
	getFeed *usecase.GetCourseFeed
}

func NewGetCourseFeedHandler(getFeed *usecase.GetCourseFeed) *GetCourseFeedHandler {
	return &GetCourseFeedHandler{getFeed: getFeed}
}

func (h *GetCourseFeedHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	items, err := h.getFeed.GetCourseFeed(courseID, userID)
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	out := make([]map[string]interface{}, 0, len(items))
	for _, it := range items {
		out = append(out, feedItemResponse(it))
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(out)
}

type CreatePostHandler struct {
	createPost *usecase.CreatePost
}

func NewCreatePostHandler(createPost *usecase.CreatePost) *CreatePostHandler {
	return &CreatePostHandler{createPost: createPost}
}

func (h *CreatePostHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
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
	var req struct {
		Title   string   `json:"title"`
		Body    string   `json:"body"`
		FileIDs []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	p, err := h.createPost.CreatePost(usecase.CreatePostInput{CourseID: courseID, UserID: userID, Title: req.Title, Body: req.Body, FileIDs: req.FileIDs})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
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
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(postResponse(p))
}

type CreateMaterialHandler struct {
	createMaterial *usecase.CreateMaterial
}

func NewCreateMaterialHandler(createMaterial *usecase.CreateMaterial) *CreateMaterialHandler {
	return &CreateMaterialHandler{createMaterial: createMaterial}
}

func (h *CreateMaterialHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
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
	var req struct {
		Title   string   `json:"title"`
		Body    string   `json:"body"`
		FileIDs []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	m, err := h.createMaterial.CreateMaterial(usecase.CreateMaterialInput{CourseID: courseID, UserID: userID, Title: req.Title, Body: req.Body, FileIDs: req.FileIDs})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
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
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(materialResponse(m))
}

type CreateAssignmentHandler struct {
	createAssignment *usecase.CreateAssignment
}

func NewCreateAssignmentHandler(createAssignment *usecase.CreateAssignment) *CreateAssignmentHandler {
	return &CreateAssignmentHandler{createAssignment: createAssignment}
}

func (h *CreateAssignmentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
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
	var req struct {
		Title    string   `json:"title"`
		Body     string   `json:"body"`
		FileIDs  []string `json:"file_ids"`
		Deadline *string  `json:"deadline"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	var deadline *time.Time
	if req.Deadline != nil && *req.Deadline != "" {
		t, err := time.Parse("2006-01-02T15:04:05Z07:00", *req.Deadline)
		if err != nil {
			t, err = time.Parse(time.RFC3339, *req.Deadline)
		}
		if err == nil {
			deadline = &t
		}
	}
	a, err := h.createAssignment.CreateAssignment(usecase.CreateAssignmentInput{CourseID: courseID, UserID: userID, Title: req.Title, Body: req.Body, FileIDs: req.FileIDs, Deadline: deadline})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
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
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(assignmentResponse(a))
}

type GetAssignmentHandler struct {
	getAssignment *usecase.GetAssignment
}

func NewGetAssignmentHandler(getAssignment *usecase.GetAssignment) *GetAssignmentHandler {
	return &GetAssignmentHandler{getAssignment: getAssignment}
}

func (h *GetAssignmentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	assignmentID := r.PathValue("assignmentId")
	if courseID == "" || assignmentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	a, err := h.getAssignment.GetAssignment(courseID, assignmentID, userID)
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
	_ = json.NewEncoder(w).Encode(assignmentResponse(a))
}

type CreateSubmissionHandler struct {
	createSubmission *usecase.CreateSubmission
}

func NewCreateSubmissionHandler(createSubmission *usecase.CreateSubmission) *CreateSubmissionHandler {
	return &CreateSubmissionHandler{createSubmission: createSubmission}
}

func (h *CreateSubmissionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	courseID := r.PathValue("courseId")
	assignmentID := r.PathValue("assignmentId")
	if courseID == "" || assignmentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var req struct {
		Body    string   `json:"body"`
		FileIDs []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	s, err := h.createSubmission.CreateSubmission(usecase.CreateSubmissionInput{CourseID: courseID, AssignmentID: assignmentID, UserID: userID, Body: req.Body, FileIDs: req.FileIDs})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		if errors.Is(err, usecase.ErrAlreadySubmitted) {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "already submitted"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(submissionResponse(s))
}

type ListSubmissionsHandler struct {
	listSubmissions *usecase.ListSubmissions
}

func NewListSubmissionsHandler(listSubmissions *usecase.ListSubmissions) *ListSubmissionsHandler {
	return &ListSubmissionsHandler{listSubmissions: listSubmissions}
}

func (h *ListSubmissionsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	assignmentID := r.PathValue("assignmentId")
	if courseID == "" || assignmentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	list, err := h.listSubmissions.ListSubmissions(courseID, assignmentID, userID)
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
	out := make([]map[string]interface{}, 0, len(list))
	for _, s := range list {
		out = append(out, submissionResponse(s))
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(out)
}

type GradeSubmissionHandler struct {
	gradeSubmission *usecase.GradeSubmission
}

func NewGradeSubmissionHandler(gradeSubmission *usecase.GradeSubmission) *GradeSubmissionHandler {
	return &GradeSubmissionHandler{gradeSubmission: gradeSubmission}
}

func (h *GradeSubmissionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	courseID := r.PathValue("courseId")
	assignmentID := r.PathValue("assignmentId")
	submissionID := r.PathValue("submissionId")
	if courseID == "" || assignmentID == "" || submissionID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var req struct {
		Grade int `json:"grade"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	s, err := h.gradeSubmission.GradeSubmission(usecase.GradeSubmissionInput{CourseID: courseID, AssignmentID: assignmentID, SubmissionID: submissionID, UserID: userID, Grade: req.Grade})
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
	_ = json.NewEncoder(w).Encode(submissionResponse(s))
}

type GetStudentGradesHandler struct {
	getStudentGrades *usecase.GetStudentGrades
}

func NewGetStudentGradesHandler(getStudentGrades *usecase.GetStudentGrades) *GetStudentGradesHandler {
	return &GetStudentGradesHandler{getStudentGrades: getStudentGrades}
}

func (h *GetStudentGradesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	targetUserID := r.PathValue("userId")
	if courseID == "" || targetUserID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	items, err := h.getStudentGrades.GetStudentGrades(courseID, targetUserID, userID)
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
	out := make([]map[string]interface{}, 0, len(items))
	for _, it := range items {
		out = append(out, map[string]interface{}{
			"submission": submissionResponse(it.Submission),
			"assignment": assignmentResponse(it.Assignment),
		})
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(out)
}

type ListCommentsHandler struct {
	listComments *usecase.ListComments
}

func NewListCommentsHandler(listComments *usecase.ListComments) *ListCommentsHandler {
	return &ListCommentsHandler{listComments: listComments}
}

func (h *ListCommentsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	assignmentID := r.PathValue("assignmentId")
	if courseID == "" || assignmentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	list, err := h.listComments.ListComments(courseID, assignmentID, userID)
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
	_ = json.NewEncoder(w).Encode(buildCommentTree(list))
}

type CreateCommentHandler struct {
	createComment *usecase.CreateComment
}

func NewCreateCommentHandler(createComment *usecase.CreateComment) *CreateCommentHandler {
	return &CreateCommentHandler{createComment: createComment}
}

func (h *CreateCommentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	userID := UserIDFromContext(r.Context())
	if userID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	courseID := r.PathValue("courseId")
	assignmentID := r.PathValue("assignmentId")
	if courseID == "" || assignmentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var req struct {
		ParentID *string  `json:"parent_id"`
		Body     string   `json:"body"`
		FileIDs  []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	c, err := h.createComment.CreateComment(usecase.CreateCommentInput{
		CourseID:     courseID,
		AssignmentID: assignmentID,
		UserID:       userID,
		ParentID:     req.ParentID,
		Body:         req.Body,
		FileIDs:      req.FileIDs,
	})
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
		var vErr *usecase.ValidationError
		if errors.As(err, &vErr) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": vErr.Message})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(commentResponse(c))
}

type DeleteCommentHandler struct {
	deleteComment *usecase.DeleteComment
}

func NewDeleteCommentHandler(deleteComment *usecase.DeleteComment) *DeleteCommentHandler {
	return &DeleteCommentHandler{deleteComment: deleteComment}
}

func (h *DeleteCommentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	assignmentID := r.PathValue("assignmentId")
	commentID := r.PathValue("commentId")
	if courseID == "" || assignmentID == "" || commentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	err := h.deleteComment.DeleteComment(usecase.DeleteCommentInput{
		CourseID:     courseID,
		AssignmentID: assignmentID,
		CommentID:    commentID,
		UserID:       userID,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrCommentNotFound) || errors.Is(err, usecase.ErrCourseNotFound) {
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
