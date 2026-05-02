-- Create roles enum
CREATE TYPE user_role AS ENUM (
  'user',           -- Webshop customer
  'admin',          -- Full admin access
  'sales_rep',      -- Sales representative
  'warehouse',      -- Warehouse staff
  'support'         -- Customer support
);

-- Drop old constraints and columns from profile
ALTER TABLE profile DROP CONSTRAINT IF EXISTS profile_email_key;
ALTER TABLE profile DROP CONSTRAINT IF EXISTS profile_default_route_format;
ALTER TABLE profile DROP CONSTRAINT IF EXISTS profile_default_route_starts_with_slash;

-- Add new columns to profile (for account data)
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS kind VARCHAR DEFAULT 'individual',  -- individual or company
  ADD COLUMN IF NOT EXISTS display_name VARCHAR,
  ADD COLUMN IF NOT EXISTS legal_name VARCHAR,
  ADD COLUMN IF NOT EXISTS phone VARCHAR,
  ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
  ADD COLUMN IF NOT EXISTS reg_no VARCHAR,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migrate roles to enum
ALTER TABLE profile
  ALTER COLUMN roles DROP DEFAULT,
  ALTER COLUMN roles SET DATA TYPE user_role[] USING (
    CASE
      WHEN roles @> ARRAY['STAFF'] THEN ARRAY['admin']::user_role[]
      WHEN roles @> ARRAY['SALES_REP'] THEN ARRAY['sales_rep']::user_role[]
      WHEN roles @> ARRAY['WAREHOUSE'] THEN ARRAY['warehouse']::user_role[]
      WHEN roles @> ARRAY['SUPPORT'] THEN ARRAY['support']::user_role[]
      ELSE ARRAY['user']::user_role[]
    END
  ),
  ALTER COLUMN roles SET DEFAULT ARRAY['user']::user_role[];

-- Drop old indexes
DROP INDEX IF EXISTS ix_profile_roles_gin;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_profile_roles_gin ON profile USING gin(roles);
CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_is_active ON profile(is_active);
CREATE INDEX IF NOT EXISTS idx_profile_created_at ON profile(created_at);

-- Update full_name to use display_name if available
UPDATE profile SET full_name = display_name WHERE full_name IS NULL AND display_name IS NOT NULL;

-- Enable RLS
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Users can see their own profile
CREATE POLICY profile_select_self ON profile
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy 2: Admins can see all profiles
CREATE POLICY profile_select_admin ON profile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profile p
      WHERE p.user_id = auth.uid() AND 'admin' = ANY(p.roles)
    )
  );

-- RLS Policy 3: Users can update only their own profile (non-role fields)
CREATE POLICY profile_update_self ON profile
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    roles = (SELECT roles FROM profile WHERE user_id = auth.uid())  -- Prevent self-role changes
  );

-- RLS Policy 4: Admins can update any profile
CREATE POLICY profile_update_admin ON profile
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profile p
      WHERE p.user_id = auth.uid() AND 'admin' = ANY(p.roles)
    )
  );

-- RLS Policy 5: Prevent inserting without being admin (for security)
-- Note: Registration should happen via API endpoint with proper validation
CREATE POLICY profile_insert_disabled ON profile
  FOR INSERT WITH CHECK (false);

-- RLS Policy 6: Only admins can delete
CREATE POLICY profile_delete_admin ON profile
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profile p
      WHERE p.user_id = auth.uid() AND 'admin' = ANY(p.roles)
    )
  );

-- Update the updated_at trigger if it exists
DROP TRIGGER IF EXISTS trg_profile_updated_at ON profile;
CREATE TRIGGER trg_profile_updated_at
BEFORE UPDATE ON profile
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Drop the account table if it exists (after backup if needed)
-- Uncomment after verifying data is migrated:
-- DROP TABLE IF EXISTS account CASCADE;

COMMIT;
