import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { openProductHostExternalUrl, requiresExplicitProductRoomEntry } from '../features/productHost/productHost';
import { productNearbyBrowserUrl } from '../features/productHost/productNearbyFallback';

/** Explicit navigation only: this never sends the Host's location to another surface. */
export function ProductNearbyFallback({ roomId = '' }: { roomId?: string }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  if (!requiresExplicitProductRoomEntry()) return null;
  const url = productNearbyBrowserUrl(import.meta.env.VITE_PUBLIC_APP_URL, window.location.hash, roomId);
  if (!url) return null;
  const open = async () => {
    if (opening) return;
    setOpening(true);
    setError('');
    try {
      const result = await openProductHostExternalUrl(url);
      if (!result.ok) setError(result.reason);
    } catch {
      setError('The browser could not open. Try again.');
    } finally {
      setOpening(false);
    }
  };
  return (
    <div className='nearby-browser-fallback'>
      <button className='text-action' type='button' onClick={() => void open()} disabled={opening}>
        <ExternalLink size={16} aria-hidden='true' />
        {opening ? 'Opening browser…' : 'Find Nearby in browser'}
      </button>
      <p className='nearby-hint'>Opens Dotify separately. Hosting and account access stay in this app.</p>
      {error && <p role='status'>{error}</p>}
    </div>
  );
}
