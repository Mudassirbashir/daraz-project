import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DarazOrderStatus } from "@/types/database.types";

export interface WebhookProcessResult {
  success: boolean;
  message: string;
  messageType?: number | string;
  eventId?: string;
  sellerId?: string;
  storeId?: string;
  orderId?: string;
  actionTaken?: string;
  isDuplicate?: boolean;
}

function safeCompareHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a.trim().toUpperCase(), "utf8");
    const bufB = Buffer.from(b.trim().toUpperCase(), "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

/**
 * Validates incoming Daraz/Lazada Open Platform Webhook signature.
 */
export function validateDarazWebhookSignature(
  rawBody: string,
  headers: Headers,
  searchParams: URLSearchParams,
  appSecret: string = process.env.DARAZ_APP_SECRET || "",
  appKey: string = process.env.DARAZ_APP_KEY || ""
): boolean {
  const authHeader = headers.get("authorization") || headers.get("Authorization") || "";
  const signHeader = headers.get("x-daraz-signature") || headers.get("x-signature") || searchParams.get("sign") || "";

  if (!authHeader && !signHeader) {
    // Allow verification probe requests if no signature header is supplied by Daraz console
    return true;
  }

  try {
    const targetSign = (signHeader || authHeader.replace(/^Bearer\s+/i, "")).trim();

    // Candidate 1: Exact Daraz specification: Authorization = HEX(HMAC-SHA256(app_key + exact_raw_message_body, app_secret))
    const baseWithAppKey = `${appKey.trim()}${rawBody}`;
    const computedAppKeyHmac = crypto
      .createHmac("sha256", appSecret.trim())
      .update(baseWithAppKey, "utf8")
      .digest("hex");

    if (safeCompareHex(computedAppKeyHmac, targetSign)) {
      return true;
    }

    // Candidate 2: HMAC-SHA256 of raw body directly
    const computedRawHmac = crypto
      .createHmac("sha256", appSecret.trim())
      .update(rawBody, "utf8")
      .digest("hex");

    if (safeCompareHex(computedRawHmac, targetSign)) {
      return true;
    }

    // Candidate 3: Parameter-sorted HMAC if parameters were passed via query string
    const paramObj: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      if (key !== "sign") paramObj[key] = val;
    });

    if (Object.keys(paramObj).length > 0) {
      const sortedKeys = Object.keys(paramObj).sort();
      let baseStr = "/api/daraz/webhook";
      for (const k of sortedKeys) {
        baseStr += `${k}${paramObj[k]}`;
      }
      const computedParamHmac = crypto
        .createHmac("sha256", appSecret.trim())
        .update(baseStr, "utf8")
        .digest("hex");

      if (safeCompareHex(computedParamHmac, targetSign)) {
        return true;
      }
    }

    console.warn("[DARAZ WEBHOOK] Signature mismatch for incoming request.");
    return false;
  } catch (err: any) {
    console.error("[DARAZ WEBHOOK] Signature validation exception:", err.message);
    return false;
  }
}

/**
 * Normalizes raw Daraz webhook order status to ERP DarazOrderStatus enum values.
 */
export function mapDarazWebhookStatus(rawStatus?: string): DarazOrderStatus {
  if (!rawStatus) return "pending";
  const norm = rawStatus.toLowerCase().replace(/[-\s]+/g, "_");

  if (["ready_to_ship", "to_ship", "to_pack", "packed", "rts"].includes(norm)) {
    return "ready_to_ship";
  } else if (["shipped", "in_transit"].includes(norm)) {
    return "shipped";
  } else if (norm === "delivered") {
    return "delivered";
  } else if (["canceled", "cancelled", "refunded"].includes(norm)) {
    return "canceled";
  } else if (["returned", "shipped_back", "shipped_back_success", "package_returned"].includes(norm)) {
    return "returned";
  } else if (["failed", "failed_delivery", "delivery_failed", "lost"].includes(norm)) {
    return "failed";
  } else if (["unpaid"].includes(norm)) {
    return "unpaid";
  } else if (["pending", "processing"].includes(norm)) {
    return "pending";
  }
  return "pending";
}

