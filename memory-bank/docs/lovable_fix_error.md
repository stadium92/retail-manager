# Prompt: Fix Database Schema for Fichiers/Achats Modules

**Context**: You have implemented the "Fichiers" and "Achats" frontend modules, but the Supabase database schema is missing several tables and columns required for them to work. This is causing runtime errors when fetching or saving data.

**Objective**: Create a new Supabase migration to align the database with the frontend requirements.

## 1. Missing Tables
Create the following tables with appropriate RLS policies (viewable by 'worker' via `store_id`, manageable by 'master'):

- **`product_families`**:
    - `id` (UUID, PK)
    - `store_id` (UUID, FK to stores)
    - `name` (Text)
    - `description` (Text, Nullable)
    - `created_at`, `updated_at`

- **`client_services`** (Groups):
    - `id` (UUID, PK)
    - `store_id` (UUID, FK to stores)
    - `name` (Text)
    - `default_discount_percent` (Numeric)
    - `created_at`, `updated_at`

## 2. Missing Columns
Add the following columns to existing tables:

- **`products`**:
    - `selling_price_3` (Numeric, Default 0)
    - `selling_price_4` (Numeric, Default 0)
    - `unit_type` (Text, Default 'Piece')
    - `brand` (Text)
    - `preferred_supplier_id` (UUID, FK to suppliers)
    - `last_inventory_date` (Timestamp)
    - `last_purchase_date` (Timestamp)
    - `last_sale_date` (Timestamp)

- **`clients`** (Assuming table exists as `customers` or `profiles`, check existing schema):
    - *Note*: If `clients` table doesn't exist, create it separate from auth `profiles`.
    - `code` (Text)
    - `credit_limit` (Numeric, Default 0)
    - `current_balance` (Numeric, Default 0)
    - `loyalty_points` (Integer, Default 0)
    - `service_id` (UUID, FK to client_services)

## 3. RLS Logic
Ensure `get_user_store_ids()` is used for the policies so workers can only see data for their assigned store.

## 4. Execution
Generate the SQL migration file.
