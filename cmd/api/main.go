package main

import (
	"neptunes-tix/internal/domain"
	"neptunes-tix/internal/middleware"
	"neptunes-tix/internal/repository"
	"neptunes-tix/internal/service"

	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"

	"gorm.io/driver/postgres"
)

func main() {
	// 1. Load the .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	/* MySQL Start
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
	MySQL End */

	// Migrate to PostgreSQL (Conxn Block)
	// sslmode=disable is fine for local dev. In production, you'd use 'verify-full'
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Kuala_Lumpur",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	// OPEN POSTGRES instead of MYSQL
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to PostgreSQL:", err)
	}

	fmt.Println("🐘 Success! Connected to PostgreSQL.")

	// AutoMigrate will now build your tables in Postgres automatically
	// db.AutoMigrate(&domain.User{}, &domain.Ticket{})
	db.AutoMigrate(&domain.User{}, &domain.Ticket{}, &domain.Order{})

	// Initialize our layers
	repo := repository.NewDBRepo(db)
	bookingSvc := service.NewBookingService(repo, repo)
	// End of PostgreSQL Conxn block

	r := gin.Default()

	// GET Route to see all tickets
	r.GET("/tickets", func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

		// 1. Grab the search query 'q'
		search := c.Query("q")
		category := c.Query("category")
		status := c.Query("status")
		onlyAvailable := (status == "available")

		// 2. Pass the 'search' variable as the 5th argument
		tickets, total, err := bookingSvc.ListTickets(limit, offset, category, onlyAvailable, search)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to fetch tickets"})
			return
		}

		c.JSON(200, gin.H{
			"total":  total,
			"limit":  limit,
			"offset": offset,
			"data":   tickets,
		})
	})

	r.GET("/marketplace", func(c *gin.Context) {
		search := c.Query("q")

		tickets, err := repo.GetMarketplace(search)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to load marketplace"})
			return
		}

		c.JSON(200, gin.H{
			"data": tickets,
		})
	})

	// POST Route to create a new ticket
	r.POST("/tickets", func(c *gin.Context) {
		var input struct {
			EventName string  `json:"event_name" binding:"required,min=3"`
			Category  string  `json:"category" binding:"required"`
			Price     float64 `json:"price" binding:"required,gt=0"`
		}

		// This line performs the validation check!
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		ticket, err := bookingSvc.CreateTicket(input.EventName, input.Category, input.Price)
		if err != nil {
			c.JSON(500, gin.H{"error": "Could not create ticket"})
			return
		}

		c.JSON(201, ticket)
	})

	r.GET("/my-orders", middleware.AuthRequired(), func(c *gin.Context) {
		userID := c.MustGet("userID").(uint)

		orders, err := repo.GetUserOrders(userID)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to fetch orders"})
			return
		}
		c.JSON(200, orders)
	})

	//PATCH Route to check-in a ticket
	r.PATCH("/tickets/:id/checkin",
		middleware.AuthRequired(),
		middleware.RolesRequired("agent", "admin"),
		func(c *gin.Context) {
			id := c.Param("id")
			err := bookingSvc.CheckInTicket(id)
			if err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "Check-in successful!"})
		},
	)

	r.DELETE("/tickets/:id",
		middleware.AuthRequired(),
		middleware.RolesRequired("admin"),
		func(c *gin.Context) {
			id := c.Param("id")
			if err := bookingSvc.RemoveTicket(id); err != nil {
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
		user, err := bookingSvc.CreateUser(input.Name, input.Email, input.Password, input.Role)
		if err != nil {
			c.JSON(500, gin.H{"error": "Could not create user"})
			return
		}

		c.JSON(201, user)
	})

	// r.POST("/bookings",
	// 	middleware.AuthRequired(),
	// 	func(c *gin.Context) {
	// 		var input struct {
	// 			TicketID string `json:"ticket_id" binding:"required"`
	// 		}

	// 		if err := c.ShouldBindJSON(&input); err != nil {
	// 			c.JSON(400, gin.H{"error": err.Error()})
	// 			return
	// 		}

	// 		// 2. Get User ID from the token (extracted by middleware)
	// 		userID := c.MustGet("userID").(uint)
	// 		userName := c.GetString("userName")

	// 		err := bookingSvc.BookTicket(input.TicketID, userID)
	// 		if err != nil {
	// 			c.JSON(400, gin.H{"error": err.Error()})
	// 			return
	// 		}

	// 		c.JSON(200, gin.H{"message": "Ticket booked successfully for " + userName + " (" + fmt.Sprint(userID) + ")"})
	// 	})

	r.POST("/bookings/bulk", middleware.AuthRequired(), func(c *gin.Context) {
		var req struct {
			EventName string `json:"event_name"`
			Category  string `json:"category"`
			Quantity  int    `json:"quantity"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid JSON format"})
			return
		}

		// DEBUG: Print the request to your terminal
		fmt.Printf("Booking Request: %+v\n", req)

		val, exists := c.Get("userID")
		if !exists {
			c.JSON(401, gin.H{"error": "User not authenticated"})
			return
		}
		userID := val.(uint)

		err := bookingSvc.CreateBulkBooking(userID, req.EventName, req.Category, req.Quantity)
		if err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		c.JSON(200, gin.H{"message": "Successfully booked " + fmt.Sprint(req.Quantity) + " tickets!"})
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

		token, err := bookingSvc.Login(input.Email, input.Password)
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

			err := bookingSvc.AdminUpdateUser(id, input.Name, input.Email, input.Role)
			if err != nil {
				c.JSON(400, gin.H{"error": "Update failed"})
				return
			}

			c.JSON(200, gin.H{"message": "User updated successfully"})
		})

	r.GET("/admin/dashboard",
		middleware.AuthRequired(),
		middleware.RolesRequired("admin", "agent"),
		func(c *gin.Context) {
			stats, err := repo.GetStats()
			if err != nil {
				c.JSON(500, gin.H{"error": "Failed to load dashboard"})
				return
			}
			c.JSON(200, stats)
		},
	)

	r.GET("/admin/stats",
		middleware.AuthRequired(),
		middleware.AdminOnly(),
		func(c *gin.Context) {
			stats, err := repo.GetAdminStats()
			if err != nil {
				c.JSON(500, gin.H{"error": "Failed to fetch stats"})
				return
			}
			c.JSON(200, stats)
		},
	)

	r.GET("/my-tickets", middleware.AuthRequired(), func(c *gin.Context) {
		// Extract ID from the JWT context we set in middleware
		userID := c.MustGet("userID").(uint)

		tickets, err := repo.GetUserTickets(userID)
		if err != nil {
			c.JSON(500, gin.H{"error": "Could not retrieve your tickets"})
			return
		}
		c.JSON(200, tickets)
	})

	r.PUT("/my-profile", middleware.AuthRequired(), func(c *gin.Context) {
		// Pull the ID from the context (set by AuthRequired middleware)
		userID := c.MustGet("userID").(uint)

		var input struct {
			Name  string `json:"name"`
			Email string `json:"email" binding:"omitempty,email"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid input: " + err.Error()})
			return
		}

		// Call our service
		err := bookingSvc.UpdateOwnProfile(userID, input.Name, input.Email)
		if err != nil {
			c.JSON(500, gin.H{"error": "Could not update profile"})
			return
		}

		c.JSON(200, gin.H{"message": "Profile updated successfully!"})
	})

	r.GET("/tickets/stats",
		middleware.AuthRequired(),
		middleware.RolesRequired("admin", "agent"),
		func(c *gin.Context) {
			// We call the service layer instead of the repo directly for better architecture
			stats, err := repo.GetStats() // Or bookingSvc.GetStats() if you added it there
			if err != nil {
				c.JSON(500, gin.H{"error": "Failed to fetch event statistics"})
				return
			}
			c.JSON(200, stats)
		},
	)

	r.GET("/orders/:id", middleware.AuthRequired(), func(c *gin.Context) {
		orderID := c.Param("id")
		userID := c.MustGet("userID").(uint)

		order, err := repo.GetOrderWithTickets(orderID, userID)
		if err != nil {
			c.JSON(404, gin.H{"error": "Order not found"})
			return
		}

		c.JSON(200, order)
	})

	r.Run(":8080")
}
