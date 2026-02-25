package domain

import "time"

type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`   // Who did it?
	Action    string    `json:"action"`    // What did they do?
	TargetID  string    `json:"target_id"` // Which ticket/event was affected?
	Details   string    `json:"details"`   // Human readable summary
	CreatedAt time.Time `json:"created_at"`
}
