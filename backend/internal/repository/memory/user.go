package memory

import (
	"sync"

	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"
)

type UserRepository struct {
	mu      sync.RWMutex
	byID    map[string]*domain.User
	byEmail map[string]*domain.User
}

func NewUserRepository() *UserRepository {
	return &UserRepository{
		byID:    make(map[string]*domain.User),
		byEmail: make(map[string]*domain.User),
	}
}

func (r *UserRepository) Create(user *domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byID[user.ID] = user
	r.byEmail[user.Email] = user
	return nil
}

func (r *UserRepository) ByEmail(email string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.byEmail[email]
	if !ok {
		return nil, nil
	}
	return u, nil
}

func (r *UserRepository) GetByID(id string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID[id], nil
}

func (r *UserRepository) Update(user *domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if old, ok := r.byID[user.ID]; ok {
		delete(r.byEmail, old.Email)
	}
	r.byID[user.ID] = user
	r.byEmail[user.Email] = user
	return nil
}

var _ repository.UserRepository = (*UserRepository)(nil)
