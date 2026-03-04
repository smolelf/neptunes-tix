// web-admin/src/app/dashboard/coupons/page.tsx
'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { Plus, Trash2, TicketPercent, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Define what a Coupon looks like (matches your Go struct)
interface Coupon {
  id: number;
  code: string;
  discount: number;
  discount_type: 'percentage' | 'fixed';
  usage_limit: number;
  used_count: number;
  expiry_date: string;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    discount: '',
    discount_type: 'percentage',
    usage_limit: '100',
    expiry_days: '30'
  });

  // 1. Fetch Coupons on Load
  const fetchCoupons = async () => {
    try {
      const response = await apiClient.get('/admin/coupons');
      setCoupons(response.data || []);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  // 2. Handle Create Coupon
  const handleCreate = async () => {
    if (!formData.code || !formData.discount) return;
    setSubmitting(true);

    try {
        // Calculate expiry date
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + parseInt(formData.expiry_days));

        await apiClient.post('/admin/coupons', {
            code: formData.code.toUpperCase(),
            discount: parseFloat(formData.discount),
            discount_type: formData.discount_type,
            usage_limit: parseInt(formData.usage_limit),
            expiry_date: expiry.toISOString()
        });

        setIsDialogOpen(false);
        setFormData({ code: '', discount: '', discount_type: 'percentage', usage_limit: '100', expiry_days: '30' }); // Reset form
        fetchCoupons(); // Refresh list
    } catch (error) {
        alert('Failed to create coupon');
    } finally {
        setSubmitting(false);
    }
  };

  // 3. Handle Delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await apiClient.delete(`/admin/coupons/${id}`);
      setCoupons(coupons.filter(c => c.id !== id));
    } catch (error) {
      alert('Failed to delete coupon');
    }
  };

  if (loading) return <div className="p-8">Loading coupons...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Promo Codes</h1>
            <p className="text-gray-500 mt-1">Manage discounts and campaigns</p>
        </div>
        
        {/* CREATE MODAL */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Promo Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Code</label>
                    <Input 
                        placeholder="SUMMER2026" 
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select 
                        value={formData.discount_type} 
                        onValueChange={(val) => setFormData({...formData, discount_type: val})}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount (RM)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Discount Value</label>
                    <Input 
                        type="number" 
                        placeholder="10" 
                        value={formData.discount}
                        onChange={(e) => setFormData({...formData, discount: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Usage Limit</label>
                    <Input 
                        type="number" 
                        value={formData.usage_limit}
                        onChange={(e) => setFormData({...formData, usage_limit: e.target.value})}
                    />
                </div>
              </div>

              <Button className="w-full bg-blue-600" onClick={handleCreate} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : 'Save Coupon'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b">
                <tr>
                    <th className="px-6 py-4 font-medium">Code</th>
                    <th className="px-6 py-4 font-medium">Discount</th>
                    <th className="px-6 py-4 font-medium">Usage</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-2">
                            <TicketPercent className="w-4 h-4 text-blue-500" />
                            {coupon.code}
                        </td>
                        <td className="px-6 py-4">
                            {coupon.discount_type === 'percentage' 
                                ? <Badge variant="secondary" className="bg-blue-100 text-blue-700">{coupon.discount}% OFF</Badge>
                                : <Badge variant="secondary" className="bg-green-100 text-green-700">RM {coupon.discount} OFF</Badge>
                            }
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                            {coupon.used_count} / {coupon.usage_limit} used
                        </td>
                        <td className="px-6 py-4">
                            {coupon.used_count >= coupon.usage_limit 
                                ? <Badge variant="destructive">Depleted</Badge> 
                                : <Badge className="bg-green-600">Active</Badge>
                            }
                        </td>
                        <td className="px-6 py-4 text-right">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDelete(coupon.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </td>
                    </tr>
                ))}
                {coupons.length === 0 && (
                    <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500">No coupons found. Create one above!</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
}