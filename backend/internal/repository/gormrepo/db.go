package gormrepo

import (
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func OpenFromEnv() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=hits_classroom port=5432 sslmode=disable TimeZone=UTC"
	}
	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}

func AutoMigrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&userModel{},
		&courseModel{},
		&courseMemberModel{},
		&postModel{},
		&materialModel{},
		&assignmentModel{},
		&submissionModel{},
		&commentModel{},
		&fileModel{},
		&teamModel{},
		&teamMemberModel{},
		&teamSubmissionVoteModel{},
		&teamSubmissionLikeModel{},
		&teamPeerGradeModel{},
		&teamAuditModel{},
	); err != nil {
		return err
	}
	// Keep voting uniqueness scoped to assignment+team+voter.
	// Older schema versions had unique(voter_id), causing 500 on second vote in another team/assignment.
	if db.Migrator().HasIndex(&teamSubmissionVoteModel{}, "ux_vote_per_user") {
		if err := db.Migrator().DropIndex(&teamSubmissionVoteModel{}, "ux_vote_per_user"); err != nil {
			return err
		}
	}
	if err := db.Migrator().CreateIndex(&teamSubmissionVoteModel{}, "ux_vote_per_user"); err != nil {
		return err
	}
	return nil
}
