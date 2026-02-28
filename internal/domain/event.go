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

type UpdateEventRequest struct {
	Name        string `json:"name"`
	Venue       string `json:"venue"`
	Date        string `json:"date"`
	Description string `json:"description"`
	LocationURL string `json:"location_url"`
	// 🚀 Actions for Tiers
	AddTiers    []TicketTier `json:"add_tiers"`    // New categories to create
	AddStock    []TicketTier `json:"add_stock"`    // Add more tickets to existing category
	RemoveTiers []string     `json:"remove_tiers"` // Categories to delete entirely
}

type TicketTier struct {
	Category string  `json:"category"`
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}

type TierStats struct {
	Category string  `json:"category"`
	Price    float64 `json:"price"`
	Stock    int     `json:"stock"`
	Sold     int     `json:"sold"`
}

// 2. The main response struct
type EventDetail struct {
	Event             // Embed the standard Event fields
	Tiers []TierStats `json:"tiers"` // Use the named struct here
}
