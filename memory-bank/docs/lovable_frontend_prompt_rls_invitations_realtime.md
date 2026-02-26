# Lovable.dev Prompt: Fix RLS Policies, Add Worker Invitations & Real-Time Notifications

## Project Context

You are working on an **existing React + TypeScript + Supabase retail management application**. The following is already implemented:

### ✅ Already Built (DO NOT REBUILD)
- **Authentication System**: Complete with role-based access control (`AuthContext`, `ProtectedRoute`)
- **Master Dashboard**: Dashboard with metrics, AI tabs, and management pages
- **Worker Interface**: Complete with sales entry, inventory view, delivery status
- **Deliverer Interface**: Complete with delivery management and basic real-time setup
- **Customer Interface**: Basic product browsing
- **Services**: `StoreService`, `InventoryService`, `SalesService` with full CRUD methods
- **UI Components**: shadcn/ui components library installed
- **Types**: TypeScript types defined in `src/types/index.ts`
- **Supabase Integration**: Supabase client configured in `src/integrations/supabase/client.ts`

### 🎯 What You Need to Build

1. **Fix RLS Policies** - Apply database migration to fix `user_roles` table RLS policies
2. **Worker Invitation System** - Allow masters to invite workers via email
3. **Real-Time Delivery Notifications** - Add live notifications for delivery status updates

---

## Task 1: Fix RLS Policies for user_roles Table

### Problem
The error `"new row violates row-level security policy for table \"user_roles\""` occurs because the RLS policies on the `user_roles` table are too restrictive and prevent role assignment during signup.

### Solution
Apply the following SQL migration to fix the RLS policies:

**File**: `supabase/migrations/20251106130000_fix_user_roles_rls.sql`

```sql
-- Fix user_roles RLS Policies
-- This migration fixes the RLS policy conflicts that prevent role assignment

-- Step 1: Drop all existing INSERT policies on user_roles to start fresh
DROP POLICY IF EXISTS "Masters can insert roles in their stores" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;

-- Step 2: Create a comprehensive SELECT policy that allows:
-- - Users to view their own roles (with or without store_id)
-- - Users to view roles in stores they have access to
-- - Masters to view all roles in their stores
DROP POLICY IF EXISTS "Users can view roles in their stores" ON public.user_roles;
CREATE POLICY "Users can view their own roles and store roles"
ON public.user_roles FOR SELECT
USING (
  -- Users can view their own roles (including global roles with store_id IS NULL)
  user_id = auth.uid()
  OR
  -- Users can view roles in stores they have access to
  (
    store_id IS NOT NULL AND
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
  OR
  -- Masters can view all roles in their stores
  (
    public.has_role(auth.uid(), 'master') AND
    (
      store_id IS NULL OR
      store_id IN (SELECT public.get_user_stores(auth.uid()))
    )
  )
);

-- Step 3: Create INSERT policy that allows:
-- - Trigger functions (SECURITY DEFINER) to insert during signup (bypasses RLS, but policy should allow)
-- - Users to insert their own role during signup (without store_id)
-- - Masters to insert roles for others (with store_id)
CREATE POLICY "Allow role assignment on signup and by masters"
ON public.user_roles FOR INSERT
WITH CHECK (
  -- Allow users to insert their own role during signup (store_id can be NULL)
  (
    user_id = auth.uid() AND
    store_id IS NULL AND
    -- Only allow if user doesn't already have this role (prevent duplicates)
    NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = NEW.role AND store_id IS NULL
    )
  )
  OR
  -- Allow masters to insert roles for others (with store_id)
  (
    public.has_role(auth.uid(), 'master') AND
    (
      store_id IS NULL OR
      store_id IN (SELECT public.get_user_stores(auth.uid()))
    )
  )
);

-- Step 4: Update UPDATE policy to allow masters to update roles
DROP POLICY IF EXISTS "Masters can update roles" ON public.user_roles;
CREATE POLICY "Masters can update roles in their stores"
ON public.user_roles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

-- Step 5: Ensure DELETE policy allows masters to delete roles
DROP POLICY IF EXISTS "Masters can delete roles in their stores" ON public.user_roles;
CREATE POLICY "Masters can delete roles in their stores"
ON public.user_roles FOR DELETE
USING (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

-- Step 6: Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Step 7: Ensure the trigger function can bypass RLS by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.auto_assign_role_on_profile_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  assigned_role public.app_role;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;
  
  -- Assign role based on email (server-side)
  assigned_role := public.assign_role_from_email(NEW.id, user_email);
  
  -- Insert role assignment (SECURITY DEFINER should bypass RLS, but policy should allow)
  -- Use store_id = NULL for global roles during signup
  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (NEW.id, assigned_role, NULL)
  ON CONFLICT (user_id, role, store_id) DO NOTHING; -- Prevent duplicate role assignments
  
  RETURN NEW;
END;
$$;

-- Step 8: Also ensure the auth.users trigger function can insert roles
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function assigns a default 'customer' role, but the email-based trigger should override
  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (NEW.id, 'customer'::public.app_role, NULL)
  ON CONFLICT (user_id, role, store_id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

### Implementation Steps

1. **Create the migration file** in `supabase/migrations/20251106130000_fix_user_roles_rls.sql`
2. **Apply the migration** via Supabase Dashboard SQL Editor or CLI
3. **Test signup** - Create a new user and verify role assignment works
4. **Verify policies** - Run this query to check policies were created:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_roles'
ORDER BY policyname;
```

