-- Migration: Add terms_accepted_at to public.users & track in confirmation trigger
-- Mandatorily records when user agreed to Terms & Conditions and Privacy Policy.

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone;

-- Update trigger function to record terms_accepted_at upon email confirmation
CREATE OR REPLACE FUNCTION public.handle_auth_user_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_meta jsonb;
  v_role text;
  v_full_name text;
  v_college_id uuid;
  v_employee_id text;
  v_department text;
  v_terms_accepted_at timestamp with time zone;
BEGIN
  -- Only execute when email becomes confirmed (email_confirmed_at is set)
  IF NEW.email_confirmed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL) THEN
    -- Enforce PSU domain for self-registered users (skip check for pre-existing dev/admin accounts)
    IF lower(NEW.email) NOT LIKE '%@psu.palawan.edu.ph' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE email = NEW.email AND lower(role) IN ('super_admin', 'admin', 'dev')
      ) THEN
        RETURN NEW;
      END IF;
    END IF;

    v_meta := NEW.raw_user_meta_data;
    v_role := COALESCE(v_meta->>'role', 'player_student');
    IF v_role IN ('super_admin', 'facilitator', 'dev', 'admin') THEN
      v_role := 'player_student';
    END IF;

    v_full_name := COALESCE(v_meta->>'full_name', NEW.email);
    v_employee_id := v_meta->>'employee_id';
    v_department := v_meta->>'department';
    
    IF v_meta->>'terms_accepted_at' IS NOT NULL AND v_meta->>'terms_accepted_at' <> '' THEN
      BEGIN
        v_terms_accepted_at := (v_meta->>'terms_accepted_at')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        v_terms_accepted_at := now();
      END;
    ELSE
      v_terms_accepted_at := now();
    END IF;

    IF v_meta->>'college_id' IS NOT NULL AND v_meta->>'college_id' <> '' THEN
      BEGIN
        v_college_id := (v_meta->>'college_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_college_id := NULL;
      END;
    ELSE
      v_college_id := NULL;
    END IF;

    INSERT INTO public.users (
      id,
      email,
      full_name,
      role,
      college_id,
      employee_id,
      department,
      is_verified,
      account_status,
      terms_accepted_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      v_role,
      v_college_id,
      v_employee_id,
      v_department,
      false,
      'active',
      v_terms_accepted_at
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
      role = COALESCE(public.users.role, EXCLUDED.role),
      college_id = COALESCE(public.users.college_id, EXCLUDED.college_id),
      employee_id = COALESCE(public.users.employee_id, EXCLUDED.employee_id),
      department = COALESCE(public.users.department, EXCLUDED.department),
      terms_accepted_at = COALESCE(public.users.terms_accepted_at, EXCLUDED.terms_accepted_at);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;
