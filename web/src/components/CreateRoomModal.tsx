// ── Create / share a room ─────────────────────────────────────────────────────
// "As easy as sharing a link." A thin, honest wrapper over the existing
// createSession flow: pick what is playing, set a mood, open the room. The
// shareable link is shown as pending until the server assigns a room code (no
// fabricated URL); the room header then exposes the real Copy link.

import { useState } from 'react';
import { Link as LinkIcon, Radio } from 'lucide-react';
import { Dialog } from './Dialog';
import type { CatalogTrack } from '../types';

const MOODS = ['Late night', 'Morning', 'Focus', 'Drive', 'Together'];

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
  const [mood, setMood] = useState(MOODS[0]);

  return (
    <Dialog className='create-room-modal' size='wide' labelledBy='create-room-title' onClose={onClose}>
      <div className='modal-header'>
        <div className='modal-icon' data-tone='success'>
          <Radio size={20} />
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
              <LinkIcon size={13} />
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

      <div className='create-room-label-group'>
        <p className='create-room-label'>Vibe</p>
        <span className='create-room-label-hint'>Sets the tone - visible on the room card.</span>
      </div>
      <div className='create-room-moods'>
        {MOODS.map(option => (
          <button
            key={option}
            className={'create-room-mood' + (mood === option ? ' is-on' : '')}
            type='button'
            onClick={() => setMood(option)}
            aria-pressed={mood === option}
          >
            {option}
          </button>
        ))}
      </div>

      <label className='create-room-label' htmlFor='create-room-name'>Your name in the room</label>
      <input
        id='create-room-name'
        className='field'
        value={displayName}
        onChange={event => onSetDisplayName(event.target.value)}
        placeholder='How should people see you?'
        maxLength={32}
      />

      <div className='create-room-actions'>
        <button className='primary-action wide' type='button' disabled={!picked} onClick={() => picked && onOpenRoom(picked)}>
          <Radio size={16} />
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
