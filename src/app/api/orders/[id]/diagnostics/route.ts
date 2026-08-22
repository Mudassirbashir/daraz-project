import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDarazClient, sanitizeLogPayload } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export interface DiagnosticLogStep {
  step_index: number;
  step_name: string;
  endpoint: string;
  request_purpose: string;
  http_status: number | string;
  daraz_code: string;
  request_id?: string;
  order_id: string;
  order_item_ids: string[];
  package_id?: string;
  tracking_number?: string;
  shipment_provider?: string;
  result_summary: string;
  failure_reason: string | null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const steps: DiagnosticLogStep[] = [];

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized diagnostic request." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Step 1: Database Order Lookup
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
      if (fallbackOrder) order = fallbackOrder;
    }

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: `Diagnostic target order '${id}' was not found in Supabase database.`,
          steps,
        },
        { status: 404 }
      );
    }

    const store = order.daraz_stores;

    steps.push({
      step_index: 1,
      step_name: "Database Lookup",
      endpoint: "supabase:orders",
      request_purpose: "Resolve target order and associated store credentials from database",
      http_status: 200,
      daraz_code: "OK",
      order_id: order.daraz_order_id,
      order_item_ids: (order.order_items || []).map((i: any) => String(i.order_item_id)),
      result_summary: `Order resolved (Status: ${order.status}, Workflow: ${order.workflow_status || order.status})`,
      failure_reason: null,
    });

    const { data: creds } = await supabase
      .from("daraz_store_credentials")
      .select("access_token")
      .eq("store_id", store?.id || "")
      .maybeSingle();

    const hasToken = Boolean(creds?.access_token && creds.access_token.trim());

    // Step 2: Daraz Store Authorization Check
    if (!store || !store.is_active || !hasToken) {
      steps.push({
        step_index: 2,
        step_name: "Store Auth Validation",
        endpoint: "local:daraz_stores",
        request_purpose: "Validate store access token and active status",
        http_status: 400,
        daraz_code: "AUTH_ERROR",
        order_id: order.daraz_order_id,
        order_item_ids: [],
        result_summary: "Store connection inactive or access token missing",
        failure_reason: "Daraz store is not connected. Reconnect store via My Stores page.",
      });

      return NextResponse.json({
        success: false,
        summary: "Store connection inactive",
        steps,
      });
    }

    const darazClient = await getDarazClient(store.id);

    steps.push({
      step_index: 2,
      step_name: "Store Auth Validation",
      endpoint: "/auth/token/refresh",
      request_purpose: "Validate/refresh Daraz Open Platform access token",
      http_status: 200,
      daraz_code: "0",
      order_id: order.daraz_order_id,
      order_item_ids: [],
      result_summary: `Access token validated for store '${store.store_name}' (${store.store_code})`,
      failure_reason: null,
    });

    // Step 3: Fetch Live Order Items & Map Order Item IDs
    let liveOrderItems: any[] = [];
    let itemFetchError: string | null = null;
    try {
      liveOrderItems = await darazClient.getOrderItems(order.daraz_order_id);
    } catch (err: any) {
      itemFetchError = err.message;
    }

    const resolvedItemIds = liveOrderItems.map((item) => String(item.order_item_id)).filter(Boolean);

    steps.push({
      step_index: 3,
      step_name: "Get Order Items",
      endpoint: "/order/items/get",
      request_purpose: "Fetch live order items and identify unique Order Item IDs from Daraz API",
      http_status: itemFetchError ? 400 : 200,
      daraz_code: itemFetchError ? "ITEM_FETCH_FAILED" : "0",
      order_id: order.daraz_order_id,
      order_item_ids: resolvedItemIds,
      result_summary: itemFetchError ? "Failed fetching live items" : `Fetched ${resolvedItemIds.length} item(s): [${resolvedItemIds.join(", ")}]`,
      failure_reason: itemFetchError,
    });

    // Step 4: Verify Fulfillment State (Pack / RTS Check)
    const currentStatus = (order.workflow_status || order.status || "pending").toLowerCase();
    const isPacked = order.is_packed || ["packed", "ready_to_ship", "shipped", "delivered"].includes(currentStatus);

    steps.push({
      step_index: 4,
      step_name: "Fulfillment State Verification",
      endpoint: "state_machine:workflow_status",
      request_purpose: "Verify order is packed and ready for shipping document retrieval",
      http_status: 200,
      daraz_code: "0",
      order_id: order.daraz_order_id,
      order_item_ids: resolvedItemIds,
      package_id: order.package_id || undefined,
      tracking_number: order.tracking_number || undefined,
      shipment_provider: order.shipping_provider || undefined,
      result_summary: `Current State: '${currentStatus}' (Is Packed: ${isPacked})`,
      failure_reason: null,
    });

    // Step 5: Test Official Document Retrieval via Daraz API
    let docResult: any = null;
    let docError: string | null = null;

    if (resolvedItemIds.length > 0) {
      try {
        docResult = await darazClient.getShippingDocument(resolvedItemIds, "shipping_label");
      } catch (err: any) {
        docError = err.message;
      }
    } else {
      docError = "No valid Order Item IDs available for document retrieval.";
    }

    steps.push({
      step_index: 5,
      step_name: "Get Official Daraz Shipping Document",
      endpoint: docResult?.endpoint || "/order/document/get",
      request_purpose: "Retrieve official Daraz AWB / Shipping Label document from Seller Center API",
      http_status: docError ? 400 : 200,
      daraz_code: docError ? "DOC_GET_FAILED" : "0",
      request_id: docResult?.raw?.request_id,
      order_id: order.daraz_order_id,
      order_item_ids: resolvedItemIds,
      package_id: order.package_id || undefined,
      tracking_number: order.tracking_number || undefined,
      shipment_provider: order.shipping_provider || undefined,
      result_summary: docError
        ? "Daraz document retrieval failed"
        : `Successfully retrieved official document (Mime: ${docResult.mimeType}, Size: ${docResult.file.length} chars)`,
      failure_reason: docError,
    });

    return NextResponse.json({
      success: !docError,
      summary: docError ? `Diagnostic Notice: ${docError}` : "End-to-End Shipping Label Pipeline Validated Successfully",
      orderId: order.daraz_order_id,
      storeName: store.store_name,
      documentRetrieved: !!docResult,
      mimeType: docResult?.mimeType || null,
      steps: sanitizeLogPayload(steps),
    });
  } catch (err: any) {
    console.error("[GET /api/orders/[id]/diagnostics Exception]:", err.message);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Internal diagnostic execution failure.",
        steps: sanitizeLogPayload(steps),
      },
      { status: 500 }
    );
  }
}
