package usecase

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

func tryTeamAudit(repo repository.TeamAuditRepository, assignmentID, teamID, actorID string, typ domain.TeamAuditEventType, payload map[string]string) {
	if repo == nil {
		return
	}
	b, _ := json.Marshal(payload)
	_ = repo.Append(&domain.TeamAuditEvent{
		ID:           uuid.NewString(),
		AssignmentID: assignmentID,
		TeamID:       teamID,
		ActorUserID:  actorID,
		EventType:    typ,
		Payload:      string(b),
		CreatedAt:    time.Now().UTC(),
	})
}
