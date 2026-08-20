import { NextRequest, NextResponse } from "next/server";
import { GET as handleGetStores } from "@/app/api/stores/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleGetStores(req);
}
