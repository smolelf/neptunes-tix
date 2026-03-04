// web-admin/src/app/dashboard/orders/page.tsx
'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/apiClient';
import { Search, ReceiptText, ExternalLink, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Slide-out Panel State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await apiClient.get('/admin/orders');
        setOrders(response.data || []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  // 🚀 The new function to open the panel and fetch details
  const handleOpenDetails = async (orderId: string) => {
    setIsSheetOpen(true);
    setDetailsLoading(true);
    try {
      const response = await apiClient.get(`/admin/orders/${orderId}`);
      setSelectedOrder(response.data);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const search = searchTerm.toLowerCase();
    const email = order.user?.email?.toLowerCase() || order.User?.email?.toLowerCase() || '';
    const ref = order.gateway_ref?.toLowerCase() || '';
    const orderId = order.id?.toString() || '';
    return email.includes(search) || ref.includes(search) || orderId.includes(search);
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Transactions Ledger</h1>
          <p className="text-gray-500 mt-1">View all purchases, points applied, and payment gateways.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search email, ref, or order ID..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-h-[500px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 border-b">
            <tr>
              <th className="px-6 py-4 font-medium">Order ID</th>
              <th className="px-6 py-4 font-medium">Customer</th>
              <th className="px-6 py-4 font-medium">Payment Details</th>
              <th className="px-6 py-4 font-medium">Total</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
               <tr>
                 <td colSpan={6} className="p-8 text-center text-gray-500">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                 </td>
               </tr>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const user = order.user || order.User; // Handle Go's JSON struct capitalization differences
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-bold text-gray-900">#{order.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{user?.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{user?.email || 'No email'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="font-medium">{order.payment_method || 'N/A'}</div>
                      <div className="text-xs text-gray-400 font-mono">Ref: {order.gateway_ref || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-green-600">RM {order.total_amount?.toFixed(2)}</div>
                      {(order.points_applied > 0 || order.coupon_discount > 0) && (
                        <div className="text-xs text-gray-400 line-through">
                          RM {(order.total_amount + (order.points_applied / 100) + order.coupon_discount).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {order.status === 'paid' ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Paid</Badge>
                      ) : order.status === 'pending' ? (
                          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none">Pending</Badge>
                      ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Cancelled</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* 🚀 Changed to trigger the slide-out */}
                      <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-50" onClick={() => handleOpenDetails(order.id)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🟢 THE SLIDE-OUT PANEL (SHEET) */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto bg-white">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold text-gray-900">Order Details</SheetTitle>
            <SheetDescription>
              {selectedOrder ? `Invoice #${selectedOrder.id}` : 'Loading...'}
            </SheetDescription>
          </SheetHeader>

          {detailsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : selectedOrder ? (
            <div className="space-y-8 text-gray-800 px-6">
              
              {/* Financial Breakdown */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium text-right">{selectedOrder.User?.name}<br/><span className="text-xs text-gray-400">{selectedOrder.User?.email}</span></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment Method</span>
                  <span className="font-medium">{selectedOrder.payment_method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Gateway Ref</span>
                  <span className="font-mono text-xs">{selectedOrder.gateway_ref}</span>
                </div>
                
                <div className="pt-3 border-t border-gray-200 mt-2 space-y-1">
                   {(selectedOrder.points_applied > 0) && (
                     <div className="flex justify-between text-sm text-orange-600">
                       <span>Points Redeemed</span>
                       <span>- RM {(selectedOrder.points_applied / 100).toFixed(2)}</span>
                     </div>
                   )}
                   {(selectedOrder.coupon_discount > 0) && (
                     <div className="flex justify-between text-sm text-blue-600">
                       <span>Promo Code Applied</span>
                       <span>- RM {selectedOrder.coupon_discount.toFixed(2)}</span>
                     </div>
                   )}
                   <div className="flex justify-between font-bold text-lg pt-2 text-green-600">
                     <span>Total Paid</span>
                     <span>RM {selectedOrder.total_amount?.toFixed(2)}</span>
                   </div>
                </div>
              </div>

              {/* Ticket Roster */}
              <div>
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <ReceiptText className="w-5 h-5 text-gray-400" /> Associated Tickets
                </h3>
                <div className="space-y-3">
                  {selectedOrder.tickets?.map((ticket: any) => (
                    <div key={ticket.id} className="p-3 border rounded-lg flex items-center justify-between shadow-sm">
                      <div>
                        <p className="font-bold text-sm text-gray-900">{ticket.Event?.name || 'Event'}</p>
                        <p className="text-xs text-gray-500">Tier: <span className="font-medium text-gray-700">{ticket.category}</span></p>
                        <p className="text-xs text-gray-400 font-mono mt-1">ID: ...{ticket.id.slice(-6).toUpperCase()}</p>
                      </div>
                      <div>
                        {ticket.checked_in_at ? (
                          <div className="flex flex-col items-end gap-1">
                            <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-none flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Scanned
                            </Badge>
                            <span className="text-[10px] text-gray-400">
                              {new Date(ticket.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!selectedOrder.tickets || selectedOrder.tickets.length === 0) && (
                    <p className="text-sm text-gray-500 text-center py-4">No tickets found for this order.</p>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <p className="text-center text-gray-500">Could not load details.</p>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}