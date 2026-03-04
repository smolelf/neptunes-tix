'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/apiClient';
import { ArrowLeft, Plus, Trash2, Loader2, Calendar, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// The shape of a single ticket tier
interface TierInput {
  category: string;
  price: string;
  stock: string;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // 1. Basic Event Details
  const [eventData, setEventData] = useState({
    name: '',
    venue: '',
    date: '',
    doors_open: '',
    location_url: ''
  });

  // 2. Dynamic Ticket Tiers (Start with one empty tier)
  const [tiers, setTiers] = useState<TierInput[]>([
    { category: '', price: '', stock: '' }
  ]);

  // --- Dynamic Form Handlers ---
  const addTier = () => {
    setTiers([...tiers, { category: '', price: '', stock: '' }]);
  };

  const removeTier = (indexToRemove: number) => {
    setTiers(tiers.filter((_, index) => index !== indexToRemove));
  };

  const updateTier = (index: number, field: keyof TierInput, value: string) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  // --- Submission Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Clean up the data types before sending to Go
      const payload = {
        event_name: eventData.name,
        venue: eventData.venue,
        date: eventData.date,
        doors_open: eventData.doors_open,
        location_url: eventData.location_url,
        tiers: tiers.map(t => ({
          category: t.category.toUpperCase(),
          price: parseFloat(t.price),
          quantity: parseInt(t.stock)
        }))
      };

      await apiClient.post('/admin/events/create', payload);
      
      // Navigate back to the events list on success
      router.push('/dashboard/events');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create event');
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-24">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Launch New Event</h1>
          <p className="text-gray-500 mt-1">Fill in the details and set up your ticket tiers.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: Event Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">1. Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Name</label>
              <Input 
                placeholder="e.g. Neon Nights Music Festival" 
                required
                value={eventData.name}
                onChange={e => setEventData({...eventData, name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500"/> Venue Name</label>
                <Input 
                  placeholder="e.g. Stadium Merdeka" 
                  required
                  value={eventData.venue}
                  onChange={e => setEventData({...eventData, venue: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500"/> Google Maps URL</label>
                <Input 
                  placeholder="https://maps.google.com/..." 
                  value={eventData.location_url}
                  onChange={e => setEventData({...eventData, location_url: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-500"/> Date</label>
                <Input 
                  type="date" 
                  required
                  value={eventData.date}
                  onChange={e => setEventData({...eventData, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Clock className="w-4 h-4 text-gray-500"/> Doors Open Time</label>
                <Input 
                  type="time" 
                  required
                  value={eventData.doors_open}
                  onChange={e => setEventData({...eventData, doors_open: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: Ticket Tiers (Dynamic Array) */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="text-xl">2. Ticket Tiers</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addTier} className="text-blue-600 border-blue-200 hover:bg-blue-50">
              <Plus className="w-4 h-4 mr-1" /> Add Tier
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {tiers.map((tier, index) => (
              <div key={index} className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100 relative group transition-all hover:border-blue-200">
                
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Category Name</label>
                  <Input 
                    placeholder="e.g. VIP, Early Bird" 
                    required
                    value={tier.category}
                    onChange={e => updateTier(index, 'category', e.target.value)}
                  />
                </div>

                <div className="w-32 space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Price (RM)</label>
                  <Input 
                    type="number" 
                    placeholder="150" 
                    min="0" step="0.01" required
                    value={tier.price}
                    onChange={e => updateTier(index, 'price', e.target.value)}
                  />
                </div>

                <div className="w-32 space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Stock</label>
                  <Input 
                    type="number" 
                    placeholder="500" 
                    min="1" required
                    value={tier.stock}
                    onChange={e => updateTier(index, 'stock', e.target.value)}
                  />
                </div>

                {/* Only allow deleting if there's more than 1 tier */}
                {tiers.length > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 mb-0.5"
                    onClick={() => removeTier(index)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}

              </div>
            ))}
            
          </CardContent>
        </Card>

        {/* Submit Action */}
        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto px-12 text-lg h-14" disabled={submitting}>
            {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : 'Launch Event'}
          </Button>
        </div>

      </form>
    </div>
  );
}