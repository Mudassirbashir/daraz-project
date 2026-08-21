-- ==============================================================================
-- DARAZ MULTI-STORE ORDER SCANNING SCHEMA HARDENING & LOOKUP INDEXES
-- Migration: 20260835000000_reliable_multi_store_order_scanning_schema.sql
-- ==============================================================================
-- Description:
-- Establishes full store-scoping across all order and product tables and adds
-- required composite indexes to support fast, collision-free multi-store scanning
-- by 9 key lookup identifiers:
--   1. store_id
--   2. daraz_order_id
--   3. daraz_order_item_id / order_item_id
--   4. seller_sku
--   5. sku
--   6. barcode
--   7. tracking_number
--   8. daraz_product_id (daraz_item_id)
--   9. daraz_sku_id
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: ENSURE STORE SCOPING ON ALL ORDER-RELATED TABLES (Requirement A)
-- ------------------------------------------------------------------------------

-- 1a. Add store_id to public.order_items if missing and backfill from parent orders
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.order_items oi
SET store_id = o.store_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.store_id IS NULL;

-- 1b. Add store_id to public.daraz_packages if missing and backfill from parent orders
ALTER TABLE public.daraz_packages
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.daraz_packages p
SET store_id = o.store_id
FROM public.orders o
WHERE p.order_id = o.id AND p.store_id IS NULL;

-- 1c. Add store_id to public.shipping_labels if missing and backfill from parent orders
ALTER TABLE public.shipping_labels
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.shipping_labels sl
SET store_id = o.store_id
FROM public.orders o
WHERE sl.order_id = o.id AND sl.store_id IS NULL;

-- 1d. Add store_id to public.daraz_shipping_labels if missing and backfill from parent orders
ALTER TABLE public.daraz_shipping_labels
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.daraz_shipping_labels dsl
SET store_id = o.store_id
FROM public.orders o
WHERE dsl.order_id = o.id AND dsl.store_id IS NULL;

-- 1e. Add store_id to public.order_activities if missing and backfill from parent orders
ALTER TABLE public.order_activities
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.order_activities oa
SET store_id = o.store_id
FROM public.orders o
WHERE oa.order_id = o.id AND oa.store_id IS NULL;


-- ------------------------------------------------------------------------------
-- SECTION 2: ADD MISSING LOOKUP COLUMNS FOR PRODUCT / ITEM SCANNING
-- ------------------------------------------------------------------------------

-- 2a. Add barcode and daraz_sku_id to public.order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS daraz_sku_id VARCHAR(100);

-- 2b. Add barcode to public.daraz_product_skus
ALTER TABLE public.daraz_product_skus
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

-- 2c. Add barcode to public.inventory
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

-- 2d. Add barcode to public.listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);


-- ------------------------------------------------------------------------------
-- SECTION 3: DUPLICATE CONFLICT DETECTION & REPORTING (Requirement J)
-- ------------------------------------------------------------------------------
-- Detect any existing data conflicts for proposed UNIQUE constraints before
-- ensuring composite UNIQUE indexes. Reports conflicts via WARNING.

DO $$
DECLARE
  v_orders_conflicts INT := 0;
  v_order_items_conflicts INT := 0;
  v_listings_conflicts INT := 0;
  v_inventory_conflicts INT := 0;
  v_products_conflicts INT := 0;
  v_skus_conflicts INT := 0;
  v_shipments_conflicts INT := 0;
