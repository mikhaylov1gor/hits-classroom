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
	return db.AutoMigrate(
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
		&teamPeerGradeModel{},
		&teamAuditModel{},
	)
}
