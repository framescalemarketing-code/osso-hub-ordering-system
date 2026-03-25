import { syncToClickUp } from './clickup';
import { syncToNetSuite } from './netsuite';
import { syncToQuickBooks } from './quickbooks';
import { writeOrderToBigQuery } from './bigquery';
import { syncToMailchimp } from './mailchimp';
import type { Customer, Order, OrderItem, Program } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type IntegrationJobRecord = {
  id: string;
  order_id: string;
  integration: 'clickup' | 'netsuite' | 'quickbooks' | 'bigquery' | 'mailchimp';
  attempts: number;
  max_attempts: number;
};

export type IntegrationJobClaim = IntegrationJobRecord & {
  payload: Record<string, unknown>;
};

export type ReminderClaim = {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  employee_id: string | null;
  reminder_type: string;
  subject: string;
  body: string | null;
  due_at: string;
  attempts: number;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  order_number: string | null;
};

type OrderSyncContext = {
  order: Order;
  customer: Customer;
  items: OrderItem[];
  program: Program | null;
};

export async function getOrderSyncContext(serviceClient: SupabaseClient, orderId: string): Promise<OrderSyncContext> {
  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('*, program:programs(*)')
    .eq('id', orderId)
    .single();
  if (orderError || !order) throw new Error(orderError?.message || 'Order not found');

  const [customerResult, itemsResult] = await Promise.all([
    serviceClient.from('customers').select('*').eq('id', order.customer_id).single(),
    serviceClient.from('order_items').select('*').eq('order_id', orderId),
  ]);

  const { data: customer, error: customerError } = customerResult;
  if (customerError || !customer) throw new Error(customerError?.message || 'Customer not found');

  const { data: items, error: itemsError } = itemsResult;
  if (itemsError) throw new Error(itemsError.message || 'Order items not found');

  return {
    order: order as Order,
    customer: customer as Customer,
    items: ((items as OrderItem[] | null) || []) as OrderItem[],
    program: ((order as Order & { program?: Program | null }).program ?? null) as Program | null,
  };
}

export async function runIntegrationForOrder(
  serviceClient: SupabaseClient,
  context: OrderSyncContext,
  integration: IntegrationJobRecord['integration']
) {
  const fullOrder = {
    ...context.order,
    customer: context.customer,
    program: context.program,
    items: context.items,
  } as Order & { customer: Customer; program?: Program | null; items: OrderItem[] };

  let externalId: string | null = null;

  if (integration === 'clickup') externalId = await syncToClickUp(fullOrder);
  else if (integration === 'netsuite') externalId = await syncToNetSuite(fullOrder);
  else if (integration === 'quickbooks') externalId = await syncToQuickBooks(fullOrder);
  else if (integration === 'bigquery') await writeOrderToBigQuery(fullOrder);
  else if (integration === 'mailchimp') externalId = await syncToMailchimp(context.customer);

  await serviceClient.from('sync_log').insert({
    integration,
    record_type: 'order',
    record_id: context.order.id,
    external_id: externalId,
    status: 'success',
    attempts: 1,
    last_attempt_at: new Date().toISOString(),
  });

  const orderUpdates: Partial<Pick<Order, 'clickup_task_id' | 'netsuite_id' | 'quickbooks_id' | 'bigquery_synced_at'>> = {};
  if (integration === 'clickup' && externalId) orderUpdates.clickup_task_id = externalId;
  if (integration === 'netsuite' && externalId) orderUpdates.netsuite_id = externalId;
  if (integration === 'quickbooks' && externalId) orderUpdates.quickbooks_id = externalId;
  if (integration === 'bigquery') orderUpdates.bigquery_synced_at = new Date().toISOString();

  if (Object.keys(orderUpdates).length) {
    const { error: orderUpdateError } = await serviceClient.from('orders').update(orderUpdates).eq('id', context.order.id);
    if (orderUpdateError) {
      throw new Error(`Order update failed after ${integration} sync: ${orderUpdateError.message}`);
    }
  }

  return { externalId };
}

export async function claimIntegrationJobs(
  serviceClient: SupabaseClient,
  params: { workerId: string; limit: number; staleAfterMinutes?: number }
): Promise<IntegrationJobClaim[]> {
  const { data, error } = await serviceClient.rpc('claim_integration_jobs', {
    p_worker_id: params.workerId,
    p_limit: params.limit,
    p_stale_after_minutes: params.staleAfterMinutes ?? 15,
  });

  if (error) {
    throw new Error(`Failed to claim integration jobs: ${error.message}`);
  }

  return ((data as IntegrationJobClaim[] | null) || []) as IntegrationJobClaim[];
}

export async function claimDueReminders(
  serviceClient: SupabaseClient,
  params: { workerId: string; limit: number; staleAfterMinutes?: number }
): Promise<ReminderClaim[]> {
  const { data, error } = await serviceClient.rpc('claim_due_reminders', {
    p_worker_id: params.workerId,
    p_limit: params.limit,
    p_stale_after_minutes: params.staleAfterMinutes ?? 30,
  });

  if (error) {
    throw new Error(`Failed to claim reminders: ${error.message}`);
  }

  return ((data as ReminderClaim[] | null) || []) as ReminderClaim[];
}

export async function runWithConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<void>
): Promise<PromiseSettledResult<void>[]> {
  const settled: PromiseSettledResult<void>[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;

      try {
        await handler(items[currentIndex], currentIndex);
        settled[currentIndex] = { status: 'fulfilled', value: undefined };
      } catch (reason) {
        settled[currentIndex] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(workers);
  return settled;
}

export async function logIntegrationFailure(
  serviceClient: SupabaseClient,
  integration: string,
  orderId: string,
  attempts: number,
  err: unknown
) {
  const errorMessage = err instanceof Error ? err.message : 'Unknown sync failure';

  await serviceClient.from('sync_log').insert({
    integration,
    record_type: 'order',
    record_id: orderId,
    status: 'failed',
    error_message: errorMessage,
    attempts,
    last_attempt_at: new Date().toISOString(),
  });

  return errorMessage;
}

export function nextRetryTime(attempts: number): string {
  const seconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + seconds * 1000).toISOString();
}
