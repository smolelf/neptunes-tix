package domain

import "time"

// Ticket is the core data of your app
type Ticket struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	EventName string    `json:"event_name"`
	Price     float64   `json:"price"`
	IsSold    bool      `json:"is_sold" gorm:"default:false"`
	CreatedAt time.Time `json:"created_at"`
}

// TicketRepository is a "Contract"
// It says: "Whatever database we use must have these functions"
type TicketRepository interface {
	Create(ticket *Ticket) error
	GetAll() ([]Ticket, error)

	GetByID(id string) (*Ticket, error)
	Update(ticket *Ticket) error
	Delete(id string) error // Add this
}
