package repository

import (
	"neptunes-tix/internal/domain"
	"time"

	"gorm.io/gorm"
)

func (d *dbRepo) CreateOrder(order *domain.Order) error {
	return d.db.Create(order).Error
}

func (d *dbRepo) GetUserTickets(userID uint) ([]domain.Ticket, error) {
	var tickets []domain.Ticket
	err := d.db.Preload("Event").
		Joins("JOIN orders ON orders.id = tickets.order_id").
		Where("orders.user_id = ?", userID).
		Find(&tickets).Error
	return tickets, err
}

func (d *dbRepo) GetUserOrders(userID uint) ([]domain.Order, error) {
	var orders []domain.Order
	err := d.db.Preload("Tickets.Event").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&orders).Error
	return orders, err
}

func (d *dbRepo) GetOrderWithTickets(orderID string, userID uint) (domain.Order, error) {
	var order domain.Order
	err := d.db.Preload("Tickets.Event").
		Where("id = ? AND user_id = ?", orderID, userID).
		First(&order).Error
	return order, err
}

func (d *dbRepo) UpdateTicketBatch(tickets []domain.Ticket) error {
	return d.db.Save(&tickets).Error
}

func (d *dbRepo) Transaction(fn func(domain.TicketRepository) error) error {
	return d.db.Transaction(func(tx *gorm.DB) error {
		// Create a new instance of your repo using the transaction DB handle
		txRepo := NewDBRepo(tx)
		return fn(txRepo)
	})
}

func (d *dbRepo) GetOrderById(id string) (*domain.Order, error) {
	var order domain.Order
	// 🚀 CRITICAL: We MUST Preload Tickets so FinalizePayment can mark them as sold
	err := d.db.Preload("Tickets").First(&order, "id = ?", id).Error
	return &order, err
}

func (d *dbRepo) UpdateOrder(order *domain.Order) error {
	return d.db.Save(order).Error
}

func (d *dbRepo) UpdateOrderFields(orderID uint, fields map[string]interface{}) error {
	// This forces a SQL UPDATE statement instead of an INSERT
	return d.db.Model(&domain.Order{}).Where("id = ?", orderID).Updates(fields).Error
}

func (d *dbRepo) CleanupExpiredOrders(timeout time.Duration) (int64, error) {
	// Find orders that are 'pending' and older than the timeout
	expirationTime := time.Now().Add(-timeout)

	var expiredOrders []domain.Order
	d.db.Where("status = ? AND created_at < ?", "pending", expirationTime).Find(&expiredOrders)

	if len(expiredOrders) == 0 {
		return 0, nil
	}

	var totalReleased int64
	for _, order := range expiredOrders {
		// 1. Unlink tickets from this order
		// We set order_id to NULL so they show up in Marketplace again
		res := d.db.Model(&domain.Ticket{}).Where("order_id = ?", order.ID).Update("order_id", nil)
		totalReleased += res.RowsAffected

		// 2. Mark order as expired so it doesn't get picked up again
		d.db.Model(&order).Update("status", "expired")
	}

	return totalReleased, nil
}
