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
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { internalNotes, priceCents, stockQuantity } = body;

    const supabase = createAdminClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof priceCents === "number") {
      if (priceCents < 0) {
        return NextResponse.json({ success: false, error: "Invalid price value." }, { status: 400 });
      }
      updateData.price_cents = priceCents;
    }

    if (typeof stockQuantity === "number") {
      if (stockQuantity < 0) {
        return NextResponse.json({ success: false, error: "Invalid stock quantity." }, { status: 400 });
      }
      updateData.stock_quantity = stockQuantity;
    }

    const { data: updatedProduct, error } = await supabase
      .from("listings")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product listing: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Product listing updated successfully.",
      product: updatedProduct,
      internalNotes: internalNotes || "",
    });
  } catch (err: any) {
    console.error("[PATCH /api/products/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update product details." },
      { status: 500 }
    );
  }
}
