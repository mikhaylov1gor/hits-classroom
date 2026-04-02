package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/usecase"
)

func teamsResponse(items []usecase.TeamInfo) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(items))
	for _, it := range items {
		members := make([]map[string]interface{}, 0, len(it.Members))
		for _, m := range it.Members {
			members = append(members, map[string]interface{}{
				"user_id":       m.UserID,
				"first_name":    m.FirstName,
				"last_name":     m.LastName,
				"average_score": m.AverageScore,
			})
		}
		out = append(out, map[string]interface{}{
			"id":            it.Team.ID,
			"assignment_id": it.Team.AssignmentID,
			"creator_id":    it.Team.CreatorID,
			"name":          it.Team.Name,
			"max_members":   it.Team.MaxMembers,
			"created_at":    it.Team.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			"members":       members,
			"status":        it.Status,
		})
	}
	return out
}

type ListAssignmentTeamsHandler struct{ uc *usecase.ListAssignmentTeams }

func NewListAssignmentTeamsHandler(uc *usecase.ListAssignmentTeams) *ListAssignmentTeamsHandler {
	return &ListAssignmentTeamsHandler{uc: uc}
}

func (h *ListAssignmentTeamsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	items, err := h.uc.ListAssignmentTeams(courseID, assignmentID, userID)
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
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(teamsResponse(items))
}

type SaveManualTeamsHandler struct{ uc *usecase.SaveManualTeams }

func NewSaveManualTeamsHandler(uc *usecase.SaveManualTeams) *SaveManualTeamsHandler {
	return &SaveManualTeamsHandler{uc: uc}
}

