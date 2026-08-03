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

const sql = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20260803000000_refactored_daraz_ops_schema.sql"),
  "utf8"
);

async function runMgmtQuery() {
  const ref = "wpmeihwfxahifdidgiac";
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("Testing Management API SQL Execution for project:", ref);

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/db/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  console.log("Mgmt API response status:", res.status);
  const text = await res.text();
  console.log("Mgmt API response text:", text);
}

runMgmtQuery();
