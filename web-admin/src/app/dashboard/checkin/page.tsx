'use client';

import { useState } from 'react';
import apiClient from '@/lib/apiClient';
import { Search, CheckCircle2, Ticket, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ManualCheckInPage() {
  const [email, setEmail] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // 1. Search for Unscanned Tickets
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setMessage(null);
    setSelectedIds([]);

    try {
      const response = await apiClient.get(`/admin/tickets/lookup?email=${email}`);
      const foundTickets = response.data || [];
      setTickets(foundTickets);
      
      if (foundTickets.length === 0) {
        setMessage({ type: 'error', text: 'No unscanned tickets found for this email.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to look up tickets.' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Toggle Checkbox Selection
  const toggleSelection = (ticketId: string) => {
    setSelectedIds(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId) 
        : [...prev, ticketId]
    );
  };

  // 3. Process Bulk Check-In
  const handleBulkCheckIn = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setMessage(null);

    try {
      await apiClient.post('/admin/tickets/bulk-checkin', {
        ticket_ids: selectedIds
      });
      
      setMessage({ type: 'success', text: `Successfully checked in ${selectedIds.length} tickets!` });
      setTickets([]); // Clear the list on success
      setSelectedIds([]);
      setEmail('');
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Check-in failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manual Check-In</h1>
        <p className="text-gray-500 mt-1">Look up and admit guests who cannot access their digital tickets.</p>
      </div>

      <Card className="mb-8 border-blue-100 shadow-sm">
        <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
          <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
            <Search className="w-5 h-5" /> Find Guest Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input 
              type="email" 
              placeholder="Enter guest email address..." 
              className="flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-32" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Selection List */}
      {tickets.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Ticket className="w-5 h-5" /> Unscanned Tickets Found ({tickets.length})
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedIds(tickets.length === selectedIds.length ? [] : tickets.map(t => t.id))}
            >
              {tickets.length === selectedIds.length ? 'Deselect All' : 'Select All'}
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {tickets.map(ticket => (
                <label key={ticket.id} className="flex items-center gap-4 py-4 cursor-pointer hover:bg-gray-50 px-2 rounded transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedIds.includes(ticket.id)}
                    onChange={() => toggleSelection(ticket.id)}
                  />
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{ticket.event?.name || 'Unknown Event'}</p>
                    <p className="text-sm text-gray-500">Tier: <span className="font-semibold text-gray-700">{ticket.category}</span></p>
                  </div>
                  <div className="text-right text-xs text-gray-400 font-mono">
                    ID: ...{ticket.id.slice(-8).toUpperCase()}
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">
                {selectedIds.length} ticket(s) selected
              </span>
              <Button 
                onClick={handleBulkCheckIn} 
                disabled={selectedIds.length === 0 || submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Admit Selected Guests
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}