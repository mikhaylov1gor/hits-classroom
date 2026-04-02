package main

import (
	"log"
	"time"

	"hits-classroom/internal/repository/gormrepo"
	"hits-classroom/internal/usecase"
)

func main() {
	db, err := gormrepo.OpenFromEnv()
	if err != nil {
		log.Fatal(err)
	}
	if err := gormrepo.AutoMigrate(db); err != nil {
		log.Fatal(err)
	}
	assignmentRepo := gormrepo.NewAssignmentRepository(db)
	teamRepo := gormrepo.NewTeamRepository(db)
	teamMemberRepo := gormrepo.NewTeamMemberRepository(db)
	submissionRepo := gormrepo.NewSubmissionRepository(db)
	teamVoteRepo := gormrepo.NewTeamVoteRepository(db)
	teamAuditRepo := gormrepo.NewTeamAuditRepository(db)
	memberRepo := gormrepo.NewCourseMemberRepository(db)

	finalizeVote := usecase.NewFinalizeTeamVoteSubmission(
		memberRepo, assignmentRepo, teamRepo, teamMemberRepo, submissionRepo, teamVoteRepo, teamAuditRepo,
	)
	auto := usecase.NewAutoFinalizeDeadline(
		assignmentRepo, teamRepo, teamMemberRepo, submissionRepo, finalizeVote, teamAuditRepo,
	)
	log.Println("deadline-worker started, tick every 1m")
	t := time.NewTicker(1 * time.Minute)
	defer t.Stop()
	for range t.C {
		if err := auto.Run(time.Now().UTC()); err != nil {
			log.Println("auto finalize:", err)
		}
	}
}