func (h *SaveManualTeamsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	var req struct {
		Teams []struct {
			Name      string   `json:"name"`
			MemberIDs []string `json:"member_ids"`
		} `json:"teams"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	input := make([]usecase.ManualTeamInput, 0, len(req.Teams))
	for _, t := range req.Teams {
		input = append(input, usecase.ManualTeamInput{Name: t.Name, MemberIDs: t.MemberIDs})
	}
	err := h.uc.SaveManualTeams(usecase.SaveManualTeamsInput{
		CourseID: courseID, AssignmentID: assignmentID, TeacherID: userID, Teams: input,
	})
	if err != nil {
		var vErr *usecase.ValidationError
		if errors.As(err, &vErr) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": vErr.Message})
			return
		}
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
	w.WriteHeader(http.StatusNoContent)
}

type GenerateRandomTeamsHandler struct{ uc *usecase.GenerateRandomTeams }

func NewGenerateRandomTeamsHandler(uc *usecase.GenerateRandomTeams) *GenerateRandomTeamsHandler {
	return &GenerateRandomTeamsHandler{uc: uc}
}

func (h *GenerateRandomTeamsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	err := h.uc.GenerateRandomTeams(usecase.GenerateRandomTeamsInput{
		CourseID: courseID, AssignmentID: assignmentID, TeacherID: userID,
	})
	if err != nil {
		respondTeamError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type GenerateBalancedTeamsHandler struct{ uc *usecase.GenerateBalancedTeams }

func NewGenerateBalancedTeamsHandler(uc *usecase.GenerateBalancedTeams) *GenerateBalancedTeamsHandler {
	return &GenerateBalancedTeamsHandler{uc: uc}
}

func (h *GenerateBalancedTeamsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	err := h.uc.GenerateBalancedTeams(usecase.GenerateRandomTeamsInput{
		CourseID: courseID, AssignmentID: assignmentID, TeacherID: userID,
	})
	if err != nil {
		respondTeamError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type CreateTeamHandler struct{ uc *usecase.CreateTeam }

func NewCreateTeamHandler(uc *usecase.CreateTeam) *CreateTeamHandler { return &CreateTeamHandler{uc: uc} }

func (h *CreateTeamHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	t, err := h.uc.CreateTeam(usecase.CreateTeamInput{
		CourseID: courseID, AssignmentID: assignmentID, UserID: userID, Name: req.Name,
	})
	if err != nil {
		respondTeamError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"id":            t.ID,
		"assignment_id": t.AssignmentID,
		"creator_id":    t.CreatorID,
		"name":          t.Name,
		"max_members":   t.MaxMembers,
		"created_at":    t.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

type JoinTeamHandler struct{ uc *usecase.JoinTeam }

func NewJoinTeamHandler(uc *usecase.JoinTeam) *JoinTeamHandler { return &JoinTeamHandler{uc: uc} }

func (h *JoinTeamHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	teamID := r.PathValue("teamId")
	if err := h.uc.JoinTeam(courseID, assignmentID, teamID, userID); err != nil {
		respondTeamError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type LeaveTeamHandler struct{ uc *usecase.LeaveTeam }

func NewLeaveTeamHandler(uc *usecase.LeaveTeam) *LeaveTeamHandler { return &LeaveTeamHandler{uc: uc} }

func (h *LeaveTeamHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
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
	if err := h.uc.LeaveTeam(courseID, assignmentID, userID); err != nil {
		respondTeamError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type VoteTeamSubmissionHandler struct{ uc *usecase.VoteTeamSubmission }

func NewVoteTeamSubmissionHandler(uc *usecase.VoteTeamSubmission) *VoteTeamSubmissionHandler {
	return &VoteTeamSubmissionHandler{uc: uc}
}

func (h *VoteTeamSubmissionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	teamID := r.PathValue("teamId")
	var req struct {
		SubmissionID string `json:"submission_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	if err := h.uc.Vote(courseID, assignmentID, teamID, req.SubmissionID, userID); err != nil {
		respondTeamError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type FinalizeTeamVoteSubmissionHandler struct{ uc *usecase.FinalizeTeamVoteSubmission }

func NewFinalizeTeamVoteSubmissionHandler(uc *usecase.FinalizeTeamVoteSubmission) *FinalizeTeamVoteSubmissionHandler {
	return &FinalizeTeamVoteSubmissionHandler{uc: uc}
}

func (h *FinalizeTeamVoteSubmissionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	teamID := r.PathValue("teamId")
	s, err := h.uc.Finalize(courseID, assignmentID, teamID, userID)
	if err != nil {
		respondTeamError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(submissionResponse(s))
}

func respondTeamError(w http.ResponseWriter, err error) {
	var vErr *usecase.ValidationError
	if errors.As(err, &vErr) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": vErr.Message})
		return
	}
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
}

type LockTeamRosterHandler struct{ uc *usecase.LockTeamRoster }

func NewLockTeamRosterHandler(uc *usecase.LockTeamRoster) *LockTeamRosterHandler {
	return &LockTeamRosterHandler{uc: uc}
}

func (h *LockTeamRosterHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	if err := h.uc.Lock(courseID, assignmentID, userID); err != nil {
		respondTeamError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type ListTeamAuditHandler struct{ uc *usecase.ListTeamAudit }

func NewListTeamAuditHandler(uc *usecase.ListTeamAudit) *ListTeamAuditHandler {
	return &ListTeamAuditHandler{uc: uc}
}

func (h *ListTeamAuditHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	var teamPtr *string
	if tid := r.URL.Query().Get("team_id"); tid != "" {
		teamPtr = &tid
	}
	events, err := h.uc.List(courseID, assignmentID, userID, teamPtr, limit, offset)
	if err != nil {
		respondTeamError(w, err)
		return
	}
	out := make([]map[string]interface{}, 0, len(events))
	for _, e := range events {
		var pl interface{} = map[string]interface{}{}
		if e.Payload != "" {
			pl = json.RawMessage(e.Payload)
		}
		out = append(out, map[string]interface{}{
			"id":            e.ID,
			"assignment_id": e.AssignmentID,
			"team_id":       e.TeamID,
			"actor_user_id": e.ActorUserID,
			"event_type":    string(e.EventType),
			"payload":       pl,
			"created_at":    e.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(out)
}

type SubmitPeerGradeSplitHandler struct{ uc *usecase.SubmitPeerGradeSplit }

func NewSubmitPeerGradeSplitHandler(uc *usecase.SubmitPeerGradeSplit) *SubmitPeerGradeSplitHandler {
	return &SubmitPeerGradeSplitHandler{uc: uc}
}

func (h *SubmitPeerGradeSplitHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	teamID := r.PathValue("teamId")
	var req struct {
		Percents map[string]float64 `json:"percents"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	if err := h.uc.Submit(usecase.SubmitPeerGradeSplitInput{
		CourseID: courseID, AssignmentID: assignmentID, TeamID: teamID, UserID: userID, Percents: req.Percents,
	}); err != nil {
		if errors.Is(err, usecase.ErrAssignmentClosed) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "assignment closed"})
			return
		}
		respondTeamError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type GradeTeamPeerSplitHandler struct{ uc *usecase.GradeTeamPeerSplit }

func NewGradeTeamPeerSplitHandler(uc *usecase.GradeTeamPeerSplit) *GradeTeamPeerSplitHandler {
	return &GradeTeamPeerSplitHandler{uc: uc}
}

func (h *GradeTeamPeerSplitHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
	teamID := r.PathValue("teamId")
	var req struct {
		Grade        int    `json:"grade"`
		GradeComment string `json:"grade_comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}
	if err := h.uc.GradeTeam(usecase.GradeTeamPeerSplitInput{
		CourseID: courseID, AssignmentID: assignmentID, TeamID: teamID, TeacherID: userID,
		Grade: req.Grade, GradeComment: req.GradeComment,
	}); err != nil {
		respondTeamError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func _avoidUnused(_ domain.TeamDistributionType) {}