BEGIN
  -- Audit orders (store_id, daraz_order_id)
  SELECT COUNT(*) INTO v_orders_conflicts FROM (
    SELECT store_id, daraz_order_id FROM public.orders
    WHERE store_id IS NOT NULL AND daraz_order_id IS NOT NULL
    GROUP BY store_id, daraz_order_id HAVING COUNT(*) > 1
  ) c;
  IF v_orders_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, daraz_order_id) key(s) found in public.orders!', v_orders_conflicts;
  END IF;

  -- Audit order_items (store_id, order_item_id)
  SELECT COUNT(*) INTO v_order_items_conflicts FROM (
    SELECT store_id, order_item_id FROM public.order_items
    WHERE store_id IS NOT NULL AND order_item_id IS NOT NULL
    GROUP BY store_id, order_item_id HAVING COUNT(*) > 1
  ) c;
  IF v_order_items_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, order_item_id) key(s) found in public.order_items!', v_order_items_conflicts;
  END IF;

  -- Audit listings (store_id, seller_sku)
  SELECT COUNT(*) INTO v_listings_conflicts FROM (
    SELECT store_id, seller_sku FROM public.listings
    WHERE store_id IS NOT NULL AND seller_sku IS NOT NULL
    GROUP BY store_id, seller_sku HAVING COUNT(*) > 1
  ) c;
  IF v_listings_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, seller_sku) key(s) found in public.listings!', v_listings_conflicts;
  END IF;

  -- Audit inventory (store_id, sku)
  SELECT COUNT(*) INTO v_inventory_conflicts FROM (
    SELECT store_id, sku FROM public.inventory
    WHERE store_id IS NOT NULL AND sku IS NOT NULL
    GROUP BY store_id, sku HAVING COUNT(*) > 1
  ) c;
  IF v_inventory_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, sku) key(s) found in public.inventory!', v_inventory_conflicts;
  END IF;

  -- Audit daraz_products (store_id, daraz_item_id)
  SELECT COUNT(*) INTO v_products_conflicts FROM (
    SELECT store_id, daraz_item_id FROM public.daraz_products
    WHERE store_id IS NOT NULL AND daraz_item_id IS NOT NULL
    GROUP BY store_id, daraz_item_id HAVING COUNT(*) > 1
  ) c;
  IF v_products_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, daraz_item_id) key(s) found in public.daraz_products!', v_products_conflicts;
  END IF;

  -- Audit daraz_product_skus (store_id, seller_sku)
  SELECT COUNT(*) INTO v_skus_conflicts FROM (
    SELECT store_id, seller_sku FROM public.daraz_product_skus
    WHERE store_id IS NOT NULL AND seller_sku IS NOT NULL
    GROUP BY store_id, seller_sku HAVING COUNT(*) > 1
  ) c;
  IF v_skus_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, seller_sku) key(s) found in public.daraz_product_skus!', v_skus_conflicts;
  END IF;

  -- Audit daraz_shipments (store_id, daraz_order_id)
  SELECT COUNT(*) INTO v_shipments_conflicts FROM (
    SELECT store_id, daraz_order_id FROM public.daraz_shipments
    WHERE store_id IS NOT NULL AND daraz_order_id IS NOT NULL
    GROUP BY store_id, daraz_order_id HAVING COUNT(*) > 1
  ) c;
  IF v_shipments_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, daraz_order_id) key(s) found in public.daraz_shipments!', v_shipments_conflicts;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- SECTION 4: ENSURE COMPOSITE UNIQUE CONSTRAINTS (Requirement D, E, F)
-- ------------------------------------------------------------------------------
-- Ensures composite UNIQUE indexes exist for per-store isolation.
-- Note: barcode and seller_sku are NOT globally unique (Requirements E & F).

-- 4a. Unique order per store
-- Explanation: Ensures daraz_order_id is unique within a single store while allowing same ID across different stores.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_order_id_unique
  ON public.orders (store_id, daraz_order_id);

-- 4b. Unique order item per store
-- Explanation: Fast unique lookup of order items by store and order_item_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_store_item_id_unique
  ON public.order_items (store_id, order_item_id);

-- 4c. Unique product per store
-- Explanation: Scopes Daraz product items to their specific store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_products_store_item_unique
  ON public.daraz_products (store_id, daraz_item_id);

-- 4d. Unique product SKU per store
-- Explanation: Allows identical seller_sku values across different stores without collision (Requirement B & F).
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_product_skus_store_sku_unique
  ON public.daraz_product_skus (store_id, seller_sku);

-- 4e. Unique listing seller SKU per store
-- Explanation: Scopes store listing seller_sku values per store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_store_seller_sku_unique
  ON public.listings (store_id, seller_sku);

