package usecase

import (
	"errors"
	"testing"
	"time"

	"hits-classroom/internal/domain"
)

func TestGetInviteCode_OwnerSuccess(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "ABCD1234", CreatedAt: time.Now()}
	courseRepo := &stubInviteCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubInviteMemberRepo{role: domain.RoleOwner}
	uc := NewGetInviteCode(courseRepo, memberRepo)

	code, err := uc.GetInviteCode("c1", "user-1")
	if err != nil {
		t.Fatalf("GetInviteCode() err = %v", err)
	}
	if code != "ABCD1234" {
		t.Errorf("code = %q, want ABCD1234", code)
	}
}

func TestGetInviteCode_TeacherSuccess(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "XYZ98765", CreatedAt: time.Now()}
	courseRepo := &stubInviteCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubInviteMemberRepo{role: domain.RoleTeacher}
	uc := NewGetInviteCode(courseRepo, memberRepo)

	code, err := uc.GetInviteCode("c1", "user-1")
	if err != nil {
		t.Fatalf("GetInviteCode() err = %v", err)
	}
	if code != "XYZ98765" {
		t.Errorf("code = %q", code)
	}
}

func TestGetInviteCode_StudentForbidden(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "ABCD1234", CreatedAt: time.Now()}
	courseRepo := &stubInviteCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubInviteMemberRepo{role: domain.RoleStudent}
	uc := NewGetInviteCode(courseRepo, memberRepo)

	_, err := uc.GetInviteCode("c1", "user-1")
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrForbidden) {
		t.Errorf("err = %v", err)
	}
}

func TestGetInviteCode_NotFound(t *testing.T) {
	courseRepo := &stubInviteCourseRepo{courses: make(map[string]*domain.Course)}
	memberRepo := &stubInviteMemberRepo{}
	uc := NewGetInviteCode(courseRepo, memberRepo)

	_, err := uc.GetInviteCode("c1", "user-1")
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("err = %v", err)
	}
}

func TestGetInviteCode_NotMemberForbidden(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "ABCD1234", CreatedAt: time.Now()}
	courseRepo := &stubInviteCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubInviteMemberRepo{role: ""}
	uc := NewGetInviteCode(courseRepo, memberRepo)

	_, err := uc.GetInviteCode("c1", "user-1")
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrForbidden) {
		t.Errorf("err = %v", err)
	}
}

type stubInviteCourseRepo struct {
	courses map[string]*domain.Course
}

func (s *stubInviteCourseRepo) Create(c *domain.Course) error { return nil }
func (s *stubInviteCourseRepo) GetByID(id string) (*domain.Course, error) {
	return s.courses[id], nil
}
func (s *stubInviteCourseRepo) GetByInviteCode(code string) (*domain.Course, error) {
	return nil, nil
}
func (s *stubInviteCourseRepo) Delete(id string) error { return nil }

type stubInviteMemberRepo struct {
	role domain.CourseRole
}

func (s *stubInviteMemberRepo) Create(m *domain.CourseMember) error { return nil }
func (s *stubInviteMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubInviteMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubInviteMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	return s.role, nil
}
func (s *stubInviteMemberRepo) DeleteByCourse(courseID string) error { return nil }
