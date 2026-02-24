package main

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"neptunes-tix/internal/domain"
	"neptunes-tix/internal/middleware"
	"neptunes-tix/internal/repository"
	"neptunes-tix/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// 1. Setup & Database
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Kuala_Lumpur",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASS"), os.Getenv("DB_NAME"), os.Getenv("DB_PORT"))

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to PostgreSQL:", err)
	}

	fmt.Println("🐘 Success! Connected to PostgreSQL.")

	db.AutoMigrate(
		&domain.User{},
		&domain.Ticket{},
		&domain.Order{},
		&domain.Event{},
		&domain.AuditLog{},
		&domain.PointTransaction{},
	)

	repo := repository.NewDBRepo(db)
	bookingSvc := service.NewBookingService(repo, repo)

	r := gin.Default()

	// Start a background worker to clean up expired reservations every minute
	go func() {
		for {
			time.Sleep(1 * time.Minute)
			// Set timeout to 15 minutes
			released, err := repo.CleanupExpiredOrders(15 * time.Minute)
			if err == nil && released > 0 {
				fmt.Printf("🧹 Cleanup: Released %d tickets from expired orders\n", released)
			}
		}
	}()

	// --- 🔓 PUBLIC ROUTES ---
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

	r.POST("/users", func(c *gin.Context) {
		var input struct {
			Name     string `json:"name" binding:"required"`
			Email    string `json:"email" binding:"required"`
			Password string `json:"password" binding:"required"`
			Role     string `json:"role"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		user, err := bookingSvc.CreateUser(input.Name, input.Email, input.Password, input.Role)
		if err != nil {
			c.JSON(500, gin.H{"error": "Could not create user"})
			return
		}
		c.JSON(201, user)
	})

	r.GET("/tickets", func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
		search := c.Query("q")
		category := c.Query("category")
		status := c.Query("status")
		tickets, total, err := bookingSvc.ListTickets(limit, offset, category, status == "available", search)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to fetch tickets"})
			return
		}
		c.JSON(200, gin.H{"total": total, "data": tickets})
	})

	r.GET("/marketplace", func(c *gin.Context) {
		search := c.Query("q")
		tickets, err := repo.GetMarketplace(search)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to load marketplace"})
			return
		}
		c.JSON(200, gin.H{"data": tickets})
	})

	// BILLING & CHECKOUT ROUTES

	r.POST("/payments/webhook", func(c *gin.Context) {
		// Billplz sends data like 'id', 'paid', 'order_id'
		orderID := c.PostForm("order_id")
		isPaid := c.PostForm("paid") == "true"

		if isPaid {
			// 1. Mark Order as PAID
			// 2. Finalize Point Deduction (Redemption)
			// 3. Award NEW Points for the cash spent
			// 4. Issue Tickets
			bookingSvc.FinalizePayment(orderID)
		}

		c.Status(200)
	})

	// 1. Show the Mock Billplz Page
	r.GET("/mock-billplz/:id", func(c *gin.Context) {
		orderID := c.Param("id")

		// We can use a simple HTML string for the mock
		html := fmt.Sprintf(`
        <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Mock Billplz Gateway</h1>
                <p>Order ID: <strong>%s</strong></p>
                <div style="margin-top: 20px;">
                    <form action="/mock-billplz/pay/%s" method="POST">
                        <button type="submit" style="background: #28a745; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 18px; cursor: pointer;">
                            Simulate Successful Payment
                        </button>
                    </form>
                    <br/>
                    <a href="#" style="color: red;">Cancel Payment</a>
                </div>
            </body>
        </html>
    `, orderID, orderID)

		c.Data(200, "text/html; charset=utf-8", []byte(html))
	})

	// 2. Handle the "Payment Success" action
	r.POST("/mock-billplz/pay/:id", func(c *gin.Context) {
		orderID := c.Param("id")

		// Call our Finalize function
		err := bookingSvc.FinalizePayment(orderID)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		// In a real Billplz flow, this would be the 'redirect_url'
		// leading back to your React Native app's Success screen
		c.Writer.Write([]byte("<h1>Payment Successful!</h1><p>You can close this window and return to the app.</p>"))
	})

	// --- 🛡️ AUTHENTICATED USER ROUTES ---
	userAuth := r.Group("/")
	userAuth.Use(middleware.AuthRequired())
	{
		userAuth.GET("/my-orders", func(c *gin.Context) {
			userID := c.MustGet("userID").(uint)
			orders, err := repo.GetUserOrders(userID)
			if err != nil {
				c.JSON(500, gin.H{"error": "Failed to fetch orders"})
				return
			}
			c.JSON(200, orders)
		})

		userAuth.GET("/orders/:id", func(c *gin.Context) {
			id := c.Param("id")
			userID := c.MustGet("userID").(uint)
			order, err := repo.GetOrderWithTickets(id, userID)
			if err != nil {
				c.JSON(404, gin.H{"error": "Order not found"})
				return
			}
			c.JSON(200, order)
		})

		userAuth.GET("/my-tickets", func(c *gin.Context) {
			userID := c.MustGet("userID").(uint)
			tickets, err := repo.GetUserTickets(userID)
			if err != nil {
				c.JSON(500, gin.H{"error": "Could not retrieve tickets"})
				return
			}
			c.JSON(200, tickets)
		})

		userAuth.PUT("/my-profile", func(c *gin.Context) {
			userID := c.MustGet("userID").(uint)
			var input struct {
				Name  string `json:"name"`
				Email string `json:"email" binding:"omitempty,email"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := bookingSvc.UpdateOwnProfile(userID, input.Name, input.Email); err != nil {
				c.JSON(500, gin.H{"error": "Update failed"})
				return
			}
			c.JSON(200, gin.H{"message": "Profile updated successfully!"})
		})

		userAuth.POST("/bookings/bulk", func(c *gin.Context) {
			var req struct {
				EventID  uint   `json:"event_id" binding:"required"`
				Category string `json:"category" binding:"required"`
				Quantity int    `json:"quantity" binding:"required,gt=0"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(400, gin.H{"error": "Invalid input"})
				return
			}
			userID := c.MustGet("userID").(uint)
			if err := bookingSvc.CreateBulkBooking(userID, req.EventID, req.Category, req.Quantity); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "Successfully booked tickets!"})
		})

		userAuth.GET("/users/me", func(c *gin.Context) {
			userID := c.MustGet("userID").(uint)

			// Make sure your repo has a method to get the User by ID
			user, err := repo.GetUserByID(fmt.Sprintf("%d", userID))
			if err != nil {
				c.JSON(404, gin.H{"error": "User not found"})
				return
			}
			c.JSON(200, user)
		})

		// 2. Fetch the Points Transaction History (for PointsHistoryScreen)
		userAuth.GET("/users/me/points", func(c *gin.Context) {
			userID := c.MustGet("userID").(uint)

			history, err := repo.GetPointHistory(userID)
			if err != nil {
				c.JSON(500, gin.H{"error": "Failed to load history"})
				return
			}
			c.JSON(200, history)
		})

		// 1. Create Bill (React Native hits this)
		userAuth.POST("/checkout", func(c *gin.Context) {
			var req struct {
				EventID      uint   `json:"event_id"`
				Category     string `json:"category"`
				Quantity     int    `json:"quantity"`
				RedeemPoints int    `json:"redeem_points"`
			}
			c.ShouldBindJSON(&req)
			userID := c.MustGet("userID").(uint)

			// Call service to create "Pending" order
			// This function should return a URL for the user to visit
			paymentURL, orderID, err := bookingSvc.InitiatePayment(userID, req.EventID, req.Category, req.Quantity, req.RedeemPoints)
			if err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}

			c.JSON(200, gin.H{
				"payment_url": paymentURL,
				"order_id":    orderID,
			}) // You can also return the order ID if needed})
		})

		userAuth.GET("/orders/:id/status", func(c *gin.Context) {
			id := c.Param("id")
			userID := c.MustGet("userID").(uint)

			// Use the existing repo method that checks if the order belongs to the user
			order, err := repo.GetOrderWithTickets(id, userID)
			if err != nil {
				c.JSON(404, gin.H{"error": "Order not found"})
				return
			}

			// Return all info needed by TicketListScreen verifyPaymentStatus
			c.JSON(200, gin.H{
				"id":            order.ID,
				"status":        order.Status, // 'pending', 'paid', or 'cancelled'
				"total":         order.TotalAmount,
				"points_earned": order.PointsEarned,
			})
		})
	}

	// --- 👮 ADMINISTRATIVE & AGENT ROUTES ---
	adminAuth := r.Group("/")
	adminAuth.Use(middleware.AuthRequired())
	{
		// In the adminAuth group in main.go
		adminAuth.GET("/admin/stats", middleware.RolesRequired("agent", "admin"), func(c *gin.Context) {
			stats, err := repo.GetAdminStats() // Now returns the full map
			if err != nil {
				c.JSON(500, gin.H{"error": "Failed to fetch dashboard data"})
				return
			}

			c.JSON(200, stats)
		})
		// Common Agent/Admin Routes
		adminAuth.PATCH("/tickets/:id/checkin", middleware.RolesRequired("agent", "admin"), func(c *gin.Context) {
			ticketID := c.Param("id")
			ticket, err := repo.ScanTicket(ticketID)
			if err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "Check-in successful!", "data": ticket})
		})

		adminAuth.GET("/agent/search-customer", middleware.RolesRequired("agent", "admin"), func(c *gin.Context) {
			nameQuery := c.Query("name")
			users, err := repo.SearchCustomerByName(nameQuery)
			if err != nil {
				c.JSON(500, gin.H{"error": "Search failed"})
				return
			}
			c.JSON(200, users)
		})

		adminAuth.GET("/admin/tickets/lookup", middleware.RolesRequired("agent", "admin"), func(c *gin.Context) {
			email := c.Query("email")
			tickets, err := repo.GetUnscannedByEmail(email)
			if err != nil {
				c.JSON(500, gin.H{"error": "Database error"})
				return
			}
			c.JSON(200, tickets)
		})

		// 2. Process the multi-select check-in
		adminAuth.POST("/admin/tickets/bulk-checkin", middleware.RolesRequired("agent", "admin"), func(c *gin.Context) {

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
		})

		// Admin Only Routes
		adminOnly := adminAuth.Group("/")
		adminOnly.Use(middleware.AdminOnly())
		{
			// adminOnly.GET("/admin/stats", func(c *gin.Context) {
			// 	sold, scanned, err := repo.GetGateStats()
			// 	if err != nil {
			// 		c.JSON(500, gin.H{"error": "Failed to fetch stats"})
			// 		return
			// 	}

			// 	// The keys here MUST match the React Native interface exactly
			// 	c.JSON(200, gin.H{
			// 		"total_sold":    sold,
			// 		"total_scanned": scanned,
			// 	})
			// })

			adminOnly.POST("/admin/events/create", func(c *gin.Context) {
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
			})

			adminOnly.DELETE("/tickets/:id", func(c *gin.Context) {
				if err := bookingSvc.RemoveTicket(c.Param("id")); err != nil {
					c.JSON(500, gin.H{"error": "Delete failed"})
					return
				}
				c.JSON(200, gin.H{"message": "Ticket deleted"})
			})
		}
	}

	r.Run(":8080")
}
