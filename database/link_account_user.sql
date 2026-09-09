-- Add user_id to account table to link with Supabase auth users
ALTER TABLE account ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id) WHERE user_id IS NOT NULL;

-- Link existing accounts to profiles by email match
UPDATE account a
SET user_id = p.user_id
FROM profile p
WHERE LOWER(a.email) = LOWER(p.email)
  AND a.user_id IS NULL
  AND p.is_active = true;
