import { NextRequest, NextResponse } from "next/server";
import { POST as handleOrderShip } from "@/app/api/v1/orders/[orderId]/ship/route";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orderId = body.orderId || body.order_id;

  if (!orderId) {
    return NextResponse.json({ success: false, error: "orderId is required in body." }, { status: 400 });
  }

  const reqWithDummyUrl = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(body),
  });

  return handleOrderShip(reqWithDummyUrl, { params: { orderId } });
}
