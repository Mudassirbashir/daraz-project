import { NextRequest, NextResponse } from "next/server";
import { initiateAsaanRetailAuth, validateAsaanRetailAuth } from "@/lib/daraz/auth-methods/asaan-retail-style";

/**
 * Asaan Retail-style Daraz Authentication Initiation
 * GET /api/daraz/asaan-retail?app_key=&app_secret=&store_username=&store_id=
 */
export async function GET(req: NextRequest) {
  return initiateAsaanRetailAuth(req);
}

/**
 * Asaan Retail-style Daraz Authentication Callback
 * POST /api/daraz/asaan-retail
 */
export async function POST(req: NextRequest) {
  // This endpoint would handle any POST requests from the validation flow
  // For now, we'll redirect to validation or handle as needed
  return NextResponse.redirect(new URL("/daraz/asaan-retail/validate", req.url));
}