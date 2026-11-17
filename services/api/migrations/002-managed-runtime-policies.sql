-- Optional Fly MPG activation, executed transactionally by the operator only.
-- Requires the dedicated dotify_runtime role and namespace 'dotify'.
-- Ordinary PostgreSQL deployments can use the narrower grants in the runbook.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'dotify_runtime'
      AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb
  ) OR pg_has_role('dotify_runtime', 'schema_admin', 'MEMBER')
    OR has_schema_privilege('dotify_runtime', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Runtime must not have administrative or schema-creation authority';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN (
      'dotify_state_identity', 'dotify_state_nonces',
      'dotify_state_revocations', 'dotify_state_documents'
    ) AND (pg_has_role('dotify_runtime', c.relowner, 'MEMBER')
      OR has_table_privilege('dotify_runtime', c.oid, 'TRUNCATE'))
  ) THEN
    RAISE EXCEPTION 'Runtime must not own, administer, or truncate state tables';
  END IF;
END $$;

-- Runtime is the managed writer role, with no DDL, superuser or BYPASSRLS.
-- Keep ownership with schema_admin. Dedicated Dotify database only.
ALTER TABLE dotify_state_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_identity_read ON dotify_state_identity
  FOR SELECT TO dotify_runtime USING (namespace = 'dotify');
-- No runtime identity INSERT/UPDATE/DELETE policy: default deny.
ALTER TABLE dotify_state_nonces ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_namespace ON dotify_state_nonces TO dotify_runtime
  USING (namespace = 'dotify') WITH CHECK (namespace = 'dotify');
ALTER TABLE dotify_state_revocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_namespace ON dotify_state_revocations TO dotify_runtime
  USING (namespace = 'dotify') WITH CHECK (namespace = 'dotify');
ALTER TABLE dotify_state_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_namespace ON dotify_state_documents TO dotify_runtime
  USING (namespace = 'dotify') WITH CHECK (namespace = 'dotify');
