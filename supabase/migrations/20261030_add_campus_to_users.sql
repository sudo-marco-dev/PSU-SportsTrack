-- Add campus column to public.users and update auth trigger
-- Date: 2026-10-30

-- 1. Add campus column to public.users if not present
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS campus text DEFAULT 'PSU Main Campus (Puerto Princesa)';

-- Index on campus for fast collegiate scouting filters
CREATE INDEX IF NOT EXISTS idx_users_campus ON public.users(campus);

-- 2. Update handle_auth_user_confirmed() to record campus from user metadata
CREATE OR REPLACE FUNCTION public.handle_auth_user_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_meta jsonb;
  v_role text;
  v_full_name text;
  v_college_id uuid;
  v_employee_id text;
  v_department text;
  v_campus text;
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
    v_campus := COALESCE(v_meta->>'campus', 'PSU Main Campus (Puerto Princesa)');
    
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
      campus,
      is_verified,
      account_status
    )
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      v_role,
      v_college_id,
      v_employee_id,
      v_department,
      v_campus,
      false,
      'active'
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
      role = COALESCE(public.users.role, EXCLUDED.role),
      college_id = COALESCE(public.users.college_id, EXCLUDED.college_id),
      employee_id = COALESCE(public.users.employee_id, EXCLUDED.employee_id),
      department = COALESCE(public.users.department, EXCLUDED.department),
      campus = COALESCE(public.users.campus, EXCLUDED.campus);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;
