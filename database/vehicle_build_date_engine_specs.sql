ALTER TABLE vehicle
  ADD COLUMN IF NOT EXISTS build_date date,
  ADD COLUMN IF NOT EXISTS engine_capacity integer,
  ADD COLUMN IF NOT EXISTS engine_power_kw integer;

UPDATE vehicle SET build_date = make_date(year, 1, 1) WHERE build_date IS NULL AND year IS NOT NULL;
