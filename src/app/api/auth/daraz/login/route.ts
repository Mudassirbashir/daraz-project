import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appKey = (process.env.DARAZ_APP_KEY || "504904").trim();

  const requestUrl = new URL(req.url);
  const protocol = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || requestUrl.host;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
  const redirectUri = `${baseUrl}/api/auth/daraz/callback`;

  // Generate cryptographically secure state token to prevent CSRF
  const csrfStateToken = crypto.randomBytes(32).toString("hex");

  // Official Daraz Open Platform OAuth Authorization URL for PK
  const authUrl = new URL("https://api.daraz.pk/oauth/authorize");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("force_auth", "true");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("client_id", appKey.trim());
  authUrl.searchParams.append("state", csrfStateToken);

  const response = NextResponse.redirect(authUrl.toString());

  // Store CSRF token in HttpOnly cookie for callback verification
  response.cookies.set("daraz_oauth_state", csrfStateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
