// web-admin/src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CreditCard, Users, Ticket } from 'lucide-react';
import Cookies from 'js-cookie';
import Link from 'next/link';


export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 🔒 Security Check: Kick them to login if no token exists
    const token = Cookies.get('adminToken');
    if (!token) {
      router.push('/');
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await apiClient.get('/admin/stats');
        setStats(response.data);
      } catch (error) {
        console.error("Dashboard fetch failed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard Overview</h1>
          <button 
            onClick={() => { Cookies.remove('adminToken'); router.push('/'); }}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-100"
          >
            Log Out
          </button>
        </div>

        {/* 📊 Top Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {stats?.total_revenue?.toLocaleString() || '0'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Tickets Sold</CardTitle>
              <Ticket className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_sold?.toLocaleString() || '0'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Checked In</CardTitle>
              <Users className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_scanned?.toLocaleString() || '0'}</div>
            </CardContent>
          </Card>
        </div>

        {/* 📋 Event Management List */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-4">Active Events</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {stats?.events?.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Event Name</th>
                    <th className="px-6 py-4 font-medium">Tickets Sold</th>
                    <th className="px-6 py-4 font-medium">Revenue</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.events.map((event: any) => (
                    <tr key={event.event_id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-900">{event.event_name}</td>
                      <td className="px-6 py-4">{event.sold}</td>
                      <td className="px-6 py-4 text-green-600 font-medium">RM {event.revenue?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                            href={`/dashboard/events/${event.event_id}`}  // 🚀 Links to the new Dashboard
                            className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                            Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No active events found.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}