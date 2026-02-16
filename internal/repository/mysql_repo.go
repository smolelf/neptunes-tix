package repository

import (
	"neptunes-tix/internal/domain"

	"gorm.io/gorm"
)

type mysqlRepo struct {
	db *gorm.DB
}

func NewMySQLRepo(db *gorm.DB) domain.TicketRepository {
	return &mysqlRepo{db: db}
}

func (m *mysqlRepo) CreateUser(u *domain.User) error {
	return m.db.Create(u).Error
}

func (m *mysqlRepo) GetUserWithTickets(id string) (*domain.User, error) {
	var user domain.User
	// Preload "Tickets" is like Laravel's "with('tickets')"
	err := m.db.Preload("Tickets").First(&user, id).Error
	return &user, err
}

func (m *mysqlRepo) Create(t *domain.Ticket) error {
	return m.db.Create(t).Error
}

func (m *mysqlRepo) GetAll(limit int, offset int) ([]domain.Ticket, int64, error) {
	var tickets []domain.Ticket
	var total int64

	// 1. Count total records (ignoring limit/offset)
	m.db.Model(&domain.Ticket{}).Count(&total)

	// 2. Get the actual data
	if limit <= 0 {
		limit = 10
	}
	err := m.db.Limit(limit).Offset(offset).Find(&tickets).Error

	return tickets, total, err
}

func (m *mysqlRepo) Update(t *domain.Ticket) error {
	return m.db.Save(t).Error
}

func (m *mysqlRepo) GetByID(id string) (*domain.Ticket, error) {
	var ticket domain.Ticket
	err := m.db.First(&ticket, id).Error
	return &ticket, err
}

func (m *mysqlRepo) Delete(id string) error {
	return m.db.Delete(&domain.Ticket{}, id).Error
}

func (m *mysqlRepo) GetUserByEmail(email string) (*domain.User, error) {
	var user domain.User
	err := m.db.Where("email = ?", email).First(&user).Error
	return &user, err
}

func (m *mysqlRepo) SearchCustomerByName(name string) ([]domain.User, error) {
	var users []domain.User
	// We use .Select() to only grab ID and Name, leaving out Email/Password
	err := m.db.Select("id", "name", "email", "role").Where("name LIKE ?", "%"+name+"%").Find(&users).Error
	return users, err
}

func (m *mysqlRepo) UpdateUser(user *domain.User) error {
	// .Updates only changes non-blank fields provided in the struct
	return m.db.Save(user).Error
}
