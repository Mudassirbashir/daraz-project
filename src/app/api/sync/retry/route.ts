import { NextRequest, NextResponse } from 'next/server';
import { processNextPendingJob } from '@/lib/queue/background-queue';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const { jobId } = body;

    if (jobId) {
      // Re-queue specific failed job
      await supabase
        .from('background_jobs')
        .update({
          status: 'pending',
          attempts: 0,
          scheduled_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    const result = await processNextPendingJob();

    return NextResponse.json({
      success: true,
      message: result.processed
        ? `Retried background job ${result.jobId} (${result.queueName})`
        : 'No pending background jobs to process.',
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to retry background sync job.',
      },
      { status: 500 }
    );
  }
}
