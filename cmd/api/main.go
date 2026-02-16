package main

import (
	"neptunes-tix/internal/domain"
	"neptunes-tix/internal/repository"
	"neptunes-tix/internal/service"
	"net/http"

	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	// 1. Load the .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// 2. Build the DSN using environment variables
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	fmt.Println("✅ Connected securely using Environment Variables!")

	db.AutoMigrate(&domain.Ticket{})

	// Initialize our layers
	repo := repository.NewMySQLRepo(db)
	ticketSvc := service.NewTicketService(repo)

	r := gin.Default()

	// GET Route to see all tickets
	r.GET("/tickets", func(c *gin.Context) {
		tickets, _ := ticketSvc.ListTickets()
		c.JSON(200, tickets)
	})

	// POST Route to create a new ticket
	r.POST("/tickets", func(c *gin.Context) {
		var input struct {
			EventName string  `json:"event_name" binding:"required"`
			Price     float64 `json:"price" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		ticket, err := ticketSvc.CreateTicket(input.EventName, input.Price)
		if err != nil {
			c.JSON(500, gin.H{"error": "Could not create ticket"})
			return
		}

		c.JSON(201, ticket)
	})

	r.PATCH("/tickets/:id/sell", func(c *gin.Context) {
		id := c.Param("id")
		ticket, err := ticketSvc.MarkAsSold(id)

		if err != nil {
			// If our service returns the "already sold" error
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, ticket)
	})

	r.DELETE("/tickets/:id", func(c *gin.Context) {
		id := c.Param("id")
		if err := ticketSvc.RemoveTicket(id); err != nil {
			c.JSON(500, gin.H{"error": "Failed to delete"})
			return
		}
		c.JSON(200, gin.H{"message": "Ticket deleted"})
	})

	r.Run(":8080")
}
