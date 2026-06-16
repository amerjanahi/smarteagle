
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS land_area_sqm numeric(10,2),
  ADD COLUMN IF NOT EXISTS built_up_area_sqm numeric(10,2);

UPDATE public.units
SET built_up_area_sqm = COALESCE(built_up_area_sqm, area_sqm, 100),
    land_area_sqm = COALESCE(land_area_sqm, ROUND((COALESCE(area_sqm, 100) * 1.4)::numeric, 2))
WHERE built_up_area_sqm IS NULL OR land_area_sqm IS NULL;
