-- Community-wide display preferences. These change presentation only; stored
-- dates, timestamps, and financial values remain unchanged.
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'DD/MM/YYYY'
    CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  ADD COLUMN IF NOT EXISTS time_format text NOT NULL DEFAULT '24h'
    CHECK (time_format IN ('12h', '24h')),
  ADD COLUMN IF NOT EXISTS number_format text NOT NULL DEFAULT 'comma-dot'
    CHECK (number_format IN ('comma-dot', 'dot-comma', 'space-dot'));
