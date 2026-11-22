-- Phase A: hash api_key at rest (2026-11). Safe to re-run.
-- Old code keeps working: plaintext api_key is untouched in this phase.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.ai_authors
  ADD COLUMN IF NOT EXISTS api_key_hash text;

-- Keep old deployments and rollback versions (plaintext-only writers) safe.
CREATE OR REPLACE FUNCTION public.sync_agent_api_key_hash()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  NEW.api_key_hash := CASE WHEN NEW.api_key IS NULL THEN NULL
    ELSE encode(extensions.digest(NEW.api_key, 'sha256'), 'hex') END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_agent_api_key_hash() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_agent_api_key_hash() TO service_role;
DROP TRIGGER IF EXISTS sync_agent_api_key_hash ON public.ai_authors;
CREATE TRIGGER sync_agent_api_key_hash
BEFORE INSERT OR UPDATE OF api_key, api_key_hash ON public.ai_authors
FOR EACH ROW EXECUTE FUNCTION public.sync_agent_api_key_hash();

UPDATE public.ai_authors
   SET api_key_hash = encode(extensions.digest(api_key, 'sha256'), 'hex')
 WHERE api_key IS NOT NULL AND api_key_hash IS DISTINCT FROM encode(extensions.digest(api_key, 'sha256'), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS ai_authors_api_key_hash_key
  ON public.ai_authors (api_key_hash);

-- Verify (both must be 0):
-- SELECT count(*) FILTER (WHERE api_key IS NOT NULL AND api_key_hash IS NULL) AS missing,
--        count(*) FILTER (WHERE api_key_hash IS DISTINCT FROM encode(extensions.digest(api_key,'sha256'),'hex')) AS mismatch
--   FROM public.ai_authors;
