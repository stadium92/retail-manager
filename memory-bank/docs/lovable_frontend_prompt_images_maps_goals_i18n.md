# Lovable.dev Prompt: Image Uploads, Map Integration, Monthly Goals & i18n Support

## Project Context

You are working on an **existing React + TypeScript + Supabase retail management application**. The following is already implemented:

### ✅ Already Built (DO NOT REBUILD)
- **Authentication System**: Complete with role-based access control (`AuthContext`, `ProtectedRoute`)
- **Master Dashboard**: Dashboard with metrics, AI tabs, and management pages
- **Worker Interface**: Complete with sales entry, inventory view, delivery status
- **Deliverer Interface**: Complete with delivery management and real-time updates
- **Customer Interface**: Basic product browsing
- **Services**: `StoreService`, `InventoryService`, `SalesService` with full CRUD methods
- **UI Components**: shadcn/ui components library installed
- **Types**: TypeScript types defined in `src/types/index.ts`
- **Supabase Integration**: Supabase client configured in `src/integrations/supabase/client.ts`
- **Database**: `inventory` table already has `image_url` field

### 🎯 What You Need to Build

1. **Image Upload Functionality** - Add picture upload for Inventory, Stores, and other interfaces
2. **Map Integration for Deliverer** - Add map view with delivery locations and navigation
3. **Monthly Goal Setting** - Allow masters to set and track monthly sales goals
4. **Internationalization (i18n)** - Add French and Bambara language support

---

## Task 1: Image Upload Functionality

### Requirements

Add image upload capabilities to:
- **Inventory Items** - Upload product images
- **Stores** - Upload store photos/logos
- **Other interfaces** - Any interface that needs image support

### Implementation Steps

#### 1. Create Image Upload Service

**File**: `src/services/ImageService.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';

export class ImageService {
  /**
   * Upload image to Supabase Storage
   * @param file - File object to upload
   * @param folder - Folder path in storage (e.g., 'inventory', 'stores')
   * @param fileName - Optional custom file name
   * @returns URL of uploaded image
   */
  static async uploadImage(
    file: File,
    folder: 'inventory' | 'stores' | 'deliveries' | 'profiles',
    fileName?: string
  ): Promise<{ data?: string; error?: any }> {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return { error: { message: 'File must be an image' } };
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return { error: { message: 'Image size must be less than 5MB' } };
      }

      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const filePath = fileName 
        ? `${folder}/${fileName}.${fileExt}`
        : `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        return { error };
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      return { data: publicUrl };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Delete image from Supabase Storage
   */
  static async deleteImage(imageUrl: string): Promise<{ error?: any }> {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/');
      const filePath = urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)

      const { error } = await supabase.storage
        .from('images')
        .remove([filePath]);

      return { error };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Resize/compress image before upload (optional optimization)
   */
  static async compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            file.type,
            quality
          );
        };
      };
    });
  }
}
```

#### 2. Create Image Upload Component

**File**: `src/components/shared/ImageUpload.tsx`

```typescript
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageService } from '@/services/ImageService';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved?: () => void;
  folder: 'inventory' | 'stores' | 'deliveries' | 'profiles';
  maxSize?: number; // in MB
  compress?: boolean;
  className?: string;
}

