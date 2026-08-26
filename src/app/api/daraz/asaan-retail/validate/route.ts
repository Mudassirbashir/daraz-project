import { NextRequest, NextResponse } from "next/server";
import { validateAsaanRetailAuth } from "@/lib/daraz/auth-methods/asaan-retail-style";

/**
 * Asaan Retail-style Daraz Authentication Validation
 * GET /api/daraz/asaan-retail/validate?state=
 */
export async function GET(req: NextRequest) {
  return validateAsaanRetailAuth(req);
}