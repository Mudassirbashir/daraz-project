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

    // Fetch order, store, and order items
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*), order_items(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const store = order.daraz_stores;

    // 1. Enforce Daraz Status Prerequisite for Shipping Document Generation
    const orderStatus = (order.workflow_status || order.status || "pending").toLowerCase();
    if (["pending", "unpaid"].includes(orderStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Official Daraz shipping label can only be generated after the order is Packed or Ready to Ship on Seller Center (Current status: '${orderStatus}'). Please update the order status first.`,
        },
        { status: 400 }
      );
    }

    // 2. Validate Store API Credentials
    if (!store || !store.access_token || !store.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz store is not connected. Reconnect store via My Stores page before requesting official shipping labels.",
        },
        { status: 400 }
      );
    }

    // 3. Attempt Official Daraz Document Retrieval with Custom Label Engine Fallback
    const { getDarazClient } = await import("@/lib/daraz/client");
    const { normalizeShippingLabelData, generateShippingLabelHtml } = await import("@/lib/shipping-label/generator");
    const darazClient = await getDarazClient(store.id);

    let decodedContent = "";
    let mimeType = "text/html";
    let isOfficial = false;
    let sourceMessage = "";

    try {
      let orderItems = Array.isArray(order.order_items) && order.order_items.length > 0
        ? order.order_items
        : [];

      if (orderItems.length === 0) {
        orderItems = await darazClient.getOrderItems(order.daraz_order_id);
      }

      const itemIds = orderItems.map((item: any) => String(item.order_item_id)).filter(Boolean);

      if (itemIds.length > 0) {
        const officialDocResult = await darazClient.getShippingDocument(itemIds, docTypeParam);
        decodedContent = officialDocResult.file;
        mimeType = officialDocResult.mimeType || "text/html";
        isOfficial = true;
        sourceMessage = "Official Daraz shipping document retrieved from Daraz Open Platform API";

        try {
          if (!decodedContent.trim().startsWith("<") && !decodedContent.startsWith("%PDF")) {
            const decodedStr = Buffer.from(decodedContent, "base64").toString("utf-8");
            if (decodedStr.includes("<") || decodedStr.includes("html") || decodedStr.includes("DOCTYPE")) {
              decodedContent = decodedStr;
            }
          }
        } catch (e) {
          // Keep raw
        }
      }
    } catch (apiErr: any) {
      console.warn(`[Order Label API] Official Daraz document API notice for order ${id}: ${apiErr.message}. Generating custom ERP shipping label.`);
    }

    // Fallback: Custom ERP Shipping Label Engine compiled from real PostgreSQL order data
    if (!decodedContent) {
      const normalizedData = normalizeShippingLabelData(order, store);
      decodedContent = generateShippingLabelHtml(normalizedData);
      mimeType = "text/html";
      isOfficial = false;
      sourceMessage = "Custom Daraz-Style Shipping Label generated inside ERP from real synchronized order data";
    }

    if (rawFormatParam) {
      return new Response(decodedContent, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="daraz-label-${order.daraz_order_id}.html"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      file: decodedContent,
      mimeType,
      docType: docTypeParam,
      isOfficial,
      isErpGenerated: !isOfficial,
      sourceMessage,
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
        error: err.message || "Failed to generate shipping label.",
        field: err.field || undefined,
      },
      { status: 400 }
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
      notes: `Official Daraz shipping label printed (${newReprintCount}x).`,
    });

    return NextResponse.json({
      success: true,
      message: "Official shipping label print recorded.",
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
