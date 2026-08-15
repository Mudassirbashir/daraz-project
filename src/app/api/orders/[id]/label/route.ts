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

    // 1. Fetch order details without broken order_items relation
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found in database." }, { status: 404 });
    }

    // Resolve store: check if store is active, or attempt relinking via seller_id
    let store = order.daraz_stores;
    if (!store || !store.is_active || !store.access_token) {
      if (store?.seller_id) {
        const { data: activeStore } = await supabase
          .from("daraz_stores")
          .select("*")
          .eq("seller_id", store.seller_id)
          .eq("is_active", true)
          .not("access_token", "is", null)
          .maybeSingle();

        if (activeStore) {
          store = activeStore;
          await supabase.from("orders").update({ store_id: activeStore.id }).eq("id", id);
        }
      }
    }

    if (!store || !store.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz store is not connected. Reconnect store via My Stores page before fetching shipping labels.",
        },
        { status: 400 }
      );
    }

    // 2. Instantiate Daraz Client with Store Credentials
    const darazClient = new DarazApiClient({
      storeId: store.id,
      accessToken: store.access_token,
      refreshToken: store.refresh_token || undefined,
      tokenExpiresAt: store.token_expires_at || undefined,
      appKey: store.api_app_key || undefined,
      appSecret: store.api_app_secret || undefined,
    });

    // 3. Retrieve Real Order Items from Daraz API
    let itemIds: string[] = [];
    try {
      const liveItems = await darazClient.getOrderItems(order.daraz_order_id);
      itemIds = liveItems.map((item) => item.order_item_id);
    } catch (itemErr: any) {
      console.warn(`[API Order Label]: Failed to fetch live items for Order ${order.daraz_order_id}:`, itemErr.message);
    }

    if (itemIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not retrieve order items from Daraz Seller Center to generate shipping label.",
        },
        { status: 400 }
      );
    }

    // 4. Fetch Official Original Shipping Label Document from Daraz REST API (/order/document/get)
    let officialDocResult: { file: string; mimeType: string };
    try {
      officialDocResult = await darazClient.getShippingDocument(itemIds, docTypeParam);
    } catch (apiErr: any) {
      console.error(`[API Order Label]: Official document API rejected for Order ${order.daraz_order_id}:`, apiErr.message);
      return NextResponse.json(
        {
          success: false,
          error: `Daraz rejected shipping label: ${apiErr.message}`,
        },
        { status: 400 }
      );
    }

    let decodedContent = officialDocResult.file;
    let mimeType = officialDocResult.mimeType || "text/html";
    let isHtml = true;

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
        const pdfBuffer = Buffer.from(officialDocResult.file, "base64");
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
