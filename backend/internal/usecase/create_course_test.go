package usecase

import (
	"errors"
	"testing"

	"hits-classroom/internal/domain"
)

type stubCourseRepo struct {
	courses map[string]*domain.Course
}

func (s *stubCourseRepo) Create(c *domain.Course) error {
	if s.courses == nil {
		s.courses = make(map[string]*domain.Course)
	}
	s.courses[c.ID] = c
	return nil
}

func (s *stubCourseRepo) GetByID(id string) (*domain.Course, error) {
	return s.courses[id], nil
}

func (s *stubCourseRepo) GetByInviteCode(code string) (*domain.Course, error) {
	for _, c := range s.courses {
		if c.InviteCode == code {
			return c, nil
		}
	}
	return nil, nil
}
func (s *stubCourseRepo) Delete(id string) error { return nil }

type stubCourseMemberRepo struct {
	members []*domain.CourseMember
}

func (s *stubCourseMemberRepo) Create(m *domain.CourseMember) error {
	s.members = append(s.members, m)
	return nil
}

func (s *stubCourseMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	for _, m := range s.members {
		if m.CourseID == courseID && m.UserID == userID {
			return m.Role, nil
		}
	}
	return "", nil
}

func (s *stubCourseMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubCourseMemberRepo) DeleteByCourse(courseID string) error { return nil }

func (s *stubCourseMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}

func TestCreateCourse_Success(t *testing.T) {
	courseRepo := &stubCourseRepo{courses: make(map[string]*domain.Course)}
	memberRepo := &stubCourseMemberRepo{}
	uc := NewCreateCourse(courseRepo, memberRepo)

	course, err := uc.CreateCourse(CreateCourseInput{
		OwnerID: "user-1",
		Title:   "Math 101",
	})
	if err != nil {
		t.Fatalf("CreateCourse() err = %v", err)
	}
	if course.ID == "" {
		t.Error("course.ID is empty")
	}
	if course.Title != "Math 101" {
		t.Errorf("course.Title = %q", course.Title)
	}
	if len(course.InviteCode) != 8 {
		t.Errorf("InviteCode length = %d, want 8", len(course.InviteCode))
	}
	if course.CreatedAt.IsZero() {
		t.Error("CreatedAt is zero")
	}
	if len(memberRepo.members) != 1 {
		t.Fatalf("members = %d, want 1", len(memberRepo.members))
	}
	if memberRepo.members[0].UserID != "user-1" || memberRepo.members[0].Role != domain.RoleOwner {
		t.Errorf("member = %+v", memberRepo.members[0])
	}
}

func TestCreateCourse_RepoError(t *testing.T) {
	courseRepo := &stubCourseRepo{courses: make(map[string]*domain.Course)}
	memberRepo := &stubCourseMemberRepo{}
	uc := NewCreateCourse(courseRepo, memberRepo)

	_, err := uc.CreateCourse(CreateCourseInput{OwnerID: "user-1", Title: ""})
	if err == nil {
		t.Fatal("expected err for empty title")
	}
	if !errors.Is(err, ErrValidation) {
		t.Errorf("err = %v", err)
	}
}
