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

func (s *BookingService) InitiatePayment(userID uint, eventID uint, category string, quantity int, redeemPoints int) (string, uint, error) {
	var mockURL string
	var capturedID uint

	err := s.ticketRepo.Transaction(func(txRepo domain.TicketRepository) error {
		// 1. Check if user exists and has enough points
		user, err := s.userRepo.GetUserByID(fmt.Sprint(userID))
		if err != nil {
			return err
		}
		if user.Points < redeemPoints {
			return fmt.Errorf("insufficient points for redemption")
		}

		// 2. Find Available Tickets
		tickets, err := txRepo.GetAvailableSequential(eventID, category, quantity)
		if err != nil {
			return err
		}
		if len(tickets) < quantity {
			return fmt.Errorf("tickets no longer available")
		}

		// 3. Calculate Pricing
		var subtotal float64
		for _, t := range tickets {
			subtotal += t.Price
		}
		discount := float64(redeemPoints) / 100.0
		finalAmount := subtotal - discount
		if finalAmount < 0 {
			finalAmount = 0
		}

		// 4. Create the PENDING Order (Initial Insert)
		newOrder := &domain.Order{
			UserID:        userID,
			TotalAmount:   finalAmount,
			Status:        "pending",
			PointsApplied: redeemPoints,
			PointsEarned:  int(finalAmount * 10),
		}

		// GORM creates the record and populates newOrder.ID here
		if err := txRepo.CreateOrder(newOrder); err != nil {
			return err
		}
		capturedID = newOrder.ID

		// 5. Link Tickets to Order (Locking)
		for i := range tickets {
			tickets[i].OrderID = &capturedID
		}
		if err := txRepo.UpdateTicketBatch(tickets); err != nil {
			return err
		}

		// 6. Generate the URL using the newly minted ID
		mockURL = fmt.Sprintf("%s/mock-billplz/%d", os.Getenv("TEMP_URL"), capturedID)

		// 7. 🔥 THE FIX: Targeted update to avoid "Duplicate Key" errors.
		// This tells GORM to only touch the payment_url field for this specific ID.
		return txRepo.UpdateOrderFields(capturedID, map[string]interface{}{
			"payment_url": mockURL,
		})
	})

	return mockURL, capturedID, err
}

func (s *BookingService) FinalizePayment(orderID string) error {
	return s.ticketRepo.Transaction(func(txRepo domain.TicketRepository) error {
		// 1. Get the Order with Tickets preloaded
		order, err := txRepo.GetOrderById(orderID)
		if err != nil || order.Status != "pending" {
			return errors.New("order not found or not pending")
		}

		// 2. Mark Order as PAID (Using targeted update is safer here too)
		err = txRepo.UpdateOrderFields(order.ID, map[string]interface{}{
			"status": "paid",
		})
		if err != nil {
			return err
		}

		// 3. Mark Tickets as SOLD
		for i := range order.Tickets {
			order.Tickets[i].IsSold = true
		}
		if err := txRepo.UpdateTicketBatch(order.Tickets); err != nil {
			return err
		}

		// 4. Finalize Points
		if order.PointsApplied > 0 {
			txRepo.IncrementUserPoints(order.UserID, -order.PointsApplied, "Used points for discount", &order.ID)
		}
		txRepo.IncrementUserPoints(order.UserID, order.PointsEarned, "Earned from purchase", &order.ID)

		return nil
	})
}
