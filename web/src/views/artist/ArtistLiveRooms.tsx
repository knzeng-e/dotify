import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Headphones, Radio, Users, X } from 'lucide-react';
import { useSessionContext, useWalletContext, useCatalogContext } from '../../app/providers';
import { Dialog } from '../../components/Dialog';
import { CoverImage } from '../../components/CoverImage';
import type { CatalogTrack, OpenRoom } from '../../shared/types';
import { artistLiveRooms, liveRoomState } from '../../features/artist-studio/liveRooms';
import { artistVisitSession } from '../../features/artist-studio/artistVisitSession';

export function ArtistLiveRooms({ tracks, runtime }: { tracks: CatalogTrack[]; runtime: string | null }) {
  const session = useSessionContext();
  const wallet = useWalletContext();
  const catalog = useCatalogContext();
  const [visit, setVisit] = useState<OpenRoom | null>(null);
  const [announce, setAnnounce] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const attemptRef = useRef(0);
  useLayoutEffect(() => {
    attemptRef.current++;
    setJoining(false);
  }, [visit, wallet.connectedWallet, wallet.expectedChainId]);
  useEffect(
    () => () => {
      attemptRef.current++;
    },
    []
  );
  useEffect(() => {
    // The standalone artist portal does not mount listener discovery.
    void session.requestOpenRooms();
    // One subscription per mounted panel; Socket.IO owns subsequent updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const online = session.socketStatus === 'online';
  const known = online && catalog.catalogIsAuthoritative;
  const rows = catalog.catalogIsAuthoritative ? artistLiveRooms(session.openRooms, tracks, runtime) : [];
  const currentVisit = rows.find(row => row.room.roomId === visit?.roomId);
  const playing = rows.filter(({ room }) => liveRoomState(room) === 'Playing');
  const present = playing.reduce((sum, { room }) => sum + room.listenerCount + 1, 0);
  async function enter() {
    if (!currentVisit || !online || !name.trim() || joining) return;
    const attempt = ++attemptRef.current;
    const identity = wallet.connectedWallet;
    setJoining(true);
    setError('');
    try {
      const token = announce
        ? await artistVisitSession({
            account: identity?.evmAddress,
            signer: identity?.keyRequestSigner,
            chainId: wallet.expectedChainId,
            getWalletClient: wallet.getActiveWalletClient
          })
        : '';
      if (attempt !== attemptRef.current) return;
      session.joinRoom(currentVisit.room.roomId, { displayName: name.trim(), announceArtist: announce, artistToken: token || undefined });
      setVisit(null);
    } catch (cause) {
      if (attempt === attemptRef.current) setError(cause instanceof Error ? cause.message : 'Could not verify your artist account. Try again.');
    } finally {
      if (attempt === attemptRef.current) setJoining(false);
    }
  }
  if (!runtime) return null;
  return (
    <section className='artist-live-panel' aria-labelledby='artist-live-title'>
      <div className='studio-section-head'>
        <div>
          <span className='studio-next-label'>
            <Radio size={14} aria-hidden='true' /> Happening now
          </span>
          <h2 id='artist-live-title'>Your music, live</h2>
        </div>
        <span className='artist-live-status' data-online={online}>
          {online ? 'Live updates' : 'Connection interrupted'}
        </span>
      </div>
      <div className='artist-live-metrics'>
        <p>
          <strong>{known ? playing.length : '—'}</strong>
          <span>
            <Radio size={16} /> rooms playing
          </span>
        </p>
        <p>
          <strong>{known ? present : '—'}</strong>
          <span>
            <Users size={16} /> connected sessions
          </span>
        </p>
      </div>
      <p className='artist-live-explanation'>
        See where your releases are bringing people together. Counts include hosts and connected guests; they are not verified listening totals.
      </p>
      {!online ? (
        <p role='status'>Live updates are unavailable. Reconnecting…</p>
      ) : !catalog.catalogIsAuthoritative ? (
        <p role='status'>Waiting for the verified catalog to match your releases.</p>
      ) : !rows.length ? (
        <div className='artist-live-empty'>
          <Headphones size={22} />
          <p>No room is playing your releases right now. Your next shared listening moment starts with a link.</p>
        </div>
      ) : (
        <div className='artist-live-rooms'>
          {rows.map(({ room, track }) => (
            <article className='artist-live-room' key={room.roomId}>
              <CoverImage src={track.imageRef} alt='' fallbackLabel={track.title} className='artist-live-cover' />
              <div>
                <strong>{track.title}</strong>
                <span>With {room.hostName}</span>
                <small>
                  {liveRoomState(room)} · {room.listenerCount + (room.hostConnected === false ? 0 : 1)} connected
                </small>
              </div>
              <button
                type='button'
                className='secondary-action compact-action'
                disabled={room.isFull || room.hostConnected === false}
                onClick={() => {
                  setVisit(room);
                  setAnnounce(false);
                  setError('');
                  setName(session.displayName === 'Listener' ? '' : session.displayName);
                }}
              >
                Visit room <ArrowUpRight size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
      {visit && (
        <Dialog historyDismiss labelledBy='artist-visit-title' size='compact' onClose={() => setVisit(null)}>
          <div className='modal-header'>
            <h2 id='artist-visit-title'>Drop into the room</h2>
            <button type='button' className='modal-close' aria-label='Close artist visit' onClick={() => setVisit(null)}>
              <X size={18} />
            </button>
          </div>
          <p>{currentVisit ? `${currentVisit.track.title} · with ${currentVisit.room.hostName}` : 'This room is no longer playing one of your releases.'}</p>
          <label className='artist-visit-name'>
            Your room name
            <input className='field' disabled={joining} value={name} onChange={event => setName(event.target.value)} maxLength={32} autoComplete='off' />
          </label>
          <label className='artist-visit-consent'>
            <input
              type='checkbox'
              checked={announce}
              disabled={joining}
              onChange={event => {
                setAnnounce(event.target.checked);
                setError('');
              }}
            />
            <span>
              <strong>
                <BadgeCheck size={16} /> Announce my presence as the artist
              </strong>
              <small>
                {announce
                  ? 'The room will see a verified artist welcome and an artist badge on your messages. Your departure will also be announced.'
                  : 'Join as an ordinary participant, with your room name. You will still appear in the people list.'}
              </small>
            </span>
          </label>
          {session.roomId && session.roomId !== visit.roomId && (
            <p>{session.mode === 'host' ? 'Joining will close the room you are hosting.' : 'Joining will leave your current room.'}</p>
          )}
          {error && <p role='alert'>{error}</p>}
          <button
            type='button'
            className='primary-action'
            disabled={joining || !name.trim() || !online || !currentVisit || currentVisit.room.isFull || currentVisit.room.hostConnected === false}
            onClick={enter}
          >
            {joining ? 'Verifying your artist account…' : 'Join'}
          </button>
        </Dialog>
      )}
    </section>
  );
}