---

## Task 2: Worker Invitation System

### Requirements

Create a complete worker invitation system that allows masters to:
1. **Invite workers via email** - Send invitation emails with signup links
2. **Track invitations** - View pending, accepted, and expired invitations
3. **Assign stores** - Assign invited workers to specific stores
4. **Resend invitations** - Resend invitation emails if needed
5. **Cancel invitations** - Cancel pending invitations

### Database Schema

First, create a migration for the `worker_invitations` table:

**File**: `supabase/migrations/20251106140000_worker_invitations.sql`

```sql
-- Create worker_invitations table
CREATE TABLE IF NOT EXISTS public.worker_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'worker',
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Masters can view invitations in their stores"
ON public.worker_invitations FOR SELECT
USING (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

CREATE POLICY "Masters can create invitations"
ON public.worker_invitations FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'master') AND
  invited_by = auth.uid() AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

CREATE POLICY "Masters can update invitations"
ON public.worker_invitations FOR UPDATE
USING (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

CREATE POLICY "Anyone can view invitation by token"
ON public.worker_invitations FOR SELECT
USING (token = current_setting('app.invitation_token', true));

-- Create index
CREATE INDEX idx_worker_invitations_token ON public.worker_invitations(token);
CREATE INDEX idx_worker_invitations_email ON public.worker_invitations(email);
CREATE INDEX idx_worker_invitations_status ON public.worker_invitations(status);

-- Create function to generate invitation token
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  -- Generate a secure random token
  token := encode(gen_random_bytes(32), 'base64');
  -- Remove special characters and make URL-safe
  token := replace(replace(token, '+', '-'), '/', '_');
  token := rtrim(token, '=');
  RETURN token;
END;
$$;

-- Create function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record public.worker_invitations;
BEGIN
  -- Get invitation by token
  SELECT * INTO invitation_record
  FROM public.worker_invitations
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Assign role to user
  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (_user_id, invitation_record.role, invitation_record.store_id)
  ON CONFLICT (user_id, role, store_id) DO NOTHING;
  
  -- Update invitation status
  UPDATE public.worker_invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = invitation_record.id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation TO authenticated;
```

### Frontend Implementation

#### 1. Create Invitation Service

**File**: `src/services/InvitationService.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';

export interface WorkerInvitation {
  id: string;
  email: string;
  role: 'worker' | 'deliverer';
  store_id?: string;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
}

export class InvitationService {
  static async createInvitation(data: {
    email: string;
    role: 'worker' | 'deliverer';
    store_id?: string;
  }): Promise<{ data?: WorkerInvitation; error?: any }> {
    try {
      // Generate token on server (via edge function or RPC)
      const { data: invitation, error } = await supabase
        .from('worker_invitations')
        .insert({
          email: data.email,
          role: data.role,
          store_id: data.store_id,
          token: crypto.randomUUID(), // Temporary, should be generated server-side
        })
        .select()
        .single();

      if (error) return { error };

      // Send invitation email (via edge function)
      await supabase.functions.invoke('send-invitation-email', {
        body: { invitation_id: invitation.id },
      });

      return { data: invitation };
    } catch (error) {
      return { error };
    }
  }

  static async getInvitations(storeId?: string): Promise<{ data?: WorkerInvitation[]; error?: any }> {
    try {
      let query = supabase
        .from('worker_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    } catch (error) {
      return { error };
    }
  }

  static async resendInvitation(id: string): Promise<{ error?: any }> {
    try {
      const { error } = await supabase.functions.invoke('send-invitation-email', {
        body: { invitation_id: id },
      });
      return { error };
    } catch (error) {
      return { error };
    }
  }

  static async cancelInvitation(id: string): Promise<{ error?: any }> {
    try {
      const { error } = await supabase
        .from('worker_invitations')
        .update({ status: 'cancelled' })
        .eq('id', id);

      return { error };
    } catch (error) {
      return { error };
    }
  }

  static async acceptInvitation(token: string): Promise<{ error?: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { error: { message: 'User not authenticated' } };
      }

      const { error } = await supabase.rpc('accept_invitation', {
        _token: token,
        _user_id: user.id,
      });

      return { error };
    } catch (error) {
      return { error };
    }
  }
}
```

