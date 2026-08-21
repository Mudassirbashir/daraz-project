import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDarazClient } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId;
  if (!orderId) {
    return NextResponse.json({ success: false, error: "orderId is required." }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const trackingNumber = body.tracking_number || body.trackingNumber || "";
    const courier = body.courier || body.shipping_provider || "Daraz Express (DEX)";

    const supabase = createAdminClient();
    const { data: order } = await supabase
      .from("orders")
      .select("id, store_id, daraz_order_id")
      .or(`id.eq.${orderId},daraz_order_id.eq.${orderId}`)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const client = await getDarazClient(order.store_id);
    const shipResult = await client.shipOrder({
      orderId: order.daraz_order_id,
      trackingNumber,
      courier,
    });

    if (shipResult.success) {
      await supabase
        .from("orders")
        .update({
          status: "shipped",
          workflow_status: "shipped",
          tracking_number: trackingNumber || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    }

    return NextResponse.json({
      success: shipResult.success,
      message: shipResult.success ? "Order marked as shipped on Daraz Open Platform." : "Failed to ship order on Daraz.",
      data: shipResult.data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to ship order." }, { status: 500 });
  }
}
