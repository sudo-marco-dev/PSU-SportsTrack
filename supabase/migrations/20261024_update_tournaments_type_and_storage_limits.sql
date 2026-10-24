-- Migration: 20261024_update_tournaments_type_and_storage_limits.sql
-- Description:
-- 1. Updates tournaments_type_check constraint to permit 'Friendly', 'Friendly Games', 'Inter-Collegiate', 'Inter-Collegiate League', 'Faculty and Staff Friendly Games', 'Faculty & Staff Friendly Games', 'Binturungan', 'STRASUC'
-- 2. Sets strict file size limit (5MB) and allowed MIME types on verification_documents bucket to prevent storage overflow.
-- 3. Enables RLS DELETE policy on storage.objects for authenticated users (scoped to user folder) and admins to enable client-side pruning.
-- 4. Purges legacy rogue test files (.msi, .mp4) exceeding storage quotas.

-- 1. Tournaments Type Check Constraint update
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_type_check;

ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_type_check 
  CHECK (type = ANY (ARRAY[
    'Binturungan'::text, 
    'STRASUC'::text, 
    'Faculty and Staff Friendly Games'::text, 
    'Faculty & Staff Friendly Games'::text,
    'Friendly'::text, 
    'Friendly Games'::text,
    'Inter-Collegiate'::text,
    'Inter-Collegiate League'::text
  ]));

-- 2. Storage Bucket limits (5MB = 5242880 bytes, whitelist PDF and standard images)
UPDATE storage.buckets 
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
WHERE id = 'verification_documents';

-- 3. Storage RLS DELETE policy for pruning previous verification files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'storage.objects'::regclass 
      AND polname = 'Allow users and admins to delete verification documents'
  ) THEN
    CREATE POLICY "Allow users and admins to delete verification documents"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'verification_documents'
      AND (
        (storage.foldername(name))[1] = (auth.uid())::text
        OR EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role = ANY (ARRAY['super_admin'::text, 'admin'::text])
        )
      )
    );
  END IF;
END $$;

-- 4. Purge legacy test files from storage
BEGIN;
SET LOCAL storage.allow_delete_query = 'true';
DELETE FROM storage.objects 
WHERE bucket_id = 'verification_documents' 
  AND (name LIKE '%.msi' OR name LIKE '%.mp4');
COMMIT;
