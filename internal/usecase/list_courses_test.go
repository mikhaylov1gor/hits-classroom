package usecase

import (
	"testing"
	"time"

	"hits-classroom/internal/domain"
)

func TestListCourses_Empty(t *testing.T) {
	courseRepo := &stubListCourseRepo{courses: make(map[string]*domain.Course)}
	memberRepo := &stubListMemberRepo{members: make([]*domain.CourseMember, 0)}
	uc := NewListCourses(courseRepo, memberRepo)

	items, err := uc.ListCourses("user-1")
	if err != nil {
		t.Fatalf("ListCourses() err = %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len = %d, want 0", len(items))
	}
}

func TestListCourses_Multiple(t *testing.T) {
	c1 := &domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: time.Now()}
	c2 := &domain.Course{ID: "c2", Title: "Physics", InviteCode: "CODE2222", CreatedAt: time.Now()}
	courseRepo := &stubListCourseRepo{courses: map[string]*domain.Course{"c1": c1, "c2": c2}}
	memberRepo := &stubListMemberRepo{
		members: []*domain.CourseMember{
			{CourseID: "c1", UserID: "user-1", Role: domain.RoleOwner},
			{CourseID: "c2", UserID: "user-1", Role: domain.RoleStudent},
		},
	}
	uc := NewListCourses(courseRepo, memberRepo)

	items, err := uc.ListCourses("user-1")
	if err != nil {
		t.Fatalf("ListCourses() err = %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("len = %d, want 2", len(items))
	}
	byID := make(map[string]CourseWithRoleItem)
	for _, it := range items {
		byID[it.Course.ID] = it
	}
	if byID["c1"].Course.Title != "Math" || byID["c1"].Role != domain.RoleOwner {
		t.Errorf("c1 = %+v", byID["c1"])
	}
	if byID["c2"].Course.Title != "Physics" || byID["c2"].Role != domain.RoleStudent {
		t.Errorf("c2 = %+v", byID["c2"])
	}
}

type stubListCourseRepo struct {
	courses map[string]*domain.Course
}

func (s *stubListCourseRepo) Create(c *domain.Course) error { return nil }
func (s *stubListCourseRepo) GetByID(id string) (*domain.Course, error) {
	return s.courses[id], nil
}
func (s *stubListCourseRepo) GetByInviteCode(code string) (*domain.Course, error) {
	return nil, nil
}
func (s *stubListCourseRepo) Delete(id string) error { return nil }

type stubListMemberRepo struct {
	members []*domain.CourseMember
}

func (s *stubListMemberRepo) Create(m *domain.CourseMember) error { return nil }
func (s *stubListMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	return "", nil
}
func (s *stubListMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubListMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return s.members, nil
}
func (s *stubListMemberRepo) DeleteByCourse(courseID string) error { return nil }
