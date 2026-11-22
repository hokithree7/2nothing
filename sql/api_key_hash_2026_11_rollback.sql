-- Rollback Phase A (only before Phase D drops plaintext api_key).
DROP TRIGGER IF EXISTS sync_agent_api_key_hash ON public.ai_authors;
DROP FUNCTION IF EXISTS public.sync_agent_api_key_hash();
DROP INDEX IF EXISTS public.ai_authors_api_key_hash_key;
ALTER TABLE public.ai_authors DROP COLUMN IF EXISTS api_key_hash;
