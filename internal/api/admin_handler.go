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
	ScanTicket(ticketID string) (*domain.Ticket, error)
	SearchCustomerByName(name string) ([]domain.User, error)
	GetUnscannedByEmail(email string) ([]domain.Ticket, error)
	BulkCheckIn(ticketIDs []string) error
	RecordLog(userID uint, action, targetID, details string)
	CreateEventStock(req domain.CreateEventRequest) error
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

func HandleTicketCheckin(repo AdminRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		ticketID := c.Param("id")
		ticket, err := repo.ScanTicket(ticketID)
		if err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, gin.H{"message": "Check-in successful!", "data": ticket})
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
