package api

import (
	"fmt"
	"neptunes-tix/internal/domain"
	"neptunes-tix/internal/service"

	"github.com/gin-gonic/gin"
)

// This interface ensures this file only demands the exact methods it needs
type AdminRepo interface {
	GetAdminStats() (map[string]interface{}, error)
	// ScanTicket(ticketID string) (*domain.Ticket, error)
	SearchCustomerByName(name string) ([]domain.User, error)
	GetUnscannedByEmail(email string) ([]domain.Ticket, error)
	BulkCheckIn(ticketIDs []string) error
	RecordLog(userID uint, action, targetID, details string)
	CreateEventStock(req domain.CreateEventRequest) error
	GetEventDetails(eventID uint) (*domain.EventDetail, error) // 🚀 Add this line
}

func HandleAdminStats(repo AdminRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := repo.GetAdminStats()
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to fetch dashboard data"})
			return
		}
		c.JSON(200, stats)
	}
}

func HandleTicketCheckin(bookingSvc *service.BookingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		ticketID := c.Param("id")

		eventIDStr := c.Query("event_id")
		if eventIDStr == "" {
			c.JSON(400, gin.H{"error": "Event ID is required for scanning"})
			return
		}

		var eventID uint
		if _, err := fmt.Sscanf(eventIDStr, "%d", &eventID); err != nil {
			c.JSON(400, gin.H{"error": "Invalid Event ID format"})
			return
		}

		// 🚀 Uses the service to enforce the "Wrong Event" business rule
		ticket, err := bookingSvc.CheckInTicket(ticketID, eventID)
		if err != nil {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, gin.H{
			"message": "Check-in successful!",
			"data":    ticket,
		})
	}
}

func HandleSearchCustomer(repo AdminRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		nameQuery := c.Query("name")
		users, err := repo.SearchCustomerByName(nameQuery)
		if err != nil {
			c.JSON(500, gin.H{"error": "Search failed"})
			return
		}
		c.JSON(200, users)
	}
}

func HandleTicketLookup(repo AdminRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		email := c.Query("email")
		tickets, err := repo.GetUnscannedByEmail(email)
		if err != nil {
			c.JSON(500, gin.H{"error": "Database error"})
			return
		}
		c.JSON(200, tickets)
	}
}

func HandleBulkCheckin(repo AdminRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.MustGet("userID").(uint)
		var req struct {
			TicketIDs []string `json:"ticket_ids" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "No tickets selected"})
			return
		}
		if err := repo.BulkCheckIn(req.TicketIDs); err != nil {
			c.JSON(500, gin.H{"error": "Failed to update tickets"})
			return
		}

		details := fmt.Sprintf("Checked in %d tickets via email lookup", len(req.TicketIDs))
		repo.RecordLog(userID, "BULK_CHECKIN", "MULTIPLE", details)

		c.JSON(200, gin.H{"message": "Checked in " + fmt.Sprint(len(req.TicketIDs)) + " guests!"})
	}
}

func HandleCreateEvent(repo AdminRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req domain.CreateEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		if err := repo.CreateEventStock(req); err != nil {
			c.JSON(500, gin.H{"error": "Failed to generate stock"})
			return
		}
		c.JSON(201, gin.H{"message": "Event created successfully!"})
	}
}

func HandleDeleteTicket(bookingSvc *service.BookingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := bookingSvc.RemoveTicket(c.Param("id")); err != nil {
			c.JSON(500, gin.H{"error": "Delete failed"})
			return
		}
		c.JSON(200, gin.H{"message": "Ticket deleted"})
	}
}

type CheckoutInput struct {
	EventID      uint                   `json:"event_id" binding:"required"`
	RedeemPoints int                    `json:"redeem_points"`
	Items        []service.CheckoutItem `json:"items" binding:"required,gt=0"`
}

func HandleCheckout(bookingSvc *service.BookingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input CheckoutInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		// Get User ID from JWT context safely
		userIDVal, exists := c.Get("userID")
		if !exists {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}

		var userID uint
		switch v := userIDVal.(type) {
		case float64:
			userID = uint(v)
		case uint:
			userID = v
		case int:
			userID = uint(v)
		default:
			c.JSON(400, gin.H{"error": "Invalid user ID format in token"})
			return
		}

		// 🚀 The service now handles multiple items in a single transaction
		order, err := bookingSvc.CreateMultiItemOrder(userID, input.EventID, input.Items, input.RedeemPoints)
		if err != nil {
			c.JSON(500, gin.H{"error": "Checkout failed: " + err.Error()})
			return
		}

		c.JSON(201, gin.H{
			"order_id":    order.ID,
			"payment_url": order.PaymentURL,
			"total":       order.TotalAmount,
		})
	}
}

func HandleUserRegistration(bookingSvc *service.BookingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Name     string `json:"name" binding:"required"`
			Email    string `json:"email" binding:"required,email"`
			Password string `json:"password" binding:"required,min=6"`
		}

		// Validate incoming JSON
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid input: " + err.Error()})
			return
		}

		// 1. Create the user & Award 100 Welcome Points
		// Your service already handles hashing and point logs
		user, err := bookingSvc.CreateUser(input.Name, input.Email, input.Password, "customer")
		if err != nil {
			c.JSON(500, gin.H{"error": "Registration failed. Email might already be in use."})
			return
		}

		// 2. 🚀 THE REFINEMENT: Generate a token immediately
		// This uses your existing Login logic to create a JWT
		token, err := bookingSvc.Login(input.Email, input.Password)
		if err != nil {
			// If login fails, account is still created, but they must log in manually
			c.JSON(201, gin.H{
				"message": "Account created! Please log in to continue.",
				"user":    user,
			})
			return
		}

		// 3. Success Response
		c.JSON(201, gin.H{
			"message": "Welcome! 100 points have been added to your account.",
			"token":   token,
			"user": gin.H{
				"id":     user.ID,
				"name":   user.Name,
				"email":  user.Email,
				"points": user.Points, // Should show 100
			},
		})
	}
}

func HandleUpdateEvent(bookingSvc *service.BookingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idParam := c.Param("id")
		var eventID uint
		if _, err := fmt.Sscanf(idParam, "%d", &eventID); err != nil {
			c.JSON(400, gin.H{"error": "Invalid Event ID"})
			return
		}

		var req domain.UpdateEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		if err := bookingSvc.UpdateEvent(eventID, req); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		// Log the action for security
		// userID := c.MustGet("userID").(uint)
		// (Assuming you expose a method to record logs, or you can skip this for now)

		c.JSON(200, gin.H{"message": "Event updated successfully"})
	}
}

func HandleGetEventDetails(repo AdminRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		idParam := c.Param("id")
		var eventID uint
		if _, err := fmt.Sscanf(idParam, "%d", &eventID); err != nil {
			c.JSON(400, gin.H{"error": "Invalid Event ID"})
			return
		}

		details, err := repo.GetEventDetails(eventID)
		if err != nil {
			c.JSON(404, gin.H{"error": "Event not found"})
			return
		}

		c.JSON(200, details)
	}
}
