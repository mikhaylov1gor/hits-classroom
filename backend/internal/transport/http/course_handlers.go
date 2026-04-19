package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
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
	out := courseWithRoleResponse(course, role)
	out["membership_status"] = "approved"
	out["message"] = "joined course successfully"
	_ = json.NewEncoder(w).Encode(out)
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
		row := courseWithRoleResponse(it.Course, it.Role)
		if it.Status != "" {
			row["membership_status"] = string(it.Status)
		}
		out = append(out, row)
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
	out := map[string]interface{}{
		"user_id":    m.UserID,
		"email":      m.Email,
		"first_name": m.FirstName,
		"last_name":  m.LastName,
		"role":       string(m.Role),
	}
	if m.Status != "" {
		out["status"] = string(m.Status)
	}
	if !m.RequestedAt.IsZero() {
		out["requested_at"] = m.RequestedAt.Format(time.RFC3339)
	}
	if m.DecidedAt != nil {
		out["decided_at"] = m.DecidedAt.Format(time.RFC3339)
	}
	if m.DecidedBy != "" {
		out["decided_by"] = m.DecidedBy
	}
	if m.DecisionNote != "" {
		out["decision_note"] = m.DecisionNote
	}
	return out
}

type ListJoinRequestsHandler struct {
	listRequests *usecase.ListJoinRequests
}

func NewListJoinRequestsHandler(listRequests *usecase.ListJoinRequests) *ListJoinRequestsHandler {
	return &ListJoinRequestsHandler{listRequests: listRequests}
}

func (h *ListJoinRequestsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	status := domain.CourseMemberStatus(strings.TrimSpace(r.URL.Query().Get("status")))
	if status == "" {
		status = domain.MemberStatusPending
	}
	if status != domain.MemberStatusPending && status != domain.MemberStatusApproved && status != domain.MemberStatusRejected {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid status"})
		return
	}
	items, err := h.listRequests.List(courseID, userID, status)
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
	for _, m := range items {
		out = append(out, memberResponse(m))
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(out)
}

type DecideJoinRequestHandler struct {
	decide *usecase.DecideJoinRequest
}

func NewDecideJoinRequestHandler(decide *usecase.DecideJoinRequest) *DecideJoinRequestHandler {
	return &DecideJoinRequestHandler{decide: decide}
}

func (h *DecideJoinRequestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	teacherID := UserIDFromContext(r.Context())
	if teacherID == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	courseID := r.PathValue("courseId")
	targetUserID := r.PathValue("userId")
	action := r.PathValue("action")
	if courseID == "" || targetUserID == "" || action == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	approve := action == "approve"
	if !approve && action != "reject" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid action"})
		return
	}
	member, err := h.decide.Decide(usecase.DecideJoinRequestInput{
		CourseID:  courseID,
		TeacherID: teacherID,
		UserID:    targetUserID,
		Approve:   approve,
		Note:      req.Note,
	})
	if err != nil {
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
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	resp := map[string]interface{}{
		"user_id": targetUserID,
		"status":  string(member.Status),
	}
	if member.DecidedAt != nil {
		resp["decided_at"] = member.DecidedAt.Format(time.RFC3339)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
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

// ── InviteTeacherHandler — пригласить пользователя по email с ролью учителя ──

type InviteTeacherHandler struct {
	inviteTeacher *usecase.InviteTeacher
	userRepo      repository.UserRepository
}

func NewInviteTeacherHandler(inviteTeacher *usecase.InviteTeacher, userRepo repository.UserRepository) *InviteTeacherHandler {
	return &InviteTeacherHandler{inviteTeacher: inviteTeacher, userRepo: userRepo}
}

func (h *InviteTeacherHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	member, err := h.inviteTeacher.InviteTeacher(usecase.InviteTeacherInput{
		CourseID: courseID,
		UserID:   userID,
		Email:    req.Email,
	})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "only the course owner can invite teachers"})
			return
		}
		if errors.Is(err, usecase.ErrUserNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "user with this email not found"})
			return
		}
		if errors.Is(err, usecase.ErrAlreadyRole) {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "user is already a teacher in this course"})
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
	u, _ := h.userRepo.GetByID(member.UserID)
	m := usecase.MemberWithUser{
		UserID:      member.UserID,
		Role:        member.Role,
		Status:      member.Status,
		RequestedAt: member.RequestedAt,
	}
	if u != nil {
		m.Email, m.FirstName, m.LastName = u.Email, u.FirstName, u.LastName
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(memberResponse(m))
}

