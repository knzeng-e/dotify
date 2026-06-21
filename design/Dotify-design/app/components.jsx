/* ============================================================================
   DOTIFY — shared components
   ========================================================================= */
const { useState, useRef, useEffect, useMemo } = React;

/* ---- Icon set (stroke, 24x24) ---- */
const ICONS = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  headphones: 'M4 14v-2a8 8 0 0 1 16 0v2 M4 14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 M20 14a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2',
  radio: 'M4.9 19.1a10 10 0 0 1 0-14.2 M7.8 16.2a6 6 0 0 1 0-8.4 M16.2 7.8a6 6 0 0 1 0 8.4 M19.1 4.9a10 10 0 0 1 0 14.2 M12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  heart: 'M12 20.5l-1.4-1.3C5.4 14.6 2.5 12 2.5 8.8 2.5 6.3 4.4 4.5 6.8 4.5c1.4 0 2.7.6 3.5 1.7l.7.9.7-.9c.8-1.1 2.1-1.7 3.5-1.7 2.4 0 4.3 1.8 4.3 4.3 0 3.2-2.9 5.8-8.1 10.4z',
  plus: 'M12 5v14 M5 12h14',
  skipBack: 'M18 18V6l-8.5 6zM6 6v12',
  skipFwd: 'M6 6v12l8.5-6zM18 6v12',
  shuffle: 'M16 4h4v4 M20 4l-6 6 M4 20l6-6 M16 20h4v-4 M4 4l5 5',
  repeat: 'M17 2l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8 11V8a4 4 0 0 1 8 0v3',
  check: 'M5 12l5 5L20 6',
  verified: 'M12 2l2.4 1.8 3 .2.9 2.9 2.4 1.9-1 2.8 1 2.8-2.4 1.9-.9 2.9-3 .2L12 22l-2.4-1.8-3-.2-.9-2.9L3.3 15l1-2.8-1-2.8 2.4-1.9.9-2.9 3-.2z M9 12l2 2 4-4',
  users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M22 20v-2a4 4 0 0 0-3-3.8 M16 3.2a4 4 0 0 1 0 7.6',
  link: 'M9 15l6-6 M10.5 6.5l1-1a4 4 0 0 1 6 6l-1 1 M13.5 17.5l-1 1a4 4 0 0 1-6-6l1-1',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2 M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3 M3 7h16 M21 11h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  x: 'M6 6l12 12 M18 6L6 18',
  share: 'M16 6l-4-4-4 4 M12 2v13 M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1',
  wifi: 'M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  key: 'M15 7a3 3 0 1 1-1.2 5.8L13 13l-1 1 1 1-1.5 1.5L11 16l-1.2 1.2L8 19l-2 .5L5 19l.5-1 1.8-1.8 4.5-4.5A3 3 0 0 1 15 7z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  dot: 'M12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  volume: 'M11 5L6 9H3v6h3l5 4zM16 9a3 3 0 0 1 0 6 M19 6a7 7 0 0 1 0 12',
};
function Icon({ name, size = 20, fill = false, style, strokeWidth = 1.9 }) {
  const d = ICONS[name] || '';
  const solid = ['play', 'pause', 'dot'].includes(name) || fill;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true"
      fill={solid ? 'currentColor' : 'none'} stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}

/* ---- Cover art (the light source) ---- */
function coverVars(track) {
  return { '--c-a': track.aura.a, '--c-b': track.aura.b, '--c-deg': track.aura.deg + 'deg' };
}
function Cover({ track, glyph = true, className = '', style }) {
  return (
    <div className={'cover ' + className} style={{ ...coverVars(track), ...style }}>
      {glyph && <span className="cover-glyph">{track.title.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>}
    </div>
  );
}

/* ---- Avatar / presence ---- */
function Avatar({ person, size = 34, style: presenceStyle = 'photo', host = false }) {
  return (
    <div className={'ava' + (host ? ' ava-host' : '')} data-style={presenceStyle}
      style={{ '--s': size + 'px', '--hue': person.hue }} title={person.name}>
      {presenceStyle === 'initials' && person.initials}
    </div>
  );
}
function AvaStack({ people, max = 5, size = 32, style = 'photo' }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="ava-stack">
      {shown.map(p => <Avatar key={p.id} person={p} size={size} style={style} />)}
      {extra > 0 && <div className="ava ava-more" style={{ '--s': size + 'px' }}>+{extra}</div>}
    </div>
  );
}

