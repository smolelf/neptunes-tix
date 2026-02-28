package service

import (
	"errors"
	"fmt"
	"math"
	"neptunes-tix/internal/domain"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type BookingService struct {
	repo domain.TicketRepository
}

func NewBookingService(repo domain.TicketRepository) *BookingService {
	return &BookingService{repo: repo}
}

// 🚀 Defined struct to fix missing type error in parameters
type CheckoutItem struct {
	Category string `json:"category" binding:"required"`
	Quantity int    `json:"quantity" binding:"required,min=1"`
}

// --- USER & AUTH ---

func (s *BookingService) CreateUser(name, email, password, role string) (*domain.User, error) {
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

	err = s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		if err := txRepo.CreateUser(newUser); err != nil {
			return err
		}
		return txRepo.IncrementUserPoints(newUser.ID, 100, "Welcome Bonus!", nil)
	})

	if err != nil {
		return nil, err
	}

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

func (s *BookingService) UpdateOwnProfile(userID uint, name, email, password, avatar string) error {
	user, err := s.repo.GetUserByID(fmt.Sprintf("%d", userID))
	if err != nil {
		return fmt.Errorf("user not found")
	}

	// 1. Update basic fields
	if name != "" {
		user.Name = name
	}
	if email != "" {
		user.Email = email
	}

	// 2. 🚀 NEW: Update Avatar (Base64 string or URL)
	if avatar != "" {
		user.AvatarURL = avatar
	}

	// 3. 🚀 NEW: Update Password (Hash it first!)
	if password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed to hash password")
		}
		user.Password = string(hashedPassword)
	}

	return s.repo.UpdateUser(user)
}

// --- ADMIN & MANAGEMENT ---

func (s *BookingService) ListTickets(limit, offset int, category string, available bool, search string) ([]domain.Ticket, int64, error) {
	return s.repo.GetAll(limit, offset, category, available, search)
}

func (s *BookingService) RemoveTicket(id string) error {
	return s.repo.Delete(id)
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

func (s *BookingService) UpdateEvent(eventID uint, req domain.UpdateEventRequest) error {
	return s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		// 1. Update Basic Event Details
		// We fetch the event first to ensure it exists
		event, err := txRepo.GetEventByID(eventID)
		if err != nil {
			return fmt.Errorf("event not found")
		}

		if req.Name != "" {
			event.Name = req.Name
		}
		if req.Venue != "" {
			event.Venue = req.Venue
		}
		if req.Date != "" {
			event.Date = req.Date
		}
		if req.Description != "" {
			event.Description = req.Description
		}
		if req.LocationURL != "" {
			event.LocationURL = req.LocationURL
		}

		if err := txRepo.UpdateEvent(event); err != nil {
			return err
		}

		// 2. Remove Categories (Safety Check First!)
		for _, category := range req.RemoveTiers {
			// Check if any tickets are sold for this category
			soldCount, err := txRepo.CountSoldTickets(eventID, category)
			if err != nil {
				return err
			}
			if soldCount > 0 {
				return fmt.Errorf("cannot remove category '%s': %d tickets already sold", category, soldCount)
			}

			// Safe to delete all tickets for this category
			if err := txRepo.DeleteTicketsByCategory(eventID, category); err != nil {
				return err
			}
		}

		// 3. Add New Categories
		if len(req.AddTiers) > 0 {
			if err := s.generateTickets(txRepo, eventID, req.AddTiers); err != nil {
				return err
			}
		}

		// 4. Add Stock to Existing Categories
		if len(req.AddStock) > 0 {
			if err := s.generateTickets(txRepo, eventID, req.AddStock); err != nil {
				return err
			}
		}

		return nil
	})
}

func (s *BookingService) generateTickets(repo domain.TicketRepository, eventID uint, tiers []domain.TicketTier) error {
	var tickets []domain.Ticket
	for _, tier := range tiers {
		for i := 0; i < tier.Quantity; i++ {
			tickets = append(tickets, domain.Ticket{
				EventID:  eventID,
				Category: tier.Category,
				Price:    tier.Price,
				IsSold:   false,
			})
		}
	}
	if len(tickets) > 0 {
		return repo.CreateTicketBatch(tickets)
	}
	return nil
}

// --- NEW MULTI-TIER CHECKOUT LOGIC ---

