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

func (s *BookingService) CreateTicket(eventName string, category string, price float64) (*domain.Ticket, error) {
	// Business Rule: Price must be positive
	if price < 0 {
		return nil, fmt.Errorf("ticket price cannot be negative")
	}

	newTicket := &domain.Ticket{
		EventName: eventName,
		Category:  category,
		Price:     price,
		IsSold:    false,
	}

	err := s.ticketRepo.CreateTicket(newTicket)
	return newTicket, err
}

func (s *BookingService) BookTicket(ticketID string, userID uint) error {
	return s.ticketRepo.Transaction(func(txRepo domain.TicketRepository) error {
		ticket, err := txRepo.GetByID(ticketID)
		if err != nil || ticket.IsSold {
			return errors.New("ticket unavailable")
		}

		ticket.IsSold = true
		ticket.UserID = &userID

		return txRepo.UpdateTicket(ticket)
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

func (s *BookingService) CheckInTicket(ticketID string) error {
	ticket, err := s.ticketRepo.GetByID(ticketID)
	if err != nil {
		return fmt.Errorf("ticket not found")
	}

	if !ticket.IsSold {
		return fmt.Errorf("cannot check in an unsold ticket")
	}

	if ticket.CheckedInAt != nil {
		return fmt.Errorf("ticket already used at %v", ticket.CheckedInAt)
	}

	now := time.Now()
	ticket.CheckedInAt = &now

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
