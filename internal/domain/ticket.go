package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// 1. THE TICKET DATABASE MODEL
type Ticket struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	EventID     uint       `json:"event_id"`
	Event       Event      `json:"event" gorm:"foreignKey:EventID"`
	Category    string     `json:"category"`
	Price       float64    `json:"price"`
	IsSold      bool       `json:"is_sold" gorm:"default:false"`
	CheckedInAt *time.Time `json:"checked_in_at"`

	OrderID *uint `json:"order_id"`
	Stock   int   `json:"stock,omitempty" gorm:"-"`
}

func (t *Ticket) BeforeCreate(tx *gorm.DB) (err error) {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return
}

// 2. THE MASTER REPOSITORY INTERFACE
type TicketRepository interface {
	// --- USER METHODS ---
	CreateUser(user *User) error
	UpdateUser(user *User) error
	GetUserByID(id string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	GetUserWithTickets(id string) (*User, error)
	SearchCustomerByName(name string) ([]User, error)

	// --- TICKET CORE METHODS ---
	CreateTicket(ticket *Ticket) error
	UpdateTicket(ticket *Ticket) error
	GetByID(id string) (*Ticket, error)
	Delete(id string) error
	GetAll(limit int, offset int, category string, available bool, search string) ([]Ticket, int64, error)
	UpdateTicketBatch(tickets []Ticket) error
	GetUserTickets(userID uint) ([]Ticket, error)
	ScanTicket(ticketID string) (*Ticket, error)
	GetGateStats() (int64, int64, error)
	GetUnscannedByEmail(email string) ([]Ticket, error)
	BulkCheckIn(ticketIDs []string) error
	CountSoldTickets(eventID uint, category string) (int64, error)
	DeleteTicketsByCategory(eventID uint, category string) error
	CreateTicketBatch(tickets []Ticket) error
	UpdateEvent(event *Event) error

	// --- MARKETPLACE & BOOKING ---
	GetMarketplace(search string) ([]Ticket, error)
	GetAvailableSequential(eventID uint, category string, limit int) ([]Ticket, error)
	CreateBulkBooking(userID uint, eventID uint, category string, quantity int) error
	GetTicketTier(eventID uint, category string) (struct {
		Price float64
		Stock int
	}, error)
	CreateOrderItem(orderID uint, category string, quantity int) error

	// --- EVENT & GENERATION ---
	CreateEventStock(req CreateEventRequest) error
	GetEventByID(id uint) (*Event, error)
	GetAllEvents() ([]Event, error)

	// --- ORDER HELPERS ---
	CreateOrder(order *Order) error
	GetUserOrders(userID uint) ([]Order, error)
	GetOrderWithTickets(orderID string, userID uint) (Order, error)
	GetOrderById(id string) (*Order, error)
	UpdateOrder(order *Order) error
	UpdateOrderFields(orderID uint, fields map[string]interface{}) error
	CleanupExpiredOrders(timeout time.Duration) (int64, error)

	// --- ADMIN STATS ---
	GetAdminStats() (map[string]interface{}, error)

	// --- AUDIT LOGGING & POINTS ---
	RecordLog(userID uint, action, targetID, details string)
	GetPointHistory(userID uint) ([]PointTransaction, error)
	IncrementUserPoints(userID uint, amount int, reason string, orderID *uint) error

	// --- SYSTEM ---
	Transaction(fn func(TicketRepository) error) error
}
