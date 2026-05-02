-- Fix: Update customer_cart and customer_wishlist to properly reference auth.users

-- Drop existing constraints if they reference the wrong table
ALTER TABLE IF EXISTS customer_cart
DROP CONSTRAINT IF EXISTS customer_cart_customer_id_fkey CASCADE;

ALTER TABLE IF EXISTS customer_wishlist
DROP CONSTRAINT IF EXISTS customer_wishlist_customer_id_fkey CASCADE;

-- Re-add constraints pointing to auth.users
ALTER TABLE customer_cart
ADD CONSTRAINT customer_cart_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE customer_wishlist
ADD CONSTRAINT customer_wishlist_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Verify the tables exist and have the right structure
-- customer_cart should have: id, customer_id, product_id, quantity, added_at, updated_at
-- customer_wishlist should have: id, customer_id, product_id, added_at

-- If tables don't exist, create them
CREATE TABLE IF NOT EXISTS customer_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  added_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS customer_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_cart_customer_id
  ON customer_cart(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_cart_product_id
  ON customer_cart(product_id);

CREATE INDEX IF NOT EXISTS idx_customer_cart_updated_at
  ON customer_cart(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_wishlist_customer_id
  ON customer_wishlist(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_wishlist_product_id
  ON customer_wishlist(product_id);

-- Create trigger for customer_cart updated_at
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

-- Grant permissions
GRANT SELECT, INSERT, DELETE, UPDATE ON customer_cart TO authenticated;
GRANT SELECT, INSERT, DELETE ON customer_wishlist TO authenticated;
