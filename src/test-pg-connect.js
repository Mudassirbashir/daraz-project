const { Client } = require("pg");
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

async function runMigration() {
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/20260803000000_refactored_daraz_ops_schema.sql"),
    "utf8"
  );

  // Check if SUPABASE_DB_PASSWORD or POSTGRES_URL is provided in env
  const dbUrl = env.POSTGRES_URL || env.DATABASE_URL;
  if (!dbUrl) {
    console.log("No POSTGRES_URL in env.local.");
    return;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log("Connected to Postgres!");
    await client.query(sql);
    console.log("Migration executed successfully!");
    await client.end();
  } catch (e) {
    console.error("Postgres connection / migration error:", e.message);
  }
}

runMigration();
