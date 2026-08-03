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

const demoUsers = [
  {
    email: "mubashir@darazops.internal",
    password: "DarazOps2026!",
    fullName: "Mubashir",
    role: "super_admin",
    employeeId: "EMP-001",
  },
  {
    email: "mudassir@darazops.internal",
    password: "DarazOps2026!",
    fullName: "Mudassir",
    role: "product_manager",
    employeeId: "EMP-002",
  },
  {
    email: "zainab@darazops.internal",
    password: "DarazOps2026!",
    fullName: "Zainab",
    role: "ops_manager",
    employeeId: "EMP-003",
  },
];

async function seedAuthUsers() {
  console.log("Creating/Ensuring Auth Users in Supabase Auth...");

  for (const user of demoUsers) {
    // 1. Create or get user in Supabase auth.users
    const { data: existingUserList } = await supabase.auth.admin.listUsers();
    let authUser = existingUserList.users.find((u) => u.email === user.email);

    if (!authUser) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName, role: user.role },
      });

      if (createErr) {
        console.error(`Error creating auth user for ${user.email}:`, createErr.message);
        continue;
      }
      authUser = created.user;
      console.log(`✓ Created auth user: ${user.email} (ID: ${authUser.id})`);
    } else {
      // Update password to ensure it matches DarazOps2026!
      await supabase.auth.admin.updateUserById(authUser.id, {
        password: user.password,
        email_confirm: true,
      });
      console.log(`✓ Updated existing auth user: ${user.email} (ID: ${authUser.id})`);
    }

    // 2. Link profile in profiles table
    const { error: profileErr } = await supabase.from("profiles").upsert(
      {
        id: authUser.id,
        employee_id: user.employeeId,
        full_name: user.fullName,
        email: user.email,
        role: user.role,
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (profileErr) {
      console.error(`Profile upsert error for ${user.email}:`, profileErr.message);
    } else {
      console.log(`   ✓ Profile updated for ${user.fullName} (${user.role})`);
    }
  }

  console.log("==================================================");
  console.log("ALL DEMO ACCOUNTS ARE CREATED IN SUPABASE AUTH!");
  console.log("==================================================");
}

seedAuthUsers();
