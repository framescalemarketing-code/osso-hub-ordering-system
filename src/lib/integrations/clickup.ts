import { integrations } from './config';
import type { Order, Customer, OrderItem } from '@/lib/types';

export async function syncToClickUp(order: Order & { customer: Customer; items: OrderItem[] }) {
  if (!integrations.clickup.enabled()) return null;

  const itemLines = order.items.map(i =>
    `• ${i.glasses_type.replace(/_/g, ' ')} — ${i.frame_brand} ${i.frame_model} ($${i.line_total})`
  ).join('\n');

  const body = {
    name: `Order ${order.order_number} — ${order.customer.first_name} ${order.customer.last_name}`,
    description: `Order Type: ${order.order_type}\nCustomer: ${order.customer.first_name} ${order.customer.last_name}\nEmail: ${order.customer.email || 'N/A'}\nPhone: ${order.customer.phone || 'N/A'}\n\nItems:\n${itemLines}\n\nTotal: $${order.total}\nStatus: ${order.status}`,
    status: 'to do',
    priority: order.order_type === 'program' ? 2 : 3,
    tags: [order.order_type, order.status],
  };

  const res = await fetch(`https://api.clickup.com/api/v2/list/${integrations.clickup.listId()}/task`, {
    method: 'POST',
    headers: {
      'Authorization': integrations.clickup.apiKey(),
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
