package usecase

import (
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

type CreatePostInput struct {
	CourseID string
	UserID   string
	Title    string
	Body     string
	FileIDs  []string
}

type CreatePost struct {
	memberRepo repository.CourseMemberRepository
	postRepo   repository.PostRepository
}

func NewCreatePost(memberRepo repository.CourseMemberRepository, postRepo repository.PostRepository) *CreatePost {
	return &CreatePost{memberRepo: memberRepo, postRepo: postRepo}
}

func (uc *CreatePost) CreatePost(in CreatePostInput) (*domain.Post, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrValidation
	}
	p := &domain.Post{
		ID:        uuid.New().String(),
		CourseID:  in.CourseID,
		Title:     title,
		Body:      in.Body,
		FileIDs:   in.FileIDs,
		CreatedAt: time.Now().UTC(),
	}
	if err := uc.postRepo.Create(p); err != nil {
		return nil, err
	}
	return p, nil
}

type CreateMaterialInput struct {
	CourseID string
	UserID   string
	Title    string
	Body     string
	FileIDs  []string
}

type CreateMaterial struct {
	memberRepo   repository.CourseMemberRepository
	materialRepo repository.MaterialRepository
}

func NewCreateMaterial(memberRepo repository.CourseMemberRepository, materialRepo repository.MaterialRepository) *CreateMaterial {
	return &CreateMaterial{memberRepo: memberRepo, materialRepo: materialRepo}
}

func (uc *CreateMaterial) CreateMaterial(in CreateMaterialInput) (*domain.Material, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrValidation
	}
	m := &domain.Material{
		ID:        uuid.New().String(),
		CourseID:  in.CourseID,
		Title:     title,
		Body:      in.Body,
		FileIDs:   in.FileIDs,
		CreatedAt: time.Now().UTC(),
	}
	if err := uc.materialRepo.Create(m); err != nil {
		return nil, err
	}
	return m, nil
}

type CreateAssignmentInput struct {
	CourseID string
	UserID   string
	Title    string
	Body     string
	FileIDs  []string
	Deadline *time.Time
}

type CreateAssignment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
}

func NewCreateAssignment(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository) *CreateAssignment {
	return &CreateAssignment{memberRepo: memberRepo, assignmentRepo: assignmentRepo}
}

func (uc *CreateAssignment) CreateAssignment(in CreateAssignmentInput) (*domain.Assignment, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrValidation
	}
	a := &domain.Assignment{
		ID:        uuid.New().String(),
		CourseID:  in.CourseID,
		Title:     title,
		Body:      in.Body,
		FileIDs:   in.FileIDs,
		Deadline:  in.Deadline,
		CreatedAt: time.Now().UTC(),
	}
	if err := uc.assignmentRepo.Create(a); err != nil {
		return nil, err
	}
	return a, nil
}

type GetAssignment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
}

func NewGetAssignment(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository) *GetAssignment {
	return &GetAssignment{memberRepo: memberRepo, assignmentRepo: assignmentRepo}
}

func (uc *GetAssignment) GetAssignment(courseID, assignmentID, userID string) (*domain.Assignment, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	return a, nil
}

type FeedItem struct {
	Type      string
	ID        string
	Title     string
	CreatedAt time.Time
	Deadline  *time.Time
}

type GetCourseFeed struct {
	memberRepo     repository.CourseMemberRepository
	postRepo       repository.PostRepository
	materialRepo   repository.MaterialRepository
	assignmentRepo repository.AssignmentRepository
}

func NewGetCourseFeed(memberRepo repository.CourseMemberRepository, postRepo repository.PostRepository, materialRepo repository.MaterialRepository, assignmentRepo repository.AssignmentRepository) *GetCourseFeed {
	return &GetCourseFeed{
		memberRepo:     memberRepo,
		postRepo:       postRepo,
		materialRepo:   materialRepo,
		assignmentRepo: assignmentRepo,
	}
}