#### 2. Create Invitation Management UI

**File**: `src/pages/master/Invitations.tsx`

Create a page that allows masters to:
- View all invitations (pending, accepted, expired, cancelled)
- Create new invitations (form with email, role, store selection)
- Resend invitations
- Cancel invitations
- Filter by status and store

**Design Requirements:**
- Use shadcn/ui Table component for list
- Use Dialog for create invitation form
- Show status badges (pending, accepted, expired, cancelled)
- Show expiration dates
- Mobile-responsive

#### 3. Update Signup Flow

**File**: `src/components/auth/AuthPage.tsx`

Update the signup flow to:
- Check for invitation token in URL params (`?token=xxx`)
- If token exists, call `InvitationService.acceptInvitation(token)`
- Show success message if invitation is accepted
- Redirect to appropriate dashboard after signup

#### 4. Create Supabase Edge Function for Email

**File**: `supabase/functions/send-invitation-email/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { invitation_id } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get invitation details
    const { data: invitation, error } = await supabase
      .from('worker_invitations')
      .select('*, stores(name)')
      .eq('id', invitation_id)
      .single();

    if (error || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate invitation URL
    const invitationUrl = `${Deno.env.get('SITE_URL')}/auth?token=${invitation.token}`;

    // Send email (using your email service - Resend, SendGrid, etc.)
    // For now, just log it
    console.log('Sending invitation email:', {
      to: invitation.email,
      url: invitationUrl,
    });

    // TODO: Integrate with email service
    // await sendEmail({
    //   to: invitation.email,
    //   subject: 'You\'ve been invited to join as a worker',
    //   html: `Click here to accept: ${invitationUrl}`,
    // });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## Task 3: Real-Time Delivery Notifications

### Requirements

Add real-time notifications for delivery status updates:
1. **Live Updates** - Deliveries update in real-time when status changes
2. **Toast Notifications** - Show toast notifications when deliveries are assigned, updated, or completed
3. **Notification Center** - Add a notification center/bell icon showing recent delivery updates
4. **Sound Alerts** (Optional) - Play sound when important delivery updates occur

### Implementation

#### 1. Create Real-Time Hook

**File**: `src/hooks/useDeliveryRealtime.ts`

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Delivery } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useDeliveryRealtime(storeId?: string) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Initial fetch
    fetchDeliveries();

    // Set up real-time subscription
    const channel = supabase
      .channel('deliveries-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: storeId ? `store_id=eq.${storeId}` : undefined,
        },
        (payload) => {
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  const fetchDeliveries = async () => {
    try {
      let query = supabase
        .from('deliveries')
        .select('*')
        .order('created_at', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      toast({
        title: 'Error',
        description: 'Failed to load deliveries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      // New delivery created
      setDeliveries((prev) => [newRecord, ...prev]);
      toast({
        title: 'New Delivery',
        description: `New delivery for ${newRecord.customer_name}`,
      });
    } else if (eventType === 'UPDATE') {
      // Delivery updated
      setDeliveries((prev) =>
        prev.map((d) => (d.id === newRecord.id ? newRecord : d))
      );

      // Show notification based on status change
      if (oldRecord.status !== newRecord.status) {
        const statusMessages: Record<string, string> = {
          assigned: 'Delivery assigned',
          in_transit: 'Delivery in transit',
          delivered: 'Delivery completed!',
          cancelled: 'Delivery cancelled',
        };

        toast({
          title: statusMessages[newRecord.status] || 'Delivery updated',
          description: `${newRecord.customer_name} - ${newRecord.delivery_address}`,
        });

        // Play sound for important updates (optional)
        if (newRecord.status === 'delivered') {
          playNotificationSound();
        }
      }
    } else if (eventType === 'DELETE') {
      // Delivery deleted
      setDeliveries((prev) => prev.filter((d) => d.id !== oldRecord.id));
    }
  };

  const playNotificationSound = () => {
    // Create audio element and play sound
    const audio = new Audio('/notification-sound.mp3'); // Add sound file to public folder
    audio.play().catch(() => {
      // Ignore errors if audio can't play
    });
  };

  return { deliveries, loading, refetch: fetchDeliveries };
}
```

#### 2. Update Deliveries Page

**File**: `src/pages/master/Deliveries.tsx`

Update the existing Deliveries page to use the real-time hook:

```typescript
import { useDeliveryRealtime } from '@/hooks/useDeliveryRealtime';

export default function DeliveriesPage() {
  const { deliveries, loading } = useDeliveryRealtime();
  
  // Rest of component...
}
```

