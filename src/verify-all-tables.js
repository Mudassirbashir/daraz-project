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

const requiredTables = [
  "profiles",
  "user_roles",
  "vendors",
  "product_developments",
  "daraz_stores",
  "inventory",
  "listings",
  "orders",
  "tasks",
  "financial_records",
  "daraz_api_logs",
];

async function verifyTables() {
  console.log("Verifying table creation on Supabase...");
  const results = {};
  let allValid = true;

  for (const table of requiredTables) {
    const { data, error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      results[table] = { status: "MISSING_OR_ERROR", error: error.message };
      allValid = false;
    } else {
      results[table] = { status: "EXISTS", sampleRows: data ? data.length : 0 };
    }
  }

  console.log("TABLE VERIFICATION RESULTS:", JSON.stringify(results, null, 2));
  console.log("ALL REQUIRED TABLES EXIST:", allValid);
  if (!allValid) {
    process.exit(1);
  }
}

verifyTables();
