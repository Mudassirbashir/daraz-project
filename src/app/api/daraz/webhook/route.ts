import { NextRequest, NextResponse } from "next/server";
import { verifyDarazWebhookSignature } from "@/lib/daraz/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeDarazSync } from "@/lib/daraz/sync-service";

export const dynamic = "force-dynamic";

/**
 * Daraz Webhook GET Endpoint:
 * Responds to Daraz Console URL verification and challenge probes.
 */
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const challenge = requestUrl.searchParams.get("challenge") || requestUrl.searchParams.get("echostr");

  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json(
    {
      code: "0",
      message: "Daraz Push Notification Webhook Service Operational",
      success: true,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

/**
 * Daraz Webhook HEAD Endpoint:
 * Responds to lightweight HTTP HEAD health checks.
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Daraz Webhook POST Endpoint:
 * Ingests webhook push notifications idempotently into daraz_webhook_events table.
 */
export async function POST(req: NextRequest) {
  const requestUrl = new URL(req.url);

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (err: any) {
    return NextResponse.json({ code: "10002", message: "Invalid body payload" }, { status: 400 });
  }

  const trimmedBody = rawBody.trim();

  // Test Ping Probe Handler
  if (!trimmedBody || trimmedBody === "{}" || trimmedBody.includes('"message_type":0') || trimmedBody.includes('"messageType":0')) {
    return NextResponse.json({ code: "0", message: "success" }, { status: 200 });
  }

  let payload: any;
  try {
    payload = JSON.parse(trimmedBody);
  } catch (parseErr: any) {
    return NextResponse.json({ code: "10003", message: "Malformed JSON payload" }, { status: 400 });
  }

  // Verification Probes
  if (
    payload.code === "0" ||
    payload.msg === "test" ||
    payload.test === true ||
    payload.action === "verify" ||
    payload.message_type === 0 ||
    payload.messageType === 0
  ) {
    return NextResponse.json({ code: "0", message: "success" }, { status: 200 });
  }

  const supabase = createAdminClient();

  // Determine store and appSecret
  let storeId = requestUrl.searchParams.get("store_id") || payload.store_id || null;
  let appSecret = process.env.DARAZ_APP_SECRET || "";

  if (!storeId && (payload.seller_id || payload.sellerId)) {
    const sellerId = String(payload.seller_id || payload.sellerId);
    const { data: store } = await supabase
      .from("daraz_stores")
      .select("id")
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (store) {
      storeId = store.id;
      const { data: creds } = await supabase
        .from("daraz_store_credentials")
        .select("api_app_secret")
        .eq("store_id", store.id)
        .maybeSingle();
      if (creds?.api_app_secret) appSecret = creds.api_app_secret;
    }
  }

  // Signature Security Verification
  const signatureHeader =
    req.headers.get("x-iop-signature") ||
    req.headers.get("signature") ||
    requestUrl.searchParams.get("sign");

  if (appSecret && signatureHeader) {
    const isValid = await verifyDarazWebhookSignature(trimmedBody, signatureHeader, appSecret);
    if (!isValid) {
      console.warn("[Daraz Webhook] Signature validation mismatch.");
      return NextResponse.json(
        { code: "10001", message: "Invalid Daraz Webhook Signature" },
        { status: 401 }
      );
    }
  }

  // Unique event ID extraction
  const eventId = String(
    payload.event_id ||
    payload.trade_order_id ||
    payload.msg_id ||
    payload.message_id ||
    payload.id ||
    `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  );

  const eventType = String(
    payload.event_type ||
    payload.message_type ||
    payload.messageType ||
    "trade_order_update"
  );

  const tradeOrderId = payload.trade_order_id || payload.order_id || payload.data?.order_id || null;

  // Idempotent insertion into daraz_webhook_events
  try {
    const { error: insertErr } = await supabase
      .from("daraz_webhook_events")
      .insert({
        store_id: storeId,
        event_id: eventId,
        event_type: eventType,
        trade_order_id: tradeOrderId,
        payload,
        processed_status: "pending",
      });

    if (insertErr) {
      if (insertErr.code === "23505" || insertErr.message?.includes("uq_store_event_id")) {
        console.log(`[Daraz Webhook] Duplicate event ${eventId} ignored.`);
        return NextResponse.json({ code: "0", message: "success" }, { status: 200 });
      }
    }
  } catch (dbEx: any) {
    console.warn("[Daraz Webhook] Notice recording webhook event:", dbEx.message);
  }

  // Trigger non-blocking asynchronous event processing
  if (storeId) {
    executeDarazSync(storeId).catch((syncErr: any) => {
      console.error(`[Daraz Webhook Background Sync Notice]:`, syncErr.message);
    });
  }

  // Immediately return HTTP 200 {"code": "0"}
  return NextResponse.json({ code: "0", message: "success" }, { status: 200 });
}
