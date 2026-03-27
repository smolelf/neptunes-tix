package domain

type EventStat struct {
	EventID   uint    `json:"event_id"`
	EventName string  `json:"event_name"`
	Revenue   float64 `json:"revenue"`
	Sold      int64   `json:"sold"`
	Scanned   int64   `json:"scanned"`
}

type DashboardStats struct {
	TotalRevenue float64     `json:"total_revenue"`
	TotalSold    int64       `json:"total_sold"`
	TotalScanned int64       `json:"total_scanned"`
	Events       []EventStat `json:"events"`
}

type TierStats struct {
	Category string  `json:"category"`
	Price    float64 `json:"price"`
	Total    int     `json:"total"`
	Sold     int     `json:"sold"`
	Revenue  float64 `json:"revenue"`
}

type EventDashboardData struct {
	Event        Event       `json:"event"`
	TierStats    []TierStats `json:"tier_stats"`
	TotalRevenue float64     `json:"total_revenue"`
	BannerURL    string      `json:"banner_url"`
}