#### 3. Create Notification Center Component

**File**: `src/components/shared/NotificationCenter.tsx`

Create a notification center component that:
- Shows a bell icon with badge count
- Displays recent delivery notifications
- Allows marking notifications as read
- Shows notification history

**Design Requirements:**
- Use shadcn/ui Popover or DropdownMenu
- Show notification list with timestamps
- Badge showing unread count
- Mobile-responsive

#### 4. Update Deliverer Dashboard

**File**: `src/components/deliverer/Dashboard/DelivererDashboard.tsx`

The deliverer dashboard already has some real-time setup. Enhance it to:
- Show toast notifications when deliveries are assigned to them
- Update delivery list in real-time
- Show notifications for status changes

#### 5. Add Notification Sound (Optional)

**File**: `public/notification-sound.mp3`

Add a notification sound file (or use a web audio API to generate one).

---

## Implementation Checklist

### Task 1: Fix RLS Policies
- [ ] Create migration file `20251106130000_fix_user_roles_rls.sql`
- [ ] Apply migration via Supabase Dashboard or CLI
- [ ] Test signup flow - verify role assignment works
- [ ] Verify policies were created correctly

### Task 2: Worker Invitation System
- [ ] Create migration for `worker_invitations` table
- [ ] Create `InvitationService.ts` with all CRUD methods
- [ ] Create `Invitations.tsx` page for master to manage invitations
- [ ] Update `AuthPage.tsx` to handle invitation tokens
- [ ] Create Supabase Edge Function for sending invitation emails
- [ ] Add navigation link to Invitations page in Master Layout
- [ ] Test invitation flow end-to-end

### Task 3: Real-Time Delivery Notifications
- [ ] Create `useDeliveryRealtime.ts` hook
- [ ] Update `Deliveries.tsx` page to use real-time hook
- [ ] Create `NotificationCenter.tsx` component
- [ ] Add notification center to Master Layout header
- [ ] Update `DelivererDashboard.tsx` to show real-time notifications
- [ ] Add notification sound (optional)
- [ ] Test real-time updates work correctly

---

## Design Guidelines

### Visual Design
- **Color Scheme**: Follow existing dashboard colors
- **Typography**: Use existing font sizes and weights
- **Components**: Use shadcn/ui components consistently
- **Icons**: Use Lucide React icons

### Mobile-First Design
- **Responsive Tables**: Use cards on mobile, tables on desktop
- **Touch Targets**: Minimum 48px height for buttons
- **Forms**: Full-width inputs on mobile
- **Notifications**: Toast notifications should be mobile-friendly

### User Experience
- **Loading States**: Show skeleton loaders while data loads
- **Error Handling**: Display error messages with toast notifications
- **Success Feedback**: Show success toasts after actions
- **Real-Time Updates**: Smooth transitions when data updates
- **Notification Priority**: Important notifications (delivered) should be more prominent

---

## Testing Checklist

### RLS Policies
- [ ] New user signup assigns role correctly
- [ ] Master can assign roles to workers
- [ ] Users can view their own roles
- [ ] RLS error no longer occurs

### Worker Invitations
- [ ] Master can create invitation
- [ ] Invitation email is sent (or logged)
- [ ] User can accept invitation via token
- [ ] Role is assigned correctly after acceptance
- [ ] Invitation status updates correctly
- [ ] Master can resend/cancel invitations

### Real-Time Notifications
- [ ] Delivery updates appear in real-time
- [ ] Toast notifications show for status changes
- [ ] Notification center displays recent updates
- [ ] Unread count updates correctly
- [ ] Notifications work on mobile

---

## Important Notes

1. **Don't Rebuild Existing Features**: The dashboard, AI features, and worker/deliverer/customer interfaces are already built. Focus only on the three tasks above.

2. **Use Existing Services**: Follow the pattern of existing services (`StoreService`, `InventoryService`, `SalesService`).

3. **Follow Existing Patterns**: Look at `DashboardView.tsx` for design patterns, component structure, and styling approach.

4. **Type Safety**: Use existing TypeScript types from `src/types/index.ts`. Add new types if needed.

5. **Error Handling**: Always handle errors and show user-friendly messages using toast notifications.

6. **Mobile Responsive**: Ensure all new pages work well on mobile devices.

7. **Supabase Realtime**: Use Supabase's built-in real-time subscriptions for live updates.

---

## Getting Started

1. **Start with RLS Fix**: Apply the migration first to fix the role assignment issue
2. **Build Invitation System**: Create the database schema, then build the UI
3. **Add Real-Time**: Enhance existing delivery pages with real-time updates
4. **Test Each Feature**: Test each feature thoroughly before moving to the next

Good luck building! Remember to use the existing codebase as reference and follow the established patterns.

