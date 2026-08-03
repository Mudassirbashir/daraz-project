-- ==============================================================================
-- DARAZ SMALL OPERATIONS MANAGEMENT SYSTEM - REFACTORED SCHEMA & RBAC
-- Migration: 20260803000000_refactored_daraz_ops_schema.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLEANUP EXISTING TYPES & TABLES (IDEMPOTENT EXECUTION)
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS daraz_api_logs CASCADE;
DROP TABLE IF EXISTS financial_records CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS daraz_stores CASCADE;
DROP TABLE IF EXISTS product_developments CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS sync_job_status CASCADE;
DROP TYPE IF EXISTS financial_record_type CASCADE;
DROP TYPE IF EXISTS daraz_order_status CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;
DROP TYPE IF EXISTS product_dev_stage CASCADE;
DROP TYPE IF EXISTS app_role CASCADE;

-- ------------------------------------------------------------------------------
-- 2. ENUMS
-- ------------------------------------------------------------------------------

CREATE TYPE app_role AS ENUM (
  'super_admin',       -- Mubashir (Full System, Finance, Store Credentials, User Admin)
  'product_manager',   -- Mudassir (Product Dev R&D, Vendors, Catalog, Listing Specs)
  'ops_manager'        -- Zainab (Inventory Control, Order Fulfillment, Task Ops, Listing Stock)
);

CREATE TYPE product_dev_stage AS ENUM (
  'ideation',
  'sourcing_samples',
  'sample_testing',
  'costing_approved',
  'ready_for_listing',
  'archived'
);

CREATE TYPE task_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE task_status AS ENUM (
  'todo',
  'in_progress',
  'review',
  'done'
);

CREATE TYPE daraz_order_status AS ENUM (
  'unpaid',
  'pending',
  'ready_to_ship',
  'shipped',
  'delivered',
  'canceled',
  'returned',
  'failed'
);

CREATE TYPE financial_record_type AS ENUM (
  'vendor_payment',
  'daraz_payout',
  'ad_spend',
  'shipping_cost',
  'customs_tax',
  'other_expense'
);

CREATE TYPE sync_job_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'failed'
);

-- ------------------------------------------------------------------------------
-- 3. OPERATIONAL TABLES
-- ------------------------------------------------------------------------------

-- User Profiles (Extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(30),
  role app_role NOT NULL DEFAULT 'ops_manager',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Roles Junction
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_role UNIQUE (user_id, role)
);

-- Vendors & Suppliers
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  country VARCHAR(50) DEFAULT 'China',
  payment_terms VARCHAR(50) DEFAULT '30% Advance, 70% Before Dispatch',
  moq INT DEFAULT 100,
  lead_time_days INT DEFAULT 15,
  rating NUMERIC(3, 2) DEFAULT 5.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product Development (R&D & Sample Pipeline)
CREATE TABLE product_developments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  stage product_dev_stage NOT NULL DEFAULT 'ideation',
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  target_cost_cents BIGINT DEFAULT 0,
  estimated_selling_price_cents BIGINT DEFAULT 0,
  sample_ordered_date DATE,
  sample_received_date DATE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daraz Stores Accounts
CREATE TABLE daraz_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code VARCHAR(30) UNIQUE NOT NULL, -- e.g., DARAZ-PK-STORE-1
  store_name VARCHAR(100) NOT NULL,
  region VARCHAR(10) NOT NULL DEFAULT 'PK', -- PK, BD, LK, NP
  seller_id VARCHAR(50) NOT NULL,
  api_app_key VARCHAR(100),
  api_app_secret VARCHAR(100),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Central Inventory Control
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity_on_hand INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved INT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  reorder_point INT NOT NULL DEFAULT 10,
  unit_cost_cents BIGINT NOT NULL DEFAULT 0,
  storage_location VARCHAR(50) DEFAULT 'Main Shelf A-1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daraz Store Product Listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE CASCADE,
  product_dev_id UUID REFERENCES product_developments(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  seller_sku VARCHAR(50) NOT NULL,
  daraz_item_id VARCHAR(50),
  daraz_sku_id VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  price_cents BIGINT NOT NULL,
  special_price_cents BIGINT,
  stock_quantity INT NOT NULL DEFAULT 0,
  is_synced BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_seller_sku_per_store UNIQUE (store_id, seller_sku)
);

