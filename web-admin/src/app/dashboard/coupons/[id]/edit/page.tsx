'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/apiClient';
import { ArrowLeft, Save, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function EditCouponPage() {
  const router = useRouter();
  const params = useParams();
  const couponId = params.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    discount: '',
    discount_type: 'percentage',
    usage_limit: '',
    expiry_date: '',
    is_active: true
  });

  // Fetch Existing Coupon
  useEffect(() => {
    const fetchCoupon = async () => {
      try {
        const response = await apiClient.get(`/admin/coupons/${couponId}`);
        const data = response.data;
        
        setFormData({
          code: data.code || '',
          discount: data.discount?.toString() || '',
          discount_type: data.discount_type || 'percentage',
          usage_limit: data.usage_limit?.toString() || '',
          expiry_date: data.expiry_date ? data.expiry_date.split('T')[0] : '', 
          is_active: data.is_active !== false // Defaults to true unless explicitly false
        });
      } catch (error) {
        console.error('Failed to fetch coupon:', error);
        alert('Could not load coupon details.');
      } finally {
        setLoading(false);
      }
    };

    if (couponId) fetchCoupon();
  }, [couponId]);

  // Submit Update
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Ensure time is appended to the date so Go parses it correctly
      const expiryISO = formData.expiry_date ? new Date(formData.expiry_date).toISOString() : new Date().toISOString();

      await apiClient.put(`/admin/coupons/${couponId}`, {
        code: formData.code.toUpperCase(),
        discount: parseFloat(formData.discount),
        discount_type: formData.discount_type,
        usage_limit: parseInt(formData.usage_limit),
        expiry_date: expiryISO,
        is_active: formData.is_active
      });
      
      alert('Promo code updated successfully!');
      router.push('/dashboard/coupons');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update promo code');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading coupon details...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Edit Promo Code</h1>
          <p className="text-gray-500 mt-1">Update rules and limits for {formData.code}</p>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Coupon Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Promo Code</label>
                    <Input required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={formData.is_active ? "true" : "false"} onValueChange={(val) => setFormData({...formData, is_active: val === "true"})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">Active</SelectItem>
                            <SelectItem value="false">Paused / Disabled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Discount Value</label>
                <Input type="number" step="0.01" required value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Discount Type</label>
                <Select value={formData.discount_type} onValueChange={(val) => setFormData({...formData, discount_type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (RM)</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Total Usage Limit</label>
                    <Input type="number" required value={formData.usage_limit} onChange={e => setFormData({...formData, usage_limit: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-500"/> Expiry Date</label>
                    <Input type="date" required value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} />
                </div>
            </div>

          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto px-12 text-lg h-14" disabled={submitting}>
            {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <><Save className="w-5 h-5 mr-2"/> Save Changes</>}
          </Button>
        </div>
      </form>
    </div>
  );
}