/* ---- Access chip (quiet web3) ---- */
function AccessChip({ track, granted = false }) {
  if (track.mode === 'human-free') {
    return <span className="chip chip-free"><Icon name="users" size={13} />Free for humans</span>;
  }
  if (granted) return <span className="chip chip-free"><Icon name="check" size={13} />Unlocked</span>;
  return <span className="chip chip-paid"><Icon name="dot" size={13} fill />{track.price} DOT</span>;
}
function VerifiedMark({ size = 14 }) {
  return <span className="chip-verified" title="Verified artist" style={{ display: 'inline-flex' }}><Icon name="verified" size={size} /></span>;
}

/* ---- Track card ---- */
function TrackCard({ track, onOpen, onOpenArtist }) {
  return (
    <div className="track-card glass fade-up" onClick={() => onOpen(track)}>
      <Cover track={track} />
      <button className="play-fab track-card-play" onClick={(e) => { e.stopPropagation(); onOpen(track, true); }} aria-label="Play">
        <Icon name="play" />
      </button>
      <h4>{track.title}</h4>
      <div className="by">
        <span onClick={(e) => { e.stopPropagation(); onOpenArtist && onOpenArtist(track.artist); }}
          className={onOpenArtist ? 'profile-by' : ''}>{track.artist}</span>
        {track.verified && <VerifiedMark size={12} />}
      </div>
      <div className="track-card-foot">
        <AccessChip track={track} />
        <span className="track-card-listening"><span className="live-dot" style={{ background: 'var(--aura-accent)' }}></span>{track.nowListening}</span>
      </div>
    </div>
  );
}

/* ---- Room card (happening now) ---- */
function RoomCard({ room, people, onJoin, presence = 'photo' }) {
  const listeners = room.listenerIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  const all = [room.host, ...listeners];
  return (
    <div className="room-card glass" style={coverVars(room.track)} onClick={() => onJoin(room)}>
      <div className="room-card-glow"></div>
      <div className="room-card-top">
        <span className="chip chip-live"><span className="live-dot"></span>Live · {room.mood}</span>
        <span className="muted-3" style={{ fontSize: 12, fontWeight: 600 }}>{room.started}</span>
      </div>
      <div className="room-card-body">
        <Cover track={room.track} />
        <div style={{ minWidth: 0 }}>
          <strong>{room.track.title}</strong>
          <span>Hosted by {room.host.name}</span>
        </div>
      </div>
      <div className="room-card-foot">
        <div className="room-card-listeners">
          <AvaStack people={all} max={4} size={28} style={presence} />
          <small>{all.length} listening</small>
        </div>
        <span className="room-join-hint">Join <Icon name="arrowRight" size={14} style={{ verticalAlign: -2 }} /></span>
      </div>
    </div>
  );
}

/* ---- Wallet pill (connected / not) ---- */
function WalletPill({ wallet, onClick }) {
  if (!wallet.connected) {
    return <button className="btn btn-ghost btn-sm" onClick={onClick}><Icon name="wallet" size={16} />Connect</button>;
  }
  return (
    <button className="btn btn-sm" onClick={onClick}
      style={{ background: 'var(--glass-2)', border: '1px solid var(--glass-border)', gap: 8, paddingLeft: 8 }}>
      <span className="ava" data-style="orb" style={{ '--s': '24px', '--hue': 150 }}></span>
      <span className="tnum">{wallet.address}</span>
      <span className="muted-3" style={{ fontWeight: 700 }}>·</span>
      <span style={{ color: 'var(--aura-accent)', fontWeight: 800 }}>{wallet.balance}</span>
    </button>
  );
}

/* ---- Status pill (signal) ---- */
function StatusPill({ icon, label, tone }) {
  const map = { online: { color: 'var(--green-soft)', bg: 'color-mix(in oklab, var(--green) 14%, transparent)', bd: 'color-mix(in oklab, var(--green) 36%, transparent)' } };
  const s = map[tone] || {};
  return <span className="chip" style={{ color: s.color, background: s.bg, borderColor: s.bd }}><Icon name={icon} size={13} />{label}</span>;
}

function fmtTime(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

Object.assign(window, {
  Icon, Cover, coverVars, Avatar, AvaStack, AccessChip, VerifiedMark,
  TrackCard, RoomCard, WalletPill, StatusPill, fmtTime,
});
