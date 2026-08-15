import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    let fallbackUser: any = null;
    if (opsUserCookie) {
      try {
        fallbackUser = JSON.parse(opsUserCookie);
      } catch (e) {
        // ignore
      }
    }

    const body = await req.json();
    const { items, markAllPicked } = body as {
      items?: Array<{ order_item_id: string; picked_quantity: number }>;
      markAllPicked?: boolean;
    };

    const supabase = createAdminClient();

    // Fetch user profile name
    let operatorName = fallbackUser?.full_name || fallbackUser?.employee_id || "Picking Staff";
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, employee_id")
        .eq("id", user.id)
        .maybeSingle();

      operatorName = profile?.full_name || profile?.employee_id || user.email || operatorName;
    }

    // Fetch target order and items
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const timestamp = new Date().toISOString();

    // Ensure order_items DB table has at least one real row for this order
    const { data: existingDbItems } = await supabase
      .from("order_items")
      .select("id, order_item_id, quantity, picked_quantity, is_picked")
      .eq("order_id", id);

    let dbItems = existingDbItems || [];

    if (dbItems.length === 0) {
      // Create a real item row in order_items table for this order if possible
      const { data: createdItem } = await supabase
        .from("order_items")
        .insert({
          order_id: id,
          order_item_id: order.daraz_order_id,
          name: "Daraz Ordered Item",
          quantity: 1,
          picked_quantity: 0,
          is_picked: false,
          item_price_cents: order.total_amount_cents || 0,
        })
        .select()
        .single();

      if (createdItem) {
        dbItems = [createdItem];
      }
    }

    if (markAllPicked) {
      if (!dbItems || dbItems.length === 0) {
        return NextResponse.json(
          { success: false, error: "Cannot mark order as picked: Order has no items in database." },
          { status: 400 }
        );
      }

      // Mark all items as picked in DB
      await supabase
        .from("order_items")
        .update({ is_picked: true, picked_quantity: 1, updated_at: timestamp })
        .eq("order_id", id);

      // Update order status to picked
      const { data: updatedOrder } = await supabase
        .from("orders")
        .update({
          workflow_status: "picked",
          updated_at: timestamp,
        })
        .eq("id", id)
        .select("*, order_items(*)")
        .single();

      // Record activity log
      await supabase.from("order_activities").insert({
        order_id: order.id,
        daraz_order_id: order.daraz_order_id,
        previous_status: order.workflow_status || order.status,
        new_status: "picked",
        actor: operatorName,
        source: "Staff UI",
        notes: "All items marked picked in warehouse pick screen.",
      });

      // Record audit log
      await supabase.from("audit_logs").insert({
        user_id: user?.id || fallbackUser?.id || "00000000-0000-0000-0000-000000000000",
        actor_name: operatorName,
        entity_type: "order",
        entity_id: order.id,
        action: "order_items_picked",
        changes: { status: "picked", operator: operatorName },
        source: "local",
      });

      return NextResponse.json({
        success: true,
        message: "✓ All items successfully marked as picked.",
        order: updatedOrder,
      });
    }

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const { data: existingItem } = await supabase
          .from("order_items")
          .select("quantity")
          .eq("order_id", id)
          .eq("order_item_id", item.order_item_id)
          .maybeSingle();

        const reqQty = existingItem?.quantity || 1;
        const isFullyPicked = item.picked_quantity >= reqQty;

        await supabase
          .from("order_items")
          .update({
            picked_quantity: item.picked_quantity,
            is_picked: isFullyPicked,
            updated_at: timestamp,
          })
          .eq("order_id", id)
          .eq("order_item_id", item.order_item_id);
      }

      // Check if all items in order are now fully picked (must have at least 1 item in DB)
      const { data: allItems } = await supabase
        .from("order_items")
        .select("quantity, picked_quantity, is_picked")
        .eq("order_id", id);

      const hasDbItems = Array.isArray(allItems) && allItems.length > 0;
      const allDone = hasDbItems && allItems.every((i) => Boolean(i.is_picked) || (typeof i.picked_quantity === "number" && typeof i.quantity === "number" && i.picked_quantity >= i.quantity));

      const nextWorkflowStatus = allDone ? "picked" : "picking";

      const { data: updatedOrder } = await supabase
        .from("orders")
        .update({
          workflow_status: nextWorkflowStatus,
          updated_at: timestamp,
        })
        .eq("id", id)
        .select("*, order_items(*)")
        .single();

      // Record activity log
      await supabase.from("order_activities").insert({
        order_id: order.id,
        daraz_order_id: order.daraz_order_id,
        previous_status: order.workflow_status || order.status,
        new_status: nextWorkflowStatus,
        actor: operatorName,
        source: "Staff UI",
        notes: `Updated item picking quantities. Workflow state: ${nextWorkflowStatus}`,
      });

      return NextResponse.json({
        success: true,
        allPicked: allDone,
        message: allDone ? "✓ Order Picking Complete" : "Order Picking in Progress",
        order: updatedOrder,
      });
    }

    return NextResponse.json({ success: false, error: "No picking updates provided." }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/orders/[id]/pick Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update pick status." },
      { status: 500 }
    );
  }
}
