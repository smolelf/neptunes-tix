package repository

import (
	"neptunes-tix/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type dbRepo struct {
	db *gorm.DB
}

func NewDBRepo(db *gorm.DB) *dbRepo {
	return &dbRepo{db: db}
}

func (d *dbRepo) CreateUser(user *domain.User) error {
	return d.db.Create(user).Error
}

func (d *dbRepo) UpdateUser(user *domain.User) error {
	return d.db.Save(user).Error
}

func (d *dbRepo) CreateTicket(ticket *domain.Ticket) error {
	return d.db.Create(ticket).Error
}

func (d *dbRepo) UpdateTicket(ticket *domain.Ticket) error {
	return d.db.Save(ticket).Error
}

func (d *dbRepo) GetUserWithTickets(id string) (*domain.User, error) {
	var user domain.User
	// This tells GORM: Get User, then their Orders, then the Tickets in those Orders
	err := d.db.Preload("Orders.Tickets").First(&user, id).Error
	return &user, err
}

func (d *dbRepo) GetAll(limit, offset int, category string, available bool, search string) ([]domain.Ticket, int64, error) {
	var tickets []domain.Ticket
	var total int64

	query := d.db.Model(&domain.Ticket{})

	// --- NEW: Search Filter ---
	if search != "" {
		// ILIKE is case-insensitive in Postgres. For MySQL, use LIKE.
		// %search% finds the term anywhere in the event name
		searchTerm := "%" + search + "%"
		query = query.Where("event_name ILIKE ?", searchTerm)
	}

	// Existing filters
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if available {
		query = query.Where("is_sold = ?", false)
	}

	// Get total count for pagination
	query.Count(&total)

	// Get the actual data
	err := query.Limit(limit).Offset(offset).Find(&tickets).Error
	return tickets, total, err
}

// For Tickets
func (d *dbRepo) GetByID(id string) (*domain.Ticket, error) {
	var ticket domain.Ticket
	err := d.db.First(&ticket, id).Error
	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

// For Users
func (d *dbRepo) GetUserByID(id string) (*domain.User, error) {
	var user domain.User
	err := d.db.First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

//TICKET DELETION STARTS HERE

func (d *dbRepo) Delete(id string) error {
	return d.db.Delete(&domain.Ticket{}, id).Error
}

func (d *dbRepo) GetDeletedTickets() ([]domain.Ticket, error) {
	var tickets []domain.Ticket
	// Unscoped() tells GORM to ignore the deleted_at filter
	err := d.db.Unscoped().Where("deleted_at IS NOT NULL").Find(&tickets).Error
	return tickets, err
}

//TICKET DELETION ENDS HERE

func (d *dbRepo) GetUserByEmail(email string) (*domain.User, error) {
	var user domain.User
	err := d.db.Where("email = ?", email).First(&user).Error
	return &user, err
}

func (d *dbRepo) SearchCustomerByName(name string) ([]domain.User, error) {
	var users []domain.User
	// We use .Select() to only grab ID and Name, leaving out Email/Password
	err := d.db.Select("id", "name", "email", "role").Where("name LIKE ?", "%"+name+"%").Find(&users).Error
	return users, err
}

func (d *dbRepo) GetStats() (map[string]interface{}, error) {
	var totalTickets, soldTickets, checkedIn int64
	var revenue float64

	d.db.Model(&domain.Ticket{}).Count(&totalTickets)
	d.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Count(&soldTickets)
	d.db.Model(&domain.Ticket{}).Where("checked_in_at IS NOT NULL").Count(&checkedIn)

	// Sum revenue from sold tickets
	d.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Select("COALESCE(SUM(price), 0)").Scan(&revenue)

	return map[string]interface{}{
		"total_tickets":   totalTickets,
		"sold_tickets":    soldTickets,
		"checked_in":      checkedIn,
		"total_revenue":   revenue,
		"sales_occupancy": float64(soldTickets) / float64(totalTickets) * 100,
	}, nil
}

func (d *dbRepo) GetUserTickets(userID uint) ([]domain.Ticket, error) {
	var tickets []domain.Ticket

	// Joins the Order table to find which tickets belong to the User
	err := d.db.Joins("JOIN orders ON orders.id = tickets.order_id").
		Where("orders.user_id = ?", userID).
		Find(&tickets).Error

	return tickets, err
}

func (d *dbRepo) GetUserOrders(userID uint) ([]domain.Order, error) {
	var orders []domain.Order

	// We get the orders for the user and "Preload" the associated tickets
	err := d.db.Preload("Tickets").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&orders).Error

	return orders, err
}

func (d *dbRepo) Transaction(fn func(domain.TicketRepository) error) error {
	return d.db.Transaction(func(tx *gorm.DB) error {
		// Create a temporary repository using the "Transaction" instance of DB
		txRepo := &dbRepo{db: tx}
		return fn(txRepo)
	})
}

func (d *dbRepo) CreateOrder(order *domain.Order) error {
	return d.db.Create(order).Error
}

func (d *dbRepo) GetAvailableSequential(eventName string, category string, limit int) ([]domain.Ticket, error) {
	var tickets []domain.Ticket

	// We use SELECT ... FOR UPDATE (Clauses) to prevent two people buying the same seat
	err := d.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("event_name = ? AND category = ? AND is_sold = ?", eventName, category, false).
		Order("id asc").
		Limit(limit).
		Find(&tickets).Error

	return tickets, err
}

func (d *dbRepo) UpdateTicketBatch(tickets []domain.Ticket) error {
	return d.db.Save(&tickets).Error
}

func (d *dbRepo) GetMarketplace(search string) ([]domain.Ticket, error) {
	// Use a temporary struct because domain.Ticket has Stock as ignored (-)
	type Result struct {
		ID        uint
		EventName string
		Category  string
		Price     float64
		Stock     int
	}
	var results []Result

	query := d.db.Model(&domain.Ticket{}).
		Select("MIN(id) as id, event_name, category, price, COUNT(*) AS stock").
		Where("is_sold = ?", false).
		Group("event_name, category, price")

	if search != "" {
		query = query.Where("event_name ILIKE ?", "%"+search+"%")
	}

	err := query.Scan(&results).Error

	tickets := []domain.Ticket{}
	for _, r := range results {
		tickets = append(tickets, domain.Ticket{
			Model:     gorm.Model{ID: r.ID},
			EventName: r.EventName,
			Category:  r.Category,
			Price:     r.Price,
			Stock:     r.Stock,
		})
	}

	return tickets, err
}

func (d *dbRepo) GetOrderWithTickets(orderID string, userID uint) (domain.Order, error) {
	var order domain.Order

	// We filter by BOTH ID and UserID so people can't guess IDs to see other's tickets
	err := d.db.Preload("Tickets").
		Where("id = ? AND user_id = ?", orderID, userID).
		First(&order).Error

	return order, err
}

func (d *dbRepo) GetAdminStats() (map[string]interface{}, error) {
	type EventStat struct {
		EventName string  `json:"event_name"`
		Sold      int     `json:"sold"`
		Scanned   int     `json:"scanned"`
		Revenue   float64 `json:"revenue"`
	}

	var eventStats []EventStat
	d.db.Model(&domain.Ticket{}).
		Select("event_name, count(*) as sold, sum(price) as revenue, count(checked_in_at) as scanned").
		Where("is_sold = ?", true).
		Group("event_name").
		Scan(&eventStats)

	// Also get the global totals for the top cards
	var totalRev float64
	d.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Select("SUM(price)").Scan(&totalRev)

	return map[string]interface{}{
		"total_revenue": totalRev,
		"events":        eventStats,
	}, nil
}
