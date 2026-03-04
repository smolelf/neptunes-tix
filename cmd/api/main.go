package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"neptunes-tix/internal/api"
	"neptunes-tix/internal/domain"
	"neptunes-tix/internal/repository"
	"neptunes-tix/internal/service"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Kuala_Lumpur",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASS"), os.Getenv("DB_NAME"), os.Getenv("DB_PORT"))

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to PostgreSQL:", err)
	}

	// fmt.Println("🐘 Success! Connected to PostgreSQL.")

	db.AutoMigrate(
		&domain.User{}, &domain.Ticket{}, &domain.Order{},
		&domain.Event{}, &domain.AuditLog{}, &domain.PointTransaction{},
		&domain.Coupon{},
	)

	repo := repository.NewDBRepo(db)
	bookingSvc := service.NewBookingService(repo)
	// Start Background Worker
	go func() {
		for {
			time.Sleep(1 * time.Minute)
			released, err := repo.CleanupExpiredOrders(15 * time.Minute)
			if err == nil && released > 0 {
				fmt.Printf("🧹 Cleanup: Released %d tickets from expired orders\n", released)
			}
		}
	}()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		// 1. Who is allowed to talk to your API?
		AllowOrigins: []string{
			"http://localhost:3000",         // Your local Next.js dev server
			"https://admin.neptunestix.com", // Your future production web URL
		},

		// 2. What actions can they perform?
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},

		// 3. What headers can they send? (Critical for your JWT Auth)
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
			"Authorization", // 👈 This allows your Bearer token through!
		},

		// 4. Expose headers to the frontend (Optional but good)
		ExposeHeaders: []string{"Content-Length"},

		// 5. Allow cookies/credentials to be sent
		AllowCredentials: true,

		// 6. Cache the OPTIONS "preflight" response for 12 hours to speed up requests
		MaxAge: 12 * time.Hour,
	}))

	// 🚀 Call our new Routes function!
	api.SetupRoutes(r, repo, bookingSvc)

	r.Run(":8080")
}
