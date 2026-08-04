import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const appKey = process.env.DARAZ_APP_KEY || "504904";
  const requestUrl = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;
  const redirectUri = `${baseUrl}/api/auth/daraz/callback`;

  // Official Daraz Open Platform OAuth Authorization URL for PK
  const authUrl = new URL("https://api.daraz.pk/oauth/authorize");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("force_auth", "true");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("client_id", appKey);

  return NextResponse.redirect(authUrl.toString());
}
