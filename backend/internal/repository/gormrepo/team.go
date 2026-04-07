package gormrepo

import (
	"time"

	"github.com/google/uuid"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"

	"gorm.io/gorm"
)

type TeamRepository struct{ db *gorm.DB }

func NewTeamRepository(db *gorm.DB) *TeamRepository { return &TeamRepository{db: db} }
func (r *TeamRepository) Create(t *domain.Team) error {
	return r.db.Create(&teamModel{
		ID: t.ID, AssignmentID: t.AssignmentID, CreatorID: t.CreatorID, Name: t.Name, MaxMembers: t.MaxMembers, CreatedAt: t.CreatedAt,
	}).Error
}
func (r *TeamRepository) GetByID(id string) (*domain.Team, error) {
	var m teamModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toTeamDomain(&m), nil
}
func (r *TeamRepository) ListByAssignment(assignmentID string) ([]*domain.Team, error) {
	var rows []teamModel
	if err := r.db.Where("assignment_id = ?", assignmentID).Order("created_at asc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.Team, 0, len(rows))
	for i := range rows {
		out = append(out, toTeamDomain(&rows[i]))
	}
	return out, nil
}
func (r *TeamRepository) DeleteByAssignment(assignmentID string) error {
	return r.db.Where("assignment_id = ?", assignmentID).Delete(&teamModel{}).Error
}
func (r *TeamRepository) ReplaceAssignmentTeams(assignmentID string, teams []*domain.Team, teamMembers map[string][]string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("assignment_id = ?", assignmentID).Delete(&teamSubmissionVoteModel{}).Error; err != nil {
			return err
		}
		if err := tx.Where("team_id IN (SELECT id FROM team_models WHERE assignment_id = ?)", assignmentID).Delete(&teamMemberModel{}).Error; err != nil {
			return err
		}
		if err := tx.Where("assignment_id = ?", assignmentID).Delete(&teamModel{}).Error; err != nil {
			return err
		}
		for _, t := range teams {
			if err := tx.Create(&teamModel{
				ID: t.ID, AssignmentID: t.AssignmentID, CreatorID: t.CreatorID, Name: t.Name, MaxMembers: t.MaxMembers, CreatedAt: t.CreatedAt,
			}).Error; err != nil {
				return err
			}
		}
		for teamID, members := range teamMembers {
			for _, userID := range members {
				if err := tx.Create(&teamMemberModel{
					TeamID: teamID, UserID: userID, JoinedAt: time.Now().UTC(),
				}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

var _ repository.TeamRepository = (*TeamRepository)(nil)

type TeamMemberRepository struct{ db *gorm.DB }

func NewTeamMemberRepository(db *gorm.DB) *TeamMemberRepository { return &TeamMemberRepository{db: db} }
func (r *TeamMemberRepository) Create(m *domain.TeamMember) error {
	return r.db.Create(&teamMemberModel{TeamID: m.TeamID, UserID: m.UserID, JoinedAt: m.JoinedAt}).Error
}
func (r *TeamMemberRepository) Delete(teamID, userID string) error {
	return r.db.Where("team_id = ? AND user_id = ?", teamID, userID).Delete(&teamMemberModel{}).Error
}
func (r *TeamMemberRepository) DeleteByTeam(teamID string) error {
	return r.db.Where("team_id = ?", teamID).Delete(&teamMemberModel{}).Error
}
func (r *TeamMemberRepository) DeleteByAssignment(assignmentID string) error {
	return r.db.Where("team_id IN (SELECT id FROM team_models WHERE assignment_id = ?)", assignmentID).Delete(&teamMemberModel{}).Error
}
func (r *TeamMemberRepository) ListByTeam(teamID string) ([]*domain.TeamMember, error) {
	var rows []teamMemberModel
	if err := r.db.Where("team_id = ?", teamID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.TeamMember, 0, len(rows))
	for i := range rows {
		out = append(out, &domain.TeamMember{TeamID: rows[i].TeamID, UserID: rows[i].UserID, JoinedAt: rows[i].JoinedAt})
	}
	return out, nil
}
func (r *TeamMemberRepository) ListByAssignment(assignmentID string) ([]*domain.TeamMember, error) {
	var rows []teamMemberModel
	if err := r.db.Table("team_member_models tm").
		Select("tm.*").
		Joins("JOIN team_models t ON t.id = tm.team_id").
		Where("t.assignment_id = ?", assignmentID).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.TeamMember, 0, len(rows))
	for i := range rows {
		out = append(out, &domain.TeamMember{TeamID: rows[i].TeamID, UserID: rows[i].UserID, JoinedAt: rows[i].JoinedAt})
	}
	return out, nil
}
func (r *TeamMemberRepository) GetTeamByUser(assignmentID, userID string) (*domain.Team, error) {
	var m teamModel
	err := r.db.Table("team_models t").
		Select("t.*").
		Joins("JOIN team_member_models tm ON tm.team_id = t.id").
		Where("t.assignment_id = ? AND tm.user_id = ?", assignmentID, userID).
		First(&m).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toTeamDomain(&m), nil
}

var _ repository.TeamMemberRepository = (*TeamMemberRepository)(nil)

type TeamVoteRepository struct{ db *gorm.DB }

func NewTeamVoteRepository(db *gorm.DB) *TeamVoteRepository { return &TeamVoteRepository{db: db} }
func (r *TeamVoteRepository) Upsert(v *domain.TeamSubmissionVote) error {
	return r.db.Where("assignment_id = ? AND team_id = ? AND voter_id = ?", v.AssignmentID, v.TeamID, v.VoterID).
		Assign(&teamSubmissionVoteModel{
			ID: v.ID, AssignmentID: v.AssignmentID, TeamID: v.TeamID, SubmissionID: v.SubmissionID, VoterID: v.VoterID, Weight: v.Weight, CreatedAt: time.Now().UTC(),
		}).
		FirstOrCreate(&teamSubmissionVoteModel{}).Error
}
func (r *TeamVoteRepository) ListByTeam(assignmentID, teamID string) ([]*domain.TeamSubmissionVote, error) {
	var rows []teamSubmissionVoteModel
	if err := r.db.Where("assignment_id = ? AND team_id = ?", assignmentID, teamID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.TeamSubmissionVote, 0, len(rows))
	for i := range rows {
		out = append(out, &domain.TeamSubmissionVote{
			ID: rows[i].ID, AssignmentID: rows[i].AssignmentID, TeamID: rows[i].TeamID, SubmissionID: rows[i].SubmissionID, VoterID: rows[i].VoterID, Weight: rows[i].Weight, CreatedAt: rows[i].CreatedAt,
		})
	}
	return out, nil
}
func (r *TeamVoteRepository) DeleteByAssignment(assignmentID string) error {
	return r.db.Where("assignment_id = ?", assignmentID).Delete(&teamSubmissionVoteModel{}).Error
}

var _ repository.TeamVoteRepository = (*TeamVoteRepository)(nil)

type TeamSubmissionLikeRepository struct{ db *gorm.DB }

func NewTeamSubmissionLikeRepository(db *gorm.DB) *TeamSubmissionLikeRepository {
	return &TeamSubmissionLikeRepository{db: db}
}

func (r *TeamSubmissionLikeRepository) Toggle(assignmentID, teamID, submissionID, userID string) (bool, error) {
	var row teamSubmissionLikeModel
	err := r.db.Where("assignment_id = ? AND team_id = ? AND submission_id = ? AND user_id = ?", assignmentID, teamID, submissionID, userID).
		First(&row).Error
	if err == nil {
		if derr := r.db.Delete(&row).Error; derr != nil {
			return false, derr
		}
		return false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return false, err
	}
	row = teamSubmissionLikeModel{
		ID:           uuid.NewString(),
		AssignmentID: assignmentID,
		TeamID:       teamID,
		SubmissionID: submissionID,
		UserID:       userID,
		CreatedAt:    time.Now().UTC(),
	}
	if cerr := r.db.Create(&row).Error; cerr != nil {
		return false, cerr
	}
	return true, nil
}

func (r *TeamSubmissionLikeRepository) ListByTeam(assignmentID, teamID string) ([]*domain.TeamSubmissionLike, error) {
	var rows []teamSubmissionLikeModel
	if err := r.db.Where("assignment_id = ? AND team_id = ?", assignmentID, teamID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.TeamSubmissionLike, 0, len(rows))
	for i := range rows {
		out = append(out, &domain.TeamSubmissionLike{
			ID: rows[i].ID, AssignmentID: rows[i].AssignmentID, TeamID: rows[i].TeamID,
			SubmissionID: rows[i].SubmissionID, UserID: rows[i].UserID, CreatedAt: rows[i].CreatedAt,
		})
	}
	return out, nil
}

func (r *TeamSubmissionLikeRepository) DeleteByAssignment(assignmentID string) error {
	return r.db.Where("assignment_id = ?", assignmentID).Delete(&teamSubmissionLikeModel{}).Error
}

var _ repository.TeamSubmissionLikeRepository = (*TeamSubmissionLikeRepository)(nil)

func toTeamDomain(m *teamModel) *domain.Team {
	return &domain.Team{
		ID: m.ID, AssignmentID: m.AssignmentID, CreatorID: m.CreatorID, Name: m.Name, MaxMembers: m.MaxMembers, CreatedAt: m.CreatedAt,
	}
}
