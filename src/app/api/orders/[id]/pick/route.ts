import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { items, markAllPicked } = body as {
      items?: Array<{ order_item_id: string; picked_quantity: number }>;
      markAllPicked?: boolean;
    };

    const supabase = createAdminClient();

    // Fetch user profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, employee_id")
      .eq("id", user.id)
      .maybeSingle();

    const operatorName = profile?.full_name || profile?.employee_id || user.email || "Picking Staff";

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

    if (markAllPicked) {
      // Mark all items as picked
      await supabase
        .from("order_items")
        .update({ is_picked: true, updated_at: timestamp })
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
        user_id: user.id,
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

      // Check if all items in order are now fully picked
      const { data: allItems } = await supabase
        .from("order_items")
        .select("quantity, picked_quantity, is_picked")
        .eq("order_id", id);

      const allDone = allItems && allItems.every((i) => i.is_picked || i.picked_quantity >= i.quantity);

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
