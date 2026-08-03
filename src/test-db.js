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

console.log("Testing Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testDB() {
  try {
    const { data: stores, error: storesErr } = await supabase.from("daraz_stores").select("*");
    console.log("daraz_stores table check:", { count: stores ? stores.length : null, storesErr });

    const { data: listings, error: listErr } = await supabase.from("listings").select("*");
    console.log("listings table check:", { count: listings ? listings.length : null, listErr });

    const { data: orders, error: ordErr } = await supabase.from("orders").select("*");
    console.log("orders table check:", { count: orders ? orders.length : null, ordErr });
  } catch (err) {
    console.error("Test DB Exception:", err);
  }
}

testDB();
