package domain

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Name      string         `json:"name"`
	Email     string         `json:"email" gorm:"unique"`
	Password  string         `json:"-"`
	Role      string         `json:"role" gorm:"default:'customer'"`
	Points    int            `json:"points" gorm:"default:0"`
	Orders    []Order        `json:"orders,omitempty" gorm:"foreignKey:UserID"`
	AvatarURL string         `json:"avatar_url"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

type PointTransaction struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`
	Amount    int       `json:"amount"`
	Reason    string    `json:"reason"`
	OrderID   *uint     `json:"order_id"`
	Type      string    `json:"type"` // earned or redeemed
	CreatedAt time.Time `json:"created_at"`
	Order     *Order    `json:"order,omitempty" gorm:"foreignKey:OrderID"`
}
