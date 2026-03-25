import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  claimIntegrationJobs,
  getOrderSyncContext,
  logIntegrationFailure,
  nextRetryTime,
  runIntegrationForOrder,
  runWithConcurrencyLimit,
  type IntegrationJobClaim,
} from '@/lib/integrations/job-runner';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.JOB_RUNNER_SECRET;
  if (!secret) return false;

  const headerSecret = request.headers.get('x-job-secret');
  if (headerSecret && headerSecret === secret) return true;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

const CLAIM_BATCH_SIZE = 25;
const MAX_JOBS_PER_RUN = 100;
const CONCURRENCY = 5;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized job runner request' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const lockId = `job-runner:${process.pid}:${Date.now()}`;

  let claimed = 0;
  let succeeded = 0;
  let retried = 0;
  let failed = 0;

  while (claimed < MAX_JOBS_PER_RUN) {
    const remaining = MAX_JOBS_PER_RUN - claimed;
    const batchSize = Math.min(CLAIM_BATCH_SIZE, remaining);
    const jobs = (await claimIntegrationJobs(supabase, {
      workerId: lockId,
      limit: batchSize,
      staleAfterMinutes: 15,
    })) as IntegrationJobClaim[];

    if (!jobs.length) {
      break;
    }

    claimed += jobs.length;

    const batchResults = await runWithConcurrencyLimit(jobs, CONCURRENCY, async (job) => {
      try {
        const context = await getOrderSyncContext(supabase, job.order_id);
        const { externalId } = await runIntegrationForOrder(supabase, context, job.integration);

        const { error: doneError } = await supabase
          .from('integration_jobs')
          .update({
            status: 'succeeded',
            attempts: job.attempts + 1,
            external_id: externalId,
            last_error: null,
            locked_at: null,
            locked_by: null,
          })
          .eq('id', job.id);
        if (doneError) throw new Error(doneError.message);

        succeeded++;
      } catch (err: unknown) {
        const attemptCount = job.attempts + 1;
        const errorMessage = await logIntegrationFailure(supabase, job.integration, job.order_id, attemptCount, err);
        const exhausted = attemptCount >= job.max_attempts;

        const { error: updateError } = await supabase
          .from('integration_jobs')
          .update({
            status: exhausted ? 'failed' : 'pending',
            attempts: attemptCount,
            last_error: errorMessage,
            next_run_at: exhausted ? new Date().toISOString() : nextRetryTime(attemptCount),
            locked_at: null,
            locked_by: null,
          })
          .eq('id', job.id);

        if (updateError) {
          failed++;
          return;
        }

        if (exhausted) failed++;
        else retried++;
      }
    });

    // Keep the pool hot across batches, but bail out if the claim RPC returned less than requested.
    if (jobs.length < batchSize || batchResults.length === 0) {
      break;
    }
  }

  return NextResponse.json({ claimed, succeeded, retried, failed });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
