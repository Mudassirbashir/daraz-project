import { NextRequest } from "next/server";
import { GET as handleCallback } from "@/app/api/stores/daraz/callback/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleCallback(req);
}
