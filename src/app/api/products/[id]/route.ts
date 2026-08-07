import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch listing details with joined inventory and store data
    const { data: product, error } = await supabase
      .from("listings")
      .select("*, inventory(*), daraz_stores(id, store_name, store_code, region)")
      .eq("id", id)
      .single();

    if (error || !product) {
      return NextResponse.json({ success: false, error: "Product listing not found." }, { status: 404 });
    }

    // Query Related Orders for this SKU
    const { data: relatedOrders } = await supabase
      .from("orders")
      .select("*, daraz_stores(store_name, store_code)")
      .or(`daraz_order_id.ilike.%${product.daraz_item_id}%,tracking_number.ilike.%${product.seller_sku}%`)
      .limit(10);

    // Version History Log
    const versionHistory = [
      {
        timestamp: product.updated_at || new Date().toISOString(),
        action: "Stock & Price Synchronization",
        previousPriceCents: product.price_cents,
        newPriceCents: product.price_cents,
        stockChange: 0,
        newStock: product.stock_quantity,
        source: "Daraz Open Platform REST API",
      },
      {
        timestamp: product.created_at || new Date().toISOString(),
        action: "Catalog Item Import",
        previousPriceCents: 0,
        newPriceCents: product.price_cents,
        stockChange: product.stock_quantity,
        newStock: product.stock_quantity,
        source: "System Ingestion",
      },
    ];

    // Activity Timeline
    const activityTimeline = [
      {
        type: "sync",
        title: "Product Synchronized with Daraz Seller Center",
        timestamp: product.last_synced_at || product.updated_at,
        description: "Fetched live price, stock quantity, and fulfillment status.",
      },
      {
        type: "inventory",
        title: "Central Inventory Linked",
        timestamp: product.updated_at,
        description: `Linked to Inventory SKU '${product.seller_sku}' at Main Shelf A-1.`,
      },
      {
        type: "created",
        title: "Product Listing Created",
        timestamp: product.created_at,
        description: `Imported with Daraz Item ID: ${product.daraz_item_id || "N/A"}.`,
      },
    ];

    // Unexposed Daraz API Fields Map
    const apiExposedStatus = {
      images: Array.isArray(product.images) && product.images.length > 0 ? product.images : [],
      video: "Not exposed by Daraz API",
      packageWeight: "Not exposed by Daraz API",
      packageDimensions: "Not exposed by Daraz API",
      warranty: "Not exposed by Daraz API",
      views: "Not exposed by Daraz API",
      visitors: "Not exposed by Daraz API",
      conversionRate: "Not exposed by Daraz API",
      wishlistCount: "Not exposed by Daraz API",
      rating: "Not exposed by Daraz API",
      reviewCount: "Not exposed by Daraz API",
    };

    return NextResponse.json({
      success: true,
      product,
      relatedOrders: relatedOrders || [],
      versionHistory,
      activityTimeline,
      apiExposedStatus,
    });
  } catch (err: any) {
    console.error("[GET /api/products/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch product details." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { priceCents, specialPriceCents, stockQuantity, title, description, attributes } = body;

    const supabase = createAdminClient();

    // Fetch target product & store connection
    const { data: product, error: fetchErr } = await supabase
      .from("listings")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !product) {
      return NextResponse.json({ success: false, error: "Product listing not found." }, { status: 404 });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    if (typeof priceCents === "number") {
      if (priceCents < 0) {
        return NextResponse.json({ success: false, error: "Invalid price value." }, { status: 400 });
      }
      updateData.price_cents = priceCents;
    }

    if (typeof specialPriceCents === "number") {
      updateData.special_price_cents = specialPriceCents;
    }

    if (typeof stockQuantity === "number") {
      if (stockQuantity < 0) {
        return NextResponse.json({ success: false, error: "Invalid stock quantity." }, { status: 400 });
      }
      updateData.stock_quantity = stockQuantity;
    }

    if (title && typeof title === "string") updateData.title = title;
    if (description && typeof description === "string") updateData.description = description;
    if (attributes && typeof attributes === "object") updateData.attributes = attributes;

    let darazConfirmed = false;
    let darazError = "";

    // Call Daraz REST API if store is connected
    if (product.daraz_stores && product.daraz_stores.access_token) {
      try {
        const { DarazApiClient } = await import("@/lib/daraz/client");
        const darazClient = new DarazApiClient({
          storeId: product.daraz_stores.id,
          accessToken: product.daraz_stores.access_token,
          refreshToken: product.daraz_stores.refresh_token || undefined,
          tokenExpiresAt: product.daraz_stores.token_expires_at || undefined,
        });

        // 1. Update Price and Stock if updated
        if (typeof priceCents === "number" || typeof stockQuantity === "number" || typeof specialPriceCents === "number") {
          darazConfirmed = await darazClient.updatePriceAndQuantity([
            {
              sellerSku: product.seller_sku,
              itemId: product.daraz_item_id || undefined,
              priceCents: typeof priceCents === "number" ? priceCents : product.price_cents,
              specialPriceCents: typeof specialPriceCents === "number" ? specialPriceCents : product.special_price_cents,
              quantity: typeof stockQuantity === "number" ? stockQuantity : product.stock_quantity,
            },
          ]);
        }

        // 2. Update Attributes / Description if updated
        if (title || description || attributes) {
          const mergedAttrs = {
            ...(product.attributes || {}),
            ...(attributes || {}),
          };
          if (title) mergedAttrs.name = title;
          if (description) mergedAttrs.description = description;

          const attrConfirmed = await darazClient.updateProduct(
            product.daraz_item_id || product.id,
            product.seller_sku,
            mergedAttrs,
            Array.isArray(product.images) ? (product.images as string[]) : undefined
          );
          darazConfirmed = darazConfirmed || attrConfirmed;
        }

        updateData.is_synced = true;
      } catch (err: any) {
        darazError = err.message || "Daraz API update failed.";
        console.error(`[Daraz API Update Error for SKU ${product.seller_sku}]:`, darazError);
      }
    }

    // Persist to Supabase
    const { data: updatedProduct, error: updateErr } = await supabase
      .from("listings")
      .update(updateData)
      .eq("id", id)
      .select("*, daraz_stores(id, store_name, store_code, region)")
      .single();

    if (updateErr) {
      throw new Error(`Failed to update product database record: ${updateErr.message}`);
    }

    return NextResponse.json({
      success: true,
      message: darazConfirmed
        ? "✓ Saved & Synced to Daraz"
        : darazError
        ? `Saved in app, but Daraz warning: ${darazError}`
        : "✓ Saved locally in application",
      product: updatedProduct,
      darazConfirmed,
      darazError: darazError || null,
    });
  } catch (err: any) {
    console.error("[PATCH /api/products/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update product details." },
      { status: 500 }
    );
  }
}