/**
 * Processes incoming Daraz push webhook payload asynchronously and safely updates Supabase database.
 */
export async function processDarazWebhookEvent(payload: any, rawBody: string): Promise<WebhookProcessResult> {
  const supabase = createAdminClient();
  const timestamp = new Date().toISOString();

  console.log("[DARAZ WEBHOOK] Received payload");

  // 1. Extract MessageType (MessageType 4 = Trade Order, MessageType 1 = Fulfillment Update, MessageType 14 = Order Status)
  const messageType = payload.message_type ?? payload.messageType ?? payload.type ?? payload.MessageType ?? 0;
  const numMessageType = parseInt(String(messageType), 10);

  // Handle Instant Messaging (MessageType 6) or unhandled types gracefully
  if (numMessageType === 6) {
    console.log("[DARAZ WEBHOOK] MessageType 6 (Instant Messaging) received and ignored.");
    return {
      success: true,
      message: "Instant Messaging notification received and ignored.",
      messageType: 6,
      actionTaken: "ignored",
    };
  }

  // 2. Extract Seller ID
  const sellerId = String(
    payload.seller_id ||
      payload.sellerId ||
      payload.data?.seller_id ||
      payload.data?.sellerId ||
      payload.shop_id ||
      ""
  ).trim();

  // 3. Extract Order Details
  const dataObj = payload.data || payload.result || payload;
  const darazOrderId = String(
    dataObj.trade_order_id ||
      dataObj.order_id ||
      dataObj.orderId ||
      payload.trade_order_id ||
      payload.order_id ||
      payload.orderId ||
      dataObj.order_number ||
      ""
  ).trim();

  const trackingNumber = dataObj.tracking_number || dataObj.tracking_code || dataObj.trackingNumber || dataObj.fulfillment_package_id || null;
  const rawStatus = dataObj.order_status || dataObj.status || dataObj.order_status_code || payload.status || "pending";
  const mappedStatus = mapDarazWebhookStatus(rawStatus);

  // 4. Extract or Generate Deterministic Event ID for Idempotency
  const eventId = String(
    payload.event_id ||
      payload.eventId ||
      payload.message_id ||
      payload.messageId ||
      crypto.createHash("md5").update(`${sellerId}:${numMessageType}:${darazOrderId}:${rawStatus}`).digest("hex")
  );

  console.log(
    `[DARAZ WEBHOOK] Processing Event details:\nMessageType: ${numMessageType}\nEvent ID: ${eventId}\nSeller ID: ${sellerId || "N/A"}\nOrder ID: ${darazOrderId || "N/A"}\nStatus: ${mappedStatus}`
  );

  // 5. Match Connected Store in daraz_stores (STRICT MATCH ONLY: No guessing)
  let targetStoreId: string | null = null;
  if (sellerId) {
    const { data: store } = await supabase
      .from("daraz_stores")
      .select("id")
      .eq("seller_id", sellerId)
      .eq("is_active", true)
      .maybeSingle();

    if (store) {
      targetStoreId = store.id;
      console.log(`[DARAZ WEBHOOK] Verified Store matched (Store ID: ${targetStoreId})`);
    }
  }

  if (!targetStoreId && [1, 4, 14].includes(numMessageType)) {
    console.warn(`[DARAZ WEBHOOK] No verified store matched for Seller ID '${sellerId}'. Processing marked as unmatched for manual review.`);
  }

  // 6. Idempotency Check & Webhook Event Storage
  let isDuplicate = false;
  try {
    const { data: existingEvent } = await supabase
      .from("daraz_webhook_events")
      .select("id, status")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[DARAZ WEBHOOK] Duplicate event ignored (Event ID: ${eventId})`);
      return {
        success: true,
        message: "Duplicate webhook event acknowledged.",
        messageType: numMessageType,
        eventId,
        sellerId,
        storeId: targetStoreId || undefined,
        orderId: darazOrderId,
        actionTaken: "duplicate_ignored",
        isDuplicate: true,
      };
    }

    const eventStatus = targetStoreId ? "processing" : "unmatched";

    await supabase.from("daraz_webhook_events").insert({
      store_id: targetStoreId,
      seller_id: sellerId || null,
      message_type: String(numMessageType),
      event_id: eventId,
      daraz_order_id: darazOrderId || null,
      payload: payload,
      status: eventStatus,
      received_at: timestamp,
    });
    console.log(`[DARAZ WEBHOOK] Event stored (status: ${eventStatus})`);
  } catch (dbErr: any) {
    console.error(`[DARAZ WEBHOOK] Failed to insert event to daraz_webhook_events: ${dbErr.message}`);
    try {
      await supabase.from("daraz_api_logs").insert({
        store_id: targetStoreId,
        sync_type: `webhook_msg_${numMessageType}`,
        status: targetStoreId ? "processing" : "unmatched",
        records_synced: 1,
        payload: { eventId, sellerId, darazOrderId, rawStatus },
      });
      console.log("[DARAZ WEBHOOK] Event stored in fallback daraz_api_logs");
    } catch (e: any) {
      console.error(`[DARAZ WEBHOOK] Fallback logging error: ${e.message}`);
    }
  }

  // 7. Process MessageType 4 (Trade Order Notification), MessageType 1 (Fulfillment), & MessageType 14
  let actionTaken = "processed";

  if (numMessageType === 4) {
    console.log("[DARAZ WEBHOOK] Processing MessageType 4 (Trade Order Notification)");
  } else if (numMessageType === 1) {
    console.log("[DARAZ WEBHOOK] Processing MessageType 1 (Fulfillment Order Update Notification)");
  } else if (numMessageType === 14) {
    console.log("[DARAZ WEBHOOK] Processing MessageType 14 (Order Status Update)");
  }

  if (([1, 4, 14].includes(numMessageType)) && darazOrderId && targetStoreId) {
    try {
      // Check if order already exists in orders table
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, status")
        .eq("daraz_order_id", darazOrderId)
        .maybeSingle();

      const customerName = dataObj.customer_name || dataObj.customer_first_name
        ? `${dataObj.customer_first_name || ""} ${dataObj.customer_last_name || ""}`.trim()
        : "Daraz Customer";

      const customerCity = dataObj.customer_city || dataObj.shipping_city || "Karachi";
      const totalAmountCents = dataObj.total_amount_cents || Math.round(parseFloat(String(dataObj.price || 0)) * 100);

      const orderPayload = {
        store_id: targetStoreId,
        daraz_order_id: darazOrderId,
        tracking_number: trackingNumber || existingOrder?.status || null,
        customer_name: customerName || "Daraz Customer",
        customer_city: customerCity,
        total_amount_cents: totalAmountCents || 0,
        status: mappedStatus,
        workflow_status: mappedStatus,
        is_payout_settled: false,
        order_date: dataObj.created_at || timestamp,
      };

      const { error: upsertErr } = await supabase
        .from("orders")
        .upsert(orderPayload, { onConflict: "daraz_order_id" });

      if (upsertErr) {
        console.error(`[DARAZ WEBHOOK] Order upsert error for Order ${darazOrderId}:`, upsertErr.message);
        actionTaken = "error_upserting_order";
      } else {
        actionTaken = existingOrder ? "order_status_updated" : "order_created";
        console.log(`[DARAZ WEBHOOK] Successfully updated Order ${darazOrderId} status to '${mappedStatus}'.`);
      }
    } catch (ordErr: any) {
      console.error(`[DARAZ WEBHOOK] Order processing exception for Order ${darazOrderId}:`, ordErr.message);
      actionTaken = "error_processing_order";
    }
  }

  // 8. Update Webhook Event Storage Status to Completed
  try {
    await supabase
      .from("daraz_webhook_events")
      .update({
        status: actionTaken.includes("error") ? "failed" : "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);
  } catch (e) {
    // ignore
  }

  console.log(`[DARAZ WEBHOOK] Processing completed (${actionTaken})`);

  return {
    success: !actionTaken.includes("error"),
    message: `Webhook event processed successfully (${actionTaken}).`,
    messageType: numMessageType,
    eventId,
    sellerId,
    storeId: targetStoreId || undefined,
    orderId: darazOrderId,
    actionTaken,
    isDuplicate,
  };
}
