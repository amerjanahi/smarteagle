
-- Booking purpose enum
DO $$ BEGIN
  CREATE TYPE public.booking_purpose AS ENUM ('personal','commercial','event','wedding');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend booking_status: add confirmed and paid
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'paid';

-- Amenities: pricing + approval flags
ALTER TABLE public.amenities
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS portal_bookable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Amenity bookings: purpose, pricing breakdown, extras
ALTER TABLE public.amenity_bookings
  ADD COLUMN IF NOT EXISTS purpose public.booking_purpose NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS hours numeric(8,2),
  ADD COLUMN IF NOT EXISTS base_amount numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extras_amount numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_status text;
