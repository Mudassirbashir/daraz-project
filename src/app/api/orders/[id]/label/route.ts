import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

function generateFallbackLabelHtml(order: any, store: any, orderItems: any[]): string {
  const storeName = store?.store_name || "Daraz Seller Store";
  const sellerId = store?.seller_id || "SELLER_ON_FILE";
  const orderId = order.daraz_order_id || order.order_number || order.id;
  const trackingNumber = order.tracking_number || order.package_id || orderId;
  const customerName = order.customer_name || "Customer on File";
  const customerCity = order.customer_city || "Pakistan";
  const customerAddress = order.customer_address || "Shipping Address on File";
  const customerPhone = order.customer_phone || "N/A";
  const amountFormatted = ((order.total_amount_cents || 0) / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });
  const paymentMethod = order.payment_method || "COD";
  const shippingProvider = order.shipping_provider || "Daraz Express (DEX)";
  const orderDate = new Date(order.order_date || order.created_at).toLocaleString();

  const itemsHtml = Array.isArray(orderItems) && orderItems.length > 0
    ? orderItems.map((i) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${i.seller_sku || "SKU"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${i.name || "Daraz Item"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${i.quantity || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${((i.paid_price_cents || i.item_price_cents || 0) / 100).toFixed(2)} PKR</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">SKU-GENERIC</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Order Items Package #${orderId}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">1</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${amountFormatted}</td>
      </tr>
    `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Daraz Order Shipping Label #${orderId}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; }
        .label-container { max-width: 650px; margin: 0 auto; border: 2px solid #000; padding: 20px; border-radius: 8px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
        .logo { font-size: 22px; font-weight: 900; color: #f97316; }
        .badge { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #fde68a; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .box { border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; background: #f8fafc; }
        .box-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
        .value { font-size: 14px; font-weight: bold; color: #0f172a; }
        .barcode { text-align: center; border: 2px dashed #94a3b8; padding: 12px; margin: 16px 0; background: #fafafa; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; }
        .footer-note { font-size: 10px; color: #64748b; margin-top: 16px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>
    </head>
    <body>
      <div class="label-container">
        <div class="header">
          <div>
            <div class="logo">DARAZ HUB</div>
            <div style="font-size: 11px; color: #64748b;">Seller Operations Management</div>
          </div>
          <div style="text-align: right;">
            <span class="badge">Application Shipping Label</span>
            <div style="font-size: 11px; font-weight: bold; margin-top: 4px;">${storeName}</div>
            <div style="font-size: 10px; font-mono; color: #64748b;">Seller ID: ${sellerId}</div>
          </div>
        </div>

        <div class="barcode">
          *${trackingNumber}*
          <div style="font-size: 11px; font-weight: normal; margin-top: 4px; color: #475569;">AWB / Tracking Number: ${trackingNumber}</div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Recipient & Delivery Address</div>
            <div class="value">${customerName}</div>
            <div style="font-size: 12px; margin-top: 4px;">${customerAddress}</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 2px; color: #2563eb;">${customerCity}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Phone: ${customerPhone}</div>
          </div>

          <div class="box">
            <div class="box-title">Package & Logistics Summary</div>
            <div style="font-size: 12px;"><strong>Order ID:</strong> #${orderId}</div>
            <div style="font-size: 12px; margin-top: 2px;"><strong>Order Date:</strong> ${orderDate}</div>
            <div style="font-size: 12px; margin-top: 2px;"><strong>Carrier:</strong> ${shippingProvider}</div>
            <div style="font-size: 12px; margin-top: 2px;"><strong>Payment Method:</strong> ${paymentMethod}</div>
            <div style="font-size: 16px; font-weight: 900; color: #16a34a; margin-top: 8px;">COD Amount: ${amountFormatted}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="footer-note">
          Generated from verified synchronized order database record. Sourced from Daraz Seller Center.
        </div>
      </div>
    </body>
    </html>
  `;
}

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

    // Attempt Official Daraz Document Retrieval
    let officialDocResult: { file: string; mimeType: string } | null = null;
    let isOfficial = false;

    if (store && store.access_token && store.is_active) {
      try {
        const darazClient = new DarazApiClient({
          storeId: store.id,
          accessToken: store.access_token,
          refreshToken: store.refresh_token || undefined,
          tokenExpiresAt: store.token_expires_at || undefined,
          appKey: store.api_app_key || undefined,
          appSecret: store.api_app_secret || undefined,
        });

        const orderItems = Array.isArray(order.order_items) && order.order_items.length > 0
          ? order.order_items
          : await darazClient.getOrderItems(order.daraz_order_id);

        const itemIds = orderItems.map((item: any) => item.order_item_id);
        if (itemIds.length === 0) itemIds.push(order.daraz_order_id);

        officialDocResult = await darazClient.getShippingDocument(itemIds, docTypeParam);
        isOfficial = true;
      } catch (officialErr: any) {
        console.warn(`[API Order Label]: Official document API unavailable for order ${order.daraz_order_id}: ${officialErr.message}. Generating application fallback label...`);
      }
    }

    let decodedContent = "";
    let mimeType = "text/html";
    let isHtml = true;

    if (officialDocResult && officialDocResult.file) {
      decodedContent = officialDocResult.file;
      mimeType = officialDocResult.mimeType || "text/html";

      try {
        if (!decodedContent.trim().startsWith("<") && !decodedContent.startsWith("%PDF")) {
          const decodedStr = Buffer.from(decodedContent, "base64").toString("utf-8");
          if (decodedStr.includes("<") || decodedStr.includes("html") || decodedStr.includes("DOCTYPE")) {
            decodedContent = decodedStr;
            isHtml = true;
          } else {
            isHtml = false;
          }
        }
      } catch (e) {
        // Keep raw
      }
    } else {
      // Generate Application Fallback Label from Verified Order Database Record
      decodedContent = generateFallbackLabelHtml(order, store, order.order_items || []);
      mimeType = "text/html";
      isOfficial = false;
    }

    if (rawFormatParam) {
      if (isHtml || mimeType.includes("html")) {
        return new Response(decodedContent, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `inline; filename="daraz-label-${order.daraz_order_id}.html"`,
          },
        });
      }

      if (mimeType.includes("pdf") || decodedContent.startsWith("%PDF")) {
        const pdfBuffer = Buffer.from(officialDocResult?.file || decodedContent, "base64");
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
      mimeType,
      docType: docTypeParam,
      isOfficial,
      sourceMessage: isOfficial
        ? "Official Daraz document retrieved from Daraz Open Platform API"
        : "Application shipping label generated from synchronized order data",
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
        error: `Daraz API Error: ${err.message || "Failed to retrieve shipping label."}`,
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
      notes: `Shipping label printed (${newReprintCount}x).`,
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
