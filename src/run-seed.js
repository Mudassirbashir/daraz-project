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

async function seedInitialData() {
  console.log("Seeding Daraz Store record...");

  const { data, error } = await supabase.from("daraz_stores").upsert(
    {
      store_code: "DARAZ-PK-01",
      store_name: "Daraz Store PK (504904)",
      region: "PK",
      seller_id: "504904",
      api_app_key: env.DARAZ_APP_KEY,
      api_app_secret: env.DARAZ_APP_SECRET,
      is_active: true,
    },
    { onConflict: "store_code" }
  ).select();

  console.log("Seed Daraz Store Result:", { data, error });
}

seedInitialData();