func (s *BookingService) CreateMultiItemOrder(userID uint, eventID uint, items []CheckoutItem, points int) (*domain.Order, error) {
	var capturedOrder *domain.Order
	var mockURL string

	err := s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		// 1. Verify User Points
		user, err := txRepo.GetUserByID(fmt.Sprint(userID))
		if err != nil {
			return err
		}
		if user.Points < points {
			return fmt.Errorf("insufficient points for redemption")
		}

		var totalAmount float64
		var reservedTickets []domain.Ticket

		// 2. Validate items, calculate total, and gather tickets
		for _, item := range items {
			// Find specific sequential tickets available for this event/category
			tickets, err := txRepo.GetAvailableSequential(eventID, item.Category, item.Quantity)
			if err != nil {
				return err
			}
			if len(tickets) < item.Quantity {
				return fmt.Errorf("insufficient stock for %s. Requested: %d, Available: %d", item.Category, item.Quantity, len(tickets))
			}

			// Add price to total and add tickets to reservation list
			for _, t := range tickets {
				totalAmount += t.Price
				reservedTickets = append(reservedTickets, t)
			}
		}

		// 3. Handle point redemption logic
		discount := float64(points) / 100.0
		finalPrice := math.Max(0, totalAmount-discount)
		pointsToEarn := int(finalPrice * 10) // RM1 = 10 pts

		// 4. Create the Main Order
		// 🚀 FIX: Removed EventID from struct init to match typical domain.Order schema
		capturedOrder = &domain.Order{
			UserID:        userID,
			TotalAmount:   finalPrice,
			PointsApplied: points,
			PointsEarned:  pointsToEarn,
			Status:        "pending",
		}

		if err := txRepo.CreateOrder(capturedOrder); err != nil {
			return err
		}

		// 5. Link Tickets to Order (This replaces UpdateStock and CreateOrderItem)
		// Since we fetched physical ticket rows in Step 2, we just update their OrderID
		for i := range reservedTickets {
			reservedTickets[i].OrderID = &capturedOrder.ID
			// Do NOT mark IsSold yet. That happens after payment.
		}
		if err := txRepo.UpdateTicketBatch(reservedTickets); err != nil {
			return err
		}

		// 6. Generate Payment URL and attach to Order
		mockURL = fmt.Sprintf("%s/mock-billplz/%d", os.Getenv("TEMP_URL"), capturedOrder.ID)

		return txRepo.UpdateOrderFields(capturedOrder.ID, map[string]interface{}{
			"payment_url": mockURL,
		})
	})

	if err != nil {
		return nil, err
	}

	// Update local struct for response
	capturedOrder.PaymentURL = mockURL
	return capturedOrder, nil
}

func (s *BookingService) FinalizePayment(orderID string) error {
	return s.repo.Transaction(func(txRepo domain.TicketRepository) error {
		order, err := txRepo.GetOrderById(orderID)
		if err != nil || order.Status != "pending" {
			return errors.New("order not found or not pending")
		}

		// 1. Mark Order Paid
		err = txRepo.UpdateOrderFields(order.ID, map[string]interface{}{
			"status": "paid",
		})
		if err != nil {
			return err
		}

		// 2. Mark Tickets Sold
		for i := range order.Tickets {
			order.Tickets[i].IsSold = true
		}
		if err := txRepo.UpdateTicketBatch(order.Tickets); err != nil {
			return err
		}

		// 3. Handle Points (Deduct spent, Award earned)
		if order.PointsApplied > 0 {
			txRepo.IncrementUserPoints(order.UserID, -order.PointsApplied, "Used points for discount", &order.ID)
		}
		txRepo.IncrementUserPoints(order.UserID, order.PointsEarned, "Earned from purchase", &order.ID)

		return nil
	})
}

func (s *BookingService) CheckInTicket(ticketID string, expectedEventID uint) (*domain.Ticket, error) {
	ticket, err := s.repo.GetByID(ticketID)
	if err != nil {
		return nil, fmt.Errorf("ticket not found")
	}

	// 1. 🔒 Security Check: Wrong Event
	// This prevents a ticket for "Event A" being scanned at "Event B"
	if ticket.EventID != expectedEventID {
		return nil, fmt.Errorf("WRONG EVENT: This ticket is for '%s'", ticket.Event.Name)
	}

	// 2. 🔒 Security Check: Unpaid Ticket
	if !ticket.IsSold {
		return nil, fmt.Errorf("INVALID: This ticket has not been paid for.")
	}

	// 3. 🔒 Security Check: Already Used
	if ticket.CheckedInAt != nil {
		// Calculate nice duration string (e.g., "5 mins ago")
		duration := time.Since(*ticket.CheckedInAt).Round(time.Minute)
		return nil, fmt.Errorf("ALREADY USED: Scanned %s ago at %s",
			duration,
			ticket.CheckedInAt.Format("3:04 PM"))
	}

	// 4. Success: Mark it
	now := time.Now()
	ticket.CheckedInAt = &now

	if err := s.repo.UpdateTicket(ticket); err != nil {
		return nil, err
	}

	return ticket, nil
}
