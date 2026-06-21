// ── Create / share a room ─────────────────────────────────────────────────────
// "As easy as sharing a link." A thin, honest wrapper over the existing
// createSession flow: pick what is playing, set a mood, open the room. The
// shareable link is shown as pending until the server assigns a room code (no
// fabricated URL); the room header then exposes the real Copy link.

import { useState } from 'react';
import { Link as LinkIcon, Radio, X } from 'lucide-react';
import { Dialog } from './Dialog';
import type { CatalogTrack } from '../types';

const MOODS = ['Late night', 'Morning', 'Focus', 'Drive', 'Together'];

type CreateRoomModalProps = {
  tracks: CatalogTrack[];
  initialTrack: CatalogTrack | undefined;
  onClose: () => void;
  onOpenRoom: (track: CatalogTrack) => void;
};

export function CreateRoomModal({ tracks, initialTrack, onClose, onOpenRoom }: CreateRoomModalProps) {
  const [picked, setPicked] = useState<CatalogTrack | undefined>(initialTrack ?? tracks[0]);
  const [mood, setMood] = useState(MOODS[0]);

  return (
    <Dialog className='create-room-modal' size='wide' labelledBy='create-room-title' onClose={onClose}>
        <div className='modal-header'>
          <div className='modal-icon' data-tone='success'>
            <Radio size={20} />
          </div>
          <button className='modal-close' type='button' onClick={onClose} aria-label='Close'>
            <X size={16} />
          </button>
        </div>
        <div className='modal-copy'>
          <p className='modal-eyebrow'>Start a room</p>
          <h2 id='create-room-title'>As easy as sharing a link</h2>
          <p>Pick what is playing. Anyone with the link can listen with you - no wallet, no sign-up.</p>
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
            <p className='create-room-label'>Now playing</p>
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

        <p className='create-room-label'>Mood</p>
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

        <div className='create-room-actions'>
          <button className='primary-action wide' type='button' disabled={!picked} onClick={() => picked && onOpenRoom(picked)}>
            <Radio size={16} />
            Open the room
          </button>
          <button className='secondary-action' type='button' onClick={onClose}>
            Cancel
          </button>
        </div>
        <p className='create-room-foot'>You host. Guests just listen - only you need access to the track.</p>
    </Dialog>
  );
}
