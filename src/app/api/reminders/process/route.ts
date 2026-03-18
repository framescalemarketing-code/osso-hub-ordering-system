import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { integrations } from '@/lib/integrations/config';

// Cron endpoint — process pending reminders
// Call via Supabase Edge Functions cron or external cron service
export async function POST() {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*, customer:customers(first_name, last_name, email, phone), order:orders(order_number)')
    .eq('status', 'pending')
    .lte('due_at', now)
    .limit(50);

  if (!reminders?.length) {
    return NextResponse.json({ processed: 0 });
  }

  if (!integrations.resend.enabled()) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(integrations.resend.apiKey());
  let sent = 0;

  for (const reminder of reminders) {
    const email = reminder.customer?.email;
    if (!email) continue;

    try {
      await resend.emails.send({
        from: integrations.resend.from(),
        to: email,
        subject: reminder.subject,
        html: `
          <p>Hi ${reminder.customer.first_name},</p>
          <p>${reminder.body || reminder.subject}</p>
          ${reminder.order ? `<p>Reference: Order ${reminder.order.order_number}</p>` : ''}
          <p style="color:#999;font-size:12px">OSSO — On-Sight Safety Optics</p>
        `,
      });

      await supabase.from('reminders').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', reminder.id);

      sent++;
    } catch {
      // Will retry next cron run
    }
  }

  return NextResponse.json({ processed: sent, total: reminders.length });
}
