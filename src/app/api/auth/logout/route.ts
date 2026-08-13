import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();

  const requestUrl = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;

  const response = NextResponse.redirect(`${baseUrl}/login?logged_out=true`);
  
  // Clear any residual auth cookies explicitly
  req.cookies.getAll().forEach((cookie) => {
    if (cookie.name.includes("sb-") || cookie.name.includes("supabase") || cookie.name === "daraz_ops_user") {
      response.cookies.delete(cookie.name);
    }
  });
  response.cookies.delete("daraz_ops_user");

  return response;
}

export async function POST(req: NextRequest) {
  return GET(req);
}
