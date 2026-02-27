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

type BookingService struct {
	repo domain.TicketRepository // 🚀 Unified Master Interface
}

// 🚀 Look how clean the constructor is now!
func NewBookingService(repo domain.TicketRepository) *BookingService {
	return &BookingService{
		repo: repo,
	}
}

func (s *BookingService) ListTickets(limit, offset int, category string, available bool, search string) ([]domain.Ticket, int64, error) {
	return s.repo.GetAll(limit, offset, category, available, search)
}

func (s *BookingService) RemoveTicket(id string) error {
	return s.repo.Delete(id)
}

func (s *BookingService) MarkAsSold(id string) (*domain.Ticket, error) {
	ticket, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err // Ticket doesn't exist
	}

	if ticket.IsSold {
		return nil, fmt.Errorf("ticket with ID %s is already sold", id)
	}

	ticket.IsSold = true
	err = s.repo.UpdateTicket(ticket)
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

	err := s.repo.CreateTicket(newTicket)
	return newTicket, err
}

func (s *BookingService) BookTickets(userID uint, eventID uint, category string, quantity int) error {
	return s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		tickets, err := txRepo.GetAvailableSequential(eventID, category, quantity)
		if err != nil {
			return err
		}
		if len(tickets) < quantity {
			return errors.New("insufficient tickets available")
		}

		var total float64
		for _, t := range tickets {
			total += t.Price
		}

		order := &domain.Order{
			UserID:      userID,
			TotalAmount: total,
			Status:      "completed",
		}
		if err := txRepo.CreateOrder(order); err != nil {
			return err
		}

		pointsToEarn := int(total * 10)
		if err := txRepo.IncrementUserPoints(userID, pointsToEarn, "Ticket Purchase", &order.ID); err != nil {
			return err
		}

		txRepo.RecordLog(userID, "POINTS_EARNED", fmt.Sprintf("%d", order.ID),
			fmt.Sprintf("Earned %d points", pointsToEarn))

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
		Role:     role,
		Points:   0,
	}

	// 2. Use a transaction to create the user and record the point log
	err = s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		// Create the user record in PostgreSQL
		if err := txRepo.CreateUser(newUser); err != nil {
			return err
		}

		return txRepo.IncrementUserPoints(newUser.ID, 100, "Welcome Bonus!", nil)
	})

	if err != nil {
		return nil, err
	}

	// Update the local object so the response shows 100
	newUser.Points = 100
	return newUser, nil
}

func (s *BookingService) Login(email, password string) (string, error) {
	user, err := s.repo.GetUserByEmail(email)
	if err != nil {
		return "", fmt.Errorf("invalid credentials")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return "", fmt.Errorf("invalid credentials")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":    user.ID,
		"user_role":  user.Role,
		"user_name":  user.Name,
		"user_email": user.Email,
		"exp":        time.Now().Add(time.Hour * 72).Unix(),
	})

	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func (s *BookingService) CheckInTicket(ticketID string, expectedEventID uint) error {
	ticket, err := s.repo.GetByID(ticketID)
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
	ticket.CheckedInAt = &now

	return s.repo.UpdateTicket(ticket)
}

func (s *BookingService) AdminUpdateUser(id string, name, email, role string) error {
	user, err := s.repo.GetUserByID(id)
	if err != nil {
		return err
	}

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

func (s *BookingService) UpdateOwnProfile(userID uint, name, email string) error {
	user, err := s.repo.GetUserByID(fmt.Sprint(userID))
	if err != nil {
		return err
	}

	if name != "" {
		user.Name = name
	}
	if email != "" {
		user.Email = email
	}

	return s.repo.UpdateUser(user)
}

func (s *BookingService) CreateBulkBooking(userID uint, eventID uint, category string, quantity int) error {
	return s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		tickets, err := txRepo.GetAvailableSequential(eventID, category, quantity)
		if err != nil {
			return err
		}
		if len(tickets) < quantity {
			return fmt.Errorf("insufficient tickets: only %d available", len(tickets))
		}

		total := 0.0
		for _, t := range tickets {
			total += t.Price
		}

		newOrder := &domain.Order{
			UserID:      userID,
			TotalAmount: total,
			Status:      "paid",
		}
		if err := txRepo.CreateOrder(newOrder); err != nil {
			return err
		}

		pointsToEarn := int(total * 10)
		if err := txRepo.IncrementUserPoints(userID, pointsToEarn, fmt.Sprintf("Bought %d tickets", quantity), &newOrder.ID); err != nil {
			return err
		}

		for i := range tickets {
			tickets[i].IsSold = true
			tickets[i].OrderID = &newOrder.ID
		}

		return txRepo.UpdateTicketBatch(tickets)
	})
}

func (s *BookingService) RedeemPoints(userID uint, pointsToSpend int) error {
	return s.repo.IncrementUserPoints(userID, -pointsToSpend, "Points Redemption", nil)
}

func (s *BookingService) InitiatePayment(userID uint, eventID uint, category string, quantity int, redeemPoints int) (string, uint, error) {
	var mockURL string
	var capturedID uint

	err := s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		// 🚀 FIXED: using txRepo instead of s.userRepo!
		user, err := txRepo.GetUserByID(fmt.Sprint(userID))
		if err != nil {
			return err
		}
		if user.Points < redeemPoints {
			return fmt.Errorf("insufficient points for redemption")
		}

		tickets, err := txRepo.GetAvailableSequential(eventID, category, quantity)
		if err != nil {
			return err
		}
		if len(tickets) < quantity {
			return fmt.Errorf("tickets no longer available")
		}

		var subtotal float64
		for _, t := range tickets {
			subtotal += t.Price
		}
		discount := float64(redeemPoints) / 100.0
		finalAmount := subtotal - discount
		if finalAmount < 0 {
			finalAmount = 0
		}

		newOrder := &domain.Order{
			UserID:        userID,
			TotalAmount:   finalAmount,
			Status:        "pending",
			PointsApplied: redeemPoints,
			PointsEarned:  int(finalAmount * 10),
		}

		if err := txRepo.CreateOrder(newOrder); err != nil {
			return err
		}
		capturedID = newOrder.ID

		for i := range tickets {
			tickets[i].OrderID = &capturedID
		}
		if err := txRepo.UpdateTicketBatch(tickets); err != nil {
			return err
		}

		mockURL = fmt.Sprintf("%s/mock-billplz/%d", os.Getenv("TEMP_URL"), capturedID)

		return txRepo.UpdateOrderFields(capturedID, map[string]interface{}{
			"payment_url": mockURL,
		})
	})

	return mockURL, capturedID, err
}

func (s *BookingService) FinalizePayment(orderID string) error {
	return s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		order, err := txRepo.GetOrderById(orderID)
		if err != nil || order.Status != "pending" {
			return errors.New("order not found or not pending")
		}

		err = txRepo.UpdateOrderFields(order.ID, map[string]interface{}{
			"status": "paid",
		})
		if err != nil {
			return err
		}

		for i := range order.Tickets {
			order.Tickets[i].IsSold = true
		}
		if err := txRepo.UpdateTicketBatch(order.Tickets); err != nil {
			return err
		}

		if order.PointsApplied > 0 {
			txRepo.IncrementUserPoints(order.UserID, -order.PointsApplied, "Used points for discount", &order.ID)
		}
		txRepo.IncrementUserPoints(order.UserID, order.PointsEarned, "Earned from purchase", &order.ID)

		return nil
	})
}
