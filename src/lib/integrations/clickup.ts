import { integrations } from './config';
import type { Customer, Order, OrderItem } from '@/lib/types';

export async function syncToClickUp(order: Order & { customer: Customer; items: OrderItem[] }) {
  if (!integrations.clickup.enabled()) return null;

  const itemLines = order.items
    .map(item => `- ${item.glasses_type.replace(/_/g, ' ')} | ${item.frame_brand} ${item.frame_model} ($${item.line_total})`)
    .join('\n');
  const pricing = order.pricing_summary;

  const body = {
    name: `Order ${order.order_number} | ${order.customer.first_name} ${order.customer.last_name}`,
    description: `Order Type: ${order.order_type}
Customer: ${order.customer.first_name} ${order.customer.last_name}
Email: ${order.customer.email || 'N/A'}
Phone: ${order.customer.phone || 'N/A'}

Items:
${itemLines}

Total Fees: $${pricing?.totalFees ?? order.total}
Bill To: $${pricing?.billTo ?? 0}
OOP: $${pricing?.oop ?? order.total}
Status: ${order.status}`,
    status: 'to do',
    priority: order.order_type === 'program' ? 2 : 3,
    tags: [order.order_type, order.status],
  };

  const res = await fetch(`https://api.clickup.com/api/v2/list/${integrations.clickup.listId()}/task`, {
    method: 'POST',
    headers: {
      Authorization: integrations.clickup.apiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp sync failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.id as string;
}
