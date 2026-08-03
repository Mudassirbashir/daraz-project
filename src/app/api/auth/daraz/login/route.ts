import { NextResponse } from "next/server";

export async function GET() {
  const appKey = process.env.DARAZ_APP_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/daraz/callback`;

  if (!appKey) {
    return NextResponse.json(
      { error: "DARAZ_APP_KEY environment variable is not configured." },
      { status: 500 }
    );
  }

  // Official Daraz Open Platform OAuth Authorization URL for PK
  const authUrl = new URL("https://api.daraz.pk/oauth/authorize");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("force_auth", "true");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("client_id", appKey);

  return NextResponse.redirect(authUrl.toString());
}
