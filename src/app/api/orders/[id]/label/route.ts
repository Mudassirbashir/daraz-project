import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const docTypeParam = (searchParams.get("doc_type") || "shipping_label") as "shipping_label" | "invoice" | "carrierManifest";

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      console.warn("[API Order Label]: Unauthenticated session attempt. Proceeding with system admin client.");
    }

    const supabase = createAdminClient();

    // Fetch order & store credentials
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    if (!order.daraz_stores || !order.daraz_stores.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: `Store '${order.daraz_stores?.store_name || "Daraz Store"}' is not connected. Reconnect store via My Stores page to print official labels.`,
          storeNotConnected: true,
        },
        { status: 400 }
      );
    }

    // Call Daraz REST API to fetch order item IDs and shipping document
    const darazClient = new DarazApiClient({
      storeId: order.daraz_stores.id,
      accessToken: order.daraz_stores.access_token,
      refreshToken: order.daraz_stores.refresh_token || undefined,
      tokenExpiresAt: order.daraz_stores.token_expires_at || undefined,
    });

    const orderItems = await darazClient.getOrderItems(order.daraz_order_id);
    const itemIds = orderItems.map((item) => item.order_item_id);

    if (itemIds.length === 0) {
      // Fallback: use order_id as item ID
      itemIds.push(order.daraz_order_id);
    }

    // Fetch Official Shipping Document from Daraz REST API /order/document/get
    const shippingDoc = await darazClient.getShippingDocument(itemIds, docTypeParam);

    return NextResponse.json({
      success: true,
      file: shippingDoc.file,
      mimeType: shippingDoc.mimeType,
      docType: docTypeParam,
      order,
      printTracking: {
        isLabelPrinted: order.is_label_printed || false,
        labelPrintedAt: order.label_printed_at || null,
        labelPrintedBy: order.label_printed_by || null,
        reprintCount: order.reprint_count || 0,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/orders/[id]/label Exception]:", err.message);
    return NextResponse.json(
      {
        success: false,
        error: `Daraz API Error: ${err.message || "Failed to retrieve official shipping label."}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      console.warn("[API Order Label POST]: Unauthenticated session attempt. Proceeding with system admin client.");
    }

    const supabase = createAdminClient();

    // Fetch user profile name
    const userId = user?.id || "";
    const { data: profile } = userId
      ? await supabase
          .from("profiles")
          .select("full_name, employee_id")
          .eq("id", userId)
          .maybeSingle()
      : { data: null };

    const operatorName = profile?.full_name || profile?.employee_id || user?.email || "Shipping Staff";

    // Fetch target order
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const timestamp = new Date().toISOString();
    const newReprintCount = (order.reprint_count || 0) + 1;

    // Record print event in orders table
    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update({
        is_label_printed: true,
        label_printed_at: order.label_printed_at || timestamp,
        label_printed_by: order.label_printed_by || operatorName,
        reprint_count: newReprintCount,
        updated_at: timestamp,
      })
      .eq("id", id)
      .select("*, daraz_stores(id, store_name, store_code, region)")
      .single();

    if (updateErr) {
      throw new Error(`Failed to record label print tracking: ${updateErr.message}`);
    }

    // Insert audit log
    await supabase.from("daraz_api_logs").insert({
      store_id: order.store_id,
      sync_type: newReprintCount > 1 ? "label_reprinted" : "label_printed",
      status: "completed",
      records_synced: 1,
      payload: {
        order_id: order.id,
        daraz_order_id: order.daraz_order_id,
        printed_by: operatorName,
        printed_at: timestamp,
        reprint_count: newReprintCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: newReprintCount > 1 ? `✓ Label Reprinted (Count: ${newReprintCount})` : "✓ Label Sent to Printer",
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error("[POST /api/orders/[id]/label Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to record print event." },
      { status: 500 }
    );
  }
}
