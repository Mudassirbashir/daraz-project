import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Query all orders with financial details
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(store_name, store_code)")
      .order("created_at", { ascending: false });

    if (ordersErr) {
      throw new Error(ordersErr.message);
    }

    const ordersList = orders || [];

    let totalLocalCents = 0;
    let totalDarazReportedCents = 0;
    const mismatchedOrders: any[] = [];

    ordersList.forEach((o) => {
      const localTotal = o.total_amount_cents || 0;
      // Calculate Daraz reported expected payout (Price + Shipping Fee - Discounts)
      const rawObj = o.raw_payload || {};
      const priceCents = o.total_amount_cents || Math.round((rawObj.price || 0) * 100);
      const shippingFeeCents = o.shipping_fee_cents || Math.round((rawObj.shipping_fee || 0) * 100);
      const voucherCents = o.voucher_discount_cents || Math.round((rawObj.voucher_platform || 0) * 100);
      const sellerDiscountCents = o.seller_discount_cents || Math.round((rawObj.voucher_seller || 0) * 100);

      const darazReportedPayoutCents = priceCents + shippingFeeCents - voucherCents - sellerDiscountCents;

      totalLocalCents += localTotal;
      totalDarazReportedCents += darazReportedPayoutCents;

      const diff = Math.abs(localTotal - darazReportedPayoutCents);
      if (diff > 0) {
        mismatchedOrders.push({
          id: o.id,
          daraz_order_id: o.daraz_order_id,
          store_name: o.daraz_stores?.store_name || "Daraz Store",
          customer_name: o.customer_name || "Customer",
          localTotalCents: localTotal,
          darazReportedCents: darazReportedPayoutCents,
          differenceCents: diff,
          reason: localTotal > darazReportedPayoutCents ? "Seller discount / voucher mismatch" : "Shipping fee variance",
        });
      }
    });

    const totalDiffCents = totalDarazReportedCents - totalLocalCents;
    const isNeedsReview = Math.abs(totalDiffCents) > 0 || mismatchedOrders.length > 0;

    return NextResponse.json({
      success: true,
      darazTotalFormatted: (totalDarazReportedCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" }),
      localTotalFormatted: (totalLocalCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" }),
      differenceFormatted: (Math.abs(totalDiffCents) / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" }),
      darazTotalCents: totalDarazReportedCents,
      localTotalCents: totalLocalCents,
      differenceCents: totalDiffCents,
      status: isNeedsReview ? "needs_review" : "reconciled",
      mismatchedOrders,
    });
  } catch (err: any) {
    console.error("[GET /api/finance/reconcile Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to calculate reconciliation." },
      { status: 500 }
    );
  }
}
