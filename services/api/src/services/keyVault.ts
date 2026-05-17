import { config } from '../config.js';

export type ContentKeyStatus = {
  configured: boolean;
  contentHash: string;
};

export function getContentKeyStatus(contentHash: string): ContentKeyStatus {
  return {
    configured: Boolean(config.CONTENT_KEY_MASTER_SECRET),
    contentHash,
  };
}
