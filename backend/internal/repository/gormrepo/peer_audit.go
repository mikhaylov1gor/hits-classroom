package gormrepo

import (
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"

	"gorm.io/gorm"
)

type TeamPeerGradeRepository struct{ db *gorm.DB }

func NewTeamPeerGradeRepository(db *gorm.DB) *TeamPeerGradeRepository {
	return &TeamPeerGradeRepository{db: db}
}

func (r *TeamPeerGradeRepository) ReplaceTeamAllocations(assignmentID, teamID string, rows []*domain.TeamPeerGradeAllocation) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("assignment_id = ? AND team_id = ?", assignmentID, teamID).Delete(&teamPeerGradeModel{}).Error; err != nil {
			return err
		}
		for _, row := range rows {
			m := &teamPeerGradeModel{
				ID: row.ID, AssignmentID: row.AssignmentID, TeamID: row.TeamID, UserID: row.UserID,
				Percent: row.Percent, UpdatedAt: row.UpdatedAt,
			}
			if err := tx.Create(m).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *TeamPeerGradeRepository) ListByTeam(assignmentID, teamID string) ([]*domain.TeamPeerGradeAllocation, error) {
	var rows []teamPeerGradeModel
	if err := r.db.Where("assignment_id = ? AND team_id = ?", assignmentID, teamID).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.TeamPeerGradeAllocation, 0, len(rows))
	for i := range rows {
		out = append(out, &domain.TeamPeerGradeAllocation{
			ID: rows[i].ID, AssignmentID: rows[i].AssignmentID, TeamID: rows[i].TeamID, UserID: rows[i].UserID,
			Percent: rows[i].Percent, UpdatedAt: rows[i].UpdatedAt,
		})
	}
	return out, nil
}

func (r *TeamPeerGradeRepository) DeleteByAssignment(assignmentID string) error {
	return r.db.Where("assignment_id = ?", assignmentID).Delete(&teamPeerGradeModel{}).Error
}

var _ repository.TeamPeerGradeRepository = (*TeamPeerGradeRepository)(nil)

type TeamAuditRepository struct{ db *gorm.DB }

func NewTeamAuditRepository(db *gorm.DB) *TeamAuditRepository {
	return &TeamAuditRepository{db: db}
}

func (r *TeamAuditRepository) Append(e *domain.TeamAuditEvent) error {
	m := &teamAuditModel{
		ID: e.ID, AssignmentID: e.AssignmentID, TeamID: e.TeamID, ActorUserID: e.ActorUserID,
		EventType: string(e.EventType), Payload: e.Payload, CreatedAt: e.CreatedAt,
	}
	return r.db.Create(m).Error
}

func (r *TeamAuditRepository) DeleteByAssignment(assignmentID string) error {
	return r.db.Where("assignment_id = ?", assignmentID).Delete(&teamAuditModel{}).Error
}

func (r *TeamAuditRepository) ListByAssignment(assignmentID string, teamID *string, limit, offset int) ([]*domain.TeamAuditEvent, error) {
	q := r.db.Where("assignment_id = ?", assignmentID)
	if teamID != nil && *teamID != "" {
		q = q.Where("team_id = ?", *teamID)
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	var rows []teamAuditModel
	if err := q.Order("created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domain.TeamAuditEvent, 0, len(rows))
	for i := range rows {
		out = append(out, &domain.TeamAuditEvent{
			ID: rows[i].ID, AssignmentID: rows[i].AssignmentID, TeamID: rows[i].TeamID, ActorUserID: rows[i].ActorUserID,
			EventType: domain.TeamAuditEventType(rows[i].EventType), Payload: rows[i].Payload, CreatedAt: rows[i].CreatedAt,
		})
	}
	return out, nil
}

var _ repository.TeamAuditRepository = (*TeamAuditRepository)(nil)
