import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

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

    // Fetch target products with store credentials
    const { data: productsToProcess, error: fetchErr } = await supabase
      .from("listings")
      .select("*, daraz_stores(*)")
      .in("id", ids);

    if (fetchErr || !productsToProcess || productsToProcess.length === 0) {
      return NextResponse.json({ success: false, error: "Target product listings not found." }, { status: 404 });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    let targetPriceCents: number | undefined;
    let targetStockQty: number | undefined;

    if (action === "price") {
      targetPriceCents = Math.round(parseFloat(value) * 100);
      if (isNaN(targetPriceCents) || targetPriceCents < 0) {
        return NextResponse.json({ success: false, error: "Invalid price value." }, { status: 400 });
      }
      updateData.price_cents = targetPriceCents;
    } else if (action === "stock") {
      targetStockQty = parseInt(value, 10);
      if (isNaN(targetStockQty) || targetStockQty < 0) {
        return NextResponse.json({ success: false, error: "Invalid stock quantity." }, { status: 400 });
      }
      updateData.stock_quantity = targetStockQty;
    } else if (action === "activate") {
      updateData.is_synced = true;
    } else if (action === "deactivate") {
      updateData.is_synced = false;
    } else {
      return NextResponse.json({ success: false, error: "Unsupported bulk action." }, { status: 400 });
    }

    const confirmedIds: string[] = [];
    const rejectedErrors: string[] = [];

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 1 - CALL DARAZ API FIRST
    // =========================================================================
    const { getValidStoreAccessToken } = await import("@/lib/daraz/store-utils");

    for (const prod of productsToProcess) {
      const store = prod.daraz_stores;
      if (!store) {
        rejectedErrors.push(`SKU ${prod.seller_sku}: Store disconnected.`);
        continue;
      }

      if (action === "price" || action === "stock") {
        try {
          const { client: darazClient } = await getValidStoreAccessToken(store.id);

          const darazConfirmed = await darazClient.updatePriceAndQuantity([
            {
              sellerSku: prod.seller_sku,
              itemId: prod.daraz_item_id || undefined,
              priceCents: action === "price" ? targetPriceCents : prod.price_cents,
              quantity: action === "stock" ? targetStockQty : prod.stock_quantity,
            },
          ]);

          if (darazConfirmed) {
            confirmedIds.push(prod.id);
          } else {
            rejectedErrors.push(`SKU ${prod.seller_sku}: Daraz Seller Center rejected update.`);
          }
        } catch (apiErr: any) {
          rejectedErrors.push(`SKU ${prod.seller_sku}: ${apiErr.message}`);
        }
      } else {
        // Activate/Deactivate local workflow
        confirmedIds.push(prod.id);
      }
    }

    if (confirmedIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Daraz rejected bulk operation. Reasons: ${rejectedErrors.join("; ")}`,
          confirmedCount: 0,
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 2 - UPDATE LOCAL DB ONLY FOR CONFIRMED ITEMS
    // =========================================================================
    const { data: updated, error } = await supabase
      .from("listings")
      .update(updateData)
      .in("id", confirmedIds)
      .select();

    if (error) {
      throw new Error(`Bulk database update error: ${error.message}`);
    }

    // Also update matching inventory stock quantities if action === 'stock'
    if (action === "stock" && updated && updated.length > 0 && targetStockQty !== undefined) {
      const skus = updated.map((item: any) => item.seller_sku);
      await supabase
        .from("inventory")
        .update({ quantity_on_hand: targetStockQty, updated_at: new Date().toISOString() })
        .in("sku", skus);
    }

    return NextResponse.json({
      success: true,
      message: `✓ Daraz Confirmed: Successfully applied '${action}' action to ${updated?.length || 0} product listing(s).`,
      count: updated?.length || 0,
      rejectedErrors,
      darazConfirmed: true,
    });
  } catch (err: any) {
    console.error("[PATCH /api/products/bulk Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute bulk action." },
      { status: 500 }
    );
  }
}
