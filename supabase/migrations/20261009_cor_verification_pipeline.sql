-- 1. Add academic and student profile columns to public.users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS student_number text,
ADD COLUMN IF NOT EXISTS program text,
ADD COLUMN IF NOT EXISTS year_level text,
ADD COLUMN IF NOT EXISTS age integer;

-- 2. Enhance public.verification_documents with confidence scoring & age
ALTER TABLE public.verification_documents
ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS extracted_age integer;

-- 3. Ensure proper index for pending queries
CREATE INDEX IF NOT EXISTS idx_verification_documents_user_status 
ON public.verification_documents(user_id, status);
