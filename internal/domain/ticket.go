package domain

import (
	"time"

	"gorm.io/gorm"
)

// Ticket is the core data of your app
type Ticket struct {
	gorm.Model
	EventName   string     `json:"event_name"`
	Category    string     `json:"category"`
	Price       float64    `json:"price"`
	IsSold      bool       `json:"is_sold" gorm:"default:false"`
	UserID      *uint      `json:"user_id"`
	CheckedInAt *time.Time `json:"checked_in_at"`
}

// TicketRepository is a "Contract"
// It says: "Whatever database we use must have these functions"
type TicketRepository interface {
	CreateTicket(ticket *Ticket) error // Must be CreateTicket
	UpdateTicket(ticket *Ticket) error
	GetAll(limit int, offset int, category string, available bool) ([]Ticket, int64, error)
	GetByID(id string) (*Ticket, error)
	Delete(id string) error
	GetStats() (map[string]interface{}, error)
	GetUserTickets(userID uint) ([]Ticket, error)
	Transaction(fn func(txRepo TicketRepository) error) error
}

// Response structure for the stats
type TicketStats struct {
	TotalSold    int    `json:"total_sold"`
	CheckedIn    int    `json:"checked_in_at"`
	Remaining    int    `json:"remaining"`
	LastScanTime string `json:"last_scan_time,omitempty"`
}
