package usecase

import (
	"errors"
	"testing"

	"hits-classroom/internal/domain"
)

func TestJoinCourse_Success(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "ABCD1234"}
	courseRepo := &stubJoinCourseRepo{courses: map[string]*domain.Course{"ABCD1234": course}}
	memberRepo := &stubJoinMemberRepo{members: make([]*domain.CourseMember, 0)}
	uc := NewJoinCourse(courseRepo, memberRepo)

	gotCourse, role, err := uc.JoinCourse(JoinCourseInput{UserID: "user-1", Code: "ABCD1234"})
	if err != nil {
		t.Fatalf("JoinCourse() err = %v", err)
	}
	if gotCourse.ID != "c1" || role != domain.RoleStudent {
		t.Errorf("course = %+v, role = %s", gotCourse, role)
	}
	if len(memberRepo.members) != 1 || memberRepo.members[0].UserID != "user-1" || memberRepo.members[0].Role != domain.RoleStudent {
		t.Errorf("members = %+v", memberRepo.members)
	}
}

func TestJoinCourse_AlreadyMember(t *testing.T) {
	course := &domain.Course{ID: "c1", Title: "Math", InviteCode: "ABCD1234"}
	courseRepo := &stubJoinCourseRepo{courses: map[string]*domain.Course{"ABCD1234": course}}
	memberRepo := &stubJoinMemberRepo{
		members: []*domain.CourseMember{{CourseID: "c1", UserID: "user-1", Role: domain.RoleStudent}},
		role:    domain.RoleStudent,
	}
	uc := NewJoinCourse(courseRepo, memberRepo)

	gotCourse, role, err := uc.JoinCourse(JoinCourseInput{UserID: "user-1", Code: "ABCD1234"})
	if err != nil {
		t.Fatalf("JoinCourse() err = %v", err)
	}
	if gotCourse.ID != "c1" || role != domain.RoleStudent {
		t.Errorf("course = %+v, role = %s", gotCourse, role)
	}
	if len(memberRepo.members) != 1 {
		t.Error("should not create duplicate member")
	}
}

func TestJoinCourse_NotFound(t *testing.T) {
	courseRepo := &stubJoinCourseRepo{courses: make(map[string]*domain.Course)}
	memberRepo := &stubJoinMemberRepo{members: make([]*domain.CourseMember, 0)}
	uc := NewJoinCourse(courseRepo, memberRepo)

	_, _, err := uc.JoinCourse(JoinCourseInput{UserID: "user-1", Code: "INVALID1"})
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrCourseNotFound) {
		t.Errorf("err = %v", err)
	}
}

func TestJoinCourse_InvalidCode(t *testing.T) {
	courseRepo := &stubJoinCourseRepo{courses: make(map[string]*domain.Course)}
	memberRepo := &stubJoinMemberRepo{members: make([]*domain.CourseMember, 0)}
	uc := NewJoinCourse(courseRepo, memberRepo)

	_, _, err := uc.JoinCourse(JoinCourseInput{UserID: "user-1", Code: ""})
	if err == nil {
		t.Fatal("expected err")
	}
	if !errors.Is(err, ErrValidation) {
		t.Errorf("err = %v", err)
	}
}

type stubJoinCourseRepo struct {
	courses map[string]*domain.Course
}

func (s *stubJoinCourseRepo) Create(c *domain.Course) error { return nil }

func (s *stubJoinCourseRepo) GetByID(id string) (*domain.Course, error) {
	for _, c := range s.courses {
		if c.ID == id {
			return c, nil
		}
	}
	return nil, nil
}

func (s *stubJoinCourseRepo) GetByInviteCode(code string) (*domain.Course, error) {
	return s.courses[code], nil
}

type stubJoinMemberRepo struct {
	members []*domain.CourseMember
	role    domain.CourseRole
}

func (s *stubJoinMemberRepo) Create(m *domain.CourseMember) error {
	s.members = append(s.members, m)
	return nil
}

func (s *stubJoinMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	if s.role != "" {
		return s.role, nil
	}
	for _, m := range s.members {
		if m.CourseID == courseID && m.UserID == userID {
			return m.Role, nil
		}
	}
	return "", nil
}

func (s *stubJoinMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubJoinMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
