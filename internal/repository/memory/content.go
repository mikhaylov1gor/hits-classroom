package memory

import (
	"sync"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

type PostRepository struct {
	mu    sync.RWMutex
	byID  map[string]*domain.Post
	byCid map[string][]*domain.Post
}

func NewPostRepository() *PostRepository {
	return &PostRepository{
		byID:  make(map[string]*domain.Post),
		byCid: make(map[string][]*domain.Post),
	}
}

func (r *PostRepository) Create(p *domain.Post) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[p.ID] = p
	r.byCid[p.CourseID] = append(r.byCid[p.CourseID], p)
	return nil
}

func (r *PostRepository) ListByCourse(courseID string) ([]*domain.Post, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byCid[courseID], nil
}

var _ repository.PostRepository = (*PostRepository)(nil)

type MaterialRepository struct {
	mu    sync.RWMutex
	byID  map[string]*domain.Material
	byCid map[string][]*domain.Material
}

func NewMaterialRepository() *MaterialRepository {
	return &MaterialRepository{
		byID:  make(map[string]*domain.Material),
		byCid: make(map[string][]*domain.Material),
	}
}

func (r *MaterialRepository) Create(m *domain.Material) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[m.ID] = m
	r.byCid[m.CourseID] = append(r.byCid[m.CourseID], m)
	return nil
}

func (r *MaterialRepository) ListByCourse(courseID string) ([]*domain.Material, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byCid[courseID], nil
}

var _ repository.MaterialRepository = (*MaterialRepository)(nil)

type AssignmentRepository struct {
	mu    sync.RWMutex
	byID  map[string]*domain.Assignment
	byCid map[string][]*domain.Assignment
}

func NewAssignmentRepository() *AssignmentRepository {
	return &AssignmentRepository{
		byID:  make(map[string]*domain.Assignment),
		byCid: make(map[string][]*domain.Assignment),
	}
}

func (r *AssignmentRepository) Create(a *domain.Assignment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[a.ID] = a
	r.byCid[a.CourseID] = append(r.byCid[a.CourseID], a)
	return nil
}

func (r *AssignmentRepository) GetByID(id string) (*domain.Assignment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[id], nil
}

func (r *AssignmentRepository) ListByCourse(courseID string) ([]*domain.Assignment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byCid[courseID], nil
}

var _ repository.AssignmentRepository = (*AssignmentRepository)(nil)

type SubmissionRepository struct {
	mu       sync.RWMutex
	byID     map[string]*domain.Submission
	byAssign map[string][]*domain.Submission
}

func NewSubmissionRepository() *SubmissionRepository {
	return &SubmissionRepository{
		byID:     make(map[string]*domain.Submission),
		byAssign: make(map[string][]*domain.Submission),
	}
}

func (r *SubmissionRepository) Create(s *domain.Submission) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[s.ID] = s
	r.byAssign[s.AssignmentID] = append(r.byAssign[s.AssignmentID], s)
	return nil
}

func (r *SubmissionRepository) GetByID(id string) (*domain.Submission, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[id], nil
}

func (r *SubmissionRepository) GetByAssignmentAndUser(assignmentID, userID string) (*domain.Submission, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, s := range r.byAssign[assignmentID] {
		if s.UserID == userID {
			return s, nil
		}
	}
	return nil, nil
}

func (r *SubmissionRepository) ListByAssignment(assignmentID string) ([]*domain.Submission, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byAssign[assignmentID], nil
}

func (r *SubmissionRepository) Update(s *domain.Submission) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[s.ID] = s
	for i, sub := range r.byAssign[s.AssignmentID] {
		if sub.ID == s.ID {
			r.byAssign[s.AssignmentID][i] = s
			break
		}
	}
	return nil
}

type CommentRepository struct {
	mu       sync.RWMutex
	byID     map[string]*domain.Comment
	byAssign map[string][]*domain.Comment
}

func NewCommentRepository() *CommentRepository {
	return &CommentRepository{
		byID:     make(map[string]*domain.Comment),
		byAssign: make(map[string][]*domain.Comment),
	}
}

func (r *CommentRepository) Create(c *domain.Comment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[c.ID] = c
	r.byAssign[c.AssignmentID] = append(r.byAssign[c.AssignmentID], c)
	return nil
}

func (r *CommentRepository) ListByAssignment(assignmentID string) ([]*domain.Comment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byAssign[assignmentID], nil
}

var _ repository.CommentRepository = (*CommentRepository)(nil)