-- 4f. Unique inventory SKU per store
-- Explanation: Scopes inventory SKUs per store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_store_sku_unique
  ON public.inventory (store_id, sku);

-- 4g. Unique shipment per store
-- Explanation: Scopes daraz_shipments records per store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_shipments_store_order_unique
  ON public.daraz_shipments (store_id, daraz_order_id);


-- ------------------------------------------------------------------------------
-- SECTION 5: COMPOSITE INDEXES FOR MULTI-STORE LOOKUP IDENTIFIERS (Requirement C)
-- ------------------------------------------------------------------------------
-- High-performance composite indexes to support all 9 order scanning lookups.

-- --- ORDERS LOOKUPS ---
-- 5a. Lookup order by (store_id, tracking_number)
-- Explanation: Enables instant store-scoped lookup when barcode scanner scans a shipping label tracking number.
CREATE INDEX IF NOT EXISTS idx_orders_store_tracking_number
  ON public.orders (store_id, tracking_number)
  WHERE tracking_number IS NOT NULL;

-- --- ORDER ITEMS LOOKUPS ---
-- 5b. Lookup order items by (store_id, daraz_order_id)
-- Explanation: Enables quick retrieval of all line items for an order within a store context.
CREATE INDEX IF NOT EXISTS idx_order_items_store_daraz_order_id
  ON public.order_items (store_id, daraz_order_id);

-- 5c. Lookup order items by (store_id, seller_sku)
-- Explanation: Fast lookup of scanned items during packing verification by seller_sku.
CREATE INDEX IF NOT EXISTS idx_order_items_store_seller_sku
  ON public.order_items (store_id, seller_sku)
  WHERE seller_sku IS NOT NULL;

-- 5d. Lookup order items by (store_id, tracking_code)
-- Explanation: Enables item matching by shipping label tracking code during scanning.
CREATE INDEX IF NOT EXISTS idx_order_items_store_tracking_code
  ON public.order_items (store_id, tracking_code)
  WHERE tracking_code IS NOT NULL;

