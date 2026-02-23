package service

import (
	"errors"
	"fmt"
	"neptunes-tix/internal/domain"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// type TicketService struct {
// 	repo domain.TicketRepository
// }

type BookingService struct {
	userRepo   domain.UserRepository
	ticketRepo domain.TicketRepository
}

func NewBookingService(tRepo domain.TicketRepository,
	uRepo domain.UserRepository) *BookingService {
	return &BookingService{
		ticketRepo: tRepo,
		userRepo:   uRepo,
	}
}

func (s *BookingService) ListTickets(limit, offset int, category string, available bool, search string) ([]domain.Ticket, int64, error) {
	return s.ticketRepo.GetAll(limit, offset, category, available, search)
}

func (s *BookingService) RemoveTicket(id string) error {
	return s.ticketRepo.Delete(id)
}

func (s *BookingService) MarkAsSold(id string) (*domain.Ticket, error) {
	ticket, err := s.ticketRepo.GetByID(id)
	if err != nil {
		return nil, err // Ticket doesn't exist
	}

	// Business Rule: Cannot sell a ticket that is already sold
	if ticket.IsSold {
		return nil, fmt.Errorf("ticket with ID %s is already sold", id)
	}

	ticket.IsSold = true
	err = s.ticketRepo.UpdateTicket(ticket)
	return ticket, err
}

func (s *BookingService) CreateTicket(eventID uint, category string, price float64) (*domain.Ticket, error) {
	if price < 0 {
		return nil, fmt.Errorf("price cannot be negative")
	}

	newTicket := &domain.Ticket{
		EventID:  eventID,
		Category: category,
		Price:    price,
		IsSold:   false,
	}

	err := s.ticketRepo.CreateTicket(newTicket)
	return newTicket, err
}

// Change eventName string -> eventID uint
func (s *BookingService) BookTickets(userID uint, eventID uint, category string, quantity int) error {
	return s.ticketRepo.Transaction(func(txRepo domain.TicketRepository) error {
		// 1. Get tickets
		tickets, err := txRepo.GetAvailableSequential(eventID, category, quantity)
		if err != nil {
			return err
		}
		if len(tickets) < quantity {
			return errors.New("insufficient tickets available")
		}

		// 2. Calculate total price
		var total float64
		for _, t := range tickets {
			total += t.Price
		}

		// 3. Create the Order
		order := &domain.Order{
			UserID:      userID,
			TotalAmount: total,
			Status:      "completed",
		}
		if err := txRepo.CreateOrder(order); err != nil {
			return err
		}

		// 🚀 4. AWARD POINTS
		pointsToEarn := int(total * 10)
		// This call is what was missing!
		if err := txRepo.IncrementUserPoints(userID, pointsToEarn, "Ticket Purchase", &order.ID); err != nil {
			return err
		}

		// 5. Audit Log (Optional but recommended)
		txRepo.RecordLog(userID, "POINTS_EARNED", fmt.Sprintf("%d", order.ID),
			fmt.Sprintf("Earned %d points", pointsToEarn))

		// 6. Update Tickets
		for i := range tickets {
			tickets[i].IsSold = true
			tickets[i].OrderID = &order.ID
		}

		return txRepo.UpdateTicketBatch(tickets)
	})
}

func (s *BookingService) CreateUser(name, email, password, role string) (*domain.User, error) {
	// 1. Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	newUser := &domain.User{
		Name:     name,
		Email:    email,
		Password: string(hashedPassword),
		Role:     role, // Customer default
	}

	err = s.userRepo.CreateUser(newUser)
	return newUser, err
}

func (s *BookingService) Login(email, password string) (string, error) {
	// 1. Find user
	user, err := s.userRepo.GetUserByEmail(email)
	if err != nil {
		return "", fmt.Errorf("invalid credentials")
	}

	// 2. Compare passwords
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return "", fmt.Errorf("invalid credentials")
	}

	// 3. Create JWT Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":    user.ID,
		"user_role":  user.Role, // Add this!
		"user_name":  user.Name,
		"user_email": user.Email,
		"exp":        time.Now().Add(time.Hour * 72).Unix(),
	})

	// 4. Sign the token with our secret
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func (s *BookingService) CheckInTicket(ticketID string, expectedEventID uint) error {
	ticket, err := s.ticketRepo.GetByID(ticketID)
	if err != nil {
		return fmt.Errorf("ticket not found")
	}

	if ticket.EventID != expectedEventID {
		return fmt.Errorf("wrong event: this ticket is for %s", ticket.Event.Name)
	}

	if !ticket.IsSold {
		return fmt.Errorf("invalid ticket: not sold")
	}

	if ticket.CheckedInAt != nil {
		return fmt.Errorf("already used at %s", ticket.CheckedInAt.Format("15:04:05"))
	}

	now := time.Now()
	ticket.CheckedInAt = &now // Assigning the address of 'now' to the pointer

	return s.ticketRepo.UpdateTicket(ticket)
}

func (s *BookingService) AdminUpdateUser(id string, name, email, role string) error {
	user, err := s.userRepo.GetUserByID(id)
	if err != nil {
		return err
	}

	// Only update if a new value is provided
	if name != "" {
		user.Name = name
	}
	if email != "" {
		user.Email = email
	}
	if role != "" {
		user.Role = role
	}

	return s.userRepo.UpdateUser(user)
}

func (s *BookingService) UpdateOwnProfile(userID uint, name, email string) error {
	// 1. Fetch user by ID (using the User Interface)
	user, err := s.userRepo.GetUserByID(fmt.Sprint(userID))
	if err != nil {
		return err
	}

	// 2. Only update the fields provided
	if name != "" {
		user.Name = name
	}
	if email != "" {
		user.Email = email
	}

	// 3. Save back to the database
	return s.userRepo.UpdateUser(user)
}

func (s *BookingService) CreateBulkBooking(userID uint, eventID uint, category string, quantity int) error {
	return s.ticketRepo.Transaction(func(txRepo domain.TicketRepository) error {

		// 1. Get the Sequential Tickets
		tickets, err := txRepo.GetAvailableSequential(eventID, category, quantity)
		if err != nil {
			return err
		}
		if len(tickets) < quantity {
			return fmt.Errorf("insufficient tickets: only %d available", len(tickets))
		}

		// 2. Calculate Total
		total := 0.0
		for _, t := range tickets {
			total += t.Price
		}

		// 3. Create the Order Parent
		newOrder := &domain.Order{
			UserID:      userID,
			TotalAmount: total,
			Status:      "paid",
		}
		if err := txRepo.CreateOrder(newOrder); err != nil {
			return err
		}

		// 🚀 4. AWARD POINTS (THE MISSING LINK)
		pointsToEarn := int(total * 10)
		if err := txRepo.IncrementUserPoints(userID, pointsToEarn, fmt.Sprintf("Bought %d tickets on %d", quantity), &newOrder.ID); err != nil {
			return err
		}

		// 5. Update the tickets
		for i := range tickets {
			tickets[i].IsSold = true
			tickets[i].OrderID = &newOrder.ID
		}

		return txRepo.UpdateTicketBatch(tickets)
	})
}

func (s *BookingService) RedeemPoints(userID uint, pointsToSpend int) error {
	// We pass nil for OrderID because it's a general redemption, or
	// pass the ID of the order being discounted!
	return s.ticketRepo.IncrementUserPoints(userID, -pointsToSpend, "Points Redemption", nil)
}
