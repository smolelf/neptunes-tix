package service

import (
	"fmt"
	"neptunes-tix/internal/domain"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type TicketService struct {
	repo domain.TicketRepository
}

func NewTicketService(r domain.TicketRepository) *TicketService {
	return &TicketService{repo: r}
}

func (s *TicketService) ListTickets(limit int, offset int) ([]domain.Ticket, int64, error) {
	return s.repo.GetAll(limit, offset)
}

func (s *TicketService) RemoveTicket(id string) error {
	return s.repo.Delete(id)
}

func (s *TicketService) MarkAsSold(id string) (*domain.Ticket, error) {
	ticket, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err // Ticket doesn't exist
	}

	// Business Rule: Cannot sell a ticket that is already sold
	if ticket.IsSold {
		return nil, fmt.Errorf("ticket with ID %s is already sold", id)
	}

	ticket.IsSold = true
	err = s.repo.Update(ticket)
	return ticket, err
}

func (s *TicketService) CreateTicket(eventName string, price float64) (*domain.Ticket, error) {
	// Business Rule: Price must be positive
	if price < 0 {
		return nil, fmt.Errorf("ticket price cannot be negative")
	}

	newTicket := &domain.Ticket{
		EventName: eventName,
		Price:     price,
		IsSold:    false,
	}

	err := s.repo.Create(newTicket)
	return newTicket, err
}

func (s *TicketService) BookTicket(ticketID string, userID uint) error {
	// 1. Check if User exists first
	_, err := s.repo.GetUserWithTickets(fmt.Sprint(userID))
	if err != nil {
		return fmt.Errorf("user with ID %d does not exist", userID)
	}

	// 2. Check if Ticket exists and is available
	ticket, err := s.repo.GetByID(ticketID)
	if err != nil {
		return fmt.Errorf("ticket not found")
	}
	if ticket.IsSold {
		return fmt.Errorf("ticket is already sold")
	}

	// 3. Perform the update
	ticket.IsSold = true
	ticket.UserID = &userID

	return s.repo.Update(ticket)
}

func (s *TicketService) CreateUser(name, email, password, role string) (*domain.User, error) {
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

	err = s.repo.CreateUser(newUser)
	return newUser, err
}

func (s *TicketService) Login(email, password string) (string, error) {
	// 1. Find user
	user, err := s.repo.GetUserByEmail(email)
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
		"user_id":   user.ID,
		"user_role": user.Role, // Add this!
		"user_name": user.Name,
		"exp":       time.Now().Add(time.Hour * 72).Unix(),
	})

	// 4. Sign the token with our secret
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func (s *TicketService) CheckInTicket(ticketID string) error {
	ticket, err := s.repo.GetByID(ticketID)
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

	return s.repo.Update(ticket)
}

func (s *TicketService) AdminUpdateUser(id string, name, email, role string) error {
	user, err := s.repo.GetUserWithTickets(id)
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

	return s.repo.UpdateUser(user)
}
