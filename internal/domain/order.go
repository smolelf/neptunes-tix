package domain

import (
	"time"
)

type Order struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	UserID      uint      `json:"user_id"`
	TotalAmount float64   `json:"total_amount"`
	Status      string    `json:"status"` // pending, paid, cancelled
	Tickets     []Ticket  `json:"tickets"`

	// Payment Gateway Integration (Billplz)
	BillplzID  string `json:"billplz_id"`
	PaymentURL string `json:"payment_url"`

	// Loyalty System
	PointsApplied int `json:"points_applied"`
	PointsEarned  int `json:"points_earned"`
}
