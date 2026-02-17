package domain

import "gorm.io/gorm"

type User struct {
	gorm.Model
	Name     string   `json:"name"`
	Email    string   `gorm:"unique" json:"email"`
	Password string   `json:"-"`                              // Hide this from JSON
	Role     string   `json:"role" gorm:"default:'customer'"` // 'admin', 'agent', 'customer'
	Tickets  []Ticket `json:"tickets,omitempty"`              //array of tickets
}

type UserRepository interface {
	CreateUser(user *User) error
	UpdateUser(user *User) error
	GetUserByID(id string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	GetUserWithTickets(id string) (*User, error)
	SearchCustomerByName(name string) ([]User, error)
}
