-- ============================================================
-- Merge profile table into account
-- After this: account is the single source of truth
-- ============================================================

-- 1. Add missing columns to account
ALTER TABLE account ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE account ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE account ADD COLUMN IF NOT EXISTS default_route VARCHAR;
ALTER TABLE account ADD COLUMN IF NOT EXISTS full_name VARCHAR;

-- 2. Migrate profile data into account
-- For profiles that already have a linked account row (by user_id match)
UPDATE account a SET
  roles = COALESCE(p.roles::TEXT[], a.roles),
  is_active = COALESCE(p.is_active, a.is_active),
  default_route = COALESCE(p.default_route, a.default_route),
  full_name = COALESCE(p.full_name, a.full_name),
  display_name = COALESCE(a.display_name, p.display_name, p.full_name),
  email = COALESCE(a.email, p.email),
  phone = COALESCE(a.phone, p.phone),
  tax_id = COALESCE(a.tax_id, p.tax_id),
  reg_no = COALESCE(a.reg_no, p.reg_no),
  legal_name = COALESCE(a.legal_name, p.legal_name),
  notes = COALESCE(a.notes, p.notes)
FROM profile p
WHERE a.user_id = p.user_id;

-- 3. For profiles WITHOUT a matching account row, create one
INSERT INTO account (user_id, kind, display_name, legal_name, full_name, email, phone, tax_id, reg_no, notes, roles, is_active, default_route)
SELECT
  p.user_id,
  UPPER(COALESCE(p.kind, 'individual')),
  COALESCE(p.display_name, p.full_name, p.email),
  p.legal_name,
  p.full_name,
  p.email,
  p.phone,
  p.tax_id,
  p.reg_no,
  p.notes,
  COALESCE(p.roles::TEXT[], ARRAY[]::TEXT[]),
  COALESCE(p.is_active, true),
  p.default_route
FROM profile p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM account a WHERE a.user_id = p.user_id);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_account_email ON account(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_account_roles_gin ON account USING gin(roles);
CREATE INDEX IF NOT EXISTS idx_account_is_active ON account(is_active);

-- 5. Rename old profile table (keep as backup, don't drop yet)
ALTER TABLE IF EXISTS profile RENAME TO profile_backup;

-- 6. Create a view named "profile" so existing JOINs keep working
CREATE OR REPLACE VIEW profile AS
SELECT
  user_id,
  roles,
  is_active,
  default_route,
  full_name,
  display_name,
  legal_name,
  email,
  phone,
  tax_id,
  reg_no,
  notes,
  kind,
  created_at
FROM account
WHERE user_id IS NOT NULL;
