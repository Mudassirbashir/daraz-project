import { NextRequest, NextResponse } from "next/server";
import { GET as handleAuth } from "@/app/api/stores/daraz/auth/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleAuth(req);
}
