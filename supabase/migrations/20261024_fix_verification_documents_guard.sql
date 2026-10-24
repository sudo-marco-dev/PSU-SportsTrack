-- PSU SportsTrack: Add reviewed_by and reviewed_at to verification_documents and update guard trigger
-- Migration: 20261024_fix_verification_documents_guard.sql

ALTER TABLE public.verification_documents 
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.guard_verification_document()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := 'Pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
