const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envContent = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyLiveOAuth() {
  console.log("==================================================");
  console.log("VERIFYING LIVE OAUTH & SYNC STATUS IN SUPABASE...");
  console.log("==================================================");

  // 1. Query daraz_stores for saved tokens and seller profile
  const { data: stores, error: storesErr } = await supabase
    .from("daraz_stores")
    .select("id, store_code, store_name, seller_id, access_token, refresh_token, token_expires_at, is_active, updated_at");

  if (storesErr) {
    console.error("❌ Failed to query daraz_stores:", storesErr.message);
    process.exit(1);
  }

  console.log(`Found ${stores ? stores.length : 0} store record(s) in database:\n`);

  let hasAuthorizedStore = false;

  if (stores && stores.length > 0) {
    for (const store of stores) {
      const hasAccessToken = !!store.access_token;
      const hasRefreshToken = !!store.refresh_token;
      const tokenExpiresAt = store.token_expires_at;

      console.log(`Store: [${store.store_code}] - ${store.store_name} (Seller ID: ${store.seller_id})`);
      console.log(` - Access Token Saved: ${hasAccessToken ? "✓ YES (SECURE)" : "❌ MISSING (Awaiting Seller OAuth Click)"}`);
      console.log(` - Refresh Token Saved: ${hasRefreshToken ? "✓ YES (SECURE)" : "❌ MISSING"}`);
      console.log(` - Token Expiration: ${tokenExpiresAt || "N/A"}`);
      console.log(` - Last Updated: ${store.updated_at}\n`);

      if (hasAccessToken && hasRefreshToken) {
        hasAuthorizedStore = true;
      }
    }
  }

  // 2. Query listings count
  const { count: productsCount, error: productsErr } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true });

  console.log(`- Products/Listings Synced: ${productsCount !== null ? productsCount : 0} item(s)`);
  if (productsErr) console.error("   Listings query error:", productsErr.message);

  // 3. Query orders count
  const { count: ordersCount, error: ordersErr } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  console.log(`- Orders Synced: ${ordersCount !== null ? ordersCount : 0} order(s)`);
  if (ordersErr) console.error("   Orders query error:", ordersErr.message);

  // 4. Query API Logs
  const { data: logs, error: logsErr } = await supabase
    .from("daraz_api_logs")
    .select("sync_type, status, records_synced, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\n- Recent API Logs in daraz_api_logs:");
  if (logs && logs.length > 0) {
    logs.forEach((log) => {
      console.log(`  [${log.created_at}] Type: ${log.sync_type} | Status: ${log.status} | Synced: ${log.records_synced} | Error: ${log.error_message || "None"}`);
    });
  } else {
    console.log("  No API logs recorded yet.");
  }

  console.log("==================================================");
  if (hasAuthorizedStore) {
    console.log("SUCCESS: LIVE DARAZ OAUTH CREDENTIALS ARE STORED IN SUPABASE!");
  } else {
    console.log("STATUS: AWAITING SELLER OAUTH AUTHORIZATION CLICK.");
  }
  console.log("==================================================");
}

verifyLiveOAuth();
