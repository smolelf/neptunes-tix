package repository

import (
	"neptunes-tix/internal/domain"

	"gorm.io/gorm"
)

type mysqlRepo struct {
	db *gorm.DB
}

func NewMySQLRepo(db *gorm.DB) *mysqlRepo {
	return &mysqlRepo{db: db}
}

func (m *mysqlRepo) CreateUser(user *domain.User) error {
	return m.db.Create(user).Error
}

func (m *mysqlRepo) UpdateUser(user *domain.User) error {
	return m.db.Save(user).Error
}

func (m *mysqlRepo) CreateTicket(ticket *domain.Ticket) error {
	return m.db.Create(ticket).Error
}

func (m *mysqlRepo) UpdateTicket(ticket *domain.Ticket) error {
	return m.db.Save(ticket).Error
}

func (m *mysqlRepo) GetUserWithTickets(id string) (*domain.User, error) {
	var user domain.User
	// Preload "Tickets" is like Laravel's "with('tickets')"
	err := m.db.Preload("Tickets").First(&user, id).Error
	return &user, err
}

func (m *mysqlRepo) GetAll(limit int, offset int, category string, available bool) ([]domain.Ticket, int64, error) {
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

// For Tickets
func (m *mysqlRepo) GetByID(id string) (*domain.Ticket, error) {
	var ticket domain.Ticket
	err := m.db.First(&ticket, id).Error
	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

// For Users
func (m *mysqlRepo) GetUserByID(id string) (*domain.User, error) {
	var user domain.User
	err := m.db.First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

//TICKET DELETION STARTS HERE

func (m *mysqlRepo) Delete(id string) error {
	return m.db.Delete(&domain.Ticket{}, id).Error
}

func (m *mysqlRepo) GetDeletedTickets() ([]domain.Ticket, error) {
	var tickets []domain.Ticket
	// Unscoped() tells GORM to ignore the deleted_at filter
	err := m.db.Unscoped().Where("deleted_at IS NOT NULL").Find(&tickets).Error
	return tickets, err
}

//TICKET DELETION ENDS HERE

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

func (m *mysqlRepo) GetStats() (map[string]interface{}, error) {
	var totalTickets, soldTickets, checkedIn int64
	var revenue float64

	m.db.Model(&domain.Ticket{}).Count(&totalTickets)
	m.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Count(&soldTickets)
	m.db.Model(&domain.Ticket{}).Where("checked_in_at IS NOT NULL").Count(&checkedIn)

	// Sum revenue from sold tickets
	m.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Select("COALESCE(SUM(price), 0)").Scan(&revenue)

	return map[string]interface{}{
		"total_tickets":   totalTickets,
		"sold_tickets":    soldTickets,
		"checked_in":      checkedIn,
		"total_revenue":   revenue,
		"sales_occupancy": float64(soldTickets) / float64(totalTickets) * 100,
	}, nil
}

func (m *mysqlRepo) GetUserTickets(userID uint) ([]domain.Ticket, error) {
	var tickets []domain.Ticket
	err := m.db.Where("user_id = ?", userID).Find(&tickets).Error
	return tickets, err
}

func (m *mysqlRepo) Transaction(fn func(domain.TicketRepository) error) error {
	return m.db.Transaction(func(tx *gorm.DB) error {
		// Create a temporary repository using the "Transaction" instance of DB
		txRepo := &mysqlRepo{db: tx}
		return fn(txRepo)
	})
}
