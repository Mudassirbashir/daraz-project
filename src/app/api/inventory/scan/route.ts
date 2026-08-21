import { NextRequest, NextResponse } from "next/server";
import { resolveScannedProduct } from "@/lib/inventory/product-scanner-service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawInput = String(body.rawInput || body.barcode || body.sku || body.input || "").trim();
    const storeId = body.storeId || body.store_id || undefined;
    const orderId = body.orderId || body.order_id || undefined;

    if (!rawInput) {
      return NextResponse.json(
        { success: false, error: "Scanner input string (barcode/SKU) is required." },
        { status: 400 }
      );
    }

    const result = await resolveScannedProduct({
      rawInput,
      storeId,
      orderId,
    });

    return NextResponse.json({
      success: result.matched,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to resolve scanned product." },
      { status: 500 }
    );
  }
}
