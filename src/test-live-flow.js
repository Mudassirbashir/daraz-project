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

const appKey = env.DARAZ_APP_KEY;
const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const redirectUri = `${baseUrl}/api/auth/daraz/callback`;

const authUrl = new URL("https://auth.lazada.com/oauth/authorize");
authUrl.searchParams.append("response_type", "code");
authUrl.searchParams.append("force_auth", "true");
authUrl.searchParams.append("redirect_uri", redirectUri);
authUrl.searchParams.append("client_id", appKey);

console.log("==================================================");
console.log("UPDATED DARAZ OAUTH AUTHORIZATION URL:");
console.log("==================================================");
console.log(authUrl.toString());
console.log("==================================================");
