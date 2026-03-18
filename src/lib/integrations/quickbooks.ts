import { integrations } from './config';
import type { Order, Customer } from '@/lib/types';

// QuickBooks Online integration — plug-and-play
export async function syncToQuickBooks(order: Order & { customer: Customer }) {
  if (!integrations.quickbooks.enabled()) return null;

  const env = process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? '' : 'sandbox-';
  const baseUrl = `https://${env}quickbooks.api.intuit.com/v3/company/${process.env.QUICKBOOKS_REALM_ID}`;

  const accessToken = await getQBAccessToken();

  // Create Invoice
  const payload = {
    Line: [{
      Amount: order.total,
      DetailType: 'SalesItemLineDetail',
      Description: `OSSO Order ${order.order_number}`,
      SalesItemLineDetail: {
        Qty: 1,
        UnitPrice: order.total,
      },
    }],
    CustomerRef: {
      name: `${order.customer.first_name} ${order.customer.last_name}`,
    },
    DocNumber: order.order_number,
    CustomerMemo: { value: `Order ${order.order_number}` },
  };

  const res = await fetch(`${baseUrl}/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickBooks sync failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.Invoice?.Id || null;
}

async function getQBAccessToken(): Promise<string> {
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${process.env.QUICKBOOKS_REFRESH_TOKEN}`,
  });

  if (!res.ok) throw new Error('QuickBooks token refresh failed');
  const data = await res.json();
  return data.access_token;
}
