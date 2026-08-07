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

async function inspectStudioSchema() {
  console.log("Inspecting product_developments table schema...");

  const { data, error } = await supabase.from("product_developments").select("*").limit(1);
  if (error) {
    console.error("Query Error:", error.message);
  } else {
    console.log("product_developments Sample Row:", data.length > 0 ? Object.keys(data[0]) : "Table is empty (0 rows)");
  }
}

inspectStudioSchema();
