import { integrations } from './config';
import type { Dataset } from '@google-cloud/bigquery';
import type { Order, Customer, OrderItem } from '@/lib/types';

export async function writeOrderToBigQuery(order: Order & { customer: Customer; items: OrderItem[] }) {
  if (!integrations.bigquery.enabled()) return;

  // Dynamic import to avoid errors when not configured
  const { BigQuery } = await import('@google-cloud/bigquery');
  const bq = new BigQuery({ projectId: integrations.bigquery.projectId() });
  const dataset = bq.dataset(integrations.bigquery.dataset());

  // Ensure tables exist
  await ensureTables(dataset);

  // Write order
  const ordersTable = dataset.table('orders');
  await ordersTable.insert([{
    order_id: order.id,
    order_number: order.order_number,
    order_type: order.order_type,
    status: order.status,
    customer_id: order.customer_id,
    customer_name: `${order.customer.first_name} ${order.customer.last_name}`,
    customer_email: order.customer.email,
    employee_id: order.employee_id,
    program_id: order.program_id,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    created_at: order.created_at,
  }]);

  // Write line items
  const itemsTable = dataset.table('order_items');
  const itemRows = order.items.map(item => ({
    item_id: item.id,
    order_id: order.id,
    order_number: order.order_number,
    glasses_type: item.glasses_type,
    frame_brand: item.frame_brand,
    frame_model: item.frame_model,
    frame_price: item.frame_price,
    lens_type: item.lens_type,
    lens_material: item.lens_material,
    lens_price: item.lens_price,
    quantity: item.quantity,
    line_total: item.line_total,
    created_at: item.created_at,
  }));
  if (itemRows.length) await itemsTable.insert(itemRows);
}

async function ensureTables(dataset: Dataset) {
  const ordersSchema = [
    { name: 'order_id', type: 'STRING' },
    { name: 'order_number', type: 'STRING' },
    { name: 'order_type', type: 'STRING' },
    { name: 'status', type: 'STRING' },
    { name: 'customer_id', type: 'STRING' },
    { name: 'customer_name', type: 'STRING' },
    { name: 'customer_email', type: 'STRING' },
    { name: 'employee_id', type: 'STRING' },
    { name: 'program_id', type: 'STRING' },
    { name: 'subtotal', type: 'NUMERIC' },
    { name: 'tax', type: 'NUMERIC' },
    { name: 'discount', type: 'NUMERIC' },
    { name: 'total', type: 'NUMERIC' },
    { name: 'created_at', type: 'TIMESTAMP' },
  ];

  const itemsSchema = [
    { name: 'item_id', type: 'STRING' },
    { name: 'order_id', type: 'STRING' },
    { name: 'order_number', type: 'STRING' },
    { name: 'glasses_type', type: 'STRING' },
    { name: 'frame_brand', type: 'STRING' },
    { name: 'frame_model', type: 'STRING' },
    { name: 'frame_price', type: 'NUMERIC' },
    { name: 'lens_type', type: 'STRING' },
    { name: 'lens_material', type: 'STRING' },
    { name: 'lens_price', type: 'NUMERIC' },
    { name: 'quantity', type: 'INTEGER' },
    { name: 'line_total', type: 'NUMERIC' },
    { name: 'created_at', type: 'TIMESTAMP' },
  ];

  try {
    const [tables] = await dataset.getTables();
    const tableNames = tables.map(t => t.id);
    if (!tableNames.includes('orders')) {
      await dataset.createTable('orders', { schema: ordersSchema });
    }
    if (!tableNames.includes('order_items')) {
      await dataset.createTable('order_items', { schema: itemsSchema });
    }
  } catch {
    // Tables may already exist
  }
}
