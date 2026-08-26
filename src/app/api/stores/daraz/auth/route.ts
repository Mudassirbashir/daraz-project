import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { encryptSecret } from "@/lib/security/encryption";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const protocol = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || requestUrl.host;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`).replace(/\/+$/, "");
  
  const redirectUri = `${baseUrl}/api/stores/daraz/callback`;

  // Custom or system App Key / App Secret
  const customAppKey = requestUrl.searchParams.get("app_key")?.trim();
  const customAppSecret = requestUrl.searchParams.get("app_secret")?.trim();
  const storeUsername = requestUrl.searchParams.get("store_username")?.trim();
  const reconnectStoreId = requestUrl.searchParams.get("store_id") || requestUrl.searchParams.get("reconnect_store_id");

  const appKey = (customAppKey || process.env.DARAZ_APP_KEY || "").trim();
  const appSecret = (customAppSecret || process.env.DARAZ_APP_SECRET || "").trim();

  if (!appKey || !appSecret) {
    console.error("[Daraz Auth Error]: Missing DARAZ_APP_KEY or DARAZ_APP_SECRET in environment variables.");
    const protocol = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || requestUrl.host;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`).replace(/\/+$/, "");
    return NextResponse.redirect(
      `${baseUrl}/stores?error=missing_config&message=${encodeURIComponent(
        "Daraz APP_KEY or APP_SECRET environment variables are missing or unconfigured. Please set DARAZ_APP_KEY and DARAZ_APP_SECRET in your environment variables."
      )}`
    );
  }

  // Generate cryptographically secure state token to prevent CSRF
  const randomHex = crypto.randomBytes(32).toString("hex");
  const csrfStateToken = reconnectStoreId ? `store_${reconnectStoreId}_${randomHex}` : randomHex;

  // Session payload containing encrypted app credentials and intent
  const sessionPayload = {
    state: csrfStateToken,
    appKey,
    encryptedAppSecret: encryptSecret(appSecret),
    storeUsername: storeUsername || null,
    reconnectStoreId: reconnectStoreId || null,
    createdAt: Date.now(),
  };

  // Official Daraz Open Platform OAuth Authorization URL for PK
  const authUrl = new URL("https://api.daraz.pk/oauth/authorize");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("force_auth", "true");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("client_id", appKey);
  authUrl.searchParams.append("state", csrfStateToken);

  const response = NextResponse.redirect(authUrl.toString());

  // Store CSRF state and onboarding session payload in HttpOnly cookie
  response.cookies.set("daraz_oauth_state", csrfStateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  response.cookies.set("daraz_onboarding_session", Buffer.from(JSON.stringify(sessionPayload)).toString("base64"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
