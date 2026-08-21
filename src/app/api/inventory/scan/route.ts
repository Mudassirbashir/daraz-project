import { NextRequest, NextResponse } from "next/server";
import { resolveScannedProduct } from "@/lib/inventory/product-scanner-service";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json(
        {
          success: false,
          code: "STORE_NOT_AUTHORIZED",
          message: "User is not authorized for the requested store.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawInput = String(body.rawInput || body.barcode || body.sku || body.input || "");
    const storeId = body.storeId || body.store_id || undefined;
    const orderId = body.orderId || body.order_id || undefined;

    const supabase = createAdminClient();

    // Query authorized active store IDs for current user
    let userStoreIds: string[] = [];
    if (user?.id) {
      const { data: userStores } = await supabase
        .from("daraz_stores")
        .select("id")
        .eq("is_active", true)
        .or(`user_id.eq.${user.id},user_id.is.null`);

      userStoreIds = (userStores || []).map((s) => s.id);
    } else {
      const { data: activeStores } = await supabase
        .from("daraz_stores")
        .select("id")
        .eq("is_active", true);

      userStoreIds = (activeStores || []).map((s) => s.id);
    }

    const result = await resolveScannedProduct({
      rawInput,
      storeId,
      userStoreIds,
      orderId,
    });

    if (result.code === "STORE_NOT_AUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          code: "STORE_NOT_AUTHORIZED",
          message: result.message || "User is not authorized for the requested store.",
        },
        { status: 403 }
      );
    }

    if (result.code === "INVALID_INPUT") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_INPUT",
          message: result.message || "Scanner input string is empty or invalid.",
        },
        { status: 400 }
      );
    }

    if (result.code === "SCAN_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          code: "SCAN_NOT_FOUND",
          message: result.message || "No matching order or product was found for this store.",
          rawInput,
        },
        { status: 404 }
      );
    }

    if (result.code === "MULTIPLE_MATCHES") {
      return NextResponse.json(
        {
          success: false,
          code: "MULTIPLE_MATCHES",
          message: result.message || "Multiple matching orders or items found for this scan.",
          matches: result.matches || [],
          rawInput,
        },
        { status: 200 }
      );
    }

    if (result.code === "DATABASE_ERROR") {
      return NextResponse.json(
        {
          success: false,
          code: "DATABASE_ERROR",
          message: result.message || "Failed to perform store scanning query.",
          rawInput,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      matchType: result.matchType,
      storeId: result.storeId,
      orderId: result.orderId,
      orderItemId: result.orderItemId,
      sellerSku: result.sellerSku,
      barcode: result.barcode,
      productId: result.productId,
      productName: result.productName,
      quantity: result.quantity,
      store: result.store,
      order: result.order,
      orderItem: result.orderItem,
      product: result.product,
      match: result.match,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        code: "DATABASE_ERROR",
        message: err.message || "Failed to resolve scanned product.",
      },
      { status: 500 }
    );
  }
}


