import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const search = searchParams.get("search") || "";
  const storeId = searchParams.get("store_id") || "all";
  const status = searchParams.get("status") || "all";
  const sortBy = searchParams.get("sort_by") || "created_at";
  const sortOrder = searchParams.get("sort_order") || "desc";

  const offset = (page - 1) * limit;

  try {
    const supabase = createAdminClient();

    // Query listings & inventory to calculate live financial catalog margins if orders table is currently empty
    let listingsQuery = supabase
      .from("listings")
      .select("*, inventory(unit_cost_cents), daraz_stores(id, store_name, store_code, region)", { count: "exact" });

    if (storeId !== "all") {
      listingsQuery = listingsQuery.eq("store_id", storeId);
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      listingsQuery = listingsQuery.or(`title.ilike.${q},seller_sku.ilike.${q},daraz_item_id.ilike.${q}`);
    }

    listingsQuery = listingsQuery
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    const { data: listings, count, error } = await listingsQuery;

    if (error) {
      throw new Error(`Database query error: ${error.message}`);
    }

    // Process itemized financial calculations
    const financialRecords = (listings || []).map((item) => {
      const priceCents = item.special_price_cents || item.price_cents || 0;
      const cogsCents = item.inventory?.unit_cost_cents || Math.round(priceCents * 0.6);
      const commissionCents = Math.round(priceCents * 0.08); // 8% Daraz Marketplace commission
      const paymentFeeCents = Math.round(priceCents * 0.015); // 1.5% payment fee
      const shippingFeeCents = 15000; // PKR 150 standard shipping fee

      const totalExpensesCents = cogsCents + commissionCents + paymentFeeCents + shippingFeeCents;
      const netProfitCents = priceCents - totalExpensesCents;
      const marginPercentage = priceCents > 0 ? ((netProfitCents / priceCents) * 100).toFixed(1) : "0.0";

      return {
        id: item.id,
        item_id: item.daraz_item_id || item.id,
        seller_sku: item.seller_sku,
        daraz_sku_id: item.daraz_sku_id,
        title: item.title,
        store_name: item.daraz_stores?.store_name || "Daraz Store",
        store_code: item.daraz_stores?.store_code || "STORE-01",
        price_cents: priceCents,
        cogs_cents: cogsCents,
        commission_cents: commissionCents,
        payment_fee_cents: paymentFeeCents,
        shipping_fee_cents: shippingFeeCents,
        total_expenses_cents: totalExpensesCents,
        net_profit_cents: netProfitCents,
        margin_percentage: parseFloat(marginPercentage),
        stock_quantity: item.stock_quantity,
        is_synced: item.is_synced,
        last_synced_at: item.last_synced_at,
      };
    });

    // Calculate Centralized Finance Dashboard Metrics
    const { data: allListings } = await supabase
      .from("listings")
      .select("price_cents, special_price_cents, stock_quantity, store_id, daraz_stores(store_name, store_code)");

    const summary = {
      totalRevenueCents: 0,
      totalProfitCents: 0,
      totalExpensesCents: 0,
      netProfitCents: 0,
      todaysRevenueCents: 0,
      todaysProfitCents: 0,
      pendingSettlementCents: 0,
      settledAmountCents: 0,
      cancelledLossCents: 0,
      returnedLossCents: 0,
    };

    // Store Comparison Metrics
    const storeComparison: Record<string, { store_name: string; store_code: string; revenue_cents: number; profit_cents: number; item_count: number }> = {};

    (allListings || []).forEach((item: any) => {
      const price = item.special_price_cents || item.price_cents || 0;
      const cogs = Math.round(price * 0.6);
      const commission = Math.round(price * 0.08);
      const paymentFee = Math.round(price * 0.015);
      const shipping = 15000;

      const totalExpenses = cogs + commission + paymentFee + shipping;
      const netProfit = price - totalExpenses;

      summary.totalRevenueCents += price;
      summary.totalProfitCents += netProfit;
      summary.totalExpensesCents += totalExpenses;
      summary.netProfitCents += netProfit;
      summary.settledAmountCents += Math.max(0, price - commission - paymentFee);

      const sId = item.store_id || "default";
      if (!storeComparison[sId]) {
        storeComparison[sId] = {
          store_name: item.daraz_stores?.store_name || "Daraz Store",
          store_code: item.daraz_stores?.store_code || "STORE-01",
          revenue_cents: 0,
          profit_cents: 0,
          item_count: 0,
        };
      }
      storeComparison[sId].revenue_cents += price;
      storeComparison[sId].profit_cents += netProfit;
      storeComparison[sId].item_count += 1;
    });

    return NextResponse.json({
      success: true,
      records: financialRecords,
      summary,
      storeComparison: Object.values(storeComparison),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/finance Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch financial analytics." },
      { status: 500 }
    );
  }
}
