package repository

import (
	"neptunes-tix/internal/domain"

	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 1. Defined internal structs for Admin Stats to ensure compilation
type EventStat struct {
	EventID   uint    `json:"event_id"`
	EventName string  `json:"event_name"`
	Revenue   float64 `json:"revenue"`
	Sold      int64   `json:"sold"`
	Scanned   int64   `json:"scanned"`
}

type DashboardStats struct {
	TotalRevenue float64     `json:"total_revenue"`
	TotalSold    int64       `json:"total_sold"`
	TotalScanned int64       `json:"total_scanned"`
	Events       []EventStat `json:"events"`
}

type dbRepo struct {
	db *gorm.DB
}

func NewDBRepo(db *gorm.DB) *dbRepo {
	return &dbRepo{db: db}
}

// --- USER METHODS ---

func (d *dbRepo) CreateUser(user *domain.User) error {
	return d.db.Create(user).Error
}

func (d *dbRepo) UpdateUser(user *domain.User) error {
	return d.db.Save(user).Error
}

func (d *dbRepo) GetUserByID(id string) (*domain.User, error) {
	var user domain.User
	err := d.db.First(&user, id).Error
	return &user, err
}

func (d *dbRepo) GetUserByEmail(email string) (*domain.User, error) {
	var user domain.User
	err := d.db.Where("email = ?", email).First(&user).Error
	return &user, err
}

func (d *dbRepo) GetUserWithTickets(id string) (*domain.User, error) {
	var user domain.User
	err := d.db.Preload("Orders.Tickets.Event").First(&user, id).Error
	return &user, err
}

func (d *dbRepo) SearchCustomerByName(name string) ([]domain.User, error) {
	var users []domain.User
	err := d.db.Select("id", "name", "email", "role").
		Where("name ILIKE ?", "%"+name+"%").Find(&users).Error
	return users, err
}

// --- TICKET CORE METHODS ---

func (d *dbRepo) CreateTicket(ticket *domain.Ticket) error {
	return d.db.Create(ticket).Error
}

func (d *dbRepo) UpdateTicket(ticket *domain.Ticket) error {
	return d.db.Save(ticket).Error
}

func (d *dbRepo) GetByID(id string) (*domain.Ticket, error) {
	var ticket domain.Ticket
	err := d.db.Preload("Event").First(&ticket, id).Error
	return &ticket, err
}

func (d *dbRepo) Delete(id string) error {
	return d.db.Delete(&domain.Ticket{}, id).Error
}

func (d *dbRepo) GetAll(limit int, offset int, category string, available bool, search string) ([]domain.Ticket, int64, error) {
	var tickets []domain.Ticket
	var total int64

	query := d.db.Model(&domain.Ticket{}).Joins("Event")

	if search != "" {
		query = query.Where("Event.name ILIKE ?", "%"+search+"%")
	}
	if category != "" {
		query = query.Where("tickets.category = ?", category)
	}
	if available {
		query = query.Where("tickets.is_sold = ?", false)
	}

	query.Count(&total)
	err := query.Limit(limit).Offset(offset).Find(&tickets).Error
	return tickets, total, err
}

// --- EVENT & GENERATION ---

func (d *dbRepo) CreateEventStock(req domain.CreateEventRequest) error {
	return d.db.Transaction(func(tx *gorm.DB) error {
		newEvent := domain.Event{
			Name:        req.EventName,
			Description: req.Description,
			Venue:       req.Venue,
			Date:        req.Date,
		}
		if err := tx.Create(&newEvent).Error; err != nil {
			return err
		}

		var tickets []domain.Ticket
		for _, tier := range req.Tiers {
			for i := 0; i < tier.Quantity; i++ {
				tickets = append(tickets, domain.Ticket{
					EventID:  newEvent.ID,
					Category: tier.Category,
					Price:    tier.Price,
					IsSold:   false,
				})
			}
		}
		return tx.Create(&tickets).Error
	})
}

// --- MARKETPLACE & BOOKING ---

func (d *dbRepo) GetMarketplace(search string) ([]domain.Ticket, error) {
	var results []struct {
		EventID    uint
		EventName  string
		EventVenue string
		EventDate  string
		Category   string
		Price      float64
		Stock      int
	}

	query := d.db.Table("tickets").
		Select("tickets.event_id, events.name as event_name, events.venue as event_venue, events.date as event_date, tickets.category, tickets.price, COUNT(*) AS stock").
		Joins("JOIN events ON events.id = tickets.event_id").
		Where("tickets.is_sold = ?", false).
		Group("tickets.event_id, events.name, events.venue, events.date, tickets.category, tickets.price")

	if search != "" {
		query = query.Where("events.name ILIKE ?", "%"+search+"%")
	}

	err := query.Scan(&results).Error

	tickets := []domain.Ticket{}
	for _, r := range results {
		tickets = append(tickets, domain.Ticket{
			EventID:  r.EventID,
			Category: r.Category,
			Price:    r.Price,
			Stock:    r.Stock,
			Event: domain.Event{
				Name:  r.EventName,
				Venue: r.EventVenue,
				Date:  r.EventDate,
			},
		})
	}
	return tickets, err
}

func (d *dbRepo) GetAvailableSequential(eventID uint, category string, limit int) ([]domain.Ticket, error) {
	var tickets []domain.Ticket
	err := d.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("event_id = ? AND category = ? AND is_sold = ?", eventID, category, false).
		Order("id asc").
		Limit(limit).
		Find(&tickets).Error
	return tickets, err
}

// --- ADMIN STATS ---

// --- ADMIN STATS ---

func (d *dbRepo) GetAdminStats() (domain.DashboardStats, error) {
	var stats domain.DashboardStats

	// Total Revenue (COALESCE handles 0.0 if no tickets sold)
	d.db.Model(&domain.Ticket{}).
		Where("is_sold = ?", true).
		Select("COALESCE(SUM(price), 0)").
		Scan(&stats.TotalRevenue)

	// Global Sold Count
	d.db.Model(&domain.Ticket{}).
		Where("is_sold = ?", true).
		Count(&stats.TotalSold)

	// Global Scanned Count
	d.db.Model(&domain.Ticket{}).
		Where("checked_in_at IS NOT NULL").
		Count(&stats.TotalScanned)

	// Individual Event Performance Breakdown
	err := d.db.Table("events").
		Select(`
			events.id as event_id, 
			events.name as event_name, 
			COALESCE(SUM(CASE WHEN tickets.is_sold THEN tickets.price ELSE 0 END), 0) as revenue, 
			COUNT(CASE WHEN tickets.is_sold THEN 1 END) as sold, 
			COUNT(tickets.checked_in_at) as scanned
		`).
		Joins("LEFT JOIN tickets ON tickets.event_id = events.id").
		Group("events.id, events.name").
		Scan(&stats.Events).Error

	return stats, err
}

// --- ORDER HELPERS ---

func (d *dbRepo) CreateOrder(order *domain.Order) error {
	return d.db.Create(order).Error
}

func (d *dbRepo) GetUserTickets(userID uint) ([]domain.Ticket, error) {
	var tickets []domain.Ticket
	err := d.db.Preload("Event").
		Joins("JOIN orders ON orders.id = tickets.order_id").
		Where("orders.user_id = ?", userID).
		Find(&tickets).Error
	return tickets, err
}

func (d *dbRepo) GetUserOrders(userID uint) ([]domain.Order, error) {
	var orders []domain.Order
	err := d.db.Preload("Tickets.Event").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&orders).Error
	return orders, err
}

