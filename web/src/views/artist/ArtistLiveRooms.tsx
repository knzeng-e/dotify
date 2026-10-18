import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Headphones, Radio, Users, X } from 'lucide-react';
import { useSessionContext, useWalletContext, useCatalogContext } from '../../app/providers';
import { Dialog } from '../../components/Dialog';
import { CoverImage } from '../../components/CoverImage';
import type { CatalogTrack, OpenRoom } from '../../shared/types';
import { artistLiveRooms, liveRoomState } from '../../features/artist-studio/liveRooms';
import { useArtistRoomActivity } from '../../features/artist-studio/useArtistRoomActivity';
import { artistVisitSession } from '../../features/artist-studio/artistVisitSession';
import { normalizeRoomCode } from '../../shared/utils/format';

export function ArtistLiveRooms({ tracks, runtime }: { tracks: CatalogTrack[]; runtime: string | null }) {
  const session = useSessionContext();
  const wallet = useWalletContext();
  const catalog = useCatalogContext();
  const activity = useArtistRoomActivity(runtime);
  const [visit, setVisit] = useState<OpenRoom | null>(null);
  const [invitation, setInvitation] = useState('');
  const [invitedRoomId, setInvitedRoomId] = useState('');
  const [announce, setAnnounce] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const attemptRef = useRef(0);
  const artistAccount = wallet.connectedWallet?.evmAddress;
  const artistSigner = wallet.connectedWallet?.keyRequestSigner;
  const walletMethod = wallet.connectedWallet?.method;
  useLayoutEffect(() => {
    attemptRef.current++;
    setJoining(false);
  }, [visit, invitedRoomId, artistAccount, artistSigner, walletMethod, wallet.expectedChainId]);
  useEffect(
    () => () => {
      attemptRef.current++;
    },
    []
  );
  const online = session.socketStatus === 'online';
  const known = online && catalog.catalogIsAuthoritative && activity.snapshot !== null;
  const rows = catalog.catalogIsAuthoritative ? artistLiveRooms(activity.snapshot?.rooms ?? [], tracks, runtime) : [];
  const currentVisit = rows.find(row => row.room.roomId === visit?.roomId);
  const targetRoomId = invitedRoomId || currentVisit?.room.roomId;
  function closeVisit() {
    setVisit(null);
    setInvitedRoomId('');
  }
  async function enter() {
    if (!targetRoomId || !online || !name.trim() || joining) return;
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
      // A shared code is enough to attempt entry. The server checks the artist
      // against the room's actual track before admitting an announced visit.
      session.joinRoom(targetRoomId, { displayName: name.trim(), announceArtist: announce, artistToken: token || undefined });
      closeVisit();
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
          {known ? 'Updates every few seconds' : online ? 'Connecting…' : 'Connection interrupted'}
        </span>
      </div>
      <div className='artist-live-metrics'>
        <p>
          <strong data-unavailable={!known}>{known ? activity.snapshot!.roomCount : 'Not available'}</strong>
          <span>
            <Radio size={16} /> rooms with your music
          </span>
        </p>
        <p>
          <strong data-unavailable={!known}>{known ? activity.snapshot!.connectedCount : 'Not available'}</strong>
          <span>
            <Users size={16} /> connected sessions
          </span>
        </p>
      </div>
      <p className='artist-live-explanation'>
        Counts include every room with your music. Public rooms welcome you from anywhere; link-only rooms remain private. Connected sessions include hosts and
        listeners, not unique people.
      </p>
      {activity.message && <p role='status'>{activity.message}</p>}
      {activity.needsSession && (
        <button type='button' className='secondary-action compact-action' disabled={activity.connecting} onClick={() => void activity.connect()}>
          {activity.connecting ? 'Verifying…' : 'Show live activity'}
        </button>
      )}
      <form
        className='room-action-form'
        onSubmit={event => {
          event.preventDefault();
          const code = normalizeRoomCode(invitation);
          if (!/^[A-Z2-9]{6}$/.test(code)) return;
          setVisit(null);
          setInvitedRoomId(code);
          setAnnounce(false);
          setError('');
          setName(session.displayName === 'Listener' ? '' : session.displayName);
        }}
      >
        <label htmlFor='artist-room-invitation'>Have a room invitation?</label>
        <div className='room-action-row'>
          <input
            id='artist-room-invitation'
            className='field room-action-field'
            value={invitation}
            onChange={event => setInvitation(event.target.value)}
            placeholder='Paste a room code or link'
            maxLength={200}
            autoComplete='off'
          />
          <button className='secondary-action' type='submit' disabled={!online || !/^[A-Z2-9]{6}$/.test(normalizeRoomCode(invitation))}>
            Join
          </button>
        </div>
      </form>
      {!online ? (
        <p role='status'>Live updates are unavailable. Reconnecting…</p>
      ) : !catalog.catalogIsAuthoritative ? (
        <p role='status'>Waiting for the verified catalog to match your releases.</p>
      ) : !known ? null : !rows.length ? (
        <div className='artist-live-empty'>
          <Headphones size={22} />
          <p>No public room with your music is open right now. You can still join a private room with an invitation.</p>
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
                  setInvitedRoomId('');
                  setVisit(room);
                  setAnnounce(false);
                  setError('');
                  setName(session.displayName === 'Listener' ? '' : session.displayName);
                }}
              >
                Join <ArrowUpRight size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
      {(visit || invitedRoomId) && (
        <Dialog historyDismiss labelledBy='artist-visit-title' size='compact' onClose={closeVisit}>
          <div className='modal-header'>
            <h2 id='artist-visit-title'>Drop into the room</h2>
            <button type='button' className='modal-close' aria-label='Close artist visit' onClick={closeVisit}>
              <X size={18} />
            </button>
          </div>
          <p>
            {currentVisit
              ? `${currentVisit.track.title} · with ${currentVisit.room.hostName}`
              : invitedRoomId
                ? `Room ${invitedRoomId}. An announced visit is verified against the music playing there.`
                : 'This room is no longer playing one of your releases.'}
          </p>
          <label className='artist-visit-name'>
            Your name or nickname
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
          {session.roomId && session.roomId !== targetRoomId && (
            <p>{session.mode === 'host' ? 'Joining will close the room you are hosting.' : 'Joining will leave your current room.'}</p>
          )}
          {error && <p role='alert'>{error}</p>}
          <button
            type='button'
            className='primary-action'
            disabled={joining || !name.trim() || !online || !targetRoomId || currentVisit?.room.isFull || currentVisit?.room.hostConnected === false}
            onClick={enter}
          >
            {joining ? 'Verifying your artist account…' : 'Join'}
          </button>
        </Dialog>
      )}
    </section>
  );
}
