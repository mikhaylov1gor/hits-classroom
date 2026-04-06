# Backend Seed Data

This project now seeds demo data on backend startup (idempotent upsert).

## How it works

- Seed runs in `api/main.go` right after DB migrations.
- Disable seeding with env var: `SEED_DEMO_DATA=false`.
- Repeated starts do not create duplicates; existing seeded rows are updated.

## Seeded Users (login/password)

- **Admin (course owner)**: `admin@hits.local` / `Admin123!`
- **Teacher 1**: `teacher1@hits.local` / `Teacher123!`
- **Teacher 2**: `teacher2@hits.local` / `Teacher123!`
- **Student 1**: `student1@hits.local` / `Student123!`
- **Student 2**: `student2@hits.local` / `Student123!`
- **Student 3**: `student3@hits.local` / `Student123!`
- **Student 4**: `student4@hits.local` / `Student123!`

## Seeded Course

- **Title**: `Demo Course: Team Assignments`
- **Invite code**: `SEED-GO-2026`

Course membership:
- owner: `admin@hits.local`
- teachers: `teacher1@hits.local`, `teacher2@hits.local`
- students: `student1@hits.local`, `student2@hits.local`, `student3@hits.local`, `student4@hits.local`

## Seeded Assignments

1. **Individual: SQL Basics**
   - `assignment_kind`: `individual`
   - `team_grading_mode`: `individual`

2. **Group: API Design (free teams)**
   - `assignment_kind`: `group`
   - `team_distribution_type`: `free`
   - `desired_team_size`: `2`
   - `team_submission_rule`: `last_submission`
   - `team_grading_mode`: `team_uniform`

3. **Group: Final Project (vote + peer split)**
   - `assignment_kind`: `group`
   - `team_distribution_type`: `balanced`
   - `desired_team_size`: `2`
   - `team_submission_rule`: `vote_weighted`
   - `vote_tie_break`: `highest_author_average`
   - `allow_early_finalization`: `false`
   - `team_grading_mode`: `team_peer_split`
   - `peer_split_min_percent`: `10`
   - `peer_split_max_percent`: `70`
