import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const search = searchParams.get("search") || "";
  const stage = searchParams.get("stage") || "all";
  const publishingStatus = searchParams.get("publishing_status") || "all";

  const offset = (page - 1) * limit;

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from("product_developments")
      .select("*", { count: "exact" });

    if (stage !== "all") {
      query = query.eq("stage", stage as any);
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`name.ilike.${q},code.ilike.${q},category.ilike.${q}`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: rawDrafts, count, error } = await query;

    if (error) {
      throw new Error(`Database studio drafts query error: ${error.message}`);
    }

    const drafts = (rawDrafts || []).map((d) => {
      let parsedNotes = {};
      try {
        parsedNotes = d.notes ? JSON.parse(d.notes) : {};
      } catch (e) {
        parsedNotes = { rawNotes: d.notes };
      }

      return {
        id: d.id,
        code: d.code,
        name: d.name,
        category: d.category,
        stage: d.stage,
        target_cost_cents: d.target_cost_cents,
        estimated_selling_price_cents: d.estimated_selling_price_cents,
        created_at: d.created_at,
        updated_at: d.updated_at,
        details: parsedNotes,
      };
    });

    let filteredDrafts = drafts;
    if (publishingStatus !== "all") {
      filteredDrafts = filteredDrafts.filter(
        (d: any) => d.details?.publishing_status === publishingStatus
      );
    }

    return NextResponse.json({
      success: true,
      drafts: filteredDrafts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/studio Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch studio drafts." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, sellerSku, language } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Draft product name is required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const code = `DEV-STU-${Date.now().toString().slice(-6)}`;

    const initialDetails = {
      seller_sku: sellerSku || `SKU-${Date.now().toString().slice(-6)}`,
      language: language || "en",
      publishing_status: "draft",
      ai_title: `${name.trim()} - Premium Quality`,
      seo_description: `High quality ${name.trim()} designed for long-lasting durability and performance.`,
      highlights: [
        `Premium material construction`,
        `Modern aesthetic design`,
        `Direct manufacturer quality guaranteed`,
      ],
      search_keywords: `${name.trim()}, daraz product, premium quality`,
      meta_keywords: `${name.trim()}, online shopping, best price`,
      package_content: `1x ${name.trim()}`,
      specifications: { weight: "0.50 kg", dimensions: "20 x 15 x 10 cm" },
      cost_breakdown: {
        material: 15000,
        laser_cutting: 5000,
        printing: 3000,
        packaging: 2000,
        courier: 10000,
        daraz_commission_pct: 8,
        tax_pct: 2,
        profit_margin_pct: 30,
      },
      images: {
        original: [],
        ai_enhanced: [],
        bg_removed: [],
        white_bg: [],
        square: [],
        thumbnail: [],
      },
      attachments: [],
      checklist: {
        images: false,
        title: true,
        description: true,
        sku: true,
        category: true,
        price: true,
        stock: true,
        weight: true,
        dimensions: true,
      },
      internal_notes: "Initial draft created in AI Listing Studio.",
    };

    const { data: newDraft, error } = await supabase
      .from("product_developments")
      .insert({
        code,
        name: name.trim(),
        category: category || "General",
        stage: "ready_for_listing",
        target_cost_cents: 35000,
        estimated_selling_price_cents: 85000,
        notes: JSON.stringify(initialDetails),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "AI Listing Studio draft created successfully.",
      draft: newDraft,
    });
  } catch (err: any) {
    console.error("[POST /api/studio Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create studio draft." },
      { status: 500 }
    );
  }
}
