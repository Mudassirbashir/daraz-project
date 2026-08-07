import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const supabase = createAdminClient();

    const { data: vendor, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, vendor });
  } catch (err: any) {
    console.error("[GET /api/vendors/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch vendor details." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const body = await req.json();
    const { name, contact_person, phone, email, address, rating, lead_time_days, minimum_order_quantity, notes } = body;

    const supabase = createAdminClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name) updateData.name = name;
    if (contact_person !== undefined) updateData.contact_person = contact_person;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (typeof rating === "number") updateData.rating = rating;
    if (typeof lead_time_days === "number") updateData.lead_time_days = lead_time_days;
    if (typeof minimum_order_quantity === "number") updateData.minimum_order_quantity = minimum_order_quantity;
    if (notes !== undefined) updateData.notes = notes;

    const { data: updatedVendor, error } = await supabase
      .from("vendors")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update vendor: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Vendor updated successfully.",
      vendor: updatedVendor,
    });
  } catch (err: any) {
    console.error("[PATCH /api/vendors/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update vendor." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("vendors")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete vendor: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Vendor deleted successfully.",
    });
  } catch (err: any) {
    console.error("[DELETE /api/vendors/[id] Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete vendor." },
      { status: 500 }
    );
  }
}
