package domain

import (
	"time"

	"gorm.io/gorm"
)

type Coupon struct {
	ID           uint    `json:"id" gorm:"primaryKey"`
	Code         string  `json:"code" gorm:"uniqueIndex;not null"`
	Discount     float64 `json:"discount"`      // E.g., 10.00
	DiscountType string  `json:"discount_type"` // "fixed" or "percentage"

	EventID *uint `json:"event_id"` // NULL = All Events, 5 = Specific Event

	ExpiryDate time.Time      `json:"expiry_date"`
	UsageLimit int            `json:"usage_limit"` // Max number of times it can be used globally
	UsedCount  int            `json:"used_count"`
	IsActive   bool           `json:"is_active" gorm:"default:true"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}
