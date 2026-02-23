package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Event struct {
	gorm.Model
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Venue       string   `json:"venue"`
	Date        string   `json:"date"`
	Tickets     []Ticket `json:"-"`
}

type Order struct {
	gorm.Model
	UserID      uint     `json:"user_id"`
	TotalAmount float64  `json:"total_amount"`
	Status      string   `json:"status"`
	Tickets     []Ticket `json:"tickets"`
}

type Ticket struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	EventID     uint       `json:"event_id"`
	Event       Event      `json:"event" gorm:"foreignKey:EventID"`
	Category    string     `json:"category"`
	Price       float64    `json:"price"`
	IsSold      bool       `json:"is_sold" gorm:"default:false"`
	CheckedInAt *time.Time `json:"checked_in_at"`

	OrderID *uint `json:"order_id"`
	Stock   int   `json:"stock,omitempty" gorm:"-"`
}

func (t *Ticket) BeforeCreate(tx *gorm.DB) (err error) {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return
}

type CreateEventRequest struct {
	EventName   string       `json:"event_name" binding:"required"`
	Description string       `json:"description"`
	Venue       string       `json:"venue"`
	Date        string       `json:"date"`
	Tiers       []TicketTier `json:"tiers" binding:"required"`
}

type TicketTier struct {
	Category string  `json:"category"`
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}

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

type TicketRepository interface {
	UserRepository

	CreateTicket(ticket *Ticket) error
	UpdateTicket(ticket *Ticket) error
	GetAll(limit int, offset int, category string, available bool, search string) ([]Ticket, int64, error)
	GetByID(id string) (*Ticket, error)
	Delete(id string) error
	// GetStats() (map[string]interface{}, error)
	GetUserTickets(userID uint) ([]Ticket, error)
	CreateOrder(order *Order) error
	GetAvailableSequential(eventID uint, category string, limit int) ([]Ticket, error)
	UpdateTicketBatch(tickets []Ticket) error
	GetMarketplace(search string) ([]Ticket, error)
	GetUserOrders(userID uint) ([]Order, error)
	GetOrderWithTickets(orderID string, userID uint) (Order, error)
	GetAdminStats() (map[string]interface{}, error)
	CreateEventStock(req CreateEventRequest) error

	IncrementUserPoints(userID uint, amount int, reason string, orderID *uint) error
	RecordLog(userID uint, action string, targetID string, details string)
	ScanTicket(ticketID string) (*Ticket, error)

	Transaction(fn func(txRepo TicketRepository) error) error
}

type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`   // The Admin/Agent who performed the action
	Action    string    `json:"action"`    // e.g., "BULK_CHECKIN", "MANUAL_CHECKIN", "DELETE_TICKET"
	TargetID  string    `json:"target_id"` // The Ticket UUID or User ID affected
	Details   string    `json:"details"`   // Extra info: "Checked in 5 tickets for guest@email.com"
	CreatedAt time.Time `json:"created_at"`
}
