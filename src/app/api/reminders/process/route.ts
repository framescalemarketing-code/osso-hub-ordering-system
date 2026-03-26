import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { integrations, notifications } from '@/lib/integrations/config';
import { claimDueReminders, runWithConcurrencyLimit } from '@/lib/integrations/job-runner';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.JOB_RUNNER_SECRET;
  if (!secret) return false;

  const headerSecret = request.headers.get('x-job-secret');
  if (headerSecret && headerSecret === secret) return true;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

const CLAIM_BATCH_SIZE = 50;
const MAX_REMINDERS_PER_RUN = 200;
const CONCURRENCY = 5;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized job runner request' }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!integrations.resend.enabled()) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
  }
  if (!notifications.enabled()) {
    return NextResponse.json({
      processed: 0,
      claimed: 0,
      failed: 0,
      skipped: true,
      message: notifications.pausedReason(),
    });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(integrations.resend.apiKey());
  const workerId = `reminder-runner:${process.pid}:${Date.now()}`;
  let sent = 0;
  let claimed = 0;
  let failed = 0;

  while (claimed < MAX_REMINDERS_PER_RUN) {
    const remaining = MAX_REMINDERS_PER_RUN - claimed;
    const batchSize = Math.min(CLAIM_BATCH_SIZE, remaining);
    const reminders = await claimDueReminders(supabase, {
      workerId,
      limit: batchSize,
      staleAfterMinutes: 30,
    });

    if (!reminders.length) {
      break;
    }

    claimed += reminders.length;

    await runWithConcurrencyLimit(reminders, CONCURRENCY, async (reminder) => {
      const email = reminder.customer_email;
      if (!email) {
        await supabase
          .from('reminders')
          .update({
            status: 'pending',
            processing_at: null,
            processing_by: null,
            last_error: 'Missing customer email',
          })
          .eq('id', reminder.id);
        failed++;
        return;
      }

      try {
        await resend.emails.send({
          from: integrations.resend.from(),
          to: email,
          subject: reminder.subject,
          html: `
            <p>Hi ${reminder.customer_first_name || 'there'},</p>
            <p>${reminder.body || reminder.subject}</p>
            ${reminder.order_number ? `<p>Reference: Order ${reminder.order_number}</p>` : ''}
            <p style="color:#999;font-size:12px">OSSO - On-Sight Safety Optics</p>
          `,
        });

        await supabase
          .from('reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            processing_at: null,
            processing_by: null,
            last_error: null,
          })
          .eq('id', reminder.id);

        sent++;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to send reminder';
        await supabase
          .from('reminders')
          .update({
            status: 'pending',
            processing_at: null,
            processing_by: null,
            last_error: message,
          })
          .eq('id', reminder.id);
        failed++;
      }
    });

    if (reminders.length < batchSize) {
      break;
    }
  }

  return NextResponse.json({ processed: sent, claimed, failed });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
