import type { Customer } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPPORTED_INTEGRATIONS = ['clickup', 'netsuite', 'quickbooks', 'bigquery', 'mailchimp'] as const;
type IntegrationName = (typeof SUPPORTED_INTEGRATIONS)[number];

type QueueClient = SupabaseClient;

function integrationJobPayload(integration: IntegrationName, customer: Customer | null) {
  if (integration === 'mailchimp') {
    return { customer_marketing_consent: !!customer?.marketing_consent };
  }
  return {};
}

export async function enqueueOrderIntegrationJobs(
  serviceClient: QueueClient,
  orderId: string,
  customer: Customer | null
) {
  const jobs = SUPPORTED_INTEGRATIONS
    .filter((integration) => integration !== 'mailchimp' || !!customer?.marketing_consent)
    .map((integration) => ({
      order_id: orderId,
      integration,
      status: 'pending',
      next_run_at: new Date().toISOString(),
      payload: integrationJobPayload(integration, customer),
    }));

  if (!jobs.length) return;

  const { error } = await serviceClient
    .from('integration_jobs')
    .upsert(jobs, { onConflict: 'order_id,integration', ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to enqueue integration jobs: ${error.message}`);
  }
}
