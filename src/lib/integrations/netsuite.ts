import { integrations } from './config';
import type { Order, Customer } from '@/lib/types';

// NetSuite TBA (Token-Based Auth) integration
// This is a plug-and-play stub — fill in credentials to enable
export async function syncToNetSuite(order: Order & { customer: Customer }) {
  if (!integrations.netsuite.enabled()) return null;

  const accountId = process.env.NETSUITE_ACCOUNT_ID!;
  const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;

  // Create Sales Order in NetSuite
  const payload = {
    entity: { externalId: order.customer_id },
    tranDate: new Date(order.created_at).toISOString().split('T')[0],
    otherRefNum: order.order_number,
    memo: `OSSO Hub Order ${order.order_number}`,
    item: {
      items: [{
        amount: order.total,
        description: `Order ${order.order_number} — ${order.customer.first_name} ${order.customer.last_name}`,
        quantity: 1,
      }],
    },
  };

  // Using OAuth 1.0 TBA — in production use a proper OAuth library
  const res = await fetch(`${baseUrl}/salesOrder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': buildNetSuiteOAuth(accountId),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NetSuite sync failed: ${res.status} ${text}`);
  }

  const location = res.headers.get('Location') || '';
  const id = location.split('/').pop();
  return id || null;
}

function buildNetSuiteOAuth(accountId: string): string {
  // Placeholder — requires proper OAuth 1.0 signature generation
  // In production, use a library like oauth-1.0a
  const consumerKey = process.env.NETSUITE_CONSUMER_KEY!;
  const tokenId = process.env.NETSUITE_TOKEN_ID!;
  const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
  const timestamp = Math.floor(Date.now() / 1000);

  return `OAuth realm="${accountId}", oauth_consumer_key="${consumerKey}", oauth_token="${tokenId}", oauth_signature_method="HMAC-SHA256", oauth_timestamp="${timestamp}", oauth_nonce="${nonce}", oauth_version="1.0", oauth_signature="PLACEHOLDER"`;
}
