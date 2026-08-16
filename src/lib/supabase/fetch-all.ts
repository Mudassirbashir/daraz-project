import { createAdminClient } from "./admin";

/**
 * Robust Parallel Chunked Fetcher for Supabase Orders Table
 * Overcomes PostgREST's default 1,000 row truncation limit by determining
 * exact total headcount and executing parallel chunked range queries.
 */
export async function fetchAllStoreOrders(
  supabase: any,
  targetStoreIds: string[],
  selectFields = "id, store_id, status, workflow_status, total_amount_cents, order_date, created_at"
): Promise<any[]> {
  if (!targetStoreIds || targetStoreIds.length === 0) return [];

  // 1. Determine exact total headcount
  const { count, error: countErr } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("store_id", targetStoreIds);

  if (countErr || !count || count === 0) return [];

  const pageSize = 1000;
  const totalPages = Math.ceil(count / pageSize);

  // 2. Fetch all pages concurrently in parallel
  const pagePromises = Array.from({ length: totalPages }, (_, i) => {
    const from = i * pageSize;
    const to = from + pageSize - 1;
    return supabase
      .from("orders")
      .select(selectFields)
      .in("store_id", targetStoreIds)
      .range(from, to);
  });

  const pageResults = await Promise.all(pagePromises);
  const allOrders: any[] = [];

  for (const res of pageResults) {
    if (res.data) {
      allOrders.push(...res.data);
    }
  }

  return allOrders;
}

/**
 * Robust Parallel Chunked Fetcher for Supabase Listings Table
 * Overcomes PostgREST's default 1,000 row truncation limit for listings/stock queries.
 */
export async function fetchAllStoreListings(
  supabase: any,
  targetStoreIds: string[],
  selectFields = "id, store_id, seller_sku, stock_quantity, daraz_item_id, price_cents"
): Promise<any[]> {
  if (!targetStoreIds || targetStoreIds.length === 0) return [];

  const { count, error: countErr } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .in("store_id", targetStoreIds);

  if (countErr || !count || count === 0) return [];

  const pageSize = 1000;
  const totalPages = Math.ceil(count / pageSize);

  const pagePromises = Array.from({ length: totalPages }, (_, i) => {
    const from = i * pageSize;
    const to = from + pageSize - 1;
    return supabase
      .from("listings")
      .select(selectFields)
      .in("store_id", targetStoreIds)
      .range(from, to);
  });

  const pageResults = await Promise.all(pagePromises);
  const allListings: any[] = [];

  for (const res of pageResults) {
    if (res.data) {
      allListings.push(...res.data);
    }
  }

  return allListings;
}
