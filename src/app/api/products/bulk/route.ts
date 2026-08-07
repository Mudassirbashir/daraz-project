import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, action, value } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Product IDs array (ids) is required for bulk actions." },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action parameter is required ('price', 'stock', 'activate', 'deactivate')." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (action === "price") {
      const priceCents = Math.round(parseFloat(value) * 100);
      if (isNaN(priceCents) || priceCents < 0) {
        return NextResponse.json({ success: false, error: "Invalid price value." }, { status: 400 });
      }
      updateData.price_cents = priceCents;
    } else if (action === "stock") {
      const stockQty = parseInt(value, 10);
      if (isNaN(stockQty) || stockQty < 0) {
        return NextResponse.json({ success: false, error: "Invalid stock quantity." }, { status: 400 });
      }
      updateData.stock_quantity = stockQty;
    } else if (action === "activate") {
      updateData.is_synced = true;
    } else if (action === "deactivate") {
      updateData.is_synced = false;
    } else {
      return NextResponse.json({ success: false, error: "Unsupported bulk action." }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("listings")
      .update(updateData)
      .in("id", ids)
      .select();

    if (error) {
      throw new Error(`Bulk update error: ${error.message}`);
    }

    // Also update matching inventory stock quantities if action === 'stock'
    if (action === "stock" && updated && updated.length > 0) {
      const skus = updated.map((item: any) => item.seller_sku);
      await supabase
        .from("inventory")
        .update({ quantity_on_hand: parseInt(value, 10), updated_at: new Date().toISOString() })
        .in("sku", skus);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully applied '${action}' action to ${updated?.length || 0} product listing(s).`,
      count: updated?.length || 0,
    });
  } catch (err: any) {
    console.error("[PATCH /api/products/bulk Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute bulk action." },
      { status: 500 }
    );
  }
}
