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

func (m *mysqlRepo) Create(t *domain.Ticket) error {
	return m.db.Create(t).Error
}

func (m *mysqlRepo) GetAll() ([]domain.Ticket, error) {
	var tickets []domain.Ticket
	err := m.db.Find(&tickets).Error
	return tickets, err
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
