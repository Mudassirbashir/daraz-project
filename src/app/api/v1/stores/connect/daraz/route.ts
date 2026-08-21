import { NextRequest, NextResponse } from "next/server";
import { POST as handleStartOAuth } from "@/app/api/daraz/oauth/start/route";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleStartOAuth(req);
}
