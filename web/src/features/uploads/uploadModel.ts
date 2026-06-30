// Uploads - pure helpers for the artist asset-upload flow.
//
// The upload handlers in App.tsx are side-effect heavy (hashing, object URLs,
// IPFS uploads); this module holds the pure pieces: the default title rule, the
// draft TrackInfo shape, and the human-readable upload-status transitions.

import { localAudioRef, priceDotForAccessMode } from '../catalog/trackModel';
import { stripExtension } from '../../utils/format';
import type { AccessMode, PersonhoodLevel, TrackInfo } from '../../types';

/** Placeholder title for a fresh release before the artist names it. */
export const DEFAULT_TRACK_TITLE = 'Untitled jam';

/**
 * Title to use after picking an audio file: derive from the filename only while
 * the title is still the untouched placeholder, otherwise keep the artist's text.
 */
export function nextTitleFromUpload(currentTitle: string, fileName: string): string {
  return currentTitle.trim() === DEFAULT_TRACK_TITLE ? stripExtension(fileName) : currentTitle;
}

export type DraftTrackInput = {
  title: string;
  artist: string;
  hash: `0x${string}`;
  imageRef: string;
  description: string;
  accessMode: AccessMode;
  priceDot: string;
  personhoodLevel: PersonhoodLevel;
};

/** Build the TrackInfo for a freshly uploaded, not-yet-registered draft track. */
export function buildDraftTrackInfo(input: DraftTrackInput): TrackInfo {
  return {
    title: input.title.trim() || 'Untitled',
    artist: input.artist.trim() || 'Unknown artist',
    hash: input.hash,
    bulletinRef: '',
    duration: 0,
    updatedAt: Date.now(),
    imageRef: input.imageRef,
    audioRef: localAudioRef(input.hash),
    description: input.description,
    accessMode: input.accessMode,
    priceDot: priceDotForAccessMode(input.accessMode, input.priceDot),
    personhoodLevel: input.personhoodLevel
  };
}

export type UploadAssetKind = 'audio' | 'cover';
export type UploadPhase = 'preparing' | 'uploading' | 'uploaded' | 'failed';

const UPLOAD_STATUS: Record<UploadAssetKind, Record<UploadPhase, string>> = {
  audio: {
    preparing: 'Hashing audio',
    uploading: 'Audio ready - uploading to IPFS...',
    uploaded: 'Audio ready - protected and uploaded to IPFS',
    failed: 'Audio ready (IPFS upload failed - will retry on register)'
  },
  cover: {
    preparing: 'Preparing cover image',
    uploading: 'Cover ready - uploading to IPFS...',
    uploaded: 'Cover ready - uploaded to IPFS',
    failed: 'Cover ready (IPFS upload failed - will retry on register)'
  }
};

/** Human-readable status for an asset upload phase (drives the rights-status line). */
export function uploadStatusMessage(kind: UploadAssetKind, phase: UploadPhase): string {
  return UPLOAD_STATUS[kind][phase];
}
