package domain

import "time"

type User struct {
	ID           string
	Email        string
	PasswordHash string
	FirstName    string
	LastName     string
	BirthDate    time.Time
	CreatedAt    time.Time
}
