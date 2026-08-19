import { NextRequest, NextResponse } from 'next/server';
import { getValidStoreAccessToken } from '@/lib/daraz/store-utils';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storeId } = await params;
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'Store ID is required' }, { status: 400 });
    }

    const { client } = await getValidStoreAccessToken(storeId);
    const storeProfile = await client.getStoreProfile();

    const supabase = createAdminClient();
    await supabase
      .from('daraz_stores')
      .update({
        seller_id: storeProfile.seller_id,
        store_name: storeProfile.name,
        sync_status: 'connected',
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId);

    return NextResponse.json({
      success: true,
      message: `Connection successful for seller: ${storeProfile.name} (${storeProfile.seller_id})`,
      storeProfile,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to connect to Daraz Seller Center API.',
      },
      { status: 500 }
    );
  }
}
