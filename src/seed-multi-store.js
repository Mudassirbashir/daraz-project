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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://wpmeihwfxahifdidgiac.supabase.co";
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const initialStores = [
  {
    store_code: "DARAZ-PK-01",
    store_name: "Daraz Flagship PK 1",
    region: "PK",
    seller_id: "504904",
    api_app_key: "504904",
    api_app_secret: "cPQFbmldQEw4X39ccnnpZNQpH9PEUhTx",
    is_active: true,
  },
  {
    store_code: "DARAZ-PK-02",
    store_name: "Daraz Express PK 2",
    region: "PK",
    seller_id: "504905",
    api_app_key: "504904",
    api_app_secret: "cPQFbmldQEw4X39ccnnpZNQpH9PEUhTx",
    is_active: true,
  },
  {
    store_code: "DARAZ-PK-03",
    store_name: "Daraz Wholesale PK 3",
    region: "PK",
    seller_id: "504906",
    api_app_key: "504904",
    api_app_secret: "cPQFbmldQEw4X39ccnnpZNQpH9PEUhTx",
    is_active: true,
  },
];

async function seedMultiStore() {
  console.log("==================================================");
  console.log("SEEDING MULTI-STORE ACCOUNTS (3 DARAZ STORES)...");
  console.log("==================================================");

  for (const store of initialStores) {
    const { data: existing } = await supabase
      .from("daraz_stores")
      .select("id")
      .eq("store_code", store.store_code)
      .single();

    if (existing) {
      console.log(`✓ Store exists: [${store.store_code}] ${store.store_name}`);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("daraz_stores")
        .insert(store)
        .select()
        .single();

      if (insertErr) {
        console.error(`Failed to insert ${store.store_code}:`, insertErr.message);
      } else {
        console.log(`✓ Created Store Slot: [${inserted.store_code}] ${inserted.store_name} (ID: ${inserted.id})`);
      }
    }
  }

  const { data: allStores } = await supabase.from("daraz_stores").select("id, store_code, store_name, is_active");
  console.log("\nActive Stores in Supabase:");
  console.table(allStores);
}

seedMultiStore();
