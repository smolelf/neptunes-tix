package domain

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Name     string  `json:"name"`
	Email    string  `gorm:"unique" json:"email"`
	Password string  `json:"-"`                              // Hide this from JSON
	Role     string  `json:"role" gorm:"default:'customer'"` // 'admin', 'agent', 'customer'
	Orders   []Order `json:"orders"`
	Points   int     `json:"points" gorm:"default:0"` // New Field
}

type UserRepository interface {
	CreateUser(user *User) error
	UpdateUser(user *User) error
	GetUserByID(id string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	GetUserWithTickets(id string) (*User, error)
	SearchCustomerByName(name string) ([]User, error)
	GetPointHistory(userID uint) ([]PointTransaction, error)
}

type PointTransaction struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`
	Amount    int       `json:"amount"`
	Reason    string    `json:"reason"`
	OrderID   *uint     `json:"order_id,omitempty"`
	Type      string    `json:"type" gorm:"default:'earned'"` // "earn" or "redeem"
	CreatedAt time.Time `json:"created_at"`
	Order     *Order    `json:"order,omitempty" gorm:"foreignKey:OrderID"`
}
