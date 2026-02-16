package main

import (
	"neptunes-tix/internal/domain"
	"neptunes-tix/internal/middleware"
	"neptunes-tix/internal/repository"
	"neptunes-tix/internal/service"

	//"net/http"

	"fmt"
	"log"
	"os"
	"strconv"

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

	db.AutoMigrate(&domain.User{}, &domain.Ticket{})

	// Initialize our layers
	repo := repository.NewMySQLRepo(db)
	ticketSvc := service.NewTicketService(repo)

	r := gin.Default()

	// GET Route to see all tickets
	r.GET("/tickets", func(c *gin.Context) {
		limitStr := c.DefaultQuery("limit", "10")
		offsetStr := c.DefaultQuery("offset", "0")

		limit, _ := strconv.Atoi(limitStr)
		offset, _ := strconv.Atoi(offsetStr)

		// Note the new 'total' variable here
		tickets, total, err := repo.GetAll(limit, offset)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to fetch tickets"})
			return
		}

		// Send the "Wrapped" response
		c.JSON(200, gin.H{
			"total":  total,
			"limit":  limit,
			"offset": offset,
			"data":   tickets,
		})
	})

	// POST Route to create a new ticket
	r.POST("/tickets", middleware.AuthRequired(), middleware.RolesRequired("admin", "agent"), func(c *gin.Context) {
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

	r.PATCH("/tickets/:id/checkin",
		middleware.AuthRequired(),
		middleware.RolesRequired("agent", "admin"),
		func(c *gin.Context) {
			id := c.Param("id")

			err := ticketSvc.CheckInTicket(id)
			if err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}

			c.JSON(200, gin.H{"message": "Check-in successful! Welcome to the event."})
		},
	)

	r.DELETE("/tickets/:id", middleware.AuthRequired(), middleware.RolesRequired("admin"), func(c *gin.Context) {
		id := c.Param("id")
		if err := ticketSvc.RemoveTicket(id); err != nil {
			c.JSON(500, gin.H{"error": "Failed to delete"})
			return
		}
		c.JSON(200, gin.H{"message": "Ticket deleted"})
	})

	// 1. Route to Create a User
	r.POST("/users", func(c *gin.Context) {
		var input struct {
			Name     string `json:"name" binding:"required"`
			Email    string `json:"email" binding:"required"`
			Password string `json:"password" binding:"required"`
			Role     string `json:"role"` // Optional, will default to 'customer' in DB
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		// Now passing the password to the service
		user, err := ticketSvc.CreateUser(input.Name, input.Email, input.Password, input.Role)
		if err != nil {
			c.JSON(500, gin.H{"error": "Could not create user"})
			return
		}

		c.JSON(201, user)
	})

	r.POST("/bookings", middleware.AuthRequired(), func(c *gin.Context) {
		var input struct {
			TicketID string `json:"ticket_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		// 2. Get User ID from the token (extracted by middleware)
		userID := c.MustGet("userID").(uint)
		userName := c.GetString("userName")

		err := ticketSvc.BookTicket(input.TicketID, userID)
		if err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, gin.H{"message": "Ticket booked successfully for " + userName + " (" + fmt.Sprint(userID) + ")"})
	})

	// Route to View User Profile with their Tickets
	r.GET("/users/:id", func(c *gin.Context) {
		id := c.Param("id")

		// We call the repository function we wrote earlier that has .Preload("Tickets")
		user, err := repo.GetUserWithTickets(id)
		if err != nil {
			c.JSON(404, gin.H{"error": "User not found"})
			return
		}

		c.JSON(200, user)
	})

	r.POST("/login", func(c *gin.Context) {
		var input struct {
			Email    string `json:"email" binding:"required"`
			Password string `json:"password" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		token, err := ticketSvc.Login(input.Email, input.Password)
		if err != nil {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}

		c.JSON(200, gin.H{"token": token})
	})

	r.GET("/agent/search-customer",
		middleware.AuthRequired(),
		middleware.RolesRequired("agent", "admin"),
		func(c *gin.Context) {
			// 1. Get the query from the URL
			nameQuery := c.Query("name")

			// 2. If it's empty, tell them to provide a name
			if nameQuery == "" {
				c.JSON(400, gin.H{"error": "Please provide a name to search"})
				return
			}

			// 3. Use the variable! (This fixes your error)
			users, err := repo.SearchCustomerByName(nameQuery)
			if err != nil {
				c.JSON(500, gin.H{"error": "Search failed"})
				return
			}

			c.JSON(200, users)
		})

	r.PUT("/admin/users/:id",
		middleware.AuthRequired(),
		middleware.RolesRequired("admin"),
		func(c *gin.Context) {
			id := c.Param("id")
			var input struct {
				Name  string `json:"name"`
				Email string `json:"email"`
				Role  string `json:"role"`
			}

			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}

			err := ticketSvc.AdminUpdateUser(id, input.Name, input.Email, input.Role)
			if err != nil {
				c.JSON(400, gin.H{"error": "Update failed"})
				return
			}

			c.JSON(200, gin.H{"message": "User updated successfully"})
		})

	r.Run(":8080")
}
