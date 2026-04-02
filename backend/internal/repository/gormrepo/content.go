package gormrepo

import (
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"

	"gorm.io/gorm"
)

type PostRepository struct{ db *gorm.DB }

func NewPostRepository(db *gorm.DB) *PostRepository { return &PostRepository{db: db} }
func (r *PostRepository) Create(post *domain.Post) error {
	return r.db.Create(toPostModel(post)).Error
}
func (r *PostRepository) GetByID(id string) (*domain.Post, error) {
	var m postModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toPostDomain(&m), nil
}
func (r *PostRepository) ListByCourse(courseID string) ([]*domain.Post, error) {
	var rows []postModel
	if err := r.db.Where("course_id = ?", courseID).Order("created_at desc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.Post, 0, len(rows))
	for i := range rows {
		out = append(out, toPostDomain(&rows[i]))
	}
	return out, nil
}
func (r *PostRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&postModel{}).Error
}
var _ repository.PostRepository = (*PostRepository)(nil)

type MaterialRepository struct{ db *gorm.DB }

func NewMaterialRepository(db *gorm.DB) *MaterialRepository { return &MaterialRepository{db: db} }
func (r *MaterialRepository) Create(material *domain.Material) error {
	return r.db.Create(toMaterialModel(material)).Error
}
func (r *MaterialRepository) GetByID(id string) (*domain.Material, error) {
	var m materialModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toMaterialDomain(&m), nil
}
func (r *MaterialRepository) ListByCourse(courseID string) ([]*domain.Material, error) {
	var rows []materialModel
	if err := r.db.Where("course_id = ?", courseID).Order("created_at desc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.Material, 0, len(rows))
	for i := range rows {
		out = append(out, toMaterialDomain(&rows[i]))
	}
	return out, nil
}
func (r *MaterialRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&materialModel{}).Error
}
var _ repository.MaterialRepository = (*MaterialRepository)(nil)

type AssignmentRepository struct{ db *gorm.DB }

func NewAssignmentRepository(db *gorm.DB) *AssignmentRepository { return &AssignmentRepository{db: db} }
func (r *AssignmentRepository) Create(a *domain.Assignment) error {
	return r.db.Create(toAssignmentModel(a)).Error
}
func (r *AssignmentRepository) GetByID(id string) (*domain.Assignment, error) {
	var m assignmentModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toAssignmentDomain(&m), nil
}
func (r *AssignmentRepository) ListByCourse(courseID string) ([]*domain.Assignment, error) {
	var rows []assignmentModel
	if err := r.db.Where("course_id = ?", courseID).Order("created_at desc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.Assignment, 0, len(rows))
	for i := range rows {
		out = append(out, toAssignmentDomain(&rows[i]))
	}
	return out, nil
}
func (r *AssignmentRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&assignmentModel{}).Error
}

func (r *AssignmentRepository) Update(a *domain.Assignment) error {
	return r.db.Save(toAssignmentModel(a)).Error
}

func (r *AssignmentRepository) ListDueForAutoFinalize(before time.Time) ([]*domain.Assignment, error) {
	var rows []assignmentModel
	err := r.db.Where("team_count > 0 AND deadline IS NOT NULL AND deadline < ? AND deadline_auto_finalized_at IS NULL", before).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Assignment, 0, len(rows))
	for i := range rows {
		out = append(out, toAssignmentDomain(&rows[i]))
	}
	return out, nil
}

var _ repository.AssignmentRepository = (*AssignmentRepository)(nil)

type SubmissionRepository struct{ db *gorm.DB }

