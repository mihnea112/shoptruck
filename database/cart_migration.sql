-- Customer Cart Table Migration
-- Stores shopping cart items for authenticated customers

CREATE TABLE IF NOT EXISTS customer_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  added_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_cart_customer_id
  ON customer_cart(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_cart_product_id
  ON customer_cart(product_id);

CREATE INDEX IF NOT EXISTS idx_customer_cart_updated_at
  ON customer_cart(updated_at DESC);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_cart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_customer_cart_updated_at ON customer_cart;
CREATE TRIGGER trigger_customer_cart_updated_at
  BEFORE UPDATE ON customer_cart
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_cart_updated_at();
