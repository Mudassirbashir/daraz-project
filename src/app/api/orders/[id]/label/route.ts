import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const docTypeParam = (searchParams.get("doc_type") || "shipping_label") as "shipping_label" | "invoice" | "carrierManifest";
  const rawFormatParam = searchParams.get("raw") === "true";

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
      appKey: order.daraz_stores.api_app_key || undefined,
      appSecret: order.daraz_stores.api_app_secret || undefined,
    });

    const orderItems = await darazClient.getOrderItems(order.daraz_order_id);
    const itemIds = orderItems.map((item) => item.order_item_id);

    if (itemIds.length === 0) {
      itemIds.push(order.daraz_order_id);
    }

    // Fetch Official Shipping Document from Daraz REST API /order/document/get
    const shippingDoc = await darazClient.getShippingDocument(itemIds, docTypeParam);

    let decodedContent = shippingDoc.file;
    let isHtml = false;

    // Decode Base64 string if payload is encoded
    try {
      if (!decodedContent.trim().startsWith("<") && !decodedContent.startsWith("%PDF")) {
        const decodedStr = Buffer.from(decodedContent, "base64").toString("utf-8");
        if (decodedStr.includes("<") || decodedStr.includes("html") || decodedStr.includes("DOCTYPE") || decodedStr.includes("body")) {
          decodedContent = decodedStr;
          isHtml = true;
        }
      } else if (decodedContent.trim().startsWith("<")) {
        isHtml = true;
      }
    } catch (e) {
      // Keep as is if decoding fails
    }

    // If requested as raw document stream directly for browser preview/printing
    if (rawFormatParam) {
      if (isHtml || shippingDoc.mimeType.includes("html")) {
        return new Response(decodedContent, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `inline; filename="daraz-label-${order.daraz_order_id}.html"`,
          },
        });
      }

      if (shippingDoc.mimeType.includes("pdf") || decodedContent.startsWith("%PDF")) {
        const pdfBuffer = Buffer.from(shippingDoc.file, "base64");
        return new Response(pdfBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="daraz-label-${order.daraz_order_id}.pdf"`,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      file: decodedContent,
      mimeType: isHtml ? "text/html" : shippingDoc.mimeType,
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

    const userId = user?.id || "";
    const { data: profile } = userId
      ? await supabase
          .from("profiles")
          .select("full_name, employee_id")
          .eq("id", userId)
          .maybeSingle()
      : { data: null };

    const operatorName = profile?.full_name || profile?.employee_id || user?.email || "Shipping Staff";

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
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update label print tracking: ${updateErr.message}`);
    }

    await supabase.from("order_activities").insert({
      order_id: order.id,
      daraz_order_id: order.daraz_order_id,
      previous_status: order.workflow_status || order.status,
      new_status: order.workflow_status || order.status,
      actor: operatorName,
      source: "Shipping Label Station",
      notes: `Official shipping label printed (${newReprintCount}x).`,
    });

    return NextResponse.json({
      success: true,
      message: "Shipping label print recorded.",
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error("[POST /api/orders/[id]/label Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to record label print event." },
      { status: 500 }
    );
  }
}
