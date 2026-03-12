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

func (r *PostRepository) GetByID(id string) (*domain.Post, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[id], nil
}

func (r *PostRepository) ListByCourse(courseID string) ([]*domain.Post, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.byCid[courseID] == nil {
		return []*domain.Post{}, nil
	}
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
	if r.byCid[courseID] == nil {
		return []*domain.Material{}, nil
	}
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
	if r.byCid[courseID] == nil {
		return []*domain.Assignment{}, nil
	}
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
	if r.byAssign[assignmentID] == nil {
		return []*domain.Submission{}, nil
	}
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

var _ repository.SubmissionRepository = (*SubmissionRepository)(nil)

type CommentRepository struct {
	mu       sync.RWMutex
	byID     map[string]*domain.Comment
	byAssign map[string][]*domain.Comment
	byPost   map[string][]*domain.Comment
}

func NewCommentRepository() *CommentRepository {
	return &CommentRepository{
		byID:     make(map[string]*domain.Comment),
		byAssign: make(map[string][]*domain.Comment),
		byPost:   make(map[string][]*domain.Comment),
	}
}

func (r *CommentRepository) Create(c *domain.Comment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[c.ID] = c
	if c.AssignmentID != "" {
		r.byAssign[c.AssignmentID] = append(r.byAssign[c.AssignmentID], c)
	}
	if c.PostID != "" {
		r.byPost[c.PostID] = append(r.byPost[c.PostID], c)
	}
	return nil
}

func (r *CommentRepository) GetByID(id string) (*domain.Comment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[id], nil
}

func (r *CommentRepository) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.byID[id]
	if !ok {
		return nil
	}
	delete(r.byID, id)
	if c.AssignmentID != "" {
		list := r.byAssign[c.AssignmentID]
		out := list[:0]
		for _, item := range list {
			if item.ID != id {
				out = append(out, item)
			}
		}
		r.byAssign[c.AssignmentID] = out
	}
	if c.PostID != "" {
		list := r.byPost[c.PostID]
		out := list[:0]
		for _, item := range list {
			if item.ID != id {
				out = append(out, item)
			}
		}
		r.byPost[c.PostID] = out
	}
	return nil
}

func (r *CommentRepository) ListByAssignment(assignmentID string) ([]*domain.Comment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.byAssign[assignmentID] == nil {
		return []*domain.Comment{}, nil
	}
	return r.byAssign[assignmentID], nil
}

func (r *CommentRepository) ListByPost(postID string) ([]*domain.Comment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.byPost[postID] == nil {
		return []*domain.Comment{}, nil
	}
	return r.byPost[postID], nil
}

var _ repository.CommentRepository = (*CommentRepository)(nil)

type FileRepository struct {
	mu    sync.RWMutex
	byID  map[string]*domain.File
	byUid map[string][]*domain.File
}

func NewFileRepository() *FileRepository {
	return &FileRepository{
		byID:  make(map[string]*domain.File),
		byUid: make(map[string][]*domain.File),
	}
}

func (r *FileRepository) Create(f *domain.File) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[f.ID] = f
	r.byUid[f.UserID] = append(r.byUid[f.UserID], f)
	return nil
}

func (r *FileRepository) GetByID(id string) (*domain.File, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[id], nil
}

func (r *FileRepository) ListByUser(userID string) ([]*domain.File, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.byUid[userID] == nil {
		return []*domain.File{}, nil
	}
	return r.byUid[userID], nil
}

var _ repository.FileRepository = (*FileRepository)(nil)