-- Daraz Synced Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE RESTRICT,
  daraz_order_id VARCHAR(50) UNIQUE NOT NULL,
  tracking_number VARCHAR(50),
  customer_name VARCHAR(100),
  customer_city VARCHAR(50),
  total_amount_cents BIGINT NOT NULL DEFAULT 0,
  status daraz_order_status NOT NULL DEFAULT 'pending',
  is_payout_settled BOOLEAN NOT NULL DEFAULT FALSE,
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Internal Tasks (Mubashir, Mudassir, Zainab)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'todo',
  assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_date DATE,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financial Records (Mubashir / Finance Control)
CREATE TABLE financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type financial_record_type NOT NULL,
  amount_cents BIGINT NOT NULL,
  reference_code VARCHAR(100),
  description TEXT,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  store_id UUID REFERENCES daraz_stores(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daraz API Synchronization Logs
CREATE TABLE daraz_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL,
  status sync_job_status NOT NULL DEFAULT 'pending',
  records_synced INT DEFAULT 0,
  error_message TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX idx_vendors_code ON vendors(code);
CREATE INDEX idx_product_dev_stage ON product_developments(stage, assigned_to);
CREATE INDEX idx_listings_store_sku ON listings(store_id, seller_sku);
CREATE INDEX idx_orders_daraz_id ON orders(daraz_order_id);
CREATE INDEX idx_orders_store_status ON orders(store_id, status);
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX idx_finance_record_date ON financial_records(record_date DESC);
CREATE INDEX idx_api_logs_store_sync ON daraz_api_logs(store_id, sync_type, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. TRIGGERS & SECURITY HELPERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_developments_updated_at BEFORE UPDATE ON product_developments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daraz_stores_updated_at BEFORE UPDATE ON daraz_stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RBAC Security Definers
CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID)
RETURNS app_role AS $$
DECLARE
  u_role app_role;
BEGIN
  SELECT role INTO u_role FROM profiles WHERE id = target_user_id;
  RETURN COALESCE(u_role, 'ops_manager'::app_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_super_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (public.get_user_role(target_user_id) = 'super_admin'::app_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daraz_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daraz_api_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Team members can view profiles" ON profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Super Admin manages profiles" ON profiles FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- User Roles
CREATE POLICY "Users read own roles" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super Admin manages roles" ON user_roles FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- Operational Modules
CREATE POLICY "Team can view vendors" ON vendors FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Product Manager & Super Admin manage vendors" ON vendors FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.get_user_role(auth.uid()) = 'product_manager');

CREATE POLICY "Team can view product developments" ON product_developments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Product Manager & Super Admin manage product dev" ON product_developments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.get_user_role(auth.uid()) = 'product_manager');

CREATE POLICY "Team can view stores" ON daraz_stores FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Super Admin manages store credentials" ON daraz_stores FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Team can view inventory" ON inventory FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Ops Manager & Super Admin manage inventory" ON inventory FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.get_user_role(auth.uid()) = 'ops_manager');

CREATE POLICY "Team can view listings" ON listings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Product & Ops Managers manage listings" ON listings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.get_user_role(auth.uid()) IN ('product_manager', 'ops_manager'));

CREATE POLICY "Team can view orders" ON orders FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Ops Manager & Super Admin update orders" ON orders FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.get_user_role(auth.uid()) = 'ops_manager');

CREATE POLICY "Team members can view tasks" ON tasks FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Team members can create and update tasks" ON tasks FOR ALL TO authenticated USING (TRUE);

CREATE POLICY "Super Admin manages financial records" ON financial_records FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admin & Ops Manager view API logs" ON daraz_api_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.get_user_role(auth.uid()) = 'ops_manager');
