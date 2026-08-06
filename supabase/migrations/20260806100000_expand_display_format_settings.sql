-- Expand presentation preferences only. Existing dates, timestamps, and
-- financial values remain unchanged; this controls how values are displayed.
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS decimal_places integer NOT NULL DEFAULT 2
    CHECK (decimal_places BETWEEN 0 AND 4);

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_date_format_check,
  DROP CONSTRAINT IF EXISTS company_settings_time_format_check,
  DROP CONSTRAINT IF EXISTS company_settings_number_format_check;

ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_date_format_check
    CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY', 'DD.MM.YYYY', 'YYYY/MM/DD')),
  ADD CONSTRAINT company_settings_time_format_check
    CHECK (time_format IN ('12h', '24h', '12h-seconds', '24h-seconds')),
  ADD CONSTRAINT company_settings_number_format_check
    CHECK (number_format IN ('comma-dot', 'dot-comma', 'space-dot', 'space-comma', 'apostrophe-dot', 'none-dot'));
