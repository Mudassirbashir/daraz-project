import { NextRequest } from "next/server";
import { POST as handleDisconnect } from "@/app/api/stores/[id]/disconnect/route";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleDisconnect(req, { params });
}
