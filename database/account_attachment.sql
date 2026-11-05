-- Files (e.g. equipment nameplate photos) attached to a customer account.
-- Files live in the private Supabase Storage bucket "account-attachments"
-- (create it in Supabase: Storage > New bucket > name "account-attachments", Public OFF).
CREATE TABLE IF NOT EXISTS account_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicle(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'nameplate',
  storage_path text NOT NULL,
  file_name text,
  note text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_attachment_account_idx
  ON account_attachment (account_id, created_at DESC);
