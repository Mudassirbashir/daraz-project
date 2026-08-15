import { NextRequest, NextResponse } from "next/server";
import { validateDarazWebhookSignature, processDarazWebhookEvent } from "@/lib/daraz/webhook-service";

export const dynamic = "force-dynamic";

/**
 * Daraz Webhook GET Endpoint:
 * Handles official Daraz/Lazada Open Platform URL verification, ping probes, and health checks.
 */
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const challenge = requestUrl.searchParams.get("challenge") || requestUrl.searchParams.get("echostr");

  console.log(`[Daraz Webhook] GET Verification Request received from ${req.headers.get("x-forwarded-for") || "Daraz Console"}`);

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
 * Responds to lightweight HTTP HEAD verification checks.
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Daraz Webhook POST Endpoint:
 * Receives real-time push events (MessageType 4: Trade Order Notification, MessageType 1: Fulfillment Update).
 */
export async function POST(req: NextRequest) {
  const requestUrl = new URL(req.url);

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (err: any) {
    console.error("[Daraz Webhook] Failed to read request body:", err.message);
    return NextResponse.json({ code: "10002", message: "Invalid body payload" }, { status: 400 });
  }

  const trimmedBody = rawBody.trim();

  // 1. Instant Verification / Test Ping Handler
  if (!trimmedBody || trimmedBody === "{}" || trimmedBody.includes('"message_type":0') || trimmedBody.includes('"messageType":0')) {
    console.log("[Daraz Webhook] Received Daraz Verification/Test Ping payload. Returning HTTP 200 OK.");
    return NextResponse.json(
      {
        code: "0",
        message: "success",
        success: true,
      },
      { status: 200 }
    );
  }

  // 2. Parse JSON Payload
  let payload: any;
  try {
    payload = JSON.parse(trimmedBody);
  } catch (parseErr: any) {
    console.error("[Daraz Webhook] Non-JSON payload received:", trimmedBody.slice(0, 100));
    return NextResponse.json({ code: "10003", message: "Malformed JSON payload" }, { status: 400 });
  }

  // Handle verification probes, test pings, or ping responses
  if (
    payload.code === "0" ||
    payload.msg === "test" ||
    payload.test === true ||
    payload.action === "verify" ||
    payload.message_type === 0 ||
    payload.messageType === 0
  ) {
    console.log("[Daraz Webhook] Received Daraz Console Verification/Probe payload. Returning HTTP 200 OK.");
    return NextResponse.json(
      {
        code: "0",
        message: "success",
        success: true,
      },
      { status: 200 }
    );
  }

  // 3. Signature Security Validation
  const isValidSignature = validateDarazWebhookSignature(trimmedBody, req.headers, requestUrl.searchParams);
  if (!isValidSignature) {
    console.warn("[Daraz Webhook] Signature validation mismatch for incoming webhook.");
    // For test events or probes with non-matching signatures, return HTTP 200 OK probe response if message_type is missing
    if (!payload.message_type && !payload.messageType) {
      return NextResponse.json({ code: "0", message: "success", success: true }, { status: 200 });
    }
    return NextResponse.json(
      {
        code: "10001",
        message: "Invalid Daraz Webhook Signature",
        success: false,
      },
      { status: 401 }
    );
  }

  // 4. Process Webhook Event Asynchronously & Respond Fast
  console.log(`[Daraz Webhook] Incoming Event: MessageType ${payload.message_type || payload.messageType || "Unknown"}`);

  // Non-blocking processing execution
  processDarazWebhookEvent(payload, trimmedBody).catch((eventErr: any) => {
    console.error("[Daraz Webhook] Async event processing notice:", eventErr.message);
  });

  // Fast HTTP 200 OK Response to Daraz Open Platform
  return NextResponse.json(
    {
      code: "0",
      message: "success",
      success: true,
    },
    { status: 200 }
  );
}
