package usecase

import (
	"errors"
	"testing"
	"time"

	"hits-classroom/internal/domain"
)

func TestGetCourse_Success(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: time.Now()}
	courseRepo := &stubGetCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubGetCourseMemberRepo{role: domain.RoleOwner}
	uc := NewGetCourse(courseRepo, memberRepo)

	got, role, err := uc.GetCourse("c1", "user-1")
	if err != nil {
		t.Fatalf("GetCourse() err = %v", err)
	}
	if got.ID != "c1" || got.Title != "Math" || role != domain.RoleOwner {
		t.Errorf("course = %+v, role = %s", got, role)
	}
}

func TestGetCourse_NotFound(t *testing.T) {
	courseRepo := &stubGetCourseRepo{courses: make(map[string]*domain.Course)}
	memberRepo := &stubGetCourseMemberRepo{}
	uc := NewGetCourse(courseRepo, memberRepo)

	_, _, err := uc.GetCourse("c1", "user-1")
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("err = %v", err)
	}
}

func TestGetCourse_Forbidden(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: time.Now()}
	courseRepo := &stubGetCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubGetCourseMemberRepo{role: ""}
	uc := NewGetCourse(courseRepo, memberRepo)

	_, _, err := uc.GetCourse("c1", "user-1")
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrForbidden) {
		t.Errorf("err = %v", err)
	}
}

type stubGetCourseRepo struct {
	courses map[string]*domain.Course
}

func (s *stubGetCourseRepo) Create(c *domain.Course) error { return nil }
func (s *stubGetCourseRepo) GetByID(id string) (*domain.Course, error) {
	return s.courses[id], nil
}
func (s *stubGetCourseRepo) GetByInviteCode(code string) (*domain.Course, error) {
	return nil, nil
}

type stubGetCourseMemberRepo struct {
	role domain.CourseRole
}

func (s *stubGetCourseMemberRepo) Create(m *domain.CourseMember) error { return nil }
func (s *stubGetCourseMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubGetCourseMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubGetCourseMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	return s.role, nil
}
