-- Create roles enum
CREATE TYPE user_role AS ENUM (
  'user',           -- Webshop customer
  'admin',          -- Full admin access
  'sales_rep',      -- Sales representative
  'warehouse',      -- Warehouse staff
  'support'         -- Customer support
);

-- Migrate existing profile table to use the enum and change default
ALTER TABLE profile
  ALTER COLUMN roles DROP DEFAULT,
  ALTER COLUMN roles SET DATA TYPE user_role[] USING (roles::user_role[]),
  ALTER COLUMN roles SET DEFAULT ARRAY['user']::user_role[];

-- Drop and recreate the index after data type change
DROP INDEX IF EXISTS ix_profile_roles_gin;
CREATE INDEX ix_profile_roles_gin ON profile USING gin(roles);

-- Update any existing STAFF roles to admin
UPDATE profile SET roles = ARRAY['admin']::user_role[] WHERE roles @> ARRAY['STAFF'];
