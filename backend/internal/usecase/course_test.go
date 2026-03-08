package usecase

import (
	"errors"
	"testing"
	"time"

	"hits-classroom/internal/domain"
)

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

func TestCreateCourse_Validation(t *testing.T) {
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

	_, _, err := uc.JoinCourse(JoinCourseInput{UserID: "user-1", Code: "ABCD1234"})
	if !errors.Is(err, ErrAlreadyMember) {
		t.Fatalf("expected ErrAlreadyMember, got %v", err)
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
func (s *stubCourseRepo) Update(c *domain.Course) error {
	if s.courses != nil {
		s.courses[c.ID] = c
	}
	return nil
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
func (s *stubCourseMemberRepo) Get(courseID, userID string) (*domain.CourseMember, error) {
	for _, m := range s.members {
		if m.CourseID == courseID && m.UserID == userID {
			return m, nil
		}
	}
	return nil, nil
}
func (s *stubCourseMemberRepo) Update(m *domain.CourseMember) error {
	for i, x := range s.members {
		if x.CourseID == m.CourseID && x.UserID == m.UserID {
			s.members[i] = m
			return nil
		}
	}
	return nil
}
func (s *stubCourseMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubCourseMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubCourseMemberRepo) DeleteByCourse(courseID string) error { return nil }

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
func (s *stubJoinCourseRepo) Update(c *domain.Course) error { return nil }
func (s *stubJoinCourseRepo) Delete(id string) error        { return nil }

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
func (s *stubJoinMemberRepo) Get(courseID, userID string) (*domain.CourseMember, error) {
	for _, m := range s.members {
		if m.CourseID == courseID && m.UserID == userID {
			return m, nil
		}
	}
	return nil, nil
}
func (s *stubJoinMemberRepo) Update(m *domain.CourseMember) error { return nil }
func (s *stubJoinMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubJoinMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubJoinMemberRepo) DeleteByCourse(courseID string) error { return nil }

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
func (s *stubListCourseRepo) Update(c *domain.Course) error { return nil }
func (s *stubListCourseRepo) Delete(id string) error        { return nil }

type stubListMemberRepo struct {
	members []*domain.CourseMember
}

func (s *stubListMemberRepo) Create(m *domain.CourseMember) error { return nil }
func (s *stubListMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	return "", nil
}
func (s *stubListMemberRepo) Get(courseID, userID string) (*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubListMemberRepo) Update(m *domain.CourseMember) error { return nil }
func (s *stubListMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubListMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return s.members, nil
}
func (s *stubListMemberRepo) DeleteByCourse(courseID string) error { return nil }

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
func (s *stubGetCourseRepo) Update(c *domain.Course) error { return nil }
func (s *stubGetCourseRepo) Delete(id string) error        { return nil }

type stubGetCourseMemberRepo struct {
	role domain.CourseRole
}

func (s *stubGetCourseMemberRepo) Create(m *domain.CourseMember) error { return nil }
func (s *stubGetCourseMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	return s.role, nil
}
func (s *stubGetCourseMemberRepo) Get(courseID, userID string) (*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubGetCourseMemberRepo) Update(m *domain.CourseMember) error { return nil }
func (s *stubGetCourseMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubGetCourseMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubGetCourseMemberRepo) DeleteByCourse(courseID string) error { return nil }

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
func (s *stubInviteCourseRepo) Update(c *domain.Course) error { return nil }
func (s *stubInviteCourseRepo) Delete(id string) error        { return nil }

type stubInviteMemberRepo struct {
	role domain.CourseRole
}

func (s *stubInviteMemberRepo) Create(m *domain.CourseMember) error { return nil }
func (s *stubInviteMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	return s.role, nil
}
func (s *stubInviteMemberRepo) Get(courseID, userID string) (*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubInviteMemberRepo) Update(m *domain.CourseMember) error { return nil }
func (s *stubInviteMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubInviteMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubInviteMemberRepo) DeleteByCourse(courseID string) error { return nil }

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
func (s *stubDeleteCourseRepo) Update(c *domain.Course) error { return nil }
func (s *stubDeleteCourseRepo) Delete(id string) error {
	delete(s.courses, id)
	return nil
}

type stubDeleteMemberRepo struct {
	role           domain.CourseRole
	deletedCourses []string
}

func (s *stubDeleteMemberRepo) Create(m *domain.CourseMember) error { return nil }
func (s *stubDeleteMemberRepo) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	return s.role, nil
}
func (s *stubDeleteMemberRepo) Get(courseID, userID string) (*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubDeleteMemberRepo) Update(m *domain.CourseMember) error { return nil }
func (s *stubDeleteMemberRepo) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubDeleteMemberRepo) ListByUser(userID string) ([]*domain.CourseMember, error) {
	return nil, nil
}
func (s *stubDeleteMemberRepo) DeleteByCourse(courseID string) error {
	s.deletedCourses = append(s.deletedCourses, courseID)
	return nil
}
