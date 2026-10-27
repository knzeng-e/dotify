import { Play, X } from 'lucide-react';
import { usePlaybackContext } from '../app/providers/PlaybackProvider';

export function ResumeListening() {
  const { resumeOffer, resumeListening, dismissResume } = usePlaybackContext();
  if (!resumeOffer) return null;
  return (
    <section className='resume-listening' aria-label='Saved listening'>
      <div>
        <small>Pick up where you left off</small>
        <strong>{resumeOffer.title}</strong>
        <span>{resumeOffer.artist} · Saved only on this device</span>
      </div>
      <button type='button' className='primary-action' onClick={resumeListening}>
        <Play size={16} /> Resume
      </button>
      <button type='button' className='icon-btn' aria-label='Dismiss saved listening' onClick={dismissResume}>
        <X size={18} />
      </button>
    </section>
  );
}
