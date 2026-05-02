-- Create extended profile table for all users
CREATE TABLE IF NOT EXISTS profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  roles JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  default_route TEXT,
  kind TEXT DEFAULT 'individual',
  display_name TEXT,
  legal_name TEXT,
  phone TEXT,
  tax_id TEXT,
  reg_no TEXT,
  notes TEXT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON profile(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email);
CREATE INDEX IF NOT EXISTS idx_profile_is_active ON profile(is_active);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_update_timestamp ON profile;
CREATE TRIGGER profile_update_timestamp
BEFORE UPDATE ON profile
FOR EACH ROW
EXECUTE FUNCTION update_profile_updated_at();
