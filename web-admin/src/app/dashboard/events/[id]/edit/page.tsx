// web-admin/src/app/dashboard/events/[id]/edit/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/apiClient';
import { ArrowLeft, Save, Loader2, Calendar, MapPin,
  Clock, Plus, Trash2, Undo, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const [existingGallery, setExistingGallery] = useState<any[]>([]); // Images already on the server
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]); // New files waiting to be uploaded
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Basic Details State
  const [eventData, setEventData] = useState({
    name: '',
    description: '',
    venue: '',
    date: '',
    doors_open: '',
    location_url: ''
  });

  // 2. Complex Tier Management States
  const [currentTiers, setCurrentTiers] = useState<any[]>([]);
  const [addStock, setAddStock] = useState<Record<string, number>>({});
  const [removeTiers, setRemoveTiers] = useState<string[]>([]);
  const [newTiers, setNewTiers] = useState<{ category: string; price: string; quantity: string }[]>([]);

  // --- Fetch Data ---
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await apiClient.get(`/admin/events/${eventId}`);
        const data = response.data;
        const evt = data.event || data;

        setEventData({
          name: evt.event_name || evt.name || '',
          description: evt.description || '',
          venue: evt.venue || '',
          date: evt.date ? evt.date.split('T')[0] : '',
          doors_open: evt.doors_open || '',
          location_url: evt.location_url || ''
        });

        if (evt.banner_url) {
          setPreviewUrl(`http://localhost:8080${evt.banner_url}`);
        }

        if (evt.images && Array.isArray(evt.images)) {
          setExistingGallery(evt.images);
        }

        setCurrentTiers(data.tier_stats || []);
        
      } catch (error) {
        console.error('Failed to fetch event:', error);
        alert('Could not load event details.');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchEvent();
  }, [eventId]);

  // --- Handlers for Existing Tiers ---
  const incrementAddStock = (category: string) => {
    setAddStock(prev => ({ ...prev, [category]: (prev[category] || 0) + 1 }));
  };

  const decrementAddStock = (category: string) => {
    setAddStock(prev => {
      const current = prev[category] || 0;
      if (current <= 0) return prev;
      return { ...prev, [category]: current - 1 };
    });
  };

  const toggleRemoveTier = (category: string) => {
    if (removeTiers.includes(category)) {
      setRemoveTiers(removeTiers.filter(c => c !== category));
    } else {
      if (confirm(`Are you sure? This will delete all unsold '${category}' tickets. It will fail if any have already been sold.`)) {
        setRemoveTiers([...removeTiers, category]);
      }
    }
  };

  // --- Handlers for New Tiers ---
  const addNewTierRow = () => setNewTiers([...newTiers, { category: '', price: '', quantity: '' }]);
  const removeNewTierRow = (index: number) => setNewTiers(newTiers.filter((_, i) => i !== index));
  const updateNewTier = (index: number, field: string, value: string) => {
    const updated = [...newTiers];
    updated[index] = { ...updated[index], [field as keyof typeof updated[0]]: value };
    setNewTiers(updated);
  };

  // --- Submit Handler ---
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Format new tiers
    const formattedNewTiers = newTiers
      .filter(t => t.category && t.price && t.quantity)
      .map(t => ({
        category: t.category.toUpperCase(),
        price: parseFloat(t.price),
        quantity: parseInt(t.quantity, 10)
      }));

    // Format added stock
    const formattedAddStock = Object.keys(addStock)
      .filter(category => addStock[category] > 0)
      .map(category => {
        const existingTier = currentTiers.find((t: any) => t.category === category);
        return {
          category,
          quantity: addStock[category],
          price: existingTier ? existingTier.price : 0 
        };
      });

    try {
      const payload = {
        event_name: eventData.name,
        description: eventData.description,
        venue: eventData.venue,
        date: eventData.date,
        doors_open: eventData.doors_open,
        location_url: eventData.location_url,
        add_tiers: formattedNewTiers.length > 0 ? formattedNewTiers : undefined,
        add_stock: formattedAddStock.length > 0 ? formattedAddStock : undefined,
        remove_tiers: removeTiers.length > 0 ? removeTiers : undefined,
      };

      await apiClient.put(`/admin/events/${eventId}`, payload);
      
      alert('Event updated successfully!');
      router.push('/dashboard/events');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update event');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Handle the user picking a file from their computer
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setBannerFile(file);
      
      // Create a temporary local URL so the admin can preview the image instantly
      setPreviewUrl(URL.createObjectURL(file)); 
    }
  };

  // 2. Handle sending it to the Go Server
  const handleUploadBanner = async () => {
    if (!bannerFile) return;
    setIsUploading(true);

    // This packages the file exactly how Postman does!
    const formData = new FormData();
    formData.append('banner', bannerFile); 

    try {
      // Assuming apiClient is your Axios instance
      const response = await apiClient.post(`/admin/events/${eventId}/banner`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data', // Crucial for file uploads!
        },
      });

      alert('Banner uploaded successfully!');
      
      // Update the preview to use the actual server URL now!
      // (Assuming your Go server is running on localhost:8080)
      setPreviewUrl(`http://localhost:8080${response.data.banner_url}`);
      setBannerFile(null); // Clear the pending file
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload banner.');
    } finally {
      setIsUploading(false);
    }
  };

  // 1. Handle selecting multiple files
  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Convert the FileList object into a standard array and add it to our state
      const newFiles = Array.from(e.target.files);
      setGalleryFiles((prev) => [...prev, ...newFiles]);
    }
  };

  // 2. Remove a file before uploading if the admin changes their mind
  const removePendingFile = (indexToRemove: number) => {
    setGalleryFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  // 3. Send the whole batch to the Go Server!
  const handleUploadGallery = async () => {
    if (galleryFiles.length === 0) return;
    setIsUploadingGallery(true);

    const formData = new FormData();
    // Append every single file to the "gallery" key (just like we did in Postman!)
    galleryFiles.forEach((file) => formData.append('gallery', file));

    try {
      const response = await apiClient.post(`/admin/events/${eventId}/gallery`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert(`Successfully uploaded ${galleryFiles.length} images!`);
      
      // Clear the pending files
      setGalleryFiles([]);
      
      // Ideally, re-fetch the event here to refresh the existingGallery state, 
      // or just force a page reload to see the new images.
      window.location.reload(); 

    } catch (error) {
      console.error('Gallery upload failed:', error);
      alert('Failed to upload gallery images.');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading event details...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Edit Event</h1>
          <p className="text-gray-500 mt-1">Update details for Event #{eventId}</p>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        
        {/* SECTION 1: EVENT DETAILS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">1. Event Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Name</label>
              <Input required value={eventData.name} onChange={e => setEventData({...eventData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Description</label>
              <Input value={eventData.description} onChange={e => setEventData({...eventData, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500"/> Venue Name</label>
                <Input required value={eventData.venue} onChange={e => setEventData({...eventData, venue: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500"/> Google Maps URL</label>
                <Input value={eventData.location_url} onChange={e => setEventData({...eventData, location_url: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-500"/> Date</label>
                <Input type="date" required value={eventData.date} onChange={e => setEventData({...eventData, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Clock className="w-4 h-4 text-gray-500"/> Doors Open Time</label>
                <Input type="time" required value={eventData.doors_open} onChange={e => setEventData({...eventData, doors_open: e.target.value})} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: EXISTING TIERS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">2. Manage Existing Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentTiers.map((tier, index) => {
              const isMarkedForRemoval = removeTiers.includes(tier.category);
              const stockToAdd = addStock[tier.category] || 0;
              const remaining = tier.total - tier.sold;

              return (
                <div key={index} className={`flex items-center justify-between p-4 rounded-lg border ${isMarkedForRemoval ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div>
                    <h4 className={`font-bold ${isMarkedForRemoval ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                      {tier.category} {isMarkedForRemoval && "(Deleting)"}
                    </h4>
                    <p className="text-sm text-gray-500">RM {tier.price} • {remaining} left</p>
                  </div>

                  {!isMarkedForRemoval ? (
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => decrementAddStock(tier.category)}>
                        -
                      </Button>
                      <span className={`w-8 text-center font-bold ${stockToAdd > 0 ? 'text-green-600' : 'text-gray-700'}`}>
                        +{stockToAdd}
                      </span>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => incrementAddStock(tier.category)}>
                        +
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 ml-4 text-red-500 hover:bg-red-100 hover:text-red-700" onClick={() => toggleRemoveTier(tier.category)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="text-blue-600 border-blue-200" onClick={() => toggleRemoveTier(tier.category)}>
                      <Undo className="w-4 h-4 mr-2" /> Undo
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* SECTION 3: NEW TIERS */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="text-xl">3. Add New Categories</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addNewTierRow} className="text-blue-600 border-blue-200 hover:bg-blue-50">
              <Plus className="w-4 h-4 mr-1" /> Add Tier
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {newTiers.map((tier, index) => (
              <div key={index} className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Category Name</label>
                  <Input placeholder="e.g. Early Bird" required value={tier.category} onChange={e => updateNewTier(index, 'category', e.target.value)} />
                </div>
                <div className="w-32 space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Price (RM)</label>
                  <Input type="number" placeholder="150" min="0" step="0.01" required value={tier.price} onChange={e => updateNewTier(index, 'price', e.target.value)} />
                </div>
                <div className="w-32 space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Quantity</label>
                  <Input type="number" placeholder="100" min="1" required value={tier.quantity} onChange={e => updateNewTier(index, 'quantity', e.target.value)} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-red-400 hover:text-red-600 mb-0.5" onClick={() => removeNewTierRow(index)}>
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            ))}
            {newTiers.length === 0 && <p className="text-sm text-gray-500 italic">No new categories to add.</p>}
          </CardContent>
        </Card>

        {/* --- EVENT BANNER UPLOAD SECTION --- */}
        <div className="mb-8 p-6 bg-white border rounded-xl shadow-sm">
          <h3 className="text-lg font-bold mb-4 text-gray-800">Event Banner</h3>
          
          <div className="flex flex-col items-center">
            
            {/* The Hidden HTML Input */}
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/webp" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
            />

            {/* The Clickable Preview / Upload Box */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-2xl h-64 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors flex flex-col justify-center items-center relative group"
            >
              {previewUrl ? (
                <>
                  {/* Show the image if we have one */}
                  <img src={previewUrl} alt="Event Banner" className="w-full h-full object-cover" />
                  {/* Overlay that appears on hover to let them change the image */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-85 transition-opacity">
                    <p className="text-white font-semibold flex items-center">
                      <UploadCloud className="w-5 h-5 mr-2" /> Change Image
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Empty State */}
                  <ImageIcon className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-gray-600 font-medium">Click to upload banner</p>
                  <p className="text-gray-400 text-sm mt-1">PNG, JPG, WEBP up to 5MB</p>
                </>
              )}
            </div>

            {/* The Upload Button (Only shows if a NEW file is selected and waiting to be uploaded) */}
            {bannerFile && (
              <button 
                type="button" 
                onClick={handleUploadBanner}
                disabled={isUploading}
                className="mt-6 flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><UploadCloud className="w-5 h-5 mr-2" /> Save Banner to Server</>
                )}
              </button>
            )}
            
          </div>
        </div>

        {/* --- 🚀 EVENT GALLERY UPLOAD SECTION --- */}
        <div className="mb-8 p-6 bg-white border rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Event Gallery</h3>
            
            {/* Hidden Multi-File Input */}
            <input 
              type="file" multiple accept="image/png, image/jpeg, image/webp" 
              className="hidden" ref={galleryInputRef} onChange={handleGallerySelect} 
            />
            
            <Button type="button" variant="outline" size="sm" onClick={() => galleryInputRef.current?.click()} className="text-blue-600 border-blue-200">
              <Plus className="w-4 h-4 mr-2" /> Add Pictures
            </Button>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* 1. Show Existing Images from Database */}
            {existingGallery.map((img, index) => (
              <div key={`existing-${index}`} className="relative h-32 rounded-lg border overflow-hidden group">
                <img src={`http://localhost:8080${img.image_url}`} alt="Gallery" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">Live</div>
              </div>
            ))}

            {/* 2. Show Pending Files Waiting to be Uploaded */}
            {galleryFiles.map((file, index) => (
              <div key={`pending-${index}`} className="relative h-32 rounded-lg border-2 border-blue-400 overflow-hidden group">
                <img src={URL.createObjectURL(file)} alt="Pending" className="w-full h-full object-cover opacity-70" />
                
                {/* Delete Button overlay */}
                <button 
                  type="button" onClick={() => removePendingFile(index)}
                  className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-6 h-6 text-white" />
                </button>
              </div>
            ))}

            {/* Empty State if completely empty */}
            {existingGallery.length === 0 && galleryFiles.length === 0 && (
              <div className="col-span-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400">
                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No gallery images yet</p>
              </div>
            )}
          </div>

          {/* The Bulk Upload Button */}
          {galleryFiles.length > 0 && (
            <div className="mt-6 flex justify-end">
              <button 
                type="button" onClick={handleUploadGallery} disabled={isUploadingGallery}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isUploadingGallery ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading {galleryFiles.length} files...</>
                ) : (
                  <><UploadCloud className="w-5 h-5 mr-2" /> Upload {galleryFiles.length} Images</>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto px-12 text-lg h-14" disabled={submitting}>
            {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <><Save className="w-5 h-5 mr-2"/> Save Changes</>}
          </Button>
        </div>
      </form>
    </div>
  );
}