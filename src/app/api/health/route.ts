import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const envCheck = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) ? "configured" : "missing",
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? "configured" : "missing",
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) ? "configured" : "missing",
    darazAppKey: Boolean(process.env.DARAZ_APP_KEY) ? "configured" : "missing",
    darazAppSecret: Boolean(process.env.DARAZ_APP_SECRET) ? "configured" : "missing",
    darazBaseUrl: Boolean(process.env.DARAZ_API_BASE_URL) ? "configured" : "missing",
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL) ? "configured" : "missing",
  };

  let dbStatus = "untested";
  let dbLatencyMs = -1;

  if (envCheck.supabaseUrl === "configured" && envCheck.serviceRoleKey === "configured") {
    try {
      const start = Date.now();
      const supabase = createAdminClient();
      const { error } = await supabase.from("daraz_stores").select("id").limit(1);
      dbLatencyMs = Date.now() - start;

      if (error) {
        dbStatus = `error: ${error.message}`;
      } else {
        dbStatus = "connected";
      }
    } catch (dbErr: any) {
      dbStatus = `exception: ${dbErr?.message || String(dbErr)}`;
    }
  } else {
    dbStatus = "configuration_missing";
  }

  const isHealthy =
    envCheck.supabaseUrl === "configured" &&
    envCheck.supabaseAnonKey === "configured" &&
    envCheck.serviceRoleKey === "configured" &&
    dbStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
