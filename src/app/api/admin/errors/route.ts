import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { executeDarazSync } from "@/lib/daraz/sync-service";
import { getDarazClient } from "@/lib/daraz/client";
import { mapDarazOrderStatus } from "@/lib/daraz/order-status";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Query active (unresolved) failed items from sync_retry_queue
    const { data: retryErrors, error: retryErr } = await supabase
      .from("sync_retry_queue")
      .select("*, daraz_stores(id, store_name, store_code)")
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(50);

    // Query failed items from daraz_api_logs
    const { data: apiLogs, error: logsErr } = await supabase
      .from("daraz_api_logs")
      .select("*, daraz_stores(id, store_name, store_code)")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      retryErrors: retryErrors || [],
      apiLogs: apiLogs || [],
    });
  } catch (err: any) {
    console.error("[GET /api/admin/errors Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch error diagnostics." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { errorId, action } = body as { errorId?: string; action?: "retry_sync" | "retry_item" | "clear_resolved" };

    const supabase = createAdminClient();

    if (action === "retry_sync") {
      // Execute safe Daraz sync engine
      const syncResult = await executeDarazSync();
      return NextResponse.json({
        success: syncResult.success,
        message: syncResult.success
          ? "✓ Synchronization completed successfully."
          : `Sync completed with notice: ${syncResult.errors.join("; ")}`,
        syncResult,
      });
    }

    if (errorId && action === "retry_item") {
      // Fetch error item
      const { data: errRecord } = await supabase
        .from("sync_retry_queue")
        .select("*")
        .eq("id", errorId)
        .single();

      if (errRecord) {
        const nextAttempt = (errRecord.attempt_count || 1) + 1;
        const timestamp = new Date().toISOString();

        // FIX C: Safety cap: if attempt_count >= 5, flag for manual review
        if (nextAttempt >= 5) {
          await supabase
            .from("sync_retry_queue")
            .update({
              attempt_count: nextAttempt,
              last_attempt_at: timestamp,
              status: "needs_manual_review",
              error_message: `Maximum retries reached (5 attempts). Flagged for manual review. Original error: ${errRecord.error_message}`,
            })
            .eq("id", errorId);

          return NextResponse.json({
            success: false,
            message: "Item reached maximum retry attempts (5) and has been flagged for manual review.",
            attemptCount: nextAttempt,
            status: "needs_manual_review",
          });
        }

        // Update retry status to retrying
        await supabase
          .from("sync_retry_queue")
          .update({
            attempt_count: nextAttempt,
            last_attempt_at: timestamp,
            status: "retrying",
          })
          .eq("id", errorId);

        let itemSuccess = false;
        let itemErrorMsg = "";

        // FIX C: Targeted single-item retry execution
        try {
          if (errRecord.store_id) {
            const darazClient = await getDarazClient(errRecord.store_id);

            if (errRecord.entity_type === "order" || errRecord.operation_type === "order_sync") {
              const freshOrder = await darazClient.getOrderDetails(errRecord.entity_id);
              if (freshOrder) {
                let rawStatus = "pending";
                if (Array.isArray(freshOrder?.statuses) && freshOrder.statuses.length > 0) {
                  rawStatus = String(freshOrder.statuses[0]);
                } else if (typeof freshOrder?.statuses === "string" && freshOrder.statuses.trim()) {
                  rawStatus = freshOrder.statuses.trim();
                } else if (typeof freshOrder?.status === "string" && freshOrder.status.trim()) {
                  rawStatus = freshOrder.status.trim();
                }

                const mappedObj = mapDarazOrderStatus(rawStatus);
                const mappedStatus = mappedObj.normalizedStatus;
                const workflowStatus = mappedObj.workflowStatus;

                const rawObj = freshOrder.raw || freshOrder;
                const shipping = rawObj.address_shipping || {};
                const billing = rawObj.address_billing || {};

                const exactFirstName = rawObj.customer_first_name || shipping.first_name || billing.first_name || "Customer";
                const exactLastName = rawObj.customer_last_name || shipping.last_name || billing.last_name || "";
                const exactCustomerName = `${exactFirstName} ${exactLastName}`.trim();
                const exactCity = freshOrder.customer_city || shipping.city || billing.city || "Karachi";

                const orderPayload = {
                  store_id: errRecord.store_id,
                  daraz_order_id: errRecord.entity_id,
                  tracking_number: freshOrder.tracking_code || rawObj.tracking_code || null,
                  customer_name: exactCustomerName,
                  customer_city: exactCity,
                  customer_phone: freshOrder.customer_phone || shipping.phone || billing.phone || null,
                  customer_address: [shipping.address1, shipping.address2].filter(Boolean).join(", ") || freshOrder.customer_address || null,
                  total_amount_cents: Math.round((parseFloat(String(freshOrder.price || 0)) || 0) * 100),
                  status: mappedStatus,
                  workflow_status: workflowStatus,
                  is_payout_settled: false,
                  order_date: freshOrder.created_at || timestamp,
                  raw_payload: rawObj,
                  updated_at: timestamp,
                };

                const { data: dbOrder, error: ordErr } = await supabase
                  .from("orders")
                  .upsert(orderPayload, { onConflict: "store_id,daraz_order_id" })
                  .select("id")
                  .maybeSingle();

                if (ordErr) {
                  throw new Error(`Order retry upsert failed: ${ordErr.message}`);
                }

                if (dbOrder?.id) {
                  const items = await darazClient.getOrderItems(errRecord.entity_id);
                  if (items && items.length > 0) {
                    const itemPayloads = items.map((item) => {
                      const cleanOrderItemId = String(item.order_item_id || item.item_id || `${errRecord.entity_id}_${Math.random()}`);
                      return {
                        store_id: errRecord.store_id,
                        order_id: dbOrder.id,
                        daraz_order_id: errRecord.entity_id,
                        order_item_id: cleanOrderItemId,
                        name: item.name || `Item ${cleanOrderItemId}`,
                        seller_sku: item.seller_sku || "UNKNOWN_SKU",
                        shop_sku: item.shop_sku || null,
                        item_id: cleanOrderItemId,
                        quantity: item.quantity || 1,
                        item_price_cents: item.item_price_cents || 0,
                        paid_price_cents: item.paid_price_cents || 0,
                        status: item.status || mappedStatus || "pending",
                        shipment_provider: item.shipment_provider || null,
                        tracking_code: item.tracking_code || null,
                        product_main_image: item.product_main_image || null,
                        raw_item_payload: item.raw || item,
                        updated_at: timestamp,
                      };
                    });

                    await supabase.from("order_items").upsert(itemPayloads, { onConflict: "store_id,order_item_id" });
                  }
                }

                itemSuccess = true;
              } else {
                throw new Error(`Order ${errRecord.entity_id} not found on Daraz Seller Center`);
              }
            } else {
              // Product/Listing targeted retry
              const { items } = await darazClient.getCatalogItems(0, 50);
              const targetItem = (items || []).find((it: any) => Array.isArray(it.skus) && it.skus.some((s: any) => s.seller_sku === errRecord.entity_id || it.item_id === errRecord.entity_id));
              if (targetItem) {
                const targetSku = targetItem.skus.find((s: any) => s.seller_sku === errRecord.entity_id) || targetItem.skus[0];
                if (targetSku) {
                  const listingPayload = {
                    store_id: errRecord.store_id,
                    seller_sku: targetSku.seller_sku,
                    daraz_item_id: targetItem.item_id,
                    daraz_sku_id: targetSku.daraz_sku_id || null,
                    title: targetItem.title,
                    price_cents: targetSku.price_cents,
                    special_price_cents: targetSku.special_price_cents ?? null,
                    stock_quantity: targetSku.quantity,
                    is_synced: true,
                    last_synced_at: timestamp,
                  };

                  const { error: listErr } = await supabase
                    .from("listings")
                    .upsert(listingPayload, { onConflict: "store_id,seller_sku" });

                  if (listErr) throw listErr;
                  itemSuccess = true;
                }
              } else {
                throw new Error(`SKU/Item ${errRecord.entity_id} not found in Daraz catalog`);
              }
            }
          } else {
            throw new Error("Missing store_id in retry_queue record");
          }
        } catch (itemRetryErr: any) {
          itemSuccess = false;
          itemErrorMsg = itemRetryErr.message;
        }

        if (itemSuccess) {
          await supabase
            .from("sync_retry_queue")
            .update({ status: "resolved", last_attempt_at: timestamp })
            .eq("id", errorId);

          return NextResponse.json({
            success: true,
            message: "✓ Targeted single-item retry resolved successfully.",
            attemptCount: nextAttempt,
          });
        } else {
          const finalStatus = nextAttempt >= 5 ? "needs_manual_review" : "failed";
          await supabase
            .from("sync_retry_queue")
            .update({
              attempt_count: nextAttempt,
              last_attempt_at: timestamp,
              error_message: itemErrorMsg || errRecord.error_message,
              status: finalStatus,
            })
            .eq("id", errorId);

          return NextResponse.json({
            success: false,
            message: `Targeted single-item retry failed (attempt ${nextAttempt}): ${itemErrorMsg}`,
            attemptCount: nextAttempt,
            status: finalStatus,
          });
        }
      }
    }

    if (action === "clear_resolved") {
      await supabase
        .from("sync_retry_queue")
        .delete()
        .eq("status", "resolved");

      return NextResponse.json({ success: true, message: "✓ Cleared resolved error logs." });
    }

    return NextResponse.json({ success: false, error: "Invalid action parameters." }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/admin/errors Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute error retry." },
      { status: 500 }
    );
  }
}
