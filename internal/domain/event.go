package domain

import "gorm.io/gorm"

type Event struct {
	gorm.Model
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Venue       string   `json:"venue"`
	Date        string   `json:"date"`
	LocationURL string   `json:"location_url"`
	DoorsOpen   string   `json:"doors_open"`
	Tickets     []Ticket `json:"-"`
}

type CreateEventRequest struct {
	EventName   string       `json:"event_name" binding:"required"`
	Description string       `json:"description"`
	Venue       string       `json:"venue"`
	Date        string       `json:"date"`
	Tiers       []TicketTier `json:"tiers" binding:"required"`
	LocationURL string       `json:"location_url"`
	DoorsOpen   string       `json:"doors_open"`
}

type TicketTier struct {
	Category string  `json:"category"`
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}
