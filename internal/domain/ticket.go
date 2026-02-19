package domain

import (
	"time"

	"gorm.io/gorm"
)

type Order struct {
	gorm.Model
	UserID      uint     `json:"user_id"`
	TotalAmount float64  `json:"total_amount"`
	Status      string   `json:"status"`  // e.g., "completed", "cancelled"
	Tickets     []Ticket `json:"tickets"` // GORM will automatically link these
}

type Ticket struct {
	gorm.Model
	EventName   string     `json:"event_name"`
	Category    string     `json:"category"`
	Price       float64    `json:"price"`
	IsSold      bool       `json:"is_sold" gorm:"default:false"`
	OrderID     *uint      `json:"order_id"`
	CheckedInAt *time.Time `json:"checked_in_at"`
	Stock       int        `json:"stock" gorm:"-"`
}

// TicketRepository is a "Contract"
// It says: "Whatever database we use must have these functions"
type TicketRepository interface {
	CreateTicket(ticket *Ticket) error // Must be CreateTicket
	UpdateTicket(ticket *Ticket) error
	GetAll(limit int, offset int, category string, available bool, search string) ([]Ticket, int64, error)
	GetByID(id string) (*Ticket, error)
	Delete(id string) error
	GetStats() (map[string]interface{}, error)
	GetUserTickets(userID uint) ([]Ticket, error)
	Transaction(fn func(txRepo TicketRepository) error) error
	CreateOrder(order *Order) error
	GetAvailableSequential(eventName string, category string, limit int) ([]Ticket, error)
	UpdateTicketBatch(tickets []Ticket) error
	GetMarketplace(search string) ([]Ticket, error)
	GetUserOrders(userID uint) ([]Order, error)
	GetOrderWithTickets(orderID string, userID uint) (Order, error)
}

// Response structure for the stats
type TicketStats struct {
	TotalSold    int    `json:"total_sold"`
	CheckedIn    int    `json:"checked_in_at"`
	Remaining    int    `json:"remaining"`
	LastScanTime string `json:"last_scan_time,omitempty"`
}
