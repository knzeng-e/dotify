// A fresh queue may omit old nonce history only in a new content-key domain.
// This binds that domain to the reviewed publisher without exposing its secret.
import assert from 'node:assert/strict';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getActiveContentKeyMasterSecret, getContentKeyVaultStatus, type ContentKeyVaultConfigInput } from './keyVault.js';
import { freshContentKeySchema, contentMasterDigest } from './freshContentKeyBinding.js';
export { freshContentKeySchema, contentMasterDigest } from './freshContentKeyBinding.js';
export function assertFreshContentKey(binding: z.infer<typeof freshContentKeySchema> | undefined, vault?: ContentKeyVaultConfigInput) {
  if (!binding) return;
  const status = getContentKeyVaultStatus(vault);
  const secret = getActiveContentKeyMasterSecret(vault);
  assert.ok(status.configured && status.activeVersion === binding.version && secret, 'Fresh publication content-key version is not configured');
  assert.ok(
    timingSafeEqual(Buffer.from(contentMasterDigest(secret), 'hex'), Buffer.from(binding.masterSha256, 'hex')),
    'Fresh publication content key differs from its reviewed binding'
  );
}
