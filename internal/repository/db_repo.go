package repository

import (
	"neptunes-tix/internal/domain"

	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 1. Defined internal structs for Admin Stats to ensure compilation
var _ domain.TicketRepository = (*dbRepo)(nil)

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
		Where("tickets.is_sold = ? AND tickets.order_id IS NULL", false).
		Group("tickets.event_id, events.name, events.venue, events.date, tickets.category, tickets.price")

	if search != "" {
		query = query.Where("events.name ILIKE ?", "%"+search+"%")
	}

	if err := query.Scan(&results).Error; err != nil {
		return nil, err
	}

	// Fixed: Only declare this variable ONCE
	marketplaceTickets := make([]domain.Ticket, 0)
	for _, r := range results {
		marketplaceTickets = append(marketplaceTickets, domain.Ticket{
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
	return marketplaceTickets, nil
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

// --- ORDER HELPERS ---

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
