-- Drop the over-permissive update policy that allowed document owners to update rows
DROP POLICY IF EXISTS "Allow document updates by owner or admin" ON public.verification_documents;

-- Create robust BEFORE UPDATE guard trigger on verification_documents
CREATE OR REPLACE FUNCTION public.guard_verification_document_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- If status or reviewer attribution is being modified
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN
    IF auth.uid() IS NOT NULL THEN
      SELECT lower(role) INTO v_caller_role FROM public.users WHERE id = auth.uid();
      IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'dev') THEN
        RAISE EXCEPTION 'Unauthorized: Only sports administrators may alter document verification status or review attribution.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_verification_update ON public.verification_documents;
CREATE TRIGGER trg_guard_verification_update
  BEFORE UPDATE ON public.verification_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_verification_document_update();