-- 5e. Lookup order items by (store_id, barcode)
-- Explanation: Enables item lookup directly by physical product barcode scanned during order packing.
CREATE INDEX IF NOT EXISTS idx_order_items_store_barcode
  ON public.order_items (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- 5f. Lookup order items by (store_id, daraz_sku_id)
-- Explanation: Fast order item resolution when scanning Daraz SKU identifiers.
CREATE INDEX IF NOT EXISTS idx_order_items_store_daraz_sku_id
  ON public.order_items (store_id, daraz_sku_id)
  WHERE daraz_sku_id IS NOT NULL;

-- 5g. Lookup order items by (store_id, item_id [daraz_product_id])
-- Explanation: Fast order item resolution by Daraz product ID.
CREATE INDEX IF NOT EXISTS idx_order_items_store_item_id
  ON public.order_items (store_id, item_id)
  WHERE item_id IS NOT NULL;

-- --- BARCODE MAPPINGS LOOKUPS ---
-- 5h. Lookup barcode mappings by (store_id, barcode)
-- Explanation: Multi-store safe barcode lookup. Barcode is non-unique globally, resolved per store.
CREATE INDEX IF NOT EXISTS idx_barcode_mappings_store_barcode
  ON public.barcode_mappings (store_id, barcode);

-- 5i. Lookup barcode mappings by (store_id, seller_sku)
-- Explanation: Fast mapping resolution between seller SKU and master barcode per store.
CREATE INDEX IF NOT EXISTS idx_barcode_mappings_store_seller_sku
  ON public.barcode_mappings (store_id, seller_sku)
  WHERE seller_sku IS NOT NULL;

-- --- PRODUCT SKUS & INVENTORY LOOKUPS ---
-- 5j. Lookup daraz_product_skus by (store_id, daraz_sku_id)
-- Explanation: Store-scoped lookup of SKU variations by Daraz SKU ID.
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_store_daraz_sku_id
  ON public.daraz_product_skus (store_id, daraz_sku_id)
  WHERE daraz_sku_id IS NOT NULL;

-- 5k. Lookup daraz_product_skus by (store_id, barcode)
-- Explanation: Store-scoped barcode lookup for Daraz product SKUs.
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_store_barcode
  ON public.daraz_product_skus (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- 5l. Lookup daraz_product_skus by (store_id, daraz_item_id)
-- Explanation: Store-scoped lookup of all SKUs belonging to a Daraz product item.
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_store_daraz_item_id
  ON public.daraz_product_skus (store_id, daraz_item_id);

-- 5m. Lookup inventory by (store_id, barcode)
-- Explanation: Store-scoped barcode lookup for stock inventory.
CREATE INDEX IF NOT EXISTS idx_inventory_store_barcode
  ON public.inventory (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- 5n. Lookup listings by (store_id, daraz_sku_id)
-- Explanation: Store-scoped lookup of product listings by Daraz SKU ID.
CREATE INDEX IF NOT EXISTS idx_listings_store_daraz_sku_id
  ON public.listings (store_id, daraz_sku_id)
  WHERE daraz_sku_id IS NOT NULL;

-- 5o. Lookup listings by (store_id, barcode)
-- Explanation: Store-scoped barcode lookup on active store listings.
CREATE INDEX IF NOT EXISTS idx_listings_store_barcode
  ON public.listings (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- --- PACKAGES & SHIPMENTS LOOKUPS ---
-- 5p. Lookup daraz_packages by (store_id, daraz_order_id)
-- Explanation: Fast store-scoped lookup of packages by Daraz order ID.
CREATE INDEX IF NOT EXISTS idx_daraz_packages_store_daraz_order_id
  ON public.daraz_packages (store_id, daraz_order_id);

-- 5q. Lookup daraz_packages by (store_id, tracking_number)
-- Explanation: Fast store-scoped lookup of package details by tracking number.
CREATE INDEX IF NOT EXISTS idx_daraz_packages_store_tracking_number
  ON public.daraz_packages (store_id, tracking_number)
  WHERE tracking_number IS NOT NULL;

-- 5r. Lookup daraz_packages by (store_id, package_id)
-- Explanation: Fast store-scoped lookup of package details by package ID.
CREATE INDEX IF NOT EXISTS idx_daraz_packages_store_package_id
  ON public.daraz_packages (store_id, package_id)
  WHERE package_id IS NOT NULL;

-- 5s. Lookup shipping_labels by (store_id, daraz_order_id)
-- Explanation: Fast store-scoped lookup of shipping labels by Daraz order ID.
CREATE INDEX IF NOT EXISTS idx_shipping_labels_store_daraz_order_id
  ON public.shipping_labels (store_id, daraz_order_id);

-- 5t. Lookup daraz_shipments by (store_id, tracking_number)
-- Explanation: Fast store-scoped lookup of shipments by tracking number.
CREATE INDEX IF NOT EXISTS idx_daraz_shipments_store_tracking_number
  ON public.daraz_shipments (store_id, tracking_number)
  WHERE tracking_number IS NOT NULL;

-- 5u. Lookup daraz_shipping_labels by (store_id, daraz_order_id)
-- Explanation: Fast store-scoped lookup of Daraz shipping labels by Daraz order ID.
CREATE INDEX IF NOT EXISTS idx_daraz_shipping_labels_store_daraz_order_id
  ON public.daraz_shipping_labels (store_id, daraz_order_id);

-- 5v. Lookup order_activities by (store_id, order_id)
-- Explanation: Fast store-scoped lookup of order audit activity logs.
CREATE INDEX IF NOT EXISTS idx_order_activities_store_order_id
  ON public.order_activities (store_id, order_id);


-- ------------------------------------------------------------------------------
-- SECTION 6: UPDATE COMPATIBILITY VIEWS & NOTIFY POSTGREST
-- ------------------------------------------------------------------------------

-- Refresh compatibility views to include newly added columns seamlessly
CREATE OR REPLACE VIEW daraz_orders AS SELECT * FROM public.orders;
CREATE OR REPLACE VIEW daraz_order_items AS SELECT * FROM public.order_items;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
