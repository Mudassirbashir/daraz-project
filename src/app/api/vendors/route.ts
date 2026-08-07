import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const pageInput = parseInt(searchParams.get("page") || "1", 10);
  const limitInput = parseInt(searchParams.get("limit") || "25", 10);
  const page = isNaN(pageInput) || pageInput < 1 ? 1 : pageInput;
  const limit = isNaN(limitInput) || limitInput < 1 ? 25 : Math.min(limitInput, 100);

  const search = searchParams.get("search") || "";
  const minRating = searchParams.get("min_rating") || "";

  const offset = (page - 1) * limit;

  try {
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("vendors")
      .select("*", { count: "exact" });

    if (minRating) {
      const parsedRating = parseFloat(minRating);
      if (!isNaN(parsedRating)) {
        query = query.gte("rating", parsedRating);
      }
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`name.ilike.${q},code.ilike.${q},contact_person.ilike.${q},email.ilike.${q}`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: vendors, count, error } = await query;

    if (error) {
      throw new Error(`Database vendors query error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      vendors: vendors || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/vendors Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch vendors." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { name, contactPerson, phone, email, address, rating, leadTimeDays, minimumOrderQuantity, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Vendor name is required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const code = `VND-${Date.now().toString().slice(-6)}`;

    const { data: newVendor, error } = await supabase
      .from("vendors")
      .insert({
        code,
        name: name.trim(),
        contact_person: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        rating: typeof rating === "number" ? rating : 5.0,
        lead_time_days: typeof leadTimeDays === "number" ? leadTimeDays : 7,
        minimum_order_quantity: typeof minimumOrderQuantity === "number" ? minimumOrderQuantity : 100,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create vendor: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Vendor created successfully.",
      vendor: newVendor,
    });
  } catch (err: any) {
    console.error("[POST /api/vendors Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create vendor." },
      { status: 500 }
    );
  }
}
