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

const sqlContent = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20260803000000_refactored_daraz_ops_schema.sql"),
  "utf8"
);

async function testSQLMethods() {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;

  console.log("Testing SQL endpoints with Service Role Key...");

  // Try endpoint 1: /rest/v1/ (RPC / SQL)
  try {
    const res = await fetch(`${baseUrl}/rest/v1/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: "SELECT 1;" }),
    });
    console.log("REST /query status:", res.status, await res.text());
  } catch (e) {
    console.log("REST /query err:", e.message);
  }

  // Try endpoint 2: /pg/v1/query
  try {
    const res = await fetch(`${baseUrl}/pg/v1/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: "SELECT 1;" }),
    });
    console.log("pg /v1/query status:", res.status, await res.text());
  } catch (e) {
    console.log("pg /v1/query err:", e.message);
  }
}

testSQLMethods();
