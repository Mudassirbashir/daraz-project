import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl, action, index } = body;

    const supabase = createAdminClient();

    const { data: product, error: fetchErr } = await supabase
      .from("listings")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !product) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    let images: string[] = Array.isArray(product.images) ? (product.images as string[]) : [];

    if (action === "add" && imageUrl) {
      images = [...images, imageUrl];
    } else if (action === "replace" && typeof index === "number" && imageUrl) {
      if (index >= 0 && index < images.length) {
        images[index] = imageUrl;
      }
    } else if (action === "remove" && typeof index === "number") {
      images = images.filter((_, i) => i !== index);
    } else {
      return NextResponse.json({ success: false, error: "Invalid image operation arguments." }, { status: 400 });
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 1 - CALL DARAZ API FIRST
    // =========================================================================
    const store = product.daraz_stores;
    if (!store) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz store is disconnected. Reconnect your store via My Stores before modifying product images.",
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    let darazConfirmed = false;
    try {
      const { getValidStoreAccessToken } = await import("@/lib/daraz/store-utils");
      const { client: darazClient } = await getValidStoreAccessToken(store.id);

      darazConfirmed = await darazClient.updateProduct(
        product.daraz_item_id || product.id,
        product.seller_sku,
        product.attributes || {},
        images
      );
    } catch (darazErr: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Daraz did not accept image update: ${darazErr.message}`,
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    if (!darazConfirmed) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz Seller Center rejected the product image update.",
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 2 - UPDATE LOCAL DB ONLY AFTER CONFIRMED SUCCESS
    // =========================================================================
    const { data: updatedProduct, error: updateErr } = await supabase
      .from("listings")
      .update({
        images,
        is_synced: true,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update product images in database: ${updateErr.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "✓ Daraz Confirmed: Saved & Synced image to Seller Center",
      product: updatedProduct,
      darazConfirmed: true,
    });
  } catch (err: any) {
    console.error("[POST /api/products/[id]/images Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to manage product images." },
      { status: 500 }
    );
  }
}
