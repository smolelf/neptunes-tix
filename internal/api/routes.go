package api

import (
	"fmt"
	"neptunes-tix/internal/domain"
	"neptunes-tix/internal/middleware"
	"neptunes-tix/internal/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// SetupRoutes wires up all the HTTP endpoints
func SetupRoutes(r *gin.Engine, rawRepo any, bookingSvc *service.BookingService) {

	// 1. Cast rawRepo so the Admin Handlers can use it
	adminRepo := rawRepo.(AdminRepo)

	// 2. Cast rawRepo so the inline Public/User routes can use it
	// (Assuming TicketRepository is your "Super Interface" that has everything)
	repo := rawRepo.(domain.TicketRepository)

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

	r.POST("/users", HandleUserRegistration(bookingSvc))

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
		orderID := c.PostForm("order_id")
		isPaid := c.PostForm("paid") == "true"
		if isPaid {
			bookingSvc.FinalizePayment(orderID)
		}
		c.Status(200)
	})

	r.GET("/mock-billplz/:id", func(c *gin.Context) {
		orderID := c.Param("id")
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

	r.POST("/mock-billplz/pay/:id", func(c *gin.Context) {
		orderID := c.Param("id")
		err := bookingSvc.FinalizePayment(orderID)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
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
				Name     string `json:"name"`
				Email    string `json:"email" binding:"omitempty,email"`
				Password string `json:"password"` // 🚀 New
				Avatar   string `json:"avatar"`   // 🚀 New (Base64)
			}

			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}

			// Pass all fields to the service
			if err := bookingSvc.UpdateOwnProfile(userID, input.Name, input.Email, input.Password, input.Avatar); err != nil {
				c.JSON(500, gin.H{"error": "Update failed"})
				return
			}

			c.JSON(200, gin.H{"message": "Profile updated successfully!"})
		})

		userAuth.GET("/users/me", func(c *gin.Context) {
			userID := c.MustGet("userID").(uint)
			user, err := repo.GetUserByID(fmt.Sprintf("%d", userID))
			if err != nil {
				c.JSON(404, gin.H{"error": "User not found"})
				return
			}
			c.JSON(200, user)
		})

		userAuth.GET("/users/me/points", func(c *gin.Context) {
			userID := c.MustGet("userID").(uint)
			history, err := repo.GetPointHistory(userID)
			if err != nil {
				c.JSON(500, gin.H{"error": "Failed to load history"})
				return
			}
			c.JSON(200, history)
		})

		// 🚀 THE MAGIC: Routing to the newly created, multi-item handler
		userAuth.POST("/checkout", HandleCheckout(bookingSvc))

		userAuth.GET("/orders/:id/status", func(c *gin.Context) {
			id := c.Param("id")
			userID := c.MustGet("userID").(uint)
			order, err := repo.GetOrderWithTickets(id, userID)
			if err != nil {
				c.JSON(404, gin.H{"error": "Order not found"})
				return
			}
			c.JSON(200, gin.H{
				"id":            order.ID,
				"status":        order.Status,
				"total":         order.TotalAmount,
				"points_earned": order.PointsEarned,
			})
		})
	}

	// --- 👮 ADMINISTRATIVE & AGENT ROUTES ---
	adminAuth := r.Group("/")
	adminAuth.Use(middleware.AuthRequired())
	{
		// 🚀 This is the magic! Look how clean this is compared to the old version.
		adminAuth.GET("/admin/stats", middleware.RolesRequired("agent", "admin"), HandleAdminStats(adminRepo))
		adminAuth.PATCH("/tickets/:id/checkin", middleware.RolesRequired("agent", "admin"), HandleTicketCheckin(bookingSvc))
		adminAuth.GET("/agent/search-customer", middleware.RolesRequired("agent", "admin"), HandleSearchCustomer(adminRepo))
		adminAuth.GET("/admin/tickets/lookup", middleware.RolesRequired("agent", "admin"), HandleTicketLookup(adminRepo))
		adminAuth.POST("/admin/tickets/bulk-checkin", middleware.RolesRequired("agent", "admin"), HandleBulkCheckin(adminRepo))

		// Admin Only Routes
		adminOnly := adminAuth.Group("/")
		adminOnly.Use(middleware.AdminOnly())
		{
			adminOnly.POST("/admin/events/create", HandleCreateEvent(adminRepo))
			adminOnly.DELETE("/tickets/:id", HandleDeleteTicket(bookingSvc))
		}
	}
}