type AcceptCourseInvitationHandler struct {
	accept *usecase.AcceptCourseInvitation
}

func NewAcceptCourseInvitationHandler(accept *usecase.AcceptCourseInvitation) *AcceptCourseInvitationHandler {
	return &AcceptCourseInvitationHandler{accept: accept}
}

func (h *AcceptCourseInvitationHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	member, err := h.accept.Accept(courseID, userID)
	if err != nil {
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
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"user_id": member.UserID,
		"status":  string(member.Status),
		"role":    string(member.Role),
	})
}

func postResponse(p *domain.Post) map[string]interface{} {
	if p == nil {
		return nil
	}
	links := p.Links
	if links == nil {
		links = []string{}
	}
	fileIDs := p.FileIDs
	if fileIDs == nil {
		fileIDs = []string{}
	}
	return map[string]interface{}{
		"id":         p.ID,
		"course_id":  p.CourseID,
		"user_id":    p.UserID,
		"title":      p.Title,
		"body":       p.Body,
		"links":      links,
		"file_ids":   fileIDs,
		"created_at": p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func materialResponse(m *domain.Material) map[string]interface{} {
	if m == nil {
		return nil
	}
	links := m.Links
	if links == nil {
		links = []string{}
	}
	fileIDs := m.FileIDs
	if fileIDs == nil {
		fileIDs = []string{}
	}
	return map[string]interface{}{
		"id":         m.ID,
		"course_id":  m.CourseID,
		"title":      m.Title,
		"body":       m.Body,
		"links":      links,
		"file_ids":   fileIDs,
		"created_at": m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func assignmentResponse(a *domain.Assignment) map[string]interface{} {
	if a == nil {
		return nil
	}
	links := a.Links
	if links == nil {
		links = []string{}
	}
	fileIDs := a.FileIDs
	if fileIDs == nil {
		fileIDs = []string{}
	}
	out := map[string]interface{}{
		"id":                       a.ID,
		"course_id":                a.CourseID,
		"title":                    a.Title,
		"body":                     a.Body,
		"links":                    links,
		"file_ids":                 fileIDs,
		"max_grade":                a.MaxGrade,
		"assignment_kind":          string(a.AssignmentKind),
		"desired_team_size":        a.DesiredTeamSize,
		"team_distribution_type":   string(a.TeamDistributionType),
		"team_count":               a.TeamCount,
		"max_team_size":            a.MaxTeamSize,
		"team_submission_rule":     string(a.TeamSubmissionRule),
		"vote_tie_break":           string(a.VoteTieBreak),
		"allow_early_finalization": a.AllowEarlyFinalization,
		"team_grading_mode":        string(a.TeamGradingMode),
		"peer_split_min_percent":   a.PeerSplitMinPercent,
		"peer_split_max_percent":   a.PeerSplitMaxPercent,
		"created_at":               a.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if a.RosterLockedAt != nil {
		out["roster_locked_at"] = a.RosterLockedAt.Format("2006-01-02T15:04:05Z07:00")
	} else {
		out["roster_locked_at"] = nil
	}
	if a.DeadlineAutoFinalizedAt != nil {
		out["deadline_auto_finalized_at"] = a.DeadlineAutoFinalizedAt.Format("2006-01-02T15:04:05Z07:00")
	} else {
		out["deadline_auto_finalized_at"] = nil
	}
	if a.Deadline != nil {
		out["deadline"] = a.Deadline.Format("2006-01-02T15:04:05Z07:00")
	} else {
		out["deadline"] = nil
	}
	if a.TeamFormationDeadline != nil {
		out["team_formation_deadline"] = a.TeamFormationDeadline.Format("2006-01-02T15:04:05Z07:00")
	} else {
		out["team_formation_deadline"] = nil
	}
	return out
}

func parseOptionalTimeString(s *string) (*time.Time, error) {
	if s == nil {
		return nil, nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, t)
	if err != nil {
		parsed, err = time.Parse("2006-01-02T15:04:05Z07:00", t)
	}
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func submissionResponse(s *domain.Submission) map[string]interface{} {
	if s == nil {
		return nil
	}
	fileIDs := s.FileIDs
	if fileIDs == nil {
		fileIDs = []string{}
	}
	out := map[string]interface{}{
		"id":            s.ID,
		"assignment_id": s.AssignmentID,
		"user_id":       s.UserID,
		"body":          s.Body,
		"file_ids":      fileIDs,
		"submitted_at":  s.SubmittedAt.Format("2006-01-02T15:04:05Z07:00"),
		"is_attached":   s.IsAttached,
		"is_returned":   s.IsReturned,
	}
	if s.Grade != nil {
		out["grade"] = *s.Grade
	} else {
		out["grade"] = nil
	}
	if s.GradeComment != nil {
		out["grade_comment"] = *s.GradeComment
	} else {
		out["grade_comment"] = nil
	}
	return out
}

func commentNodeResponse(c *domain.Comment, replies []map[string]interface{}) map[string]interface{} {
	if c == nil {
		return nil
	}
	fileIDs := c.FileIDs
	if fileIDs == nil {
		fileIDs = []string{}
	}
	out := map[string]interface{}{
		"id":            c.ID,
		"assignment_id": c.AssignmentID,
		"post_id":       c.PostID,
		"material_id":   c.MaterialID,
		"user_id":       c.UserID,
		"parent_id":     nil,
		"is_private":    c.IsPrivate,
		"body":          c.Body,
		"file_ids":      fileIDs,
		"created_at":    c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"replies":       replies,
	}
	if c.ParentID != nil {
		out["parent_id"] = *c.ParentID
	}
	if replies == nil {
		out["replies"] = []map[string]interface{}{}
	}
	return out
}

func commentResponse(c *domain.Comment) map[string]interface{} {
	return commentNodeResponse(c, nil)
}

// buildCommentTree строит дерево вложенных комментариев из плоского списка.
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
		replies := make([]map[string]interface{}, 0, len(children))
		for _, ch := range children {
			replies = append(replies, buildNode(ch))
		}
		return commentNodeResponse(c, replies)
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
		Links   []string `json:"links"`
		FileIDs []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	p, err := h.createPost.CreatePost(usecase.CreatePostInput{CourseID: courseID, UserID: userID, Title: req.Title, Body: req.Body, Links: req.Links, FileIDs: req.FileIDs})
	if err != nil {
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
		Links   []string `json:"links"`
		FileIDs []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	m, err := h.createMaterial.CreateMaterial(usecase.CreateMaterialInput{CourseID: courseID, UserID: userID, Title: req.Title, Body: req.Body, Links: req.Links, FileIDs: req.FileIDs})
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

type UpdateAssignmentHandler struct {
	updateAssignment *usecase.UpdateAssignment
}

func NewUpdateAssignmentHandler(updateAssignment *usecase.UpdateAssignment) *UpdateAssignmentHandler {
	return &UpdateAssignmentHandler{updateAssignment: updateAssignment}
}

func (h *UpdateAssignmentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	assignmentID := r.PathValue("assignmentId")
	if courseID == "" || assignmentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var rawBody map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	var req struct {
		Title                  string   `json:"title"`
		Body                   string   `json:"body"`
		Links                  []string `json:"links"`
		FileIDs                []string `json:"file_ids"`
		Deadline               *string  `json:"deadline"`
		MaxGrade               int      `json:"max_grade"`
		AssignmentKind         string   `json:"assignment_kind"`
		DesiredTeamSize        int      `json:"desired_team_size"`
		TeamDistributionType   string   `json:"team_distribution_type"`
		TeamCount              int      `json:"team_count"`
		TeamSubmissionRule     string   `json:"team_submission_rule"`
		VoteTieBreak           string   `json:"vote_tie_break"`
		AllowEarlyFinalization *bool    `json:"allow_early_finalization"`
		TeamGradingMode        string   `json:"team_grading_mode"`
		PeerSplitMinPercent    float64  `json:"peer_split_min_percent"`
		PeerSplitMaxPercent    float64  `json:"peer_split_max_percent"`
	}
	b, err := json.Marshal(rawBody)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	if err := json.Unmarshal(b, &req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	var deadline *time.Time
	if req.Deadline != nil && *req.Deadline != "" {
		t, err := time.Parse(time.RFC3339, *req.Deadline)
		if err == nil {
			deadline = &t
		}
	}
	formationSpecified := false
	var formationDeadline *time.Time
	if raw, ok := rawBody["team_formation_deadline"]; ok {
		formationSpecified = true
		if string(raw) == "null" {
			formationDeadline = nil
		} else {
			var s string
			if err := json.Unmarshal(raw, &s); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid team_formation_deadline"})
				return
			}
			fd, ferr := parseOptionalTimeString(&s)
			if ferr != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid team_formation_deadline"})
				return
			}
			formationDeadline = fd
		}
	}
	a, err := h.updateAssignment.UpdateAssignment(usecase.UpdateAssignmentInput{
		CourseID:               courseID,
		AssignmentID:           assignmentID,
		UserID:                 userID,
		Title:                  req.Title,
		Body:                   req.Body,
		Links:                  req.Links,
		FileIDs:                req.FileIDs,
		Deadline:               deadline,
		MaxGrade:               req.MaxGrade,
		AssignmentKind:         domain.AssignmentKind(req.AssignmentKind),
		DesiredTeamSize:        req.DesiredTeamSize,
		TeamDistributionType:   domain.TeamDistributionType(req.TeamDistributionType),
		TeamCount:              req.TeamCount,
		TeamSubmissionRule:     domain.TeamSubmissionRule(req.TeamSubmissionRule),
		VoteTieBreak:           domain.VoteTieBreak(req.VoteTieBreak),
		AllowEarlyFinalization: req.AllowEarlyFinalization,
		TeamGradingMode:        domain.TeamGradingMode(req.TeamGradingMode),
		PeerSplitMinPercent:          req.PeerSplitMinPercent,
		PeerSplitMaxPercent:          req.PeerSplitMaxPercent,
		TeamFormationDeadline:        formationDeadline,
		TeamFormationDeadlineSet:     formationSpecified,
	})
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
		var vErr *usecase.ValidationError
		if errors.As(err, &vErr) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": vErr.Message})
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
	_ = json.NewEncoder(w).Encode(assignmentResponse(a))
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
		Title                     string   `json:"title"`
		Body                      string   `json:"body"`
		Links                     []string `json:"links"`
		FileIDs                   []string `json:"file_ids"`
		FileIDsCamel              []string `json:"fileIds"`
		Deadline                  *string  `json:"deadline"`
		MaxGrade                  int      `json:"max_grade"`
		MaxGradeCamel             int      `json:"maxGrade"`
		AssignmentKind            string   `json:"assignment_kind"`
		AssignmentKindCamel       string   `json:"assignmentKind"`
		DesiredTeamSize           int      `json:"desired_team_size"`
		DesiredTeamSizeCamel      int      `json:"desiredTeamSize"`
		TeamDistributionType      string   `json:"team_distribution_type"`
		TeamDistributionCamel     string   `json:"teamDistributionType"`
		TeamCount                 int      `json:"team_count"`
		TeamCountCamel            int      `json:"teamCount"`
		TeamSubmissionRule        string   `json:"team_submission_rule"`
		TeamSubmissionCamel       string   `json:"teamSubmissionRule"`
		VoteTieBreak              string   `json:"vote_tie_break"`
		VoteTieBreakCamel         string   `json:"voteTieBreak"`
		AllowEarlyFinalization    *bool    `json:"allow_early_finalization"`
		AllowEarlyFinalizationCam *bool    `json:"allowEarlyFinalization"`
		TeamGradingMode           string   `json:"team_grading_mode"`
		TeamGradingModeCamel      string   `json:"teamGradingMode"`
		PeerSplitMinPercent       *float64 `json:"peer_split_min_percent"`
		PeerSplitMinCamel         *float64 `json:"peerSplitMinPercent"`
		PeerSplitMaxPercent       *float64 `json:"peer_split_max_percent"`
		PeerSplitMaxCamel         *float64 `json:"peerSplitMaxPercent"`
		TeamFormationDeadline     *string  `json:"team_formation_deadline"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	pickStr := func(a, b string) string {
		if a != "" {
			return a
		}
		return b
	}
	pickInt := func(a, b int) int {
		if a != 0 {
			return a
		}
		return b
	}
	pickBoolPtr := func(a, b *bool) *bool {
		if a != nil {
			return a
		}
		return b
	}
	fileIDs := req.FileIDs
	if len(fileIDs) == 0 {
		fileIDs = req.FileIDsCamel
	}
	maxGrade := req.MaxGrade
	if maxGrade == 0 && req.MaxGradeCamel > 0 {
		maxGrade = req.MaxGradeCamel
	}
	assignmentKind := pickStr(req.AssignmentKind, req.AssignmentKindCamel)
	desiredTeamSize := pickInt(req.DesiredTeamSize, req.DesiredTeamSizeCamel)
	teamDistribution := pickStr(req.TeamDistributionType, req.TeamDistributionCamel)
	teamCount := pickInt(req.TeamCount, req.TeamCountCamel)
	teamSubmissionRule := pickStr(req.TeamSubmissionRule, req.TeamSubmissionCamel)
	voteTieBreak := pickStr(req.VoteTieBreak, req.VoteTieBreakCamel)
	allowEarly := pickBoolPtr(req.AllowEarlyFinalization, req.AllowEarlyFinalizationCam)
	teamGradingMode := pickStr(req.TeamGradingMode, req.TeamGradingModeCamel)
	peerMin := 0.0
	if req.PeerSplitMinPercent != nil {
		peerMin = *req.PeerSplitMinPercent
	} else if req.PeerSplitMinCamel != nil {
		peerMin = *req.PeerSplitMinCamel
	}
	peerMax := 0.0
	if req.PeerSplitMaxPercent != nil {
		peerMax = *req.PeerSplitMaxPercent
	} else if req.PeerSplitMaxCamel != nil {
		peerMax = *req.PeerSplitMaxCamel
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
	formationDeadline, ferr := parseOptionalTimeString(req.TeamFormationDeadline)
	if ferr != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid team_formation_deadline"})
		return
	}
	a, err := h.createAssignment.CreateAssignment(usecase.CreateAssignmentInput{
		CourseID:               courseID,
		UserID:                 userID,
		Title:                  req.Title,
		Body:                   req.Body,
		Links:                  req.Links,
		FileIDs:                fileIDs,
		Deadline:               deadline,
		MaxGrade:               maxGrade,
		AssignmentKind:         domain.AssignmentKind(assignmentKind),
		DesiredTeamSize:        desiredTeamSize,
		TeamDistributionType:   domain.TeamDistributionType(teamDistribution),
		TeamCount:              teamCount,
		TeamSubmissionRule:     domain.TeamSubmissionRule(teamSubmissionRule),
		VoteTieBreak:           domain.VoteTieBreak(voteTieBreak),
		AllowEarlyFinalization: allowEarly,
		TeamGradingMode:        domain.TeamGradingMode(teamGradingMode),
		PeerSplitMinPercent:    peerMin,
		PeerSplitMaxPercent:    peerMax,
		TeamFormationDeadline:  formationDeadline,
	})
	if err != nil {
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
		Body       string   `json:"body"`
		FileIDs    []string `json:"file_ids"`
		IsAttached bool     `json:"is_attached"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	s, err := h.createSubmission.CreateSubmission(usecase.CreateSubmissionInput{CourseID: courseID, AssignmentID: assignmentID, UserID: userID, Body: req.Body, FileIDs: req.FileIDs, IsAttached: req.IsAttached})
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
		if errors.Is(err, usecase.ErrAssignmentClosed) {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "assignment is closed"})
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
		Grade        int    `json:"grade"`
		GradeComment string `json:"grade_comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	s, err := h.gradeSubmission.GradeSubmission(usecase.GradeSubmissionInput{CourseID: courseID, AssignmentID: assignmentID, SubmissionID: submissionID, UserID: userID, Grade: req.Grade, GradeComment: req.GradeComment})
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

type GradeTeamMemberSubmissionHandler struct {
	gradeSubmission *usecase.GradeSubmission
}

func NewGradeTeamMemberSubmissionHandler(gradeSubmission *usecase.GradeSubmission) *GradeTeamMemberSubmissionHandler {
	return &GradeTeamMemberSubmissionHandler{gradeSubmission: gradeSubmission}
}

func (h *GradeTeamMemberSubmissionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	memberUserID := r.PathValue("userId")
	if courseID == "" || assignmentID == "" || memberUserID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var req struct {
		Grade        int    `json:"grade"`
		GradeComment string `json:"grade_comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	s, err := h.gradeSubmission.GradeTeamMemberSubmission(usecase.GradeTeamMemberSubmissionInput{
		CourseID:       courseID,
		AssignmentID: assignmentID,
		MemberUserID:   memberUserID,
		TeacherUserID:  userID,
		Grade:          req.Grade,
		GradeComment:   req.GradeComment,
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

type DetachAssignmentHandler struct {
	detachAssignment *usecase.DetachSubmission
}

func NewDetachAssignmentHandler(detachAssignment *usecase.DetachSubmission) *DetachAssignmentHandler {
	return &DetachAssignmentHandler{detachAssignment: detachAssignment}
}

func (h *DetachAssignmentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	if courseID == "" || assignmentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	s, err := h.detachAssignment.DetachSubmission(usecase.DetachAssignmentInput{CourseID: courseID, AssignmentID: assignmentID, UserID: userID})
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
		if errors.Is(err, usecase.ErrValidation) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "validation failed"})
			return
		}
		if errors.Is(err, usecase.ErrAssignmentClosed) {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "assignment is closed"})
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

type ReturnAssignmentHandler struct {
	returnAssignment *usecase.ReturnAssignment
}

func NewReturnAssignmentHandler(returnAssignment *usecase.ReturnAssignment) *ReturnAssignmentHandler {
	return &ReturnAssignmentHandler{returnAssignment: returnAssignment}
}

func (h *ReturnAssignmentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	s, err := h.returnAssignment.ReturnAssignment(usecase.ReturnAssignmentInput{CourseID: courseID, AssignmentID: assignmentID, SubmissionID: submissionID, UserID: userID})
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
		ParentID  *string  `json:"parent_id"`
		IsPrivate bool     `json:"is_private"`
		Body      string   `json:"body"`
		FileIDs   []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	c, err := h.createComment.CreateComment(usecase.CreateCommentInput{CourseID: courseID, AssignmentID: assignmentID, UserID: userID, ParentID: req.ParentID, IsPrivate: req.IsPrivate, Body: req.Body, FileIDs: req.FileIDs})
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

// ── Post comments ─────────────────────────────────────────────────────────────

type ListPostCommentsHandler struct {
	listPostComments *usecase.ListPostComments
}

func NewListPostCommentsHandler(lpc *usecase.ListPostComments) *ListPostCommentsHandler {
	return &ListPostCommentsHandler{listPostComments: lpc}
}

func (h *ListPostCommentsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	postID := r.PathValue("postId")
	if courseID == "" || postID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	list, err := h.listPostComments.ListPostComments(courseID, postID, userID)
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

type CreatePostCommentHandler struct {
	createComment *usecase.CreateComment
}

func NewCreatePostCommentHandler(createComment *usecase.CreateComment) *CreatePostCommentHandler {
	return &CreatePostCommentHandler{createComment: createComment}
}

func (h *CreatePostCommentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	postID := r.PathValue("postId")
	if courseID == "" || postID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var req struct {
		ParentID  *string  `json:"parent_id"`
		IsPrivate bool     `json:"is_private"`
		Body      string   `json:"body"`
		FileIDs   []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	c, err := h.createComment.CreateComment(usecase.CreateCommentInput{CourseID: courseID, PostID: postID, UserID: userID, ParentID: req.ParentID, IsPrivate: req.IsPrivate, Body: req.Body, FileIDs: req.FileIDs})
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

// ── Delete comment (unified for assignment, post, and material comments) ──────

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
	commentID := r.PathValue("commentId")
	if courseID == "" || commentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	err := h.deleteComment.DeleteComment(usecase.DeleteCommentInput{CourseID: courseID, CommentID: commentID, UserID: userID})
	if err != nil {
		if errors.Is(err, usecase.ErrCommentNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "comment not found"})
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

// ── GetPost ───────────────────────────────────────────────────────────────────

type GetPostHandler struct {
	getPost *usecase.GetPost
}

func NewGetPostHandler(getPost *usecase.GetPost) *GetPostHandler {
	return &GetPostHandler{getPost: getPost}
}

func (h *GetPostHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	postID := r.PathValue("postId")
	if courseID == "" || postID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	p, err := h.getPost.GetPost(courseID, postID, userID)
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
	_ = json.NewEncoder(w).Encode(postResponse(p))
}

// ── GetMaterial ───────────────────────────────────────────────────────────────

type GetMaterialHandler struct {
	getMaterial *usecase.GetMaterial
}

func NewGetMaterialHandler(getMaterial *usecase.GetMaterial) *GetMaterialHandler {
	return &GetMaterialHandler{getMaterial: getMaterial}
}

func (h *GetMaterialHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	materialID := r.PathValue("materialId")
	if courseID == "" || materialID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	m, err := h.getMaterial.GetMaterial(courseID, materialID, userID)
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
	_ = json.NewEncoder(w).Encode(materialResponse(m))
}

// ── GetMySubmission ───────────────────────────────────────────────────────────

type GetMySubmissionHandler struct {
	getMySubmission *usecase.GetMySubmission
}

func NewGetMySubmissionHandler(getMySubmission *usecase.GetMySubmission) *GetMySubmissionHandler {
	return &GetMySubmissionHandler{getMySubmission: getMySubmission}
}

func (h *GetMySubmissionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	s, err := h.getMySubmission.GetMySubmission(courseID, assignmentID, userID)
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
	_ = json.NewEncoder(w).Encode(submissionResponse(s))
}

// ── LeaveCourse ───────────────────────────────────────────────────────────────

type LeaveCourseHandler struct {
	leaveCourse *usecase.LeaveCourse
}

func NewLeaveCourseHandler(leaveCourse *usecase.LeaveCourse) *LeaveCourseHandler {
	return &LeaveCourseHandler{leaveCourse: leaveCourse}
}

func (h *LeaveCourseHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	err := h.leaveCourse.LeaveCourse(usecase.LeaveCourseInput{CourseID: courseID, UserID: userID})
	if err != nil {
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "not a member of this course"})
			return
		}
		if errors.Is(err, usecase.ErrLastOwner) {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "cannot leave: you are the last owner"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "internal error"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── RemoveMember ──────────────────────────────────────────────────────────────

type RemoveMemberHandler struct {
	removeMember *usecase.RemoveMember
	userRepo     repository.UserRepository
}

func NewRemoveMemberHandler(removeMember *usecase.RemoveMember, userRepo repository.UserRepository) *RemoveMemberHandler {
	return &RemoveMemberHandler{removeMember: removeMember, userRepo: userRepo}
}

func (h *RemoveMemberHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	targetUserID := r.PathValue("userId")
	if courseID == "" || targetUserID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	err := h.removeMember.RemoveMember(usecase.RemoveMemberInput{CourseID: courseID, UserID: userID, TargetUserID: targetUserID})
	if err != nil {
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "member not found"})
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
	w.WriteHeader(http.StatusNoContent)
}

// ── ChangeMemberRole ──────────────────────────────────────────────────────────

type ChangeMemberRoleHandler struct {
	changeMemberRole *usecase.ChangeMemberRole
	userRepo         repository.UserRepository
}

func NewChangeMemberRoleHandler(changeMemberRole *usecase.ChangeMemberRole, userRepo repository.UserRepository) *ChangeMemberRoleHandler {
	return &ChangeMemberRoleHandler{changeMemberRole: changeMemberRole, userRepo: userRepo}
}

func (h *ChangeMemberRoleHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	targetUserID := r.PathValue("userId")
	if courseID == "" || targetUserID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	member, err := h.changeMemberRole.ChangeMemberRole(usecase.ChangeMemberRoleInput{
		CourseID:     courseID,
		UserID:       userID,
		TargetUserID: targetUserID,
		NewRole:      domain.CourseRole(req.Role),
	})
	if err != nil {
		if errors.Is(err, usecase.ErrCourseNotFound) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "member not found"})
			return
		}
		if errors.Is(err, usecase.ErrForbidden) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		if errors.Is(err, usecase.ErrLastOwner) {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "cannot demote the last owner"})
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
	u, _ := h.userRepo.GetByID(targetUserID)
	m := usecase.MemberWithUser{UserID: member.UserID, Role: member.Role}
	if u != nil {
		m.Email, m.FirstName, m.LastName = u.Email, u.FirstName, u.LastName
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(memberResponse(m))
}

// ── DeletePost ────────────────────────────────────────────────────────────────

type DeletePostHandler struct {
	deletePost *usecase.DeletePost
}

func NewDeletePostHandler(deletePost *usecase.DeletePost) *DeletePostHandler {
	return &DeletePostHandler{deletePost: deletePost}
}

func (h *DeletePostHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	postID := r.PathValue("postId")
	if courseID == "" || postID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	err := h.deletePost.DeletePost(courseID, postID, userID)
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

// ── DeleteMaterial ────────────────────────────────────────────────────────────

type DeleteMaterialHandler struct {
	deleteMaterial *usecase.DeleteMaterial
}

func NewDeleteMaterialHandler(deleteMaterial *usecase.DeleteMaterial) *DeleteMaterialHandler {
	return &DeleteMaterialHandler{deleteMaterial: deleteMaterial}
}

func (h *DeleteMaterialHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	materialID := r.PathValue("materialId")
	if courseID == "" || materialID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	err := h.deleteMaterial.DeleteMaterial(courseID, materialID, userID)
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

// ── DeleteAssignment ──────────────────────────────────────────────────────────

type DeleteAssignmentHandler struct {
	deleteAssignment *usecase.DeleteAssignment
}

func NewDeleteAssignmentHandler(deleteAssignment *usecase.DeleteAssignment) *DeleteAssignmentHandler {
	return &DeleteAssignmentHandler{deleteAssignment: deleteAssignment}
}

func (h *DeleteAssignmentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	if courseID == "" || assignmentID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	err := h.deleteAssignment.DeleteAssignment(courseID, assignmentID, userID)
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

// ── Material comments ─────────────────────────────────────────────────────────

type ListMaterialCommentsHandler struct {
	listMaterialComments *usecase.ListMaterialComments
}

func NewListMaterialCommentsHandler(lmc *usecase.ListMaterialComments) *ListMaterialCommentsHandler {
	return &ListMaterialCommentsHandler{listMaterialComments: lmc}
}

func (h *ListMaterialCommentsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	materialID := r.PathValue("materialId")
	if courseID == "" || materialID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	list, err := h.listMaterialComments.ListMaterialComments(courseID, materialID, userID)
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

type CreateMaterialCommentHandler struct {
	createComment *usecase.CreateComment
}

func NewCreateMaterialCommentHandler(createComment *usecase.CreateComment) *CreateMaterialCommentHandler {
	return &CreateMaterialCommentHandler{createComment: createComment}
}

func (h *CreateMaterialCommentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	materialID := r.PathValue("materialId")
	if courseID == "" || materialID == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	var req struct {
		ParentID  *string  `json:"parent_id"`
		IsPrivate bool     `json:"is_private"`
		Body      string   `json:"body"`
		FileIDs   []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	c, err := h.createComment.CreateComment(usecase.CreateCommentInput{CourseID: courseID, MaterialID: materialID, UserID: userID, ParentID: req.ParentID, IsPrivate: req.IsPrivate, Body: req.Body, FileIDs: req.FileIDs})
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