func (d *dbRepo) GetOrderWithTickets(orderID string, userID uint) (domain.Order, error) {
	var order domain.Order
	err := d.db.Preload("Tickets.Event").
		Where("id = ? AND user_id = ?", orderID, userID).
		First(&order).Error
	return order, err
}

func (d *dbRepo) UpdateTicketBatch(tickets []domain.Ticket) error {
	return d.db.Save(&tickets).Error
}

func (d *dbRepo) Transaction(fn func(domain.TicketRepository) error) error {
	return d.db.Transaction(func(tx *gorm.DB) error {
		// Create a new instance of your repo using the transaction DB handle
		txRepo := NewDBRepo(tx)
		return fn(txRepo)
	})
}

func (d *dbRepo) ScanTicket(ticketID string) (*domain.Ticket, error) {
	var ticket domain.Ticket

	// We preload "Event" so the Scanner UI can say "Welcome to [Event Name]"
	// We also use a transaction or a specific ID check
	err := d.db.Preload("Event").First(&ticket, "id = ?", ticketID).Error
	if err != nil {
		return nil, fmt.Errorf("ticket not found")
	}

	if !ticket.IsSold {
		return &ticket, fmt.Errorf("this ticket has not been sold yet")
	}

	if ticket.CheckedInAt != nil {
		// Formatted time makes the error message more helpful for the Agent
		return &ticket, fmt.Errorf("already scanned at %s", ticket.CheckedInAt.Format("03:04 PM"))
	}

	now := time.Now()
	ticket.CheckedInAt = &now

	return &ticket, d.db.Save(&ticket).Error
}
