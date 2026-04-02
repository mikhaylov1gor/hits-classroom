package gormrepo

import (
	"hits-classroom/internal/domain"
	"hits-classroom/internal/repository"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *domain.User) error {
	return r.db.Create(toUserModel(user)).Error
}

func (r *UserRepository) ByEmail(email string) (*domain.User, error) {
	var m userModel
	if err := r.db.Where("email = ?", email).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toUserDomain(&m), nil
}

func (r *UserRepository) GetByID(id string) (*domain.User, error) {
	var m userModel
	if err := r.db.Where("id = ?", id).First(&m).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return toUserDomain(&m), nil
}

func (r *UserRepository) Update(user *domain.User) error {
	return r.db.Model(&userModel{}).Where("id = ?", user.ID).Updates(toUserModel(user)).Error
}

func toUserModel(u *domain.User) *userModel {
	if u == nil {
		return nil
	}
	return &userModel{
		ID:           u.ID,
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		FirstName:    u.FirstName,
		LastName:     u.LastName,
		BirthDate:    u.BirthDate,
		CreatedAt:    u.CreatedAt,
	}
}

func toUserDomain(m *userModel) *domain.User {
	if m == nil {
		return nil
	}
	return &domain.User{
		ID:           m.ID,
		Email:        m.Email,
		PasswordHash: m.PasswordHash,
		FirstName:    m.FirstName,
		LastName:     m.LastName,
		BirthDate:    m.BirthDate,
		CreatedAt:    m.CreatedAt,
	}
}

var _ repository.UserRepository = (*UserRepository)(nil)
