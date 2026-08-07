import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const supabase = createAdminClient();

    const { data: draft, error } = await supabase
      .from("product_developments")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !draft) {
      return NextResponse.json({ success: false, error: "Studio draft not found." }, { status: 404 });
    }

    let parsedDetails = {};
    try {
      parsedDetails = draft.notes ? JSON.parse(draft.notes) : {};
    } catch (e) {
      parsedDetails = {};
    }

    return NextResponse.json({
      success: true,
      draft: {
        ...draft,
        details: parsedDetails,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/studio/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch studio draft details." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const body = await req.json();
    const { name, category, stage, target_cost_cents, estimated_selling_price_cents, details } = body;

    const supabase = createAdminClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (stage) updateData.stage = stage;
    if (typeof target_cost_cents === "number") updateData.target_cost_cents = target_cost_cents;
    if (typeof estimated_selling_price_cents === "number") updateData.estimated_selling_price_cents = estimated_selling_price_cents;
    if (details) updateData.notes = JSON.stringify(details);

    const { data: updatedDraft, error } = await supabase
      .from("product_developments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update studio draft: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Studio draft updated successfully.",
      draft: updatedDraft,
    });
  } catch (err: any) {
    console.error("[PATCH /api/studio/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update studio draft." },
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
      throw new Error(`Failed to delete studio draft: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Studio draft deleted successfully.",
    });
  } catch (err: any) {
    console.error("[DELETE /api/studio/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete studio draft." },
      { status: 500 }
    );
  }
}
