package repository

import "hits-classroom/internal/domain"

type UserRepository interface {
	Create(user *domain.User) error
	ByEmail(email string) (*domain.User, error)
}
