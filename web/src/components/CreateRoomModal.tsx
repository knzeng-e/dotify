// ── Create / share a room ─────────────────────────────────────────────────────
// "As easy as sharing a link." A thin, honest wrapper over the existing
// createSession flow: pick what is playing, name yourself, open the room. The
// shareable link is shown as pending until the server assigns a room code (no
// fabricated URL); the room header then exposes the real Copy link.

import { useState } from 'react';
import { Dialog } from './Dialog';
import type { CatalogTrack } from '../shared/types';

function SvgBroadcast({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M4.9 19.1C1 15.2 1 8.8 4.9 4.9' />
      <path d='M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5' />
      <circle cx='12' cy='12' r='2' />
      <path d='M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5' />
      <path d='M19.1 4.9C23 8.8 23 15.1 19.1 19' />
    </svg>
  );
}

function SvgLink({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' />
      <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' />
    </svg>
  );
}

type CreateRoomModalProps = {
  tracks: CatalogTrack[];
  initialTrack: CatalogTrack | undefined;
  displayName: string;
  onSetDisplayName: (name: string) => void;
  onClose: () => void;
  onOpenRoom: (track: CatalogTrack) => void;
};

export function CreateRoomModal({ tracks, initialTrack, displayName, onSetDisplayName, onClose, onOpenRoom }: CreateRoomModalProps) {
  const [picked, setPicked] = useState<CatalogTrack | undefined>(initialTrack ?? tracks[0]);

  return (
    <Dialog className='create-room-modal' size='wide' labelledBy='create-room-title' onClose={onClose}>
      <div className='modal-header'>
        <div className='modal-icon' data-tone='success'>
          <SvgBroadcast size={20} />
        </div>
      </div>
      <div className='modal-copy'>
        <p className='modal-eyebrow'>Start a room</p>
        <h2 id='create-room-title'>As easy as sharing a link</h2>
        <p>Open a room and share the link. Anyone can join and listen - no wallet, no sign-up.</p>
      </div>

      {picked && (
        <div className='create-room-preview'>
          <img src={picked.imageRef} alt='' crossOrigin='anonymous' />
          <div>
            <strong>{picked.title}</strong>
            <span>{picked.artist}</span>
            <span className='create-room-link'>
              <SvgLink size={13} />
              Your link appears when the room opens
            </span>
          </div>
        </div>
      )}

      {tracks.length > 1 && (
        <>
          <div className='create-room-label-group'>
            <p className='create-room-label'>Choose a track</p>
            <span className='create-room-label-hint'>Your room opens with this track.</span>
          </div>
          <div className='create-room-picker'>
            {tracks.map(track => (
              <button
                key={track.id}
                className={'create-room-pick' + (picked?.id === track.id ? ' is-on' : '')}
                type='button'
                onClick={() => setPicked(track)}
                aria-label={`Select ${track.title}`}
                aria-pressed={picked?.id === track.id}
              >
                <img src={track.imageRef} alt='' crossOrigin='anonymous' />
              </button>
            ))}
          </div>
        </>
      )}

      <label className='create-room-label' htmlFor='create-room-name'>
        Your name in the room
      </label>
      <input
        id='create-room-name'
        className='field'
        value={displayName}
        onChange={event => onSetDisplayName(event.target.value)}
        placeholder='How should people see you?'
        maxLength={32}
        autoFocus
      />

      <div className='create-room-actions'>
        <button className='primary-action wide' type='button' disabled={!picked || !displayName.trim()} onClick={() => picked && onOpenRoom(picked)}>
          <SvgBroadcast size={16} />
          Open the room
        </button>
        <button className='create-room-cancel' type='button' onClick={onClose}>
          Cancel
        </button>
      </div>
      <p className='create-room-foot'>You host. Guests just listen - only you need access to the track.</p>
    </Dialog>
  );
}