export function ImageUpload({
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  folder,
  maxSize = 5,
  compress = true,
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Image must be less than ${maxSize}MB`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Compress image if enabled
      const fileToUpload = compress 
        ? await ImageService.compressImage(file)
        : file;

      // Upload image
      const { data: imageUrl, error } = await ImageService.uploadImage(
        fileToUpload,
        folder
      );

      if (error) {
        throw error;
      }

      if (imageUrl) {
        setPreview(imageUrl);
        onImageUploaded(imageUrl);
        toast({
          title: 'Success',
          description: 'Image uploaded successfully',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (currentImageUrl) {
      // Delete from storage
      await ImageService.deleteImage(currentImageUrl);
    }
    setPreview(null);
    onImageRemoved?.();
    toast({
      title: 'Image removed',
      description: 'Image has been deleted',
    });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="h-32 w-32 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            No image uploaded
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : preview ? 'Change Image' : 'Upload Image'}
        </Button>
        {preview && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRemove}
            disabled={uploading}
          >
            <X className="h-4 w-4 mr-2" />
            Remove
          </Button>
        )}
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
```

#### 3. Update Inventory Forms

**File**: `src/pages/master/Inventory.tsx` (or wherever inventory forms are)

Add `ImageUpload` component to inventory create/edit forms:

```typescript
import { ImageUpload } from '@/components/shared/ImageUpload';

// In your form component:
<ImageUpload
  currentImageUrl={formData.image_url}
  onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
  onImageRemoved={() => setFormData({ ...formData, image_url: undefined })}
  folder="inventory"
/>
```

#### 4. Update Store Forms

**File**: `src/pages/master/Stores.tsx`

Add `ImageUpload` component to store create/edit forms:

```typescript
// Add image_url field to Store type if not already present
// Then add ImageUpload component to store forms
<ImageUpload
  currentImageUrl={formData.image_url}
  onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
  onImageRemoved={() => setFormData({ ...formData, image_url: undefined })}
  folder="stores"
/>
```

#### 5. Database Migration (if needed)

**File**: `supabase/migrations/20251106150000_add_image_url_to_stores.sql`

```sql
-- Add image_url to stores table if not exists
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image_url to other tables if needed
-- ALTER TABLE public.deliverers ADD COLUMN IF NOT EXISTS image_url TEXT;
```

#### 6. Create Supabase Storage Bucket

In Supabase Dashboard:
1. Go to **Storage**
2. Create a new bucket named `images`
3. Set it to **Public** (or configure RLS policies)
4. Add RLS policies:

```sql
-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

-- Allow authenticated users to read images
CREATE POLICY "Authenticated users can read images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'images');

-- Allow authenticated users to delete their own images
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'images');
```

---

## Task 2: Map Integration for Deliverer

### Requirements

Add map functionality to help deliverers:
- **View delivery locations** on a map
- **See route** between deliveries
- **Navigate** to delivery addresses
- **Track current location** (GPS)
- **Optimize delivery route** (optional)

### Implementation Steps

#### 1. Install Map Library

```bash
npm install react-leaflet leaflet
npm install @types/leaflet --save-dev
```

Or use Google Maps:
```bash
npm install @react-google-maps/api
```

**Recommendation**: Use **Leaflet** (free, open-source) or **Google Maps** (requires API key but more features).

#### 2. Create Map Component (Leaflet Example)

**File**: `src/components/deliverer/Map/DeliveryMap.tsx`

```typescript
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Delivery } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Phone, MapPin } from 'lucide-react';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DeliveryMapProps {
  deliveries: Delivery[];
  currentLocation?: { lat: number; lng: number };
  onDeliverySelect?: (delivery: Delivery) => void;
}

export function DeliveryMap({ deliveries, currentLocation, onDeliverySelect }: DeliveryMapProps) {
  const [deliveryLocations, setDeliveryLocations] = useState<Array<{ delivery: Delivery; lat: number; lng: number }>>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(currentLocation || null);

  useEffect(() => {
    // Get current user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }

    // Geocode delivery addresses
    geocodeDeliveries();
  }, [deliveries]);

  const geocodeDeliveries = async () => {
    // Use a geocoding service (OpenStreetMap Nominatim is free)
    const locations = await Promise.all(
      deliveries.map(async (delivery) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(delivery.delivery_address)}&limit=1`
          );
          const data = await response.json();
          if (data && data.length > 0) {
            return {
              delivery,
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon),
            };
          }
        } catch (error) {
          console.error('Geocoding error:', error);
        }
        return null;
      })
    );

    setDeliveryLocations(locations.filter(Boolean) as Array<{ delivery: Delivery; lat: number; lng: number }>);
  };

  const openNavigation = (delivery: Delivery) => {
    // Open in navigation app (Google Maps, Apple Maps, etc.)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery.delivery_address)}`;
    window.open(url, '_blank');
  };

  const center = userLocation || (deliveryLocations.length > 0 
    ? { lat: deliveryLocations[0].lat, lng: deliveryLocations[0].lng }
    : { lat: 12.6392, lng: -8.0029 }); // Default to Bamako, Mali

  if (deliveryLocations.length === 0 && !userLocation) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Loading map...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-[500px] rounded-lg overflow-hidden border">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>Your Location</Popup>
          </Marker>
        )}

        {/* Delivery location markers */}
        {deliveryLocations.map(({ delivery, lat, lng }) => (
          <Marker key={delivery.id} position={[lat, lng]}>
            <Popup>
              <div className="space-y-2">
                <p className="font-semibold">{delivery.customer_name}</p>
                <p className="text-sm">{delivery.delivery_address}</p>
                <p className="text-sm">{delivery.customer_phone}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => openNavigation(delivery)}
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Navigate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = `tel:${delivery.customer_phone}`}
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    Call
                  </Button>
                  {onDeliverySelect && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeliverySelect(delivery)}
                    >
                      View Details
                    </Button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Route polyline (optional - requires route calculation) */}
        {userLocation && deliveryLocations.length > 0 && (
          <Polyline
            positions={[
              [userLocation.lat, userLocation.lng],
              ...deliveryLocations.map(({ lat, lng }) => [lat, lng]),
            ]}
            color="blue"
            weight={3}
          />
        )}
      </MapContainer>
    </div>
  );
}
```

#### 3. Update Deliverer Dashboard

**File**: `src/components/deliverer/Dashboard/DelivererDashboard.tsx`

Add map view to deliverer dashboard:

```typescript
import { DeliveryMap } from '../Map/DeliveryMap';