func (uc *GetCourseFeed) GetCourseFeed(courseID, userID string) ([]FeedItem, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	posts, _ := uc.postRepo.ListByCourse(courseID)
	materials, _ := uc.materialRepo.ListByCourse(courseID)
	assignments, _ := uc.assignmentRepo.ListByCourse(courseID)
	var items []FeedItem
	for _, p := range posts {
		items = append(items, FeedItem{Type: "post", ID: p.ID, Title: p.Title, CreatedAt: p.CreatedAt, Deadline: nil})
	}
	for _, m := range materials {
		items = append(items, FeedItem{Type: "material", ID: m.ID, Title: m.Title, CreatedAt: m.CreatedAt, Deadline: nil})
	}
	for _, a := range assignments {
		items = append(items, FeedItem{Type: "assignment", ID: a.ID, Title: a.Title, CreatedAt: a.CreatedAt, Deadline: a.Deadline})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	return items, nil
}

var ErrAlreadySubmitted = errors.New("already submitted")

type CreateSubmissionInput struct {
	CourseID     string
	AssignmentID string
	UserID       string
	Body         string
	FileIDs      []string
}

type CreateSubmission struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewCreateSubmission(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *CreateSubmission {
	return &CreateSubmission{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *CreateSubmission) CreateSubmission(in CreateSubmissionInput) (*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	existing, _ := uc.submissionRepo.GetByAssignmentAndUser(in.AssignmentID, in.UserID)
	if existing != nil {
		return nil, ErrAlreadySubmitted
	}
	s := &domain.Submission{
		ID:           uuid.New().String(),
		AssignmentID: in.AssignmentID,
		UserID:       in.UserID,
		Body:         in.Body,
		FileIDs:      in.FileIDs,
		SubmittedAt:  time.Now().UTC(),
	}
	if err := uc.submissionRepo.Create(s); err != nil {
		return nil, err
	}
	return s, nil
}

type ListSubmissions struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewListSubmissions(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *ListSubmissions {
	return &ListSubmissions{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *ListSubmissions) ListSubmissions(courseID, assignmentID, userID string) ([]*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	return uc.submissionRepo.ListByAssignment(assignmentID)
}

type GradeSubmissionInput struct {
	CourseID     string
	AssignmentID string
	SubmissionID string
	UserID       string
	Grade        int
}

type GradeSubmission struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewGradeSubmission(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *GradeSubmission {
	return &GradeSubmission{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *GradeSubmission) GradeSubmission(in GradeSubmissionInput) (*domain.Submission, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	s, err := uc.submissionRepo.GetByID(in.SubmissionID)
	if err != nil || s == nil || s.AssignmentID != in.AssignmentID {
		return nil, ErrCourseNotFound
	}
	if in.Grade < 0 || in.Grade > 100 {
		return nil, ErrValidation
	}
	s.Grade = &in.Grade
	if err := uc.submissionRepo.Update(s); err != nil {
		return nil, err
	}
	return s, nil
}

type SubmissionWithAssignmentItem struct {
	Submission *domain.Submission
	Assignment *domain.Assignment
}

type GetStudentGrades struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
}

func NewGetStudentGrades(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, submissionRepo repository.SubmissionRepository) *GetStudentGrades {
	return &GetStudentGrades{memberRepo: memberRepo, assignmentRepo: assignmentRepo, submissionRepo: submissionRepo}
}

func (uc *GetStudentGrades) GetStudentGrades(courseID, targetUserID, userID string) ([]SubmissionWithAssignmentItem, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	if userID != targetUserID && role != domain.RoleOwner && role != domain.RoleTeacher {
		return nil, ErrForbidden
	}
	member, _ := uc.memberRepo.Get(courseID, targetUserID)
	if member == nil {
		return nil, ErrCourseNotFound
	}
	assignments, _ := uc.assignmentRepo.ListByCourse(courseID)
	var out []SubmissionWithAssignmentItem
	for _, a := range assignments {
		s, _ := uc.submissionRepo.GetByAssignmentAndUser(a.ID, targetUserID)
		if s != nil {
			out = append(out, SubmissionWithAssignmentItem{Submission: s, Assignment: a})
		}
	}
	return out, nil
}

type ListComments struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	commentRepo    repository.CommentRepository
}

func NewListComments(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, commentRepo repository.CommentRepository) *ListComments {
	return &ListComments{memberRepo: memberRepo, assignmentRepo: assignmentRepo, commentRepo: commentRepo}
}

func (uc *ListComments) ListComments(courseID, assignmentID, userID string) ([]*domain.Comment, error) {
	role, err := uc.memberRepo.GetUserRole(courseID, userID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(assignmentID)
	if err != nil || a == nil || a.CourseID != courseID {
		return nil, ErrCourseNotFound
	}
	return uc.commentRepo.ListByAssignment(assignmentID)
}

type CreateCommentInput struct {
	CourseID     string
	AssignmentID string
	UserID       string
	ParentID     *string
	Body         string
	FileIDs      []string
}

type CreateComment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	commentRepo    repository.CommentRepository
}

func NewCreateComment(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, commentRepo repository.CommentRepository) *CreateComment {
	return &CreateComment{memberRepo: memberRepo, assignmentRepo: assignmentRepo, commentRepo: commentRepo}
}

func (uc *CreateComment) CreateComment(in CreateCommentInput) (*domain.Comment, error) {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return nil, ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return nil, ErrCourseNotFound
	}
	if strings.TrimSpace(in.Body) == "" {
		return nil, &ValidationError{Message: "body is required"}
	}
	if in.ParentID != nil {
		parent, err := uc.commentRepo.GetByID(*in.ParentID)
		if err != nil || parent == nil || parent.AssignmentID != in.AssignmentID {
			return nil, ErrCourseNotFound
		}
	}
	c := &domain.Comment{
		ID:           uuid.New().String(),
		AssignmentID: in.AssignmentID,
		UserID:       in.UserID,
		ParentID:     in.ParentID,
		Body:         in.Body,
		FileIDs:      in.FileIDs,
		CreatedAt:    time.Now().UTC(),
	}
	if err := uc.commentRepo.Create(c); err != nil {
		return nil, err
	}
	return c, nil
}

var ErrCommentNotFound = errors.New("comment not found")

type DeleteCommentInput struct {
	CourseID     string
	AssignmentID string
	CommentID    string
	UserID       string
}

type DeleteComment struct {
	memberRepo     repository.CourseMemberRepository
	assignmentRepo repository.AssignmentRepository
	commentRepo    repository.CommentRepository
}

func NewDeleteComment(memberRepo repository.CourseMemberRepository, assignmentRepo repository.AssignmentRepository, commentRepo repository.CommentRepository) *DeleteComment {
	return &DeleteComment{memberRepo: memberRepo, assignmentRepo: assignmentRepo, commentRepo: commentRepo}
}

func (uc *DeleteComment) DeleteComment(in DeleteCommentInput) error {
	role, err := uc.memberRepo.GetUserRole(in.CourseID, in.UserID)
	if err != nil || role == "" {
		return ErrForbidden
	}
	a, err := uc.assignmentRepo.GetByID(in.AssignmentID)
	if err != nil || a == nil || a.CourseID != in.CourseID {
		return ErrCourseNotFound
	}
	comment, err := uc.commentRepo.GetByID(in.CommentID)
	if err != nil || comment == nil || comment.AssignmentID != in.AssignmentID {
		return ErrCommentNotFound
	}
	// Автор может удалять свои, owner/teacher — любые
	if comment.UserID != in.UserID && role != domain.RoleOwner && role != domain.RoleTeacher {
		return ErrForbidden
	}
	// Каскадно удаляем все дочерние комментарии
	all, err := uc.commentRepo.ListByAssignment(in.AssignmentID)
	if err != nil {
		return err
	}
	toDelete := collectDescendants(in.CommentID, all)
	toDelete = append(toDelete, in.CommentID)
	for _, id := range toDelete {
		if err := uc.commentRepo.Delete(id); err != nil {
			return err
		}
	}
	return nil
}

// collectDescendants рекурсивно собирает ID всех дочерних комментариев.
func collectDescendants(parentID string, all []*domain.Comment) []string {
	var ids []string
	for _, c := range all {
		if c.ParentID != nil && *c.ParentID == parentID {
			ids = append(ids, c.ID)
			ids = append(ids, collectDescendants(c.ID, all)...)
		}
	}
	return ids
}
