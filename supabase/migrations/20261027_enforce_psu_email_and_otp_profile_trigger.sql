-- PSU SportsTrack: Enforce PSU Official Email Domain & Post-Confirmation Profile Trigger
-- Date: 2026-10-27

-- 1. Update guard_user_registration to enforce strict @psu.palawan.edu.ph for self-registration
CREATE OR REPLACE FUNCTION public.guard_user_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lower(role) INTO v_caller_role FROM public.users WHERE id = auth.uid();

  -- If standard user or self-registration (non-admin)
  IF (v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'dev')) THEN
    IF NEW.role IN ('super_admin', 'facilitator', 'dev', 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: Self-registration for elevated roles (%) is strictly forbidden.', NEW.role;
    END IF;

    -- Enforce PSU official domain strictly (no subdomains)
    IF NEW.email IS NOT NULL AND lower(NEW.email) NOT LIKE '%@psu.palawan.edu.ph' THEN
      RAISE EXCEPTION 'Registration restricted: Only official PSU emails ending with @psu.palawan.edu.ph are permitted.';
    END IF;

    NEW.is_verified := false;
    NEW.account_status := 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Trigger on auth.users to automatically create/sync profile when email is confirmed
CREATE OR REPLACE FUNCTION public.handle_auth_user_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_meta jsonb;
  v_role text;
  v_full_name text;
  v_college_id uuid;
  v_employee_id text;
  v_department text;
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
      false,
      'active'
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
      role = COALESCE(public.users.role, EXCLUDED.role),
      college_id = COALESCE(public.users.college_id, EXCLUDED.college_id),
      employee_id = COALESCE(public.users.employee_id, EXCLUDED.employee_id),
      department = COALESCE(public.users.department, EXCLUDED.department);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

DROP TRIGGER IF EXISTS trg_handle_auth_user_confirmed ON auth.users;
CREATE TRIGGER trg_handle_auth_user_confirmed
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_confirmed();
