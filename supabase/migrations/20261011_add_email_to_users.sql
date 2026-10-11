-- Migration: 20261011_add_email_to_users.sql
-- Description: Add email column to public.users, backfill from auth.users, and add sync trigger

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;

-- Backfill emails from auth.users
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id AND (u.email IS NULL OR u.email = '');

-- Create or replace trigger to auto-populate email on insert/update from auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    SELECT email INTO NEW.email FROM auth.users WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_email ON public.users;
CREATE TRIGGER trg_sync_user_email
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_email_sync();
