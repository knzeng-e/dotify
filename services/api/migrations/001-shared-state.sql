-- Apply once using the operator role. Application startup never creates state.
CREATE TABLE IF NOT EXISTS dotify_state_identity (
  namespace text PRIMARY KEY,
  identity jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS dotify_state_nonces (
  namespace text NOT NULL REFERENCES dotify_state_identity(namespace),
  nonce text NOT NULL,
  address text NOT NULL,
  chain_id bigint NOT NULL,
  expires_at bigint NOT NULL,
  used boolean NOT NULL DEFAULT false,
  PRIMARY KEY (namespace, nonce)
);
CREATE INDEX IF NOT EXISTS dotify_nonce_expiry ON dotify_state_nonces(namespace, expires_at);
CREATE TABLE IF NOT EXISTS dotify_state_revocations (
  namespace text NOT NULL REFERENCES dotify_state_identity(namespace),
  jti text NOT NULL,
  expires_at bigint NOT NULL,
  PRIMARY KEY(namespace, jti)
);
CREATE INDEX IF NOT EXISTS dotify_revocation_expiry ON dotify_state_revocations(namespace, expires_at);
CREATE TABLE IF NOT EXISTS dotify_state_documents (
  namespace text NOT NULL REFERENCES dotify_state_identity(namespace),
  name text NOT NULL,
  value jsonb NOT NULL,
  PRIMARY KEY(namespace, name),
  CHECK (octet_length(value::text) <= 16777216)
);
