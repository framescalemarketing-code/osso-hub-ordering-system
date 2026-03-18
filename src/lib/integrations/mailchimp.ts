import { integrations } from './config';
import type { Customer } from '@/lib/types';

export async function syncToMailchimp(customer: Customer) {
  if (!integrations.mailchimp.enabled()) return null;
  if (!customer.marketing_consent || !customer.email) return null;

  const server = integrations.mailchimp.server();
  const listId = integrations.mailchimp.listId();
  const apiKey = integrations.mailchimp.apiKey();

  const payload = {
    email_address: customer.email,
    status: 'subscribed',
    merge_fields: {
      FNAME: customer.first_name,
      LNAME: customer.last_name,
      PHONE: customer.phone || '',
    },
    tags: ['osso-hub', 'customer'],
  };

  const res = await fetch(`https://${server}.api.mailchimp.com/3.0/lists/${listId}/members`, {
    method: 'POST',
    headers: {
      'Authorization': `apikey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // 200 or 400 (already exists) are both fine
  if (!res.ok && res.status !== 400) {
    const text = await res.text();
    throw new Error(`Mailchimp sync failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.id || null;
}
