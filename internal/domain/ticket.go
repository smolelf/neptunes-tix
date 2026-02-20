package domain

import (
	"time"

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
	gorm.Model
	EventID     uint       `json:"event_id"`
	Event       Event      `json:"event" gorm:"foreignKey:EventID"` // Needed for preloading
	Category    string     `json:"category"`
	Price       float64    `json:"price"`
	IsSold      bool       `json:"is_sold" gorm:"default:false"`
	CheckedInAt *time.Time `json:"checked_in_at"` // Corrected type
	OrderID     *uint      `json:"order_id"`
	// Add this virtual field for the marketplace aggregation
	Stock int `json:"stock,omitempty" gorm:"-"`
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
	GetAdminStats() (DashboardStats, error)
	CreateEventStock(req CreateEventRequest) error

	ScanTicket(ticketID string) (*Ticket, error)

	Transaction(fn func(txRepo TicketRepository) error) error
}
