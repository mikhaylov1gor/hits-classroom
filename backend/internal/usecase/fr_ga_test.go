package usecase

import (
	"testing"
	"time"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository/memory"
)

func TestResolveVoteWinner_RandomTieIsDeterministic(t *testing.T) {
	a := &domain.Assignment{
		ID:           "assignment-1",
		VoteTieBreak: domain.VoteTieBreakRandom,
	}
	subs := []*domain.Submission{
		{ID: "sub-b", UserID: "u1"},
		{ID: "sub-a", UserID: "u2"},
	}
	memberSet := map[string]bool{"u1": true, "u2": true}
	scores := map[string]float64{"sub-a": 2, "sub-b": 2}
	w1 := resolveVoteWinner(a, "course-1", a.ID, "team-1", scores, subs, memberSet, nil, nil, map[string]int{})
	w2 := resolveVoteWinner(a, "course-1", a.ID, "team-1", scores, subs, memberSet, nil, nil, map[string]int{})
	if w1 != w2 {
		t.Fatalf("expected same winner, got %q and %q", w1, w2)
	}
	if w1 != "sub-a" && w1 != "sub-b" {
		t.Fatalf("unexpected winner %q", w1)
	}
}

func TestResolveVoteWinner_HighestAuthorUsesAverage(t *testing.T) {
	assignRepo := memory.NewAssignmentRepository()
	subRepo := memory.NewSubmissionRepository()
	courseID := "c1"
	ts := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	oldA := &domain.Assignment{
		ID: "old", CourseID: courseID, Title: "Old", Body: "x", MaxGrade: 100,
		CreatedAt: ts,
	}
	if err := assignRepo.Create(oldA); err != nil {
		t.Fatal(err)
	}
	g80 := 80
	g20 := 20
	if err := subRepo.Create(&domain.Submission{
		ID: "os1", AssignmentID: oldA.ID, UserID: "uhi", Body: "", SubmittedAt: ts,
		Grade: &g80, IsAttached: true,
	}); err != nil {
		t.Fatal(err)
	}
	if err := subRepo.Create(&domain.Submission{
		ID: "os2", AssignmentID: oldA.ID, UserID: "ulo", Body: "", SubmittedAt: ts,
		Grade: &g20, IsAttached: true,
	}); err != nil {
		t.Fatal(err)
	}
	a := &domain.Assignment{ID: "new", VoteTieBreak: domain.VoteTieBreakHighestAuthorAverage}
	subs := []*domain.Submission{
		{ID: "s1", UserID: "ulo"},
		{ID: "s2", UserID: "uhi"},
	}
	memberSet := map[string]bool{"uhi": true, "ulo": true}
	scores := map[string]float64{"s1": 1, "s2": 1}
	w := resolveVoteWinner(a, courseID, a.ID, "t1", scores, subs, memberSet, assignRepo, subRepo, map[string]int{})
	if w != "s2" {
		t.Fatalf("expected higher-average author uhi (s2), got %q", w)
	}
}
