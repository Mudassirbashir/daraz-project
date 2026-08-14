import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const pageInput = parseInt(searchParams.get("page") || "1", 10);
  const limitInput = parseInt(searchParams.get("limit") || "25", 10);
  const page = isNaN(pageInput) || pageInput < 1 ? 1 : pageInput;
  const limit = isNaN(limitInput) || limitInput < 1 ? 25 : Math.min(limitInput, 100);

  const search = searchParams.get("search") || "";
  const storeId = searchParams.get("store_id") || "all";
  const sortBy = searchParams.get("sort_by") || "created_at";
  const sortOrder = searchParams.get("sort_order") || "desc";

  const offset = (page - 1) * limit;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Query synced orders containing exact Daraz financial data
    let ordersQuery = supabase
      .from("orders")
      .select("*, daraz_stores(id, store_name, store_code, region)", { count: "exact" });

    if (storeId !== "all") {
      ordersQuery = ordersQuery.eq("store_id", storeId);
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      ordersQuery = ordersQuery.or(`daraz_order_id.ilike.${q},customer_name.ilike.${q},tracking_number.ilike.${q}`);
    }

    const validSortFields = ["order_date", "total_amount_cents", "customer_name", "status"];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "order_date";

    ordersQuery = ordersQuery
      .order(safeSortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    const { data: ordersList, count, error } = await ordersQuery;

    if (error) {
      throw new Error(`Database query error: ${error.message}`);
    }

    // Process exact order financial records from Daraz API raw fields
    const financialRecords = (ordersList || []).map((o) => {
      const rawObj = o.raw_payload || {};
      const grossPriceCents = o.total_amount_cents || Math.round((parseFloat(String(rawObj.price || 0)) * 100));
      const shippingFeeCents = o.shipping_fee_cents || Math.round((parseFloat(String(rawObj.shipping_fee || 0)) * 100));
      const voucherDiscountCents = o.voucher_discount_cents || Math.round((parseFloat(String(rawObj.voucher_platform || rawObj.voucher || 0)) * 100));
      const sellerDiscountCents = o.seller_discount_cents || Math.round((parseFloat(String(rawObj.voucher_seller || 0)) * 100));

      const netAmountCents = grossPriceCents + shippingFeeCents - voucherDiscountCents - sellerDiscountCents;

      return {
        id: o.id,
        daraz_order_id: o.daraz_order_id,
        order_number: o.order_number || o.daraz_order_id,
        customer_name: o.customer_name || "Daraz Customer",
        store_name: o.daraz_stores?.store_name || "Daraz Store",
        store_code: o.daraz_stores?.store_code || "STORE-01",
        status: o.status,
        currency: o.currency || "PKR",
        gross_sales_cents: grossPriceCents,
        shipping_fee_cents: shippingFeeCents,
        voucher_discount_cents: voucherDiscountCents,
        seller_discount_cents: sellerDiscountCents,
        net_amount_cents: netAmountCents,
        fee_breakdown_status: rawObj.item_fee ? "Official API Breakdown" : "Data unavailable from Daraz API",
        order_date: o.order_date,
      };
    });

    // Calculate overall totals from actual DB records
    const { data: allOrders } = await supabase
      .from("orders")
      .select("total_amount_cents, shipping_fee_cents, voucher_discount_cents, seller_discount_cents, status, store_id, daraz_stores(store_name, store_code)");

    const summary = {
      totalGrossSalesCents: 0,
      totalShippingFeeCents: 0,
      totalVoucherDiscountCents: 0,
      totalSellerDiscountCents: 0,
      totalNetAmountCents: 0,
      deliveredGrossSalesCents: 0,
      pendingSettlementCents: 0,
    };

    const storeComparison: Record<string, { store_name: string; store_code: string; gross_sales_cents: number; net_amount_cents: number; order_count: number }> = {};

    (allOrders || []).forEach((o: any) => {
      const gross = o.total_amount_cents || 0;
      const ship = o.shipping_fee_cents || 0;
      const vch = o.voucher_discount_cents || 0;
      const sellerDisc = o.seller_discount_cents || 0;
      const net = gross + ship - vch - sellerDisc;

      summary.totalGrossSalesCents += gross;
      summary.totalShippingFeeCents += ship;
      summary.totalVoucherDiscountCents += vch;
      summary.totalSellerDiscountCents += sellerDisc;
      summary.totalNetAmountCents += net;

      if (o.status === "delivered") {
        summary.deliveredGrossSalesCents += gross;
      } else {
        summary.pendingSettlementCents += gross;
      }

      const sId = o.store_id || "default";
      if (!storeComparison[sId]) {
        storeComparison[sId] = {
          store_name: o.daraz_stores?.store_name || "Daraz Store",
          store_code: o.daraz_stores?.store_code || "STORE-01",
          gross_sales_cents: 0,
          net_amount_cents: 0,
          order_count: 0,
        };
      }
      storeComparison[sId].gross_sales_cents += gross;
      storeComparison[sId].net_amount_cents += net;
      storeComparison[sId].order_count += 1;
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
