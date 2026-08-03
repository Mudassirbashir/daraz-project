-- ==============================================================================
-- DARAZ SMALL OPERATIONS APP - SEED DATA
-- File: supabase/seed.sql
-- ==============================================================================

-- Seed Profiles for Mubashir (Super Admin), Mudassir (Product Manager), Zainab (Operations Manager)
INSERT INTO profiles (id, employee_id, full_name, email, phone, role, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'EMP-001', 'Mubashir', 'mubashir@darazops.internal', '+92 300 1111111', 'super_admin', true),
  ('22222222-2222-2222-2222-222222222222', 'EMP-002', 'Mudassir', 'mudassir@darazops.internal', '+92 300 2222222', 'product_manager', true),
  ('33333333-3333-3333-3333-333333333333', 'EMP-003', 'Zainab', 'zainab@darazops.internal', '+92 300 3333333', 'ops_manager', true)
ON CONFLICT (email) DO NOTHING;

-- Seed Daraz Stores Across Regions
INSERT INTO daraz_stores (id, store_code, store_name, region, seller_id, is_active)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'DARAZ-PK-01', 'Daraz Flagship Store PK', 'PK', 'PK_SELLER_88192', true),
  ('a2222222-2222-2222-2222-222222222222', 'DARAZ-BD-01', 'Daraz Express Store BD', 'BD', 'BD_SELLER_44120', true)
ON CONFLICT (store_code) DO NOTHING;

-- Seed Key Vendors
INSERT INTO vendors (id, code, name, contact_name, email, country, moq, lead_time_days)
VALUES
  ('b1111111-1111-1111-1111-111111111111', 'VEND-CN-01', 'Shenzhen Tech Electronics', 'Li Wei', 'liwei@techvendor.cn', 'China', 200, 14),
  ('b2222222-2222-2222-2222-222222222222', 'VEND-PK-01', 'Lahore Packaging Industries', 'Tariq Mahmood', 'tariq@lhrpack.pk', 'Pakistan', 500, 5)
ON CONFLICT (code) DO NOTHING;

-- Seed Product Development Samples
INSERT INTO product_developments (id, code, name, category, stage, vendor_id, target_cost_cents, estimated_selling_price_cents, assigned_to)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'DEV-2026-01', 'Wireless Noise Canceling Earbuds v2', 'Electronics', 'sample_testing', 'b1111111-1111-1111-1111-111111111111', 1200, 2999, '22222222-2222-2222-2222-222222222222'),
  ('c2222222-2222-2222-2222-222222222222', 'DEV-2026-02', 'Ergonomic Desk Mat Ultra', 'Home & Living', 'ready_for_listing', 'b2222222-2222-2222-2222-222222222222', 450, 1499, '22222222-2222-2222-2222-222222222222')
ON CONFLICT (code) DO NOTHING;

-- Seed Sample Tasks for Mubashir, Mudassir, Zainab
INSERT INTO tasks (title, description, priority, status, assigned_to, created_by, due_date)
VALUES
  ('Approve Vendor PO for Earbuds v2', 'Review cost breakdown and approve 30% advance payment', 'high', 'in_progress', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', CURRENT_DATE + INTERVAL '2 days'),
  ('Finalize Daraz Listing Keywords for Desk Mat', 'Optimize SEO title and bullet points for Daraz PK Search', 'medium', 'todo', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', CURRENT_DATE + INTERVAL '3 days'),
  ('Update Inventory Stock Count for KHI Hub Dispatch', 'Audit stock on hand vs reserved in central stock', 'urgent', 'in_progress', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', CURRENT_DATE + INTERVAL '1 day');
