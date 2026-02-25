package repository

import (
	"fmt"
	"neptunes-tix/internal/domain"

	"gorm.io/gorm"
)

func (d *dbRepo) CreateEventStock(req domain.CreateEventRequest) error {
	return d.db.Transaction(func(tx *gorm.DB) error {
		newEvent := domain.Event{
			Name:        req.EventName,
			Description: req.Description,
			Venue:       req.Venue,
			Date:        req.Date,
			LocationURL: req.LocationURL,
			DoorsOpen:   req.DoorsOpen,
		}
		if err := tx.Create(&newEvent).Error; err != nil {
			return err
		}

		var tickets []domain.Ticket
		for _, tier := range req.Tiers {
			for i := 0; i < tier.Quantity; i++ {
				// Just add the data to the slice, don't hit the DB yet
				tickets = append(tickets, domain.Ticket{
					EventID:  newEvent.ID,
					Category: tier.Category,
					Price:    tier.Price,
					IsSold:   false,
				})
			}
		}

		// Safety check: Don't try to insert if the slice is empty
		if len(tickets) == 0 {
			return fmt.Errorf("no tickets were generated. check tier quantities")
		}

		// ONE single database call to insert everything in the slice
		return tx.Create(&tickets).Error
	})
}

// 1. Implement GetEventByID
func (d *dbRepo) GetEventByID(id uint) (*domain.Event, error) {
	var event domain.Event
	err := d.db.First(&event, id).Error
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// 2. Implement GetAllEvents (The one causing your error!)
func (d *dbRepo) GetAllEvents() ([]domain.Event, error) {
	var events []domain.Event
	err := d.db.Find(&events).Error
	return events, err
}

// Note: CreateEventStock is already in your db_repo.go,
// so you don't need to move it unless you want to clean up.
