-- Migration: Create customer_wishlist table for favorites/wishlist functionality

-- Create customer_wishlist table
CREATE TABLE IF NOT EXISTS customer_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_wishlist_customer_id
  ON customer_wishlist(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_wishlist_product_id
  ON customer_wishlist(product_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON customer_wishlist TO authenticated;
GRANT SELECT, INSERT, DELETE ON customer_wishlist TO anon;
