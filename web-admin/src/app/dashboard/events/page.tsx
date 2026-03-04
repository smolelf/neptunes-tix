'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { Plus, CalendarDays, MapPin, Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // We reuse the stats endpoint because it contains event-level sales data!
        const response = await apiClient.get('/admin/stats');
        setEvents(response.data?.events || []);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) return <div className="p-8">Loading events...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manage Events</h1>
          <p className="text-gray-500 mt-1">View and manage your upcoming shows</p>
        </div>
        
        {/* Route to a dedicated creation page */}
        <Link href="/dashboard/events/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" /> Create New Event
          </Button>
        </Link>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 border-b">
            <tr>
              <th className="px-6 py-4 font-medium">Event Details</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Tickets Sold</th>
              <th className="px-6 py-4 font-medium">Revenue</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((event) => (
              <tr key={event.event_id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900 text-base">{event.event_name}</div>
                  <div className="flex items-center text-gray-500 mt-1 text-xs gap-3">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{event.event_venue}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3"/>{event.event_date}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Active</Badge>
                </td>
                <td className="px-6 py-4 font-medium text-gray-600">
                  {event.sold} / {event.sold + 50} {/* Placeholder capacity */}
                </td>
                <td className="px-6 py-4 font-bold text-green-600">
                  RM {event.revenue?.toLocaleString() || '0'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-8">
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50">
                      <Edit className="w-4 h-4 mr-1" /> Edit
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No active events. Click "Create New Event" to get started!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}