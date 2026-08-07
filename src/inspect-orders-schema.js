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

async function inspectOrdersSchema() {
  console.log("Inspecting orders and order_items table schema...");

  const { data: orders, error: ordersErr } = await supabase.from("orders").select("*").limit(1);
  if (ordersErr) {
    console.error("Orders table query error:", ordersErr.message);
  } else {
    console.log("Orders Table Keys:", orders.length > 0 ? Object.keys(orders[0]) : "Table is empty (0 rows)");
  }

  const { data: items, error: itemsErr } = await supabase.from("order_items").select("*").limit(1);
  if (itemsErr) {
    console.warn("Order Items table query notice:", itemsErr.message);
  } else {
    console.log("Order Items Table Keys:", items.length > 0 ? Object.keys(items[0]) : "Table is empty (0 rows)");
  }
}

inspectOrdersSchema();
