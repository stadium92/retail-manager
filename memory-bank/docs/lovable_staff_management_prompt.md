# Role: Frontend Expert
# Context: "Retail Manager" App (Supabase + React + Shadcn/UI)

We need to build the **Staff Management** module for the **Master** (Store Owner).
The Master needs to be able to manually create accounts for **Workers** and **Deliverers**.

## 1. New Feature: Team Management Page
**Location**: Master Dashboard -> Sidebar -> "Team" or "Staff"

### UI Structure:
1.  **Overview Cards (Top)**:
    *   "Total Workers": [Count] / [Slot Limit] (e.g., 3/5)
    *   "Total Deliverers": [Count] / [Slot Limit]
2.  **Tabs**:
    *   **Tab 1: Workers**
        *   Table listing all Workers.
        *   Columns: Name, Email, Phone, Assigned Store, Status (Active/Inactive), Actions (Edit, Delete).
        *   **Button**: "Add New Worker" (Primary).
    *   **Tab 2: Deliverers**
        *   Table listing all Deliverers.
        *   Columns: Name, Email, Phone, Vehicle Type, Status, Actions.
        *   **Button**: "Add New Deliverer" (Primary).

### "Add Worker" Modal/Drawer:
*   **Fields**:
    *   **Full Name** (Text)
    *   **Email** (Email type) - *Make this unique check*.
    *   **Password** (Password type) - *Master sets the initial password*.
    *   **Phone Number** (Tel)
    *   **Assign Store** (Dropdown - Select from Master's stores).
*   **Logic**:
    *   On Submit: Call Supabase Auth `signUp` (or a specific Edge Function `create_user`) to create the user.
    *   Insert a row into `user_roles` linking this User ID to the role 'worker'.
    *   Insert a row into `profiles` with the name/phone.
    *   Create a record in `store_workers` linking User ID to Store ID.

### "Add Deliverer" Modal/Drawer:
*   **Fields**:
    *   **Full Name**
    *   **Email**
    *   **Password**
    *   **Phone Number**
    *   **Vehicle Type** (Dropdown: Bike, Motorbike, Van, Truck).
*   **Logic**:
    *   On Submit: Create Supabase User.
    *   Assign 'deliverer' role.

## 2. Technical Constraints
*   **Supabase Auth**: Since the Master is creating accounts *for* others, we cannot use standard client-side `signUp` (which logs the current user out).
    *   *Solution*: We need a **Supabase Edge Function** named `create-user`.
    *   The frontend should call this function: `supabase.functions.invoke('create-user', { body: { email, password, role, ... } })`.
*   **Slots Limit**:
    *   Frontend should visually show limits (e.g., "Upgrade to add more workers" if limit reached). *For now, just assume a static limit or unlimited.*

## 3. Styling
*   Use **Shadcn/UI** components: `Table`, `Dialog` (Modal), `Form` (react-hook-form), `Tabs`.
*   Use `Lucide-React` icons: `Users`, `Truck`, `UserPlus`.
*   Theme: Professional, clean, consistent with the rest of the Master Dashboard.
