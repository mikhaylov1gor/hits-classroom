package memory

import (
	"sync"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

type CourseRepository struct {
	mu       sync.RWMutex
	byID     map[string]*domain.Course
	byInvite map[string]*domain.Course
}

func NewCourseRepository() *CourseRepository {
	return &CourseRepository{
		byID:     make(map[string]*domain.Course),
		byInvite: make(map[string]*domain.Course),
	}
}

func (r *CourseRepository) Create(c *domain.Course) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[c.ID] = c
	r.byInvite[c.InviteCode] = c
	return nil
}

func (r *CourseRepository) GetByID(id string) (*domain.Course, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[id], nil
}

func (r *CourseRepository) GetByInviteCode(code string) (*domain.Course, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byInvite[code], nil
}

var _ repository.CourseRepository = (*CourseRepository)(nil)

type CourseMemberRepository struct {
	mu      sync.RWMutex
	members []*domain.CourseMember
}

func NewCourseMemberRepository() *CourseMemberRepository {
	return &CourseMemberRepository{members: make([]*domain.CourseMember, 0)}
}

func (r *CourseMemberRepository) Create(m *domain.CourseMember) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.members = append(r.members, m)
	return nil
}

func (r *CourseMemberRepository) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, m := range r.members {
		if m.CourseID == courseID && m.UserID == userID {
			return m.Role, nil
		}
	}
	return "", nil
}

func (r *CourseMemberRepository) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*domain.CourseMember
	for _, m := range r.members {
		if m.CourseID == courseID {
			out = append(out, m)
		}
	}
	return out, nil
}

func (r *CourseMemberRepository) ListByUser(userID string) ([]*domain.CourseMember, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*domain.CourseMember
	for _, m := range r.members {
		if m.UserID == userID {
			out = append(out, m)
		}
	}
	return out, nil
}

var _ repository.CourseMemberRepository = (*CourseMemberRepository)(nil)