func NewSubmissionRepository(db *gorm.DB) *SubmissionRepository { return &SubmissionRepository{db: db} }
func (r *SubmissionRepository) Create(s *domain.Submission) error {
	return r.db.Create(toSubmissionModel(s)).Error
}
func (r *SubmissionRepository) GetByID(id string) (*domain.Submission, error) {
	var m submissionModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toSubmissionDomain(&m), nil
}
func (r *SubmissionRepository) GetByAssignmentAndUser(assignmentID, userID string) (*domain.Submission, error) {
	var m submissionModel
	if err := r.db.Where("assignment_id = ? AND user_id = ?", assignmentID, userID).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toSubmissionDomain(&m), nil
}
func (r *SubmissionRepository) ListByAssignment(assignmentID string) ([]*domain.Submission, error) {
	var rows []submissionModel
	if err := r.db.Where("assignment_id = ?", assignmentID).Order("submitted_at desc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.Submission, 0, len(rows))
	for i := range rows {
		out = append(out, toSubmissionDomain(&rows[i]))
	}
	return out, nil
}
func (r *SubmissionRepository) Update(s *domain.Submission) error {
	return r.db.Model(&submissionModel{}).Where("id = ?", s.ID).Updates(toSubmissionModel(s)).Error
}
func (r *SubmissionRepository) DeleteByAssignment(assignmentID string) error {
	return r.db.Where("assignment_id = ?", assignmentID).Delete(&submissionModel{}).Error
}
var _ repository.SubmissionRepository = (*SubmissionRepository)(nil)

type CommentRepository struct{ db *gorm.DB }

func NewCommentRepository(db *gorm.DB) *CommentRepository { return &CommentRepository{db: db} }
func (r *CommentRepository) Create(c *domain.Comment) error {
	return r.db.Create(toCommentModel(c)).Error
}
func (r *CommentRepository) GetByID(id string) (*domain.Comment, error) {
	var m commentModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toCommentDomain(&m), nil
}
func (r *CommentRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&commentModel{}).Error
}
func (r *CommentRepository) ListByAssignment(assignmentID string) ([]*domain.Comment, error) {
	return r.listBy("assignment_id = ?", assignmentID)
}
func (r *CommentRepository) ListByPost(postID string) ([]*domain.Comment, error) {
	return r.listBy("post_id = ?", postID)
}
func (r *CommentRepository) ListByMaterial(materialID string) ([]*domain.Comment, error) {
	return r.listBy("material_id = ?", materialID)
}
func (r *CommentRepository) DeleteByAssignment(assignmentID string) error {
	return r.db.Where("assignment_id = ?", assignmentID).Delete(&commentModel{}).Error
}
func (r *CommentRepository) DeleteByPost(postID string) error {
	return r.db.Where("post_id = ?", postID).Delete(&commentModel{}).Error
}
func (r *CommentRepository) DeleteByMaterial(materialID string) error {
	return r.db.Where("material_id = ?", materialID).Delete(&commentModel{}).Error
}
func (r *CommentRepository) listBy(query string, arg string) ([]*domain.Comment, error) {
	var rows []commentModel
	if err := r.db.Where(query, arg).Order("created_at asc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.Comment, 0, len(rows))
	for i := range rows {
		out = append(out, toCommentDomain(&rows[i]))
	}
	return out, nil
}
var _ repository.CommentRepository = (*CommentRepository)(nil)

type FileRepository struct{ db *gorm.DB }

func NewFileRepository(db *gorm.DB) *FileRepository { return &FileRepository{db: db} }
func (r *FileRepository) Create(f *domain.File) error {
	return r.db.Create(toFileModel(f)).Error
}
func (r *FileRepository) GetByID(id string) (*domain.File, error) {
	var m fileModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toFileDomain(&m), nil
}
func (r *FileRepository) ListByUser(userID string) ([]*domain.File, error) {
	var rows []fileModel
	if err := r.db.Where("user_id = ?", userID).Order("created_at desc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.File, 0, len(rows))
	for i := range rows {
		out = append(out, toFileDomain(&rows[i]))
	}
	return out, nil
}
var _ repository.FileRepository = (*FileRepository)(nil)

func toPostModel(p *domain.Post) *postModel {
	return &postModel{ID: p.ID, CourseID: p.CourseID, UserID: p.UserID, Title: p.Title, Body: p.Body, Links: p.Links, FileIDs: p.FileIDs, CreatedAt: p.CreatedAt}
}
func toPostDomain(m *postModel) *domain.Post {
	return &domain.Post{ID: m.ID, CourseID: m.CourseID, UserID: m.UserID, Title: m.Title, Body: m.Body, Links: m.Links, FileIDs: m.FileIDs, CreatedAt: m.CreatedAt}
}
func toMaterialModel(m *domain.Material) *materialModel {
	return &materialModel{ID: m.ID, CourseID: m.CourseID, Title: m.Title, Body: m.Body, Links: m.Links, FileIDs: m.FileIDs, CreatedAt: m.CreatedAt}
}
func toMaterialDomain(m *materialModel) *domain.Material {
	return &domain.Material{ID: m.ID, CourseID: m.CourseID, Title: m.Title, Body: m.Body, Links: m.Links, FileIDs: m.FileIDs, CreatedAt: m.CreatedAt}
}
func toAssignmentModel(a *domain.Assignment) *assignmentModel {
	return &assignmentModel{
		ID: a.ID, CourseID: a.CourseID, Title: a.Title, Body: a.Body, Links: a.Links, FileIDs: a.FileIDs,
		Deadline: a.Deadline, MaxGrade: a.MaxGrade,
		AssignmentKind: string(a.AssignmentKind), DesiredTeamSize: a.DesiredTeamSize,
		TeamDistributionType: string(a.TeamDistributionType), TeamCount: a.TeamCount, MaxTeamSize: a.MaxTeamSize,
		TeamSubmissionRule: string(a.TeamSubmissionRule), VoteTieBreak: string(a.VoteTieBreak),
		AllowEarlyFinalization: a.AllowEarlyFinalization, TeamGradingMode: string(a.TeamGradingMode),
		PeerSplitMinPercent: a.PeerSplitMinPercent, PeerSplitMaxPercent: a.PeerSplitMaxPercent,
		RosterLockedAt: a.RosterLockedAt, DeadlineAutoFinalizedAt: a.DeadlineAutoFinalizedAt,
		CreatedAt: a.CreatedAt,
	}
}
func toAssignmentDomain(m *assignmentModel) *domain.Assignment {
	return &domain.Assignment{
		ID: m.ID, CourseID: m.CourseID, Title: m.Title, Body: m.Body, Links: m.Links, FileIDs: m.FileIDs,
		Deadline: m.Deadline, MaxGrade: m.MaxGrade,
		AssignmentKind: domain.AssignmentKind(m.AssignmentKind), DesiredTeamSize: m.DesiredTeamSize,
		TeamDistributionType: domain.TeamDistributionType(m.TeamDistributionType),
		TeamCount: m.TeamCount, MaxTeamSize: m.MaxTeamSize, TeamSubmissionRule: domain.TeamSubmissionRule(m.TeamSubmissionRule),
		VoteTieBreak: domain.VoteTieBreak(m.VoteTieBreak), AllowEarlyFinalization: m.AllowEarlyFinalization,
		TeamGradingMode: domain.TeamGradingMode(m.TeamGradingMode),
		PeerSplitMinPercent: m.PeerSplitMinPercent, PeerSplitMaxPercent: m.PeerSplitMaxPercent,
		RosterLockedAt: m.RosterLockedAt, DeadlineAutoFinalizedAt: m.DeadlineAutoFinalizedAt,
		CreatedAt: m.CreatedAt,
	}
}
func toSubmissionModel(s *domain.Submission) *submissionModel {
	return &submissionModel{
		ID: s.ID, AssignmentID: s.AssignmentID, UserID: s.UserID, Body: s.Body, FileIDs: s.FileIDs,
		SubmittedAt: s.SubmittedAt, Grade: s.Grade, GradeComment: s.GradeComment, IsAttached: s.IsAttached, IsReturned: s.IsReturned,
	}
}
func toSubmissionDomain(m *submissionModel) *domain.Submission {
	return &domain.Submission{
		ID: m.ID, AssignmentID: m.AssignmentID, UserID: m.UserID, Body: m.Body, FileIDs: m.FileIDs,
		SubmittedAt: m.SubmittedAt, Grade: m.Grade, GradeComment: m.GradeComment, IsAttached: m.IsAttached, IsReturned: m.IsReturned,
	}
}
func toCommentModel(c *domain.Comment) *commentModel {
	return &commentModel{
		ID: c.ID, AssignmentID: c.AssignmentID, PostID: c.PostID, MaterialID: c.MaterialID, UserID: c.UserID,
		ParentID: c.ParentID, IsPrivate: c.IsPrivate, Body: c.Body, FileIDs: c.FileIDs, CreatedAt: c.CreatedAt,
	}
}
func toCommentDomain(m *commentModel) *domain.Comment {
	return &domain.Comment{
		ID: m.ID, AssignmentID: m.AssignmentID, PostID: m.PostID, MaterialID: m.MaterialID, UserID: m.UserID,
		ParentID: m.ParentID, IsPrivate: m.IsPrivate, Body: m.Body, FileIDs: m.FileIDs, CreatedAt: m.CreatedAt,
	}
}
func toFileModel(f *domain.File) *fileModel {
	return &fileModel{ID: f.ID, UserID: f.UserID, FileName: f.FileName, FileSize: f.FileSize, MimeType: f.MimeType, CreatedAt: f.CreatedAt}
}
func toFileDomain(m *fileModel) *domain.File {
	return &domain.File{ID: m.ID, UserID: m.UserID, FileName: m.FileName, FileSize: m.FileSize, MimeType: m.MimeType, CreatedAt: m.CreatedAt}
}
