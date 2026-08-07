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
  const stage = searchParams.get("stage") || "all";

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
      .from("product_developments")
      .select("*, vendors(name)", { count: "exact" });

    if (stage !== "all") {
      query = query.eq("stage", stage as any);
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`name.ilike.${q},code.ilike.${q},category.ilike.${q}`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: productDevs, count, error } = await query;

    if (error) {
      throw new Error(`Database product_developments query error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      productDevs: productDevs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/product-dev Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch product development records." },
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
    const { name, category, stage, targetCostCents, estimatedSellingPriceCents, assignedTo, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Product name is required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const code = `DEV-${Date.now().toString().slice(-6)}`;

    const { data: newDev, error } = await supabase
      .from("product_developments")
      .insert({
        code,
        name: name.trim(),
        category: category || "General",
        stage: stage || "ideation",
        target_cost_cents: typeof targetCostCents === "number" ? targetCostCents : 25000,
        estimated_selling_price_cents: typeof estimatedSellingPriceCents === "number" ? estimatedSellingPriceCents : 75000,
        assigned_to: assignedTo || "Mudassir",
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create product development item: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Product development item created successfully.",
      productDev: newDev,
    });
  } catch (err: any) {
    console.error("[POST /api/product-dev Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create product development item." },
      { status: 500 }
    );
  }
}
