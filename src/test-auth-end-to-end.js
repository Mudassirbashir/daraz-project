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
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const publicClient = createClient(supabaseUrl, anonKey);

async function testAuthEndToEnd() {
  console.log("==================================================");
  console.log("TESTING SUPABASE AUTHENTICATION END-TO-END...");
  console.log("==================================================");

  // 1. Create a brand new test user
  const testEmail = `test.user.${Date.now()}@darazops.internal`;
  const testPassword = "DarazOps2026!";

  console.log(`\n1. Creating new test user: ${testEmail}`);
  const { data: createdUser, error: createErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: "Test Auditor", role: "ops_manager" },
  });

  if (createErr) {
    console.error("❌ Failed to create test user:", createErr.message);
    process.exit(1);
  }
  console.log(`   ✓ Created Auth User ID: ${createdUser.user.id}`);

  // 2. Link profile in profiles table
  const { error: profileErr } = await adminClient.from("profiles").upsert({
    id: createdUser.user.id,
    employee_id: `EMP-TEST-${Date.now().toString().slice(-4)}`,
    full_name: "Test Auditor",
    email: testEmail,
    role: "ops_manager",
    is_active: true,
  });

  if (profileErr) {
    console.error("❌ Failed to upsert profile:", profileErr.message);
  } else {
    console.log("   ✓ Profile linked in profiles table");
  }

  // 3. Test public login (signInWithPassword)
  console.log("\n2. Testing signInWithPassword for new test user...");
  const { data: loginData, error: loginErr } = await publicClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginErr || !loginData.session) {
    console.error("❌ Login failed:", loginErr?.message);
    process.exit(1);
  }

  console.log(`   ✓ Login Successful!`);
  console.log(`   Access Token Length: ${loginData.session.access_token.length}`);
  console.log(`   User ID: ${loginData.user.id}`);
  console.log(`   Email: ${loginData.user.email}`);

  // 4. Test Existing Demo User Login (Mubashir)
  console.log("\n3. Testing signInWithPassword for existing Super Admin (mubashir@darazops.internal)...");
  const { data: adminLoginData, error: adminLoginErr } = await publicClient.auth.signInWithPassword({
    email: "mubashir@darazops.internal",
    password: "DarazOps2026!",
  });

  if (adminLoginErr || !adminLoginData.session) {
    console.error("❌ Admin Login failed:", adminLoginErr?.message);
    process.exit(1);
  }

  console.log(`   ✓ Admin Login Successful!`);
  console.log(`   Access Token Length: ${adminLoginData.session.access_token.length}`);
  console.log(`   User ID: ${adminLoginData.user.id}`);

  console.log("\n==================================================");
  console.log("SUCCESS: END-TO-END AUTHENTICATION TEST PASSED!");
  console.log("==================================================");
}

testAuthEndToEnd();
