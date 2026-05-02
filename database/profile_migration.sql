-- Create profile table for staff/admin users
CREATE TABLE IF NOT EXISTS profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  roles TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  default_route TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON profile(user_id);
