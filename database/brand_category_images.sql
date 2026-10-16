-- Logo for brands and image for categories (paths inside the product-images bucket).
ALTER TABLE brand    ADD COLUMN IF NOT EXISTS logo_path  text;
ALTER TABLE category ADD COLUMN IF NOT EXISTS image_path text;
