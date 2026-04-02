ALTER TABLE orders
ADD COLUMN intake_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN pricing_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN submitted_to_bill_at TIMESTAMPTZ;

ALTER TABLE order_items
ADD COLUMN configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN pricing_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_orders_submitted_to_bill_at ON orders(submitted_to_bill_at);
