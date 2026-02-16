package domain

import "time"

// Ticket is the core data of your app
type Ticket struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	EventName   string     `json:"event_name"`
	Price       float64    `json:"price"`
	IsSold      bool       `json:"is_sold" gorm:"default:false"`
	CreatedAt   time.Time  `json:"created_at"`
	UserID      *uint      `json:"user_id"`
	CheckedInAt *time.Time `json:"checked_in_at"`
}

// TicketRepository is a "Contract"
// It says: "Whatever database we use must have these functions"
type TicketRepository interface {
	Create(ticket *Ticket) error
	GetAll(limit int, offset int) ([]Ticket, int64, error)
	GetByID(id string) (*Ticket, error)
	Update(ticket *Ticket) error
	Delete(id string) error

	CreateUser(user *User) error
	GetUserWithTickets(id string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	SearchCustomerByName(name string) ([]User, error)
	UpdateUser(user *User) error
}

type User struct {
	ID       uint     `gorm:"primaryKey" json:"id"`
	Name     string   `json:"name"`
	Email    string   `gorm:"unique" json:"email"`
	Password string   `json:"-"`                              // Hide this from JSON
	Role     string   `json:"role" gorm:"default:'customer'"` // 'admin', 'agent', 'customer'
	Tickets  []Ticket `json:"tickets,omitempty"`              //array of tickets
}
