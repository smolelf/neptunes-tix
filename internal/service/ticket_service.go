package service

import (
	"fmt"
	"neptunes-tix/internal/domain"
)

type TicketService struct {
	repo domain.TicketRepository
}

func NewTicketService(r domain.TicketRepository) *TicketService {
	return &TicketService{repo: r}
}

// CreateTicket is where we put our business logic

func (s *TicketService) ListTickets() ([]domain.Ticket, error) {
	return s.repo.GetAll()

}

func (s *TicketService) RemoveTicket(id string) error {
	return s.repo.Delete(id)
}

func (s *TicketService) MarkAsSold(id string) (*domain.Ticket, error) {
	ticket, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err // Ticket doesn't exist
	}

	// Business Rule: Cannot sell a ticket that is already sold
	if ticket.IsSold {
		return nil, fmt.Errorf("ticket with ID %s is already sold", id)
	}

	ticket.IsSold = true
	err = s.repo.Update(ticket)
	return ticket, err
}

func (s *TicketService) CreateTicket(eventName string, price float64) (*domain.Ticket, error) {
	// Business Rule: Price must be positive
	if price < 0 {
		return nil, fmt.Errorf("ticket price cannot be negative")
	}

	newTicket := &domain.Ticket{
		EventName: eventName,
		Price:     price,
		IsSold:    false,
	}

	err := s.repo.Create(newTicket)
	return newTicket, err
}
