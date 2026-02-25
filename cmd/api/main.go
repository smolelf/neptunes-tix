package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"neptunes-tix/internal/api" // 👈 Importing our new API folder
	"neptunes-tix/internal/domain"
	"neptunes-tix/internal/repository"
	"neptunes-tix/internal/service"

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

	fmt.Println("🐘 Success! Connected to PostgreSQL.")

	db.AutoMigrate(
		&domain.User{}, &domain.Ticket{}, &domain.Order{},
		&domain.Event{}, &domain.AuditLog{}, &domain.PointTransaction{},
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

	// 🚀 Call our new Routes function!
	api.SetupRoutes(r, repo, bookingSvc)

	r.Run(":8080")
}
