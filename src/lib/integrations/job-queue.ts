import { CORE_OPERATIONAL_INTEGRATIONS, type CoreOperationalIntegration } from '@/lib/ordering-domain';
import type { Customer } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type QueueClient = SupabaseClient;

export async function enqueueOrderIntegrationJobs(
  serviceClient: QueueClient,
  orderId: string,
  _customer: Customer | null
) {
  void _customer;

  const jobs = CORE_OPERATIONAL_INTEGRATIONS.map((integration: CoreOperationalIntegration) => ({
      order_id: orderId,
      integration,
      status: 'pending',
      next_run_at: new Date().toISOString(),
      payload: {},
    }));

  if (!jobs.length) return;

  const { error } = await serviceClient
    .from('integration_jobs')
    .upsert(jobs, { onConflict: 'order_id,integration', ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to enqueue integration jobs: ${error.message}`);
  }
}
