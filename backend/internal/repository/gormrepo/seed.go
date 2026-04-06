package gormrepo

import (
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type seedUser struct {
	ID        string
	Email     string
	Password  string
	FirstName string
	LastName  string
	BirthDate time.Time
}

// SeedDemoData populates a deterministic demo dataset.
// It is safe to run on each startup: rows are inserted/updated without duplicates.
func SeedDemoData(db *gorm.DB) error {
	now := time.Now().UTC()

	users := []seedUser{
		{
			ID:        "11111111-1111-1111-1111-111111111111",
			Email:     "admin@hits.local",
			Password:  "Admin123!",
			FirstName: "Admin",
			LastName:  "Owner",
			BirthDate: time.Date(1995, 1, 10, 0, 0, 0, 0, time.UTC),
		},
		{
			ID:        "22222222-2222-2222-2222-222222222222",
			Email:     "teacher1@hits.local",
			Password:  "Teacher123!",
			FirstName: "Ivan",
			LastName:  "Petrov",
			BirthDate: time.Date(1990, 4, 12, 0, 0, 0, 0, time.UTC),
		},
		{
			ID:        "33333333-3333-3333-3333-333333333333",
			Email:     "teacher2@hits.local",
			Password:  "Teacher123!",
			FirstName: "Anna",
			LastName:  "Sidorova",
			BirthDate: time.Date(1992, 8, 24, 0, 0, 0, 0, time.UTC),
		},
		{
			ID:        "44444444-4444-4444-4444-444444444444",
			Email:     "student1@hits.local",
			Password:  "Student123!",
			FirstName: "Nikita",
			LastName:  "Smirnov",
			BirthDate: time.Date(2004, 3, 5, 0, 0, 0, 0, time.UTC),
		},
		{
			ID:        "55555555-5555-5555-5555-555555555555",
			Email:     "student2@hits.local",
			Password:  "Student123!",
			FirstName: "Maria",
			LastName:  "Volkova",
			BirthDate: time.Date(2003, 11, 2, 0, 0, 0, 0, time.UTC),
		},
		{
			ID:        "66666666-6666-6666-6666-666666666666",
			Email:     "student3@hits.local",
			Password:  "Student123!",
			FirstName: "Daniil",
			LastName:  "Kuznetsov",
			BirthDate: time.Date(2004, 6, 18, 0, 0, 0, 0, time.UTC),
		},
		{
			ID:        "77777777-7777-7777-7777-777777777777",
			Email:     "student4@hits.local",
			Password:  "Student123!",
			FirstName: "Elena",
			LastName:  "Orlova",
			BirthDate: time.Date(2005, 1, 22, 0, 0, 0, 0, time.UTC),
		},
	}

	userIDs := map[string]string{}
	for _, u := range users {
		id, err := upsertSeedUser(db, u, now)
		if err != nil {
			return err
		}
		userIDs[u.Email] = id
	}

	course := courseModel{
		ID:         "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		Title:      "Demo Course: Team Assignments",
		InviteCode: "SEED-GO-2026",
		CreatedAt:  now,
	}
	if err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"title":       course.Title,
			"invite_code": course.InviteCode,
		}),
	}).Create(&course).Error; err != nil {
		return err
	}

	members := []courseMemberModel{
		{CourseID: course.ID, UserID: userIDs["admin@hits.local"], Role: "owner"},
		{CourseID: course.ID, UserID: userIDs["teacher1@hits.local"], Role: "teacher"},
		{CourseID: course.ID, UserID: userIDs["teacher2@hits.local"], Role: "teacher"},
		{CourseID: course.ID, UserID: userIDs["student1@hits.local"], Role: "student"},
		{CourseID: course.ID, UserID: userIDs["student2@hits.local"], Role: "student"},
		{CourseID: course.ID, UserID: userIDs["student3@hits.local"], Role: "student"},
		{CourseID: course.ID, UserID: userIDs["student4@hits.local"], Role: "student"},
	}
	for _, m := range members {
		if err := db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "course_id"}, {Name: "user_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"role": m.Role,
			}),
		}).Create(&m).Error; err != nil {
			return err
		}
	}

	individualDeadline := now.AddDate(0, 0, 10)
	groupFreeDeadline := now.AddDate(0, 0, 14)
	groupVoteDeadline := now.AddDate(0, 0, 20)

	assignments := []assignmentModel{
		{
			ID:                     "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
			CourseID:               course.ID,
			Title:                  "Individual: SQL Basics",
			Body:                   "Solve individual SQL tasks and upload your solution.",
			Links:                  []string{},
			FileIDs:                []string{},
			Deadline:               &individualDeadline,
			MaxGrade:               100,
			AssignmentKind:         "individual",
			DesiredTeamSize:        0,
			TeamDistributionType:   "free",
			TeamCount:              0,
			MaxTeamSize:            0,
			TeamSubmissionRule:     "first_submission",
			VoteTieBreak:           "highest_author_average",
			AllowEarlyFinalization: true,
			TeamGradingMode:        "individual",
			PeerSplitMinPercent:    0,
			PeerSplitMaxPercent:    0,
			CreatedAt:              now,
		},
		{
			ID:                     "cccccccc-cccc-cccc-cccc-cccccccccccc",
			CourseID:               course.ID,
			Title:                  "Group: API Design (free teams)",
			Body:                   "Create API contract in teams. Students create/join teams by themselves.",
			Links:                  []string{},
			FileIDs:                []string{},
			Deadline:               &groupFreeDeadline,
			MaxGrade:               100,
			AssignmentKind:         "group",
			DesiredTeamSize:        2,
			TeamDistributionType:   "free",
			TeamCount:              2,
			MaxTeamSize:            2,
			TeamSubmissionRule:     "last_submission",
			VoteTieBreak:           "highest_author_average",
			AllowEarlyFinalization: true,
			TeamGradingMode:        "team_uniform",
			PeerSplitMinPercent:    0,
			PeerSplitMaxPercent:    0,
			CreatedAt:              now,
		},
		{
			ID:                     "dddddddd-dddd-dddd-dddd-dddddddddddd",
			CourseID:               course.ID,
			Title:                  "Group: Final Project (vote + peer split)",
			Body:                   "Teams vote for best submission and teacher grades with peer split.",
			Links:                  []string{},
			FileIDs:                []string{},
			Deadline:               &groupVoteDeadline,
			MaxGrade:               100,
			AssignmentKind:         "group",
			DesiredTeamSize:        2,
			TeamDistributionType:   "balanced",
			TeamCount:              2,
			MaxTeamSize:            2,
			TeamSubmissionRule:     "vote_weighted",
			VoteTieBreak:           "highest_author_average",
			AllowEarlyFinalization: false,
			TeamGradingMode:        "team_peer_split",
			PeerSplitMinPercent:    10,
			PeerSplitMaxPercent:    70,
			CreatedAt:              now,
		},
	}
	for _, a := range assignments {
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			UpdateAll: true,
		}).Create(&a).Error; err != nil {
			return err
		}
	}

	return nil
}

func upsertSeedUser(db *gorm.DB, u seedUser, now time.Time) (string, error) {
	var existing userModel
	err := db.Where("email = ?", u.Email).First(&existing).Error
	hash, hashErr := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if hashErr != nil {
		return "", hashErr
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := userModel{
			ID:           u.ID,
			Email:        u.Email,
			PasswordHash: string(hash),
			FirstName:    u.FirstName,
			LastName:     u.LastName,
			BirthDate:    u.BirthDate,
			CreatedAt:    now,
		}
		if createErr := db.Create(&row).Error; createErr != nil {
			return "", createErr
		}
		return row.ID, nil
	}
	if err != nil {
		return "", err
	}

	update := map[string]interface{}{
		"password_hash": string(hash),
		"first_name":    u.FirstName,
		"last_name":     u.LastName,
		"birth_date":    u.BirthDate,
	}
	if updateErr := db.Model(&userModel{}).Where("id = ?", existing.ID).Updates(update).Error; updateErr != nil {
		return "", updateErr
	}
	return existing.ID, nil
}
