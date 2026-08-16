import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDarazClient, sanitizeLogPayload } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const docTypeParam = (searchParams.get("doc_type") || "shipping_label") as "shipping_label" | "invoice" | "carrierManifest";
  const rawFormatParam = searchParams.get("raw") === "true";
  const formatParam = searchParams.get("format");

  try {
    // 1. Authenticate current application user
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access to shipping label endpoint." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Fetch target order and store details
    let order: any = null;

    const { data: primaryOrder } = await supabase
      .from("orders")
      .select("*, daraz_stores(*), order_items(*)")
      .eq("id", id)
      .maybeSingle();

    if (primaryOrder) {
      order = primaryOrder;
    } else {
      const { data: fallbackOrder } = await supabase
        .from("orders")
        .select("*, daraz_stores(*), order_items(*)")
        .eq("daraz_order_id", id)
        .maybeSingle();

      if (fallbackOrder) {
        order = fallbackOrder;
      }
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: `Order '${id}' not found in database.` },
        { status: 404 }
      );
    }

    const store = order.daraz_stores;

    // 3. Verify Store Ownership & Connection Status
    if (!store || !store.access_token || !store.is_active) {
      // Structured error log
      console.warn(
        `[GET /shipping-label] Store disconnected for Order ${order.daraz_order_id}:`,
        sanitizeLogPayload({ store_id: store?.id, order_id: order.daraz_order_id, status: "DISCONNECTED" })
      );

      return NextResponse.json(
        {
          success: false,
          error: "Daraz store is disconnected. Reconnect store via My Stores page before requesting official shipping labels.",
          storeNotConnected: true,
        },
        { status: 400 }
      );
    }

    // 4. Validate Daraz Access Token & Get Client Instance
    let darazClient;
    try {
      darazClient = await getDarazClient(store.id);
    } catch (clientErr: any) {
      console.error(
        `[GET /shipping-label] Client initialization failed for store ${store.id}:`,
        sanitizeLogPayload({ store_id: store.id, order_id: order.daraz_order_id, error: clientErr.message })
      );
      return NextResponse.json(
        {
          success: false,
          error: `Store authentication error: ${clientErr.message}`,
          storeNotConnected: true,
        },
        { status: 401 }
      );
    }

    // 5. Enforce Order Fulfillment State Prerequisite
    const orderStatus = (order.workflow_status || order.status || "pending").toLowerCase();
    if (["pending", "unpaid"].includes(orderStatus) && !order.is_packed) {
      return NextResponse.json(
        {
          success: false,
          error: `Official Daraz shipping label can only be generated after the order is Packed or Ready to Ship on Seller Center (Current status: '${orderStatus}'). Please click 'Pack Order' to proceed.`,
          orderStateInvalid: true,
          orderStatus,
        },
        { status: 400 }
      );
    }

    // 6. Get Item IDs required for Document API
    let orderItems = Array.isArray(order.order_items) && order.order_items.length > 0
      ? order.order_items
      : [];

    if (orderItems.length === 0) {
      try {
        orderItems = await darazClient.getOrderItems(order.daraz_order_id);
      } catch (itemErr: any) {
        console.warn(`[GET /shipping-label] Failed to fetch live items for Order ${order.daraz_order_id}:`, itemErr.message);
      }
    }

    const itemIds = orderItems.map((item: any) => String(item.order_item_id)).filter(Boolean);

    if (itemIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No valid order items found for Daraz Order #${order.daraz_order_id}. Cannot retrieve shipping label.`,
        },
        { status: 400 }
      );
    }

    // 7. Call Official Daraz Open Platform Document API (/order/document/get)
    let officialDocResult;
    try {
      officialDocResult = await darazClient.getShippingDocument(itemIds, docTypeParam);
    } catch (apiErr: any) {
      console.error(
        `[GET /shipping-label] Daraz Document API Error:`,
        sanitizeLogPayload({
          store_id: store.id,
          order_id: order.daraz_order_id,
          endpoint: "/order/document/get",
          error: apiErr.message,
        })
      );

      return NextResponse.json(
        {
          success: false,
          error: apiErr.message || `Daraz Open Platform API failed to return shipping label document for Order #${order.daraz_order_id}.`,
          daraz_order_id: order.daraz_order_id,
          doc_type: docTypeParam,
        },
        { status: 502 }
      );
    }

    const decodedContent = officialDocResult.file;
    const mimeType = officialDocResult.mimeType || "application/pdf";
    const timestamp = new Date().toISOString();

    // 8. Persist Normalized Shipment & Shipping Label Records
    let shipmentId: string | null = null;
    try {
      const { data: shipmentData } = await supabase
        .from("daraz_shipments")
        .upsert(
          {
            store_id: store.id,
            order_id: order.id,
            daraz_order_id: order.daraz_order_id,
            package_id: order.package_id || `PKG-${order.daraz_order_id}`,
            shipment_provider_name: order.shipping_provider || "Daraz Express (DEX)",
            tracking_number: order.tracking_number || null,
            status: order.workflow_status || order.status || "packed",
            raw_response: sanitizeLogPayload(officialDocResult.raw || {}),
            updated_at: timestamp,
          },
          { onConflict: "daraz_order_id" }
        )
        .select("id")
        .maybeSingle();

      shipmentId = shipmentData?.id || null;
    } catch (shipmentDbErr: any) {
      console.warn("[GET /shipping-label] Notice saving to daraz_shipments:", shipmentDbErr.message);
    }

    try {
      await supabase.from("daraz_shipping_labels").insert({
        shipment_id: shipmentId,
        order_id: order.id,
        daraz_order_id: order.daraz_order_id,
        label_type: docTypeParam,
        document_data: decodedContent,
        mime_type: mimeType,
        status: "ready",
        created_at: timestamp,
        updated_at: timestamp,
      });
    } catch (labelDbErr: any) {
      console.warn("[GET /shipping-label] Notice saving to daraz_shipping_labels:", labelDbErr.message);
    }

    // Also persist in shipping_labels view/table for backward compatibility
    try {
      await supabase.from("shipping_labels").insert({
        order_id: order.id,
        daraz_order_id: order.daraz_order_id,
        package_id: order.package_id || null,
        doc_type: docTypeParam,
        mime_type: mimeType,
        file_content: decodedContent,
        is_official: true,
        retrieved_at: timestamp,
      });
    } catch (compatErr: any) {
      // Ignored if table structured differently
    }

    // 9. Return PDF Binary Buffer or Base64/HTML Payload
    if (rawFormatParam || formatParam === "pdf" || formatParam === "raw") {
      const isPdf = mimeType === "application/pdf" || decodedContent.startsWith("%PDF") || decodedContent.startsWith("JVBERi");
      let bodyBuffer: Buffer;
      if (isPdf && (decodedContent.startsWith("JVBERi") || !decodedContent.startsWith("%PDF"))) {
        try {
          bodyBuffer = Buffer.from(decodedContent, "base64");
        } catch (e) {
          bodyBuffer = Buffer.from(decodedContent, "utf-8");
        }
      } else {
        bodyBuffer = Buffer.from(decodedContent, "utf-8");
      }
      const contentType = isPdf ? "application/pdf" : "text/html; charset=utf-8";
      const extension = isPdf ? "pdf" : "html";

      return new Response(new Uint8Array(bodyBuffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="daraz-label-${order.daraz_order_id}.${extension}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      file: decodedContent,
      mimeType,
      docType: docTypeParam,
      isOfficial: true,
      sourceMessage: "Official Daraz shipping document retrieved from Daraz Open Platform API",
      order,
      printTracking: {
        isLabelPrinted: order.is_label_printed || false,
        labelPrintedAt: order.label_printed_at || null,
        labelPrintedBy: order.label_printed_by || null,
        reprintCount: order.reprint_count || 0,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/orders/[id]/shipping-label Exception]:", err.message);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to generate shipping label.",
      },
      { status: 500 }
    );
  }
}
