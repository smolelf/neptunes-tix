package repository

import (
	"fmt"
	"neptunes-tix/internal/domain"
)

func (d *dbRepo) GetAdminStats() (map[string]interface{}, error) {
	var totalRevenue float64
	var totalSold, totalScanned int64

	// 1. Calculate Global Stats
	d.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Select("SUM(price)").Row().Scan(&totalRevenue)
	d.db.Model(&domain.Ticket{}).Where("is_sold = ?", true).Count(&totalSold)
	d.db.Model(&domain.Ticket{}).Where("checked_in_at IS NOT NULL").Count(&totalScanned)

	// 2. Calculate Individual Event Stats
	type EventResult struct {
		EventID   uint    `json:"event_id"`
		EventName string  `json:"event_name"`
		Revenue   float64 `json:"revenue"`
		Sold      int64   `json:"sold"`
		Scanned   int64   `json:"scanned"`
	}
	var eventStats []EventResult

	var recentLogs []domain.AuditLog
	d.db.Order("created_at desc").Limit(10).Find(&recentLogs)
	fmt.Println(recentLogs)

	// Raw SQL grouping is the most efficient way to get this nested data
	d.db.Table("tickets").
		Select("events.id as event_id, events.name as event_name, SUM(tickets.price) as revenue, COUNT(tickets.id) as sold, COUNT(tickets.checked_in_at) as scanned").
		Joins("join events on events.id = tickets.event_id").
		Where("tickets.is_sold = ?", true).
		Group("events.id, events.name").
		Scan(&eventStats)

	return map[string]interface{}{
		"total_revenue": totalRevenue,
		"total_sold":    totalSold,
		"total_scanned": totalScanned,
		"events":        eventStats,
		"recent_logs":   recentLogs,
	}, nil
}
