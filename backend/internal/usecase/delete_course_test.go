package usecase

import (
	"errors"
	"testing"
	"time"

	"hits-classroom/internal/domain"
)

func TestDeleteCourse_OwnerSuccess(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: time.Now()}
	courseRepo := &stubDeleteCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubDeleteMemberRepo{role: domain.RoleOwner}
	uc := NewDeleteCourse(courseRepo, memberRepo)

	err := uc.DeleteCourse("c1", "user-1")
	if err != nil {
		t.Fatalf("DeleteCourse() err = %v", err)
	}
	if _, ok := courseRepo.courses["c1"]; ok {
		t.Error("course should be deleted")
	}
	if len(memberRepo.deletedCourses) != 1 || memberRepo.deletedCourses[0] != "c1" {
		t.Errorf("DeleteByCourse not called for c1: %v", memberRepo.deletedCourses)
	}
}

func TestDeleteCourse_TeacherForbidden(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: time.Now()}
	courseRepo := &stubDeleteCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubDeleteMemberRepo{role: domain.RoleTeacher}
	uc := NewDeleteCourse(courseRepo, memberRepo)

	err := uc.DeleteCourse("c1", "user-1")
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrForbidden) {
		t.Errorf("err = %v", err)
	}
	if _, ok := courseRepo.courses["c1"]; !ok {
		t.Error("course should not be deleted")
	}
}

func TestDeleteCourse_NotFound(t *testing.T) {
	courseRepo := &stubDeleteCourseRepo{courses: make(map[string]*domain.Course)}
	memberRepo := &stubDeleteMemberRepo{role: domain.RoleOwner}
	uc := NewDeleteCourse(courseRepo, memberRepo)

	err := uc.DeleteCourse("c1", "user-1")
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("err = %v", err)
	}
}

func TestDeleteCourse_NotMemberForbidden(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "CODE1111", CreatedAt: time.Now()}
	courseRepo := &stubDeleteCourseRepo{courses: map[string]*domain.Course{"c1": course}}
	memberRepo := &stubDeleteMemberRepo{role: ""}
	uc := NewDeleteCourse(courseRepo, memberRepo)

	err := uc.DeleteCourse("c1", "user-1")
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrForbidden) {
		t.Errorf("err = %v", err)
	}
}

type stubDeleteCourseRepo struct {
	courses map[string]*domain.Course
}

func (s *stubDeleteCourseRepo) Create(c *domain.Course) error { return nil }
func (s *stubDeleteCourseRepo) GetByID(id string) (*domain.Course, error) {
	return s.courses[id], nil
}
func (s *stubDeleteCourseRepo) GetByInviteCode(code string) (*domain.Course, error) {
	return nil, nil
}
func (s *stubDeleteCourseRepo) Delete(id string) error {
	delete(s.courses, id)
	return nil
}

type stubDeleteMemberRepo struct {
	role           domain.CourseRole
	deletedCourses []string
}

func (s *stubDeleteMemberRepo) Create(m *domain.CourseMember) error { return nil }
func (s *stubDeleteMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubDeleteMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubDeleteMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	return s.role, nil
}
func (s *stubDeleteMemberRepo) DeleteByCourse(courseID string) error {
	s.deletedCourses = append(s.deletedCourses, courseID)
	return nil
}