// In your component:
{activeTab === 'map' && (
  <DeliveryMap
    deliveries={deliveries.filter(d => d.status !== 'delivered')}
    onDeliverySelect={(delivery) => {
      // Show delivery details
      setSelectedDelivery(delivery);
      setActiveTab('deliveries');
    }}
  />
)}
```

#### 4. Add Map Tab to Navigation

Update `DelivererBottomNavigation` to include a Map tab.

#### 5. Alternative: Google Maps Integration

If using Google Maps instead:

```typescript
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';

// Requires Google Maps API key in environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

---

## Task 3: Monthly Goal Setting

### Requirements

Allow masters to:
- **Set monthly sales goals** for stores
- **View progress** toward goals
- **Track goal completion** on dashboard
- **Set goals per store** (if multi-store)

### Implementation Steps

#### 1. Database Migration

**File**: `supabase/migrations/20251106160000_monthly_goals.sql`

```sql
-- Create monthly_goals table
CREATE TABLE IF NOT EXISTS public.monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  sales_goal DECIMAL(10, 2) NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, month, year)
);

-- Enable RLS
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Masters can view goals in their stores"
ON public.monthly_goals FOR SELECT
USING (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

CREATE POLICY "Masters can manage goals in their stores"
ON public.monthly_goals FOR ALL
USING (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

-- Create index
CREATE INDEX idx_monthly_goals_store_month_year ON public.monthly_goals(store_id, year, month);
```

#### 2. Create Goal Service

**File**: `src/services/GoalService.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';

export interface MonthlyGoal {
  id: string;
  store_id?: string;
  month: number;
  year: number;
  sales_goal: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal: MonthlyGoal;
  currentSales: number;
  progress: number; // percentage
  remaining: number;
  daysRemaining: number;
  onTrack: boolean;
}

export class GoalService {
  static async getGoals(storeId?: string, year?: number, month?: number): Promise<{ data?: MonthlyGoal[]; error?: any }> {
    try {
      let query = supabase
        .from('monthly_goals')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      if (year) {
        query = query.eq('year', year);
      }

      if (month) {
        query = query.eq('month', month);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    } catch (error) {
      return { error };
    }
  }

  static async createGoal(goal: Omit<MonthlyGoal, 'id' | 'created_at' | 'updated_at'>): Promise<{ data?: MonthlyGoal; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('monthly_goals')
        .insert(goal)
        .select()
        .single();

      return { data: data || undefined, error };
    } catch (error) {
      return { error };
    }
  }

  static async updateGoal(id: string, updates: Partial<MonthlyGoal>): Promise<{ data?: MonthlyGoal; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('monthly_goals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      return { data: data || undefined, error };
    } catch (error) {
      return { error };
    }
  }

  static async deleteGoal(id: string): Promise<{ error?: any }> {
    try {
      const { error } = await supabase
        .from('monthly_goals')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      return { error };
    }
  }

  static async getGoalProgress(goalId: string, storeId?: string): Promise<{ data?: GoalProgress; error?: any }> {
    try {
      // Get goal
      const { data: goal, error: goalError } = await supabase
        .from('monthly_goals')
        .select('*')
        .eq('id', goalId)
        .single();

      if (goalError || !goal) {
        return { error: goalError };
      }

      // Calculate current month sales
      const now = new Date();
      const monthStart = new Date(goal.year, goal.month - 1, 1);
      const monthEnd = new Date(goal.year, goal.month, 0, 23, 59, 59);

      let salesQuery = supabase
        .from('sales')
        .select('total_price')
        .gte('sale_date', monthStart.toISOString())
        .lte('sale_date', monthEnd.toISOString());

      if (storeId || goal.store_id) {
        salesQuery = salesQuery.eq('store_id', storeId || goal.store_id);
      }

      const { data: sales, error: salesError } = await salesQuery;

      if (salesError) {
        return { error: salesError };
      }

      const currentSales = sales?.reduce((sum, sale) => sum + Number(sale.total_price), 0) || 0;
      const progress = (currentSales / goal.sales_goal) * 100;
      const remaining = goal.sales_goal - currentSales;
      const daysInMonth = new Date(goal.year, goal.month, 0).getDate();
      const daysElapsed = Math.min(now.getDate(), daysInMonth);
      const daysRemaining = daysInMonth - daysElapsed;
      const expectedProgress = (daysElapsed / daysInMonth) * 100;
      const onTrack = progress >= expectedProgress - 10; // 10% tolerance

      return {
        data: {
          goal,
          currentSales,
          progress,
          remaining,
          daysRemaining,
          onTrack,
        },
      };
    } catch (error) {
      return { error };
    }
  }
}
```

