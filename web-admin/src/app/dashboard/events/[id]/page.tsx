'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import { 
  ArrowLeft, Edit, Calendar, MapPin, 
  TrendingUp, Users, DollarSign, Ticket 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function EventDashboard() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await apiClient.get(`/admin/events/${eventId}`);
        setData(response.data);
      } catch (error) {
        console.error('Failed to load event dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    if (eventId) fetchDashboard();
  }, [eventId]);

  if (loading) return <div className="p-12 text-center text-gray-500">Loading dashboard...</div>;
  if (!data) return <div className="p-12 text-center text-red-500">Event not found.</div>;

  const { event, tier_stats, total_revenue } = data;
  const totalSold = tier_stats?.reduce((acc: number, curr: any) => acc + curr.sold, 0) || 0;
  const totalCapacity = tier_stats?.reduce((acc: number, curr: any) => acc + curr.total, 0) || 1; // avoid divide by zero
  const sellThroughRate = Math.round((totalSold / totalCapacity) * 100);

  return (
    <div className="p-8 max-w-6xl mx-auto pb-24">
      
      {/* 🟢 HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/events')}>
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{event.event_name || event.name}</h1>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Active</Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(event.date).toLocaleDateString()}</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.venue}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Link href={`/dashboard/events/${eventId}/edit`}>
            <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
              <Edit className="w-4 h-4 mr-2" /> Edit Details
            </Button>
          </Link>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <TrendingUp className="w-4 h-4 mr-2" /> View Reports
          </Button>
        </div>
      </div>

      {/* 📊 KEY METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM {total_revenue?.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">+0% from yesterday</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Tickets Sold</CardTitle>
            <Ticket className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSold} <span className="text-sm font-normal text-gray-400">/ {totalCapacity}</span></div>
            <Progress value={sellThroughRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Check-In Status</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {/* You can wire this up to real check-in data later */}
            <div className="text-2xl font-bold">0 <span className="text-sm font-normal text-gray-400">Arrived</span></div>
            <p className="text-xs text-gray-500 mt-1">Event has not started</p>
          </CardContent>
        </Card>
      </div>

      {/* 📋 TIER BREAKDOWN TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket Sales by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Sold / Cap</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium text-right">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tier_stats?.map((tier: any, index: number) => {
                  const percentage = Math.round((tier.sold / tier.total) * 100);
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{tier.category}</td>
                      <td className="px-4 py-3">RM {tier.price}</td>
                      <td className="px-4 py-3">{tier.sold} / {tier.total}</td>
                      <td className="px-4 py-3 font-medium text-green-600">RM {tier.revenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right w-1/4">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-gray-500 w-8">{percentage}%</span>
                          <Progress value={percentage} className="h-2 w-24" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}