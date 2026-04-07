package gormrepo

import (
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
	"time"

	"gorm.io/gorm"
)

type CourseRepository struct {
	db *gorm.DB
}

func NewCourseRepository(db *gorm.DB) *CourseRepository {
	return &CourseRepository{db: db}
}

func (r *CourseRepository) Create(c *domain.Course) error {
	return r.db.Create(toCourseModel(c)).Error
}

func (r *CourseRepository) GetByID(id string) (*domain.Course, error) {
	var m courseModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toCourseDomain(&m), nil
}

func (r *CourseRepository) GetByInviteCode(code string) (*domain.Course, error) {
	var m courseModel
	if err := r.db.Where("invite_code = ?", code).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toCourseDomain(&m), nil
}

func (r *CourseRepository) Update(c *domain.Course) error {
	return r.db.Model(&courseModel{}).Where("id = ?", c.ID).Updates(toCourseModel(c)).Error
}

func (r *CourseRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&courseModel{}).Error
}

func toCourseModel(c *domain.Course) *courseModel {
	if c == nil {
		return nil
	}
	return &courseModel{
		ID:         c.ID,
		Title:      c.Title,
		InviteCode: c.InviteCode,
		CreatedAt:  c.CreatedAt,
	}
}

func toCourseDomain(m *courseModel) *domain.Course {
	if m == nil {
		return nil
	}
	return &domain.Course{
		ID:         m.ID,
		Title:      m.Title,
		InviteCode: m.InviteCode,
		CreatedAt:  m.CreatedAt,
	}
}

var _ repository.CourseRepository = (*CourseRepository)(nil)

type CourseMemberRepository struct {
	db *gorm.DB
}

func NewCourseMemberRepository(db *gorm.DB) *CourseMemberRepository {
	return &CourseMemberRepository{db: db}
}

func (r *CourseMemberRepository) Create(member *domain.CourseMember) error {
	if member.Status == "" {
		member.Status = domain.MemberStatusApproved
	}
	if member.RequestedAt.IsZero() {
		member.RequestedAt = time.Now().UTC()
	}
	return r.db.Create(toCourseMemberModel(member)).Error
}

func (r *CourseMemberRepository) GetUserRole(courseID, userID string) (domain.CourseRole, error) {
	var m courseMemberModel
	if err := r.db.Where("course_id = ? AND user_id = ?", courseID, userID).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", err
	}
	// Students can access course features only after teacher approval.
	if domain.CourseRole(m.Role) == domain.RoleStudent && domain.CourseMemberStatus(m.Status) != domain.MemberStatusApproved {
		return "", nil
	}
	return domain.CourseRole(m.Role), nil
}

func (r *CourseMemberRepository) Get(courseID, userID string) (*domain.CourseMember, error) {
	var m courseMemberModel
	if err := r.db.Where("course_id = ? AND user_id = ?", courseID, userID).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toCourseMemberDomain(&m), nil
}

func (r *CourseMemberRepository) Update(member *domain.CourseMember) error {
	return r.db.Model(&courseMemberModel{}).
		Where("course_id = ? AND user_id = ?", member.CourseID, member.UserID).
		Update("role", string(member.Role)).Error
}

func (r *CourseMemberRepository) ListByCourse(courseID string) ([]*domain.CourseMember, error) {
	var rows []courseMemberModel
	if err := r.db.Where("course_id = ?", courseID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.CourseMember, 0, len(rows))
	for i := range rows {
		out = append(out, toCourseMemberDomain(&rows[i]))
	}
	return out, nil
}

func (r *CourseMemberRepository) ListByCourseAndStatus(courseID string, status domain.CourseMemberStatus) ([]*domain.CourseMember, error) {
	var rows []courseMemberModel
	if err := r.db.Where("course_id = ? AND status = ?", courseID, string(status)).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.CourseMember, 0, len(rows))
	for i := range rows {
		out = append(out, toCourseMemberDomain(&rows[i]))
	}
	return out, nil
}

func (r *CourseMemberRepository) ListByUser(userID string) ([]*domain.CourseMember, error) {
	var rows []courseMemberModel
	if err := r.db.Where("user_id = ?", userID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.CourseMember, 0, len(rows))
	for i := range rows {
		out = append(out, toCourseMemberDomain(&rows[i]))
	}
	return out, nil
}

func (r *CourseMemberRepository) DeleteByCourse(courseID string) error {
	return r.db.Where("course_id = ?", courseID).Delete(&courseMemberModel{}).Error
}

func (r *CourseMemberRepository) Delete(courseID, userID string) error {
	return r.db.Where("course_id = ? AND user_id = ?", courseID, userID).Delete(&courseMemberModel{}).Error
}

func toCourseMemberModel(m *domain.CourseMember) *courseMemberModel {
	if m == nil {
		return nil
	}
	return &courseMemberModel{
		CourseID:     m.CourseID,
		UserID:       m.UserID,
		Role:         string(m.Role),
		Status:       string(m.Status),
		RequestedAt:  m.RequestedAt,
		DecidedAt:    m.DecidedAt,
		DecidedBy:    m.DecidedBy,
		DecisionNote: m.DecisionNote,
	}
}

func toCourseMemberDomain(m *courseMemberModel) *domain.CourseMember {
	if m == nil {
		return nil
	}
	return &domain.CourseMember{
		CourseID:     m.CourseID,
		UserID:       m.UserID,
		Role:         domain.CourseRole(m.Role),
		Status:       domain.CourseMemberStatus(m.Status),
		RequestedAt:  m.RequestedAt,
		DecidedAt:    m.DecidedAt,
		DecidedBy:    m.DecidedBy,
		DecisionNote: m.DecisionNote,
	}
}

var _ repository.CourseMemberRepository = (*CourseMemberRepository)(nil)