#### 3. Create Goal Management UI

**File**: `src/pages/master/Goals.tsx`

Create a page for masters to:
- View current month's goal
- Set/edit monthly goals
- View goal progress
- See goal history

**Design Requirements:**
- Use shadcn/ui components
- Show progress bars and charts
- Color-code progress (green for on-track, red for behind)
- Mobile-responsive

#### 4. Add Goal Progress to Dashboard

**File**: `src/components/master/Dashboard/DashboardView.tsx`

Add goal progress card to dashboard showing:
- Current month goal
- Progress percentage
- Remaining amount
- Days remaining
- Visual progress bar

---

## Task 4: Internationalization (i18n) - French & Bambara

### Requirements

Add language support for:
- **French** (fr)
- **Bambara** (bm)
- **English** (en) - default/fallback

### Implementation Steps

#### 1. Install i18n Library

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

#### 2. Create Translation Files

**File**: `src/locales/en/translation.json`

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "filter": "Filter",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "confirm": "Confirm",
    "close": "Close"
  },
  "dashboard": {
    "title": "Dashboard",
    "todaySales": "Today's Sales",
    "weekSales": "Week Sales",
    "monthSales": "Month Sales",
    "totalStores": "Total Stores",
    "lowStockItems": "Low Stock Items",
    "salesStatus": "Sales Status"
  },
  "inventory": {
    "title": "Inventory",
    "addItem": "Add Item",
    "editItem": "Edit Item",
    "deleteItem": "Delete Item",
    "itemName": "Item Name",
    "price": "Price",
    "quantity": "Quantity",
    "lowStock": "Low Stock"
  },
  "stores": {
    "title": "Stores",
    "addStore": "Add Store",
    "editStore": "Edit Store",
    "deleteStore": "Delete Store",
    "storeName": "Store Name",
    "address": "Address",
    "phone": "Phone"
  },
  "deliveries": {
    "title": "Deliveries",
    "pending": "Pending",
    "assigned": "Assigned",
    "inTransit": "In Transit",
    "delivered": "Delivered",
    "cancelled": "Cancelled",
    "customerName": "Customer Name",
    "deliveryAddress": "Delivery Address"
  },
  "sales": {
    "title": "Sales",
    "totalSales": "Total Sales",
    "salesCount": "Sales Count",
    "averageTransaction": "Average Transaction"
  },
  "goals": {
    "title": "Monthly Goals",
    "setGoal": "Set Monthly Goal",
    "currentGoal": "Current Goal",
    "progress": "Progress",
    "remaining": "Remaining",
    "daysRemaining": "Days Remaining",
    "onTrack": "On Track",
    "behind": "Behind"
  },
  "auth": {
    "login": "Login",
    "signup": "Sign Up",
    "email": "Email",
    "password": "Password",
    "signOut": "Sign Out"
  }
}
```

**File**: `src/locales/fr/translation.json`

```json
{
  "common": {
    "save": "Enregistrer",
    "cancel": "Annuler",
    "delete": "Supprimer",
    "edit": "Modifier",
    "create": "Créer",
    "search": "Rechercher",
    "filter": "Filtrer",
    "loading": "Chargement...",
    "error": "Erreur",
    "success": "Succès",
    "confirm": "Confirmer",
    "close": "Fermer"
  },
  "dashboard": {
    "title": "Tableau de bord",
    "todaySales": "Ventes d'aujourd'hui",
    "weekSales": "Ventes de la semaine",
    "monthSales": "Ventes du mois",
    "totalStores": "Total des magasins",
    "lowStockItems": "Articles en rupture de stock",
    "salesStatus": "Statut des ventes"
  },
  "inventory": {
    "title": "Inventaire",
    "addItem": "Ajouter un article",
    "editItem": "Modifier l'article",
    "deleteItem": "Supprimer l'article",
    "itemName": "Nom de l'article",
    "price": "Prix",
    "quantity": "Quantité",
    "lowStock": "Stock faible"
  },
  "stores": {
    "title": "Magasins",
    "addStore": "Ajouter un magasin",
    "editStore": "Modifier le magasin",
    "deleteStore": "Supprimer le magasin",
    "storeName": "Nom du magasin",
    "address": "Adresse",
    "phone": "Téléphone"
  },
  "deliveries": {
    "title": "Livraisons",
    "pending": "En attente",
    "assigned": "Assigné",
    "inTransit": "En transit",
    "delivered": "Livré",
    "cancelled": "Annulé",
    "customerName": "Nom du client",
    "deliveryAddress": "Adresse de livraison"
  },
  "sales": {
    "title": "Ventes",
    "totalSales": "Ventes totales",
    "salesCount": "Nombre de ventes",
    "averageTransaction": "Transaction moyenne"
  },
  "goals": {
    "title": "Objectifs mensuels",
    "setGoal": "Définir l'objectif mensuel",
    "currentGoal": "Objectif actuel",
    "progress": "Progrès",
    "remaining": "Restant",
    "daysRemaining": "Jours restants",
    "onTrack": "Sur la bonne voie",
    "behind": "En retard"
  },
  "auth": {
    "login": "Connexion",
    "signup": "S'inscrire",
    "email": "Email",
    "password": "Mot de passe",
    "signOut": "Déconnexion"
  }
}
```

**File**: `src/locales/bm/translation.json`

```json
{
  "common": {
    "save": "Ka kɛ",
    "cancel": "Ka bɔ",
    "delete": "Ka bɔ",
    "edit": "Ka fura",
    "create": "Ka kɛ",
    "search": "Ka ɲini",
    "filter": "Ka fili",
    "loading": "Ka se ka taa...",
    "error": "Juguman",
    "success": "N'ka ɲɛ",
    "confirm": "Ka sɛgɛ",
    "close": "Ka da"
  },
  "dashboard": {
    "title": "Dashboard",
    "todaySales": "Tɔn sɔrɔ ni",
    "weekSales": "Dɔgɔkun sɔrɔ ni",
    "monthSales": "Kalo sɔrɔ ni",
    "totalStores": "Magasin jɛlen bɛɛ",
    "lowStockItems": "Bɛnɛ caman tɛ",
    "salesStatus": "Sɔrɔ ka ɲɛ"
  },
  "inventory": {
    "title": "Bɛnɛ",
    "addItem": "Ka bɛnɛ kɛ",
    "editItem": "Ka bɛnɛ fura",
    "deleteItem": "Ka bɛnɛ bɔ",
    "itemName": "Bɛnɛ tɔgɔ",
    "price": "Sɔrɔ",
    "quantity": "Jɛlen",
    "lowStock": "Bɛnɛ caman tɛ"
  },
  "stores": {
    "title": "Magasin",
    "addStore": "Ka magasin kɛ",
    "editStore": "Ka magasin fura",
    "deleteStore": "Ka magasin bɔ",
    "storeName": "Magasin tɔgɔ",
    "address": "Adɛrɛsi",
    "phone": "Telefɔni"
  },
  "deliveries": {
    "title": "Ka kɛ",
    "pending": "Ka sugandi",
    "assigned": "Ka kɛ",
    "inTransit": "Ka taa",
    "delivered": "Ka kɛ",
    "cancelled": "Ka bɔ",
    "customerName": "Jatigɛ tɔgɔ",
    "deliveryAddress": "Ka kɛ adɛrɛsi"
  },
  "sales": {
    "title": "Sɔrɔ",
    "totalSales": "Sɔrɔ bɛɛ",
    "salesCount": "Sɔrɔ jɛlen",
    "averageTransaction": "Sɔrɔ cɛma"
  },
  "goals": {
    "title": "Kalo ka ɲɛ",
    "setGoal": "Ka kalo ka ɲɛ kɛ",
    "currentGoal": "Sisan ka ɲɛ",
    "progress": "Ka taa",
    "remaining": "Ka sɛ",
    "daysRemaining": "Don jɛlen",
    "onTrack": "Ka taa ɲɛ",
    "behind": "Ka kɔ"
  },
  "auth": {
    "login": "Ka taa",
    "signup": "Ka sɛrɛ",
    "email": "Email",
    "password": "Gafɛ",
    "signOut": "Ka bɔ"
  }
}
```

#### 3. Configure i18n

**File**: `src/i18n/config.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from '../locales/en/translation.json';
import frTranslations from '../locales/fr/translation.json';
import bmTranslations from '../locales/bm/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      fr: { translation: frTranslations },
      bm: { translation: bmTranslations },
    },
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

