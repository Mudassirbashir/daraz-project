import { NextRequest, NextResponse } from 'next/server';
import { seedAllTeamAccounts, ensureUserExistsInSupabase } from '@/lib/supabase/seed-users';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, fullName, role } = body;

    if (email) {
      const res = await ensureUserExistsInSupabase(email, password, fullName, role);
      return NextResponse.json({ success: true, user: res });
    }

    const results = await seedAllTeamAccounts();
    return NextResponse.json({
      success: true,
      message: 'Successfully seeded all 3 team accounts into Supabase Auth & Profiles table.',
      accounts: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to seed users.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
