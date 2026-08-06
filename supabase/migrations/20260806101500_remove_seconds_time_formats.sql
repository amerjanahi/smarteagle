-- Time display is limited to hour and minute formats only.
UPDATE public.company_settings
SET time_format = '24h'
WHERE time_format IN ('12h-seconds', '24h-seconds');

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_time_format_check;

ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_time_format_check
    CHECK (time_format IN ('12h', '24h'));
