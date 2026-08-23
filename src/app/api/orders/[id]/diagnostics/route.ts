import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthenticatedUser,
  requireAuthorizedStore,
  safeErrorResponse,
} from "@/lib/api/auth-guard";

export const dynamic = "force-dynamic";

export interface OrderDiagnosticStep {
  step_index: number;
  step_name: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  details: string;
  failure_reason: string | null;
}

/**
 * GET /api/orders/[id]/diagnostics
 *
 * Returns a server-side diagnostic summary of the order's local fulfillment
 * pipeline state. It is strictly read-only against the database — it does NOT
 * call Daraz APIs, does NOT trigger syncs, and does NOT expose credentials.
 *
 * For deep external-API diagnostics use POST /api/sync/diagnostic.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  if (!id || typeof id !== "string") {
    return safeErrorResponse(400, "INVALID_ID", "Order ID is required.");
  }

  const auth = await requireAuthenticatedUser(req, { permission: "orders:read" });
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  let order: any = null;
  const { data: byId } = await admin
    .from("orders")
    .select("id, daraz_order_id, store_id, status, workflow_status, package_id, tracking_number, shipping_provider, is_packed, packed_at, packed_by, label_printed_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (byId) {
    order = byId;
  } else {
    const { data: byDaraz } = await admin
      .from("orders")
      .select("id, daraz_order_id, store_id, status, workflow_status, package_id, tracking_number, shipping_provider, is_packed, packed_at, packed_by, label_printed_at, updated_at")
      .eq("daraz_order_id", id)
      .maybeSingle();
    order = byDaraz || null;
  }

  if (!order) {
    return safeErrorResponse(404, "ORDER_NOT_FOUND", "Order not found.");
  }

  // Multi-store isolation: caller must own the parent store.
  const storeAuth = await requireAuthorizedStore(auth.principal, order.store_id);
  if (!storeAuth.ok) return storeAuth.response;

  const steps: OrderDiagnosticStep[] = [
    {
      step_index: 1,
      step_name: "Order Lookup",
      status: "PASSED",
      details: `Order ${order.daraz_order_id} resolved from database.`,
      failure_reason: null,
    },
    {
      step_index: 2,
      step_name: "Fulfillment State",
      status: order.is_packed ? "PASSED" : "SKIPPED",
      details: `Current workflow_status='${order.workflow_status || order.status}', is_packed=${Boolean(order.is_packed)}.`,
      failure_reason: order.is_packed ? null : "Order has not been packed yet.",
    },
    {
      step_index: 3,
      step_name: "Shipping Document Readiness",
      status: order.package_id ? "PASSED" : "SKIPPED",
      details: order.package_id
        ? `Package ID present: ${order.package_id}.`
        : "Package ID missing — call POST /api/orders/[id]/pack before retrieving a shipping label.",
      failure_reason: order.package_id ? null : "Package ID missing.",
    },
    {
      step_index: 4,
      step_name: "Shipping Label Print Tracking",
      status: order.label_printed_at ? "PASSED" : "SKIPPED",
      details: order.label_printed_at
        ? `Label printed at ${order.label_printed_at}.`
        : "Label not yet printed.",
      failure_reason: null,
    },
  ];

  return NextResponse.json({
    success: true,
    summary: "Local order diagnostics completed (read-only).",
    orderId: order.daraz_order_id,
    steps,
    timestamp: new Date().toISOString(),
  });
}
