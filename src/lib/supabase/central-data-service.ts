import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllStoreListings, fetchAllStoreOrders } from "@/lib/supabase/fetch-all";

export interface CentralStoreMetrics {
  storeId: string;
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalOrders: number;
  inProgressOrdersCount: number;
  grossRevenueCents: number;
}

/**
 * Centralized Store Metrics & Data Access Layer
 * Guarantees that Dashboard (Home), Orders, Products (Listings), and Stock (Inventory)
 * compute metrics and KPI numbers from the exact same underlying DB services.
 */
export async function getCentralStoreMetrics(
  storeId: string = "all",
  userStoreIds: string[]
): Promise<{
  activeStoreIds: string[];
  listings: any[];
  orders: any[];
  metrics: {
    totalProductsCount: number;
    totalStockUnits: number;
    lowStockCount: number;
    totalOrdersCount: number;
    inProgressOrdersCount: number;
    grossRevenueCents: number;
  };
  perStoreMetrics: Record<string, CentralStoreMetrics>;
}> {
  const supabase = createAdminClient();

  let targetStoreIds = userStoreIds;
  if (storeId !== "all") {
    targetStoreIds = userStoreIds.includes(storeId) ? [storeId] : [];
  }

  if (targetStoreIds.length === 0) {
    return {
      activeStoreIds: [],
      listings: [],
      orders: [],
      metrics: {
        totalProductsCount: 0,
        totalStockUnits: 0,
        lowStockCount: 0,
        totalOrdersCount: 0,
        inProgressOrdersCount: 0,
        grossRevenueCents: 0,
      },
      perStoreMetrics: {},
    };
  }

  const [listings, orders] = await Promise.all([
    fetchAllStoreListings(supabase, targetStoreIds, "id, store_id, seller_sku, stock_quantity, daraz_item_id, price_cents"),
    fetchAllStoreOrders(supabase, targetStoreIds, "id, store_id, status, workflow_status, total_amount_cents, order_date, created_at"),
  ]);

  // Aggregate global or filtered metrics
  const totalDistinctParents = new Set(listings.map((l: any) => l.daraz_item_id).filter(Boolean)).size;
  const totalProductsCount = totalDistinctParents > 0 ? totalDistinctParents : listings.length;
  const totalStockUnits = listings.reduce((sum: number, l: any) => sum + (l.stock_quantity || 0), 0);
  const lowStockCount = listings.filter((l: any) => (l.stock_quantity || 0) <= 10).length;

  const totalOrdersCount = orders.length;
  const inProgressOrdersCount = orders.filter((o: any) =>
    ["pending", "unpaid", "ready_to_ship", "picking", "packed", "to_pack", "to_ship"].includes(
      String(o.workflow_status || o.status || "").toLowerCase()
    )
  ).length;

  const grossRevenueCents = orders.reduce((sum: number, o: any) => sum + (o.total_amount_cents || 0), 0);

  // Build per-store metrics breakdown
  const perStoreMetrics: Record<string, CentralStoreMetrics> = {};
  targetStoreIds.forEach((stId) => {
    const stListings = listings.filter((l: any) => l.store_id === stId);
    const stOrders = orders.filter((o: any) => o.store_id === stId);

    const stParents = new Set(stListings.map((l: any) => l.daraz_item_id).filter(Boolean)).size;
    const stProdCount = stParents > 0 ? stParents : stListings.length;
    const stStock = stListings.reduce((sum: number, l: any) => sum + (l.stock_quantity || 0), 0);
    const stLowStock = stListings.filter((l: any) => (l.stock_quantity || 0) <= 10).length;
    const stOutOfStock = stListings.filter((l: any) => (l.stock_quantity || 0) === 0).length;

    const stOrdCount = stOrders.length;
    const stInProgress = stOrders.filter((o: any) =>
      ["pending", "unpaid", "ready_to_ship", "picking", "packed", "to_pack", "to_ship"].includes(
        String(o.workflow_status || o.status || "").toLowerCase()
      )
    ).length;
    const stRevenue = stOrders.reduce((sum: number, o: any) => sum + (o.total_amount_cents || 0), 0);

    perStoreMetrics[stId] = {
      storeId: stId,
      totalProducts: stProdCount,
      totalStockUnits: stStock,
      lowStockCount: stLowStock,
      outOfStockCount: stOutOfStock,
      totalOrders: stOrdCount,
      inProgressOrdersCount: stInProgress,
      grossRevenueCents: stRevenue,
    };
  });

  return {
    activeStoreIds: targetStoreIds,
    listings,
    orders,
    metrics: {
      totalProductsCount,
      totalStockUnits,
      lowStockCount,
      totalOrdersCount,
      inProgressOrdersCount,
      grossRevenueCents,
    },
    perStoreMetrics,
  };
}
