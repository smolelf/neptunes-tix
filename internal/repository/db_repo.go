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
	err := d.db.First(&ticket, "id = ?", id).Error
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
				// Just add the data to the slice, don't hit the DB yet
				tickets = append(tickets, domain.Ticket{
					EventID:  newEvent.ID,
					Category: tier.Category,
					Price:    tier.Price,
					IsSold:   false,
				})
			}
		}

		// Safety check: Don't try to insert if the slice is empty
		if len(tickets) == 0 {
			return fmt.Errorf("no tickets were generated. check tier quantities")
		}

		// ONE single database call to insert everything in the slice
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

func (d *dbRepo) CreateBulkBooking(userID uint, eventID uint, category string, quantity int) error {
	return d.db.Transaction(func(tx *gorm.DB) error {
		// 1. Get the price for this specific tier
		var price float64
		if err := tx.Table("tickets").
			Select("price").
			Where("event_id = ? AND category = ?", eventID, category).
			Limit(1).
			Scan(&price).Error; err != nil {
			return err
		}

		// 2. Calculate actual total
		totalSpent := price * float64(quantity)
		pointsToEarn := int(totalSpent * 10) // RM 1 = 10 Points

		// 3. Mark tickets as sold and link to user (Simplified for this snippet)
		// ... (Your existing ticket update logic goes here) ...

		// 4. Update User Points
		if err := tx.Model(&domain.User{}).Where("id = ?", userID).
			Update("points", gorm.Expr("points + ?", pointsToEarn)).Error; err != nil {
			return err
		}

		// 5. Record Point Transaction
		return tx.Create(&domain.PointTransaction{
			UserID: userID,
			Amount: pointsToEarn,
			Reason: fmt.Sprintf("Purchased %d x %s for Event ID %d", quantity, category, eventID),
		}).Error
	})
}

// --- ADMIN STATS ---

func (d *dbRepo) GetAdminStats() (map[string]interface{}, error) {
	var totalRevenue float64
	var totalSold, totalScanned int64

	// 1. Calculate Global Stats
	d.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Select("SUM(price)").Row().Scan(&totalRevenue)
	d.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Count(&totalSold)
	d.db.Model(&domain.Ticket{}).Where("checked_in_at IS NOT NULL").Count(&totalScanned)

	// 2. Calculate Individual Event Stats
	type EventResult struct {
		EventID   uint    `json:"event_id"`
		EventName string  `json:"event_name"`
		Revenue   float64 `json:"revenue"`
		Sold      int64   `json:"sold"`
		Scanned   int64   `json:"scanned"`
	}
	var eventStats []EventResult

	var recentLogs []domain.AuditLog
	d.db.Order("created_at desc").Limit(10).Find(&recentLogs)
	fmt.Println(recentLogs)

	// Raw SQL grouping is the most efficient way to get this nested data
	d.db.Table("tickets").
		Select("events.id as event_id, events.name as event_name, SUM(tickets.price) as revenue, COUNT(tickets.id) as sold, COUNT(tickets.checked_in_at) as scanned").
		Joins("join events on events.id = tickets.event_id").
		Where("tickets.is_sold = ?", true).
		Group("events.id, events.name").
		Scan(&eventStats)

	return map[string]interface{}{
		"total_revenue": totalRevenue,
		"total_sold":    totalSold,
		"total_scanned": totalScanned,
		"events":        eventStats,
		"recent_logs":   recentLogs,
	}, nil
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

// --- SCANNING ---

func (d *dbRepo) ScanTicket(ticketID string) (*domain.Ticket, error) {
	var ticket domain.Ticket

	// 1. Fetch ticket and ensure it exists
	err := d.db.Preload("Event").First(&ticket, "id = ?", ticketID).Error
	if err != nil {
		return nil, fmt.Errorf("invalid ticket code")
	}

	// 2. Security Check: Is it sold?
	if !ticket.IsSold {
		return &ticket, fmt.Errorf("unpaid ticket - cannot admit")
	}

	// 3. Security Check: Is it a duplicate scan?
	if ticket.CheckedInAt != nil {
		// Calculate how long ago it was scanned
		duration := time.Since(*ticket.CheckedInAt).Round(time.Minute)
		return &ticket, fmt.Errorf("ALREADY USED: Scanned %v ago (at %s)",
			duration,
			ticket.CheckedInAt.Format("03:04 PM"))
	}

	// 4. Mark as scanned
	now := time.Now()
	err = d.db.Model(&ticket).Update("checked_in_at", now).Error

	ticket.CheckedInAt = &now // Update local object for the response
	return &ticket, err
}

func (d *dbRepo) GetGateStats() (int64, int64, error) {
	var sold, scanned int64

	// Count tickets where is_sold is true
	d.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Count(&sold)

	// Count tickets where checked_in_at is not null
	d.db.Model(&domain.Ticket{}).Where("checked_in_at IS NOT NULL").Count(&scanned)

	return sold, scanned, nil
}

func (d *dbRepo) GetUnscannedByEmail(email string) ([]domain.Ticket, error) {
	var tickets []domain.Ticket

	err := d.db.Preload("Event").
		Joins("JOIN orders ON orders.id = tickets.order_id").
		Joins("JOIN users ON users.id = orders.user_id").
		Where("users.email = ? AND tickets.checked_in_at IS NULL AND tickets.is_sold = ?", email, true).
		Find(&tickets).Error

	return tickets, err
}

func (d *dbRepo) BulkCheckIn(ticketIDs []string) error {
	now := time.Now()
	return d.db.Model(&domain.Ticket{}).
		Where("id IN ?", ticketIDs).
		Update("checked_in_at", now).Error
}

// --- AUDIT LOGGING ---
func (d *dbRepo) RecordLog(userID uint, action, targetID, details string) {
	log := domain.AuditLog{
		UserID:   userID,
		Action:   action,
		TargetID: targetID,
		Details:  details,
	}
	d.db.Create(&log)
}

// --- POINTS & REWARDS ---
func (d *dbRepo) GetPointHistory(userID uint) ([]domain.PointTransaction, error) {
	var history []domain.PointTransaction

	// Sort by most recent first
	err := d.db.Where("user_id = ?", userID).
		Order("created_at desc").
		Limit(50).
		Preload("Order").
		Find(&history).Error

	return history, err
}

// Add this helper to db_repo.go
func (d *dbRepo) awardPoints(tx *gorm.DB, userID uint, amount float64, reason string) error {
	points := int(amount * 10)

	// Update user
	if err := tx.Model(&domain.User{}).Where("id = ?", userID).
		Update("points", gorm.Expr("points + ?", points)).Error; err != nil {
		return err
	}

	// Create log
	return tx.Create(&domain.PointTransaction{
		UserID: userID,
		Amount: points,
		Reason: reason,
	}).Error
}

func (d *dbRepo) IncrementUserPoints(userID uint, amount int, reason string, orderID *uint) error {
	// 1. Update User balance
	err := d.db.Model(&domain.User{}).Where("id = ?", userID).
		Update("points", gorm.Expr("points + ?", amount)).Error
	if err != nil {
		return err
	}

	// 2. Determine type based on amount
	txType := "earned"
	if amount < 0 {
		txType = "redeemed"
	}

	// 3. Create the history record with the Order Link
	return d.db.Create(&domain.PointTransaction{
		UserID:    userID,
		Amount:    amount,
		Reason:    reason,
		OrderID:   orderID, // Now stored in DB!
		Type:      txType,
		CreatedAt: time.Now(),
	}).Error
}
