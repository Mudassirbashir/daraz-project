import { NextRequest, NextResponse } from "next/server";
import { getDarazClient } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const storeId = params.storeId;
  if (!storeId) {
    return NextResponse.json({ success: false, error: "storeId parameter is required." }, { status: 400 });
  }

  try {
    const client = await getDarazClient(storeId);
    const profile = await client.getStoreProfile();

    return NextResponse.json({
      success: true,
      status: "connected",
      sellerId: profile.seller_id,
      storeName: profile.name,
      shortCode: profile.short_code || null,
      region: profile.location || "PK",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: err.message || "Failed to test connection to Daraz Open Platform.",
      },
      { status: 500 }
    );
  }
}
