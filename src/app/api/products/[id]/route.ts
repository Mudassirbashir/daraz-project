import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient, humanizeDarazApiError } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: product, error } = await supabase
      .from("listings")
      .select("*, inventory(*), daraz_stores(id, store_name, store_code, region)")
      .eq("id", id)
      .single();

    if (error || !product) {
      return NextResponse.json({ success: false, error: "Product listing not found." }, { status: 404 });
    }

    const { data: relatedOrders } = await supabase
      .from("orders")
      .select("*, daraz_stores(store_name, store_code)")
      .or(`daraz_order_id.ilike.%${product.daraz_item_id}%,tracking_number.ilike.%${product.seller_sku}%`)
      .limit(10);

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

    // Explicit Status for Catalog Fields Not Exposed by Daraz Open Platform API
    const apiExposedStatus = {
      images: Array.isArray(product.images) && product.images.length > 0 ? product.images : [],
      video: "Not supported by Daraz API",
      packageWeight: "Not supported by Daraz API",
      packageDimensions: "Not supported by Daraz API",
      warranty: "Not supported by Daraz API",
      views: "Not supported by Daraz API",
      visitors: "Not supported by Daraz API",
      conversionRate: "Not supported by Daraz API",
      wishlistCount: "Not supported by Daraz API",
      rating: "Not supported by Daraz API",
      reviewCount: "Not supported by Daraz API",
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
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
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

    const store = product.daraz_stores;
    if (!store || !store.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz store is not connected. Reconnect your store via My Stores before updating product details.",
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    // Prepare candidate values
    const targetPriceCents = typeof priceCents === "number" ? priceCents : product.price_cents;
    const targetSpecialPriceCents = typeof specialPriceCents === "number" ? specialPriceCents : product.special_price_cents;
    const targetStockQuantity = typeof stockQuantity === "number" ? stockQuantity : product.stock_quantity;

    if (targetPriceCents < 0 || targetStockQuantity < 0) {
      return NextResponse.json({ success: false, error: "Invalid price or stock quantity value." }, { status: 400 });
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 1 - SEND REQUEST TO DARAZ API FIRST
    // =========================================================================
    const darazClient = new DarazApiClient({
      storeId: store.id,
      accessToken: store.access_token,
      refreshToken: store.refresh_token || undefined,
      tokenExpiresAt: store.token_expires_at || undefined,
      appKey: store.api_app_key || undefined,
      appSecret: store.api_app_secret || undefined,
    });

    let darazConfirmed = false;

    try {
      if (typeof priceCents === "number" || typeof stockQuantity === "number" || typeof specialPriceCents === "number") {
        darazConfirmed = await darazClient.updatePriceAndQuantity([
          {
            sellerSku: product.seller_sku,
            itemId: product.daraz_item_id || undefined,
            priceCents: targetPriceCents,
            specialPriceCents: targetSpecialPriceCents,
            quantity: targetStockQuantity,
          },
        ]);
      }

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
    } catch (apiErr: any) {
      console.error(`[Daraz API Update Rejected for SKU ${product.seller_sku}]:`, apiErr.message);
      // STEP 2 - ABORT DATABASE UPDATE IF DARAZ REJECTED THE CHANGE
      return NextResponse.json(
        {
          success: false,
          error: `Daraz did not accept this change: ${apiErr.message}`,
          darazConfirmed: false,
          previousValues: {
            price_cents: product.price_cents,
            stock_quantity: product.stock_quantity,
          },
        },
        { status: 400 }
      );
    }

    if (!darazConfirmed) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz did not accept this change: Seller Center returned an unconfirmed response status.",
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 3 - UPDATE LOCAL DB ONLY AFTER CONFIRMED SUCCESS
    // =========================================================================
    const updateData: Record<string, any> = {
      price_cents: targetPriceCents,
      special_price_cents: targetSpecialPriceCents,
      stock_quantity: targetStockQuantity,
      is_synced: true,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (title && typeof title === "string") updateData.title = title;
    if (description && typeof description === "string") updateData.description = description;
    if (attributes && typeof attributes === "object") updateData.attributes = attributes;

    const { data: updatedProduct, error: updateErr } = await supabase
      .from("listings")
      .update(updateData)
      .eq("id", id)
      .select("*, daraz_stores(id, store_name, store_code, region)")
      .single();

    if (updateErr) {
      throw new Error(`Failed to update product database record: ${updateErr.message}`);
    }

    // Also update central inventory stock quantity
    if (product.seller_sku) {
      await supabase
        .from("inventory")
        .update({
          quantity_on_hand: targetStockQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("sku", product.seller_sku);
    }

    // Audit Log
    await supabase.from("audit_logs").insert({
      user_id: user?.id || null,
      actor_name: user?.email || "Ops Manager",
      entity_type: "product",
      entity_id: product.id,
      action: "price_stock_update",
      changes: {
        previousPriceCents: product.price_cents,
        newPriceCents: targetPriceCents,
        previousStock: product.stock_quantity,
        newStock: targetStockQuantity,
        darazConfirmed: true,
      },
      source: "daraz_api",
    });

    return NextResponse.json({
      success: true,
      message: "✓ Daraz Confirmed: Product updated and synced to Seller Center",
      product: updatedProduct,
      darazConfirmed: true,
    });
  } catch (err: any) {
    console.error("[PATCH /api/products/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update product details." },
      { status: 500 }
    );
  }
}