#### 4. Initialize i18n in App

**File**: `src/main.tsx` or `src/App.tsx`

```typescript
import './i18n/config';
```

#### 5. Create Language Switcher Component

**File**: `src/components/shared/LanguageSwitcher.tsx`

```typescript
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'bm', name: 'Bamanankan' },
  ];

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <Select value={i18n.language} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[140px]">
        <Globe className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

#### 6. Update Components to Use Translations

**Example**: `src/components/master/Dashboard/DashboardView.tsx`

```typescript
import { useTranslation } from 'react-i18next';

export function DashboardView() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <MetricCard
        title={t('dashboard.todaySales')}
        value={`$${metrics.todaySales.toFixed(2)}`}
      />
      {/* ... */}
    </div>
  );
}
```

#### 7. Add Language Switcher to Layout

Add `LanguageSwitcher` component to the master layout header/navigation.

---

## Implementation Checklist

### Task 1: Image Upload
- [ ] Create `ImageService.ts` with upload/delete methods
- [ ] Create `ImageUpload.tsx` component
- [ ] Add image upload to Inventory forms
- [ ] Add image upload to Store forms
- [ ] Create Supabase Storage bucket and policies
- [ ] Test image upload functionality
- [ ] Add image display in lists/views

### Task 2: Map Integration
- [ ] Install map library (Leaflet or Google Maps)
- [ ] Create `DeliveryMap.tsx` component
- [ ] Add geocoding for delivery addresses
- [ ] Integrate map into Deliverer Dashboard
- [ ] Add navigation functionality
- [ ] Add GPS location tracking
- [ ] Test map functionality

### Task 3: Monthly Goals
- [ ] Create database migration for `monthly_goals` table
- [ ] Create `GoalService.ts`
- [ ] Create Goals management page
- [ ] Add goal progress to Dashboard
- [ ] Add goal setting UI
- [ ] Test goal tracking

### Task 4: i18n Support
- [ ] Install i18next libraries
- [ ] Create translation files (en, fr, bm)
- [ ] Configure i18n
- [ ] Create `LanguageSwitcher` component
- [ ] Update all components to use translations
- [ ] Add language switcher to layout
- [ ] Test language switching

---

## Design Guidelines

### Image Upload
- **File Size**: Max 5MB per image
- **Formats**: JPG, PNG, WebP
- **Compression**: Compress images before upload
- **Preview**: Show image preview before/after upload
- **Error Handling**: Show clear error messages

### Map Integration
- **Mobile-First**: Optimize for mobile devices
- **Offline Support**: Cache map tiles for offline use
- **Performance**: Lazy load map component
- **Privacy**: Request location permission appropriately

### Monthly Goals
- **Visual Progress**: Use progress bars and charts
- **Color Coding**: Green for on-track, red for behind
- **Notifications**: Alert when goal is at risk
- **History**: Show past months' goals and achievements

### i18n
- **Complete Coverage**: Translate all user-facing text
- **RTL Support**: Consider right-to-left languages if needed
- **Date/Number Formatting**: Use locale-specific formats
- **Language Persistence**: Save user's language preference

---

## Important Notes

1. **Supabase Storage**: Ensure storage bucket is created and RLS policies are set correctly
2. **Map API Keys**: If using Google Maps, add API key to environment variables
3. **Geocoding**: Use free services (OpenStreetMap Nominatim) or paid (Google Geocoding API)
4. **Translation Quality**: Have native speakers review Bambara translations
5. **Performance**: Optimize image uploads and map rendering for mobile devices
6. **Offline Support**: Consider offline capabilities for map and image caching

---

## Getting Started

1. **Start with Image Upload** - Most straightforward, good foundation
2. **Add Map Integration** - Requires external libraries and API setup
3. **Implement Monthly Goals** - Database and UI work
4. **Add i18n Support** - Systematic translation of all components

Good luck building! Remember to test each feature thoroughly before moving to the next.




