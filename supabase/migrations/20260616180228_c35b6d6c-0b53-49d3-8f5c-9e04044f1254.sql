ALTER TABLE public.units ADD COLUMN IF NOT EXISTS handover_date date;
UPDATE public.units SET handover_date = CURRENT_DATE - INTERVAL '30 days' WHERE handover_date IS NULL AND is_occupied = true;
UPDATE public.units SET handover_date = CURRENT_DATE - INTERVAL '10 days' WHERE handover_date IS NULL AND unit_number IN (SELECT unit_number FROM public.units LIMIT 1);