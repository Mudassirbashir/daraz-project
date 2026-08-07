import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const body = await req.json();
    const { name, category, stage, target_cost_cents, estimated_selling_price_cents, assigned_to, notes } = body;

    const supabase = createAdminClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (stage) updateData.stage = stage;
    if (typeof target_cost_cents === "number") updateData.target_cost_cents = target_cost_cents;
    if (typeof estimated_selling_price_cents === "number") updateData.estimated_selling_price_cents = estimated_selling_price_cents;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (notes !== undefined) updateData.notes = notes;

    const { data: updatedDev, error } = await supabase
      .from("product_developments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update R&D item: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Product development item updated successfully.",
      productDev: updatedDev,
    });
  } catch (err: any) {
    console.error("[PATCH /api/product-dev/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update product development item." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("product_developments")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete R&D item: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Product development item deleted successfully.",
    });
  } catch (err: any) {
    console.error("[DELETE /api/product-dev/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete product development item." },
      { status: 500 }
    );
  }
}
