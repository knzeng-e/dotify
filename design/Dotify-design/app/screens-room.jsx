/* ============================================================================
   DOTIFY — Shared listening room (the village square)
   ========================================================================= */
const { useState, useRef, useEffect } = React;
function RoomScreen({ room, data, wallet, isHost, playing, progress, duration, presenceStyle,
  onLeave, onTogglePlay, onSeek, onShare, onCopy, copied }) {
  const { people } = data;
  const track = room.track;
  const listeners = room.listenerIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  const everyone = [room.host, ...listeners];
  const [reactions, setReactions] = useState([]);
  const [feed, setFeed] = useState([
    { id: 1, who: room.host.name, text: 'welcome in 🌿 turning it up', host: true },
    { id: 2, who: listeners[0]?.name || 'Lena', text: 'this harp is unreal' },
  ]);
  const stageRef = useRef(null);

  function react(emoji) {
    const id = Math.random();
    setReactions(r => [...r, { id, emoji, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 2600);
  }

  // ambient: drive the whole room from this track's aura
  return (
    <div className="room-screen" style={{ ...coverVars(track), '--aura-a': track.aura.a, '--aura-b': track.aura.b, '--aura-accent': track.aura.accent, '--aura-deg': track.aura.deg + 'deg' }}>
      <div className="room-head">
        <button className="btn btn-ghost btn-sm" onClick={onLeave}><Icon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} />Leave room</button>
        <div className="room-head-mid">
          <span className="chip chip-live"><span className="live-dot"></span>Live</span>
          <span className="muted" style={{ fontWeight: 600 }}>{room.mood} · {everyone.length} listening</span>
        </div>
        <div className="room-code-pill">
          <span className="muted-3" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>ROOM</span>
          <strong className="tnum">{room.code}</strong>
          <button className="btn btn-aura btn-sm" onClick={onCopy}><Icon name={copied ? 'check' : 'link'} size={15} />{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </div>

      <div className="room-body">
        {/* Stage */}
        <div className="room-stage" ref={stageRef}>
          <div className="room-cover-wrap">
            <div className={'room-cover-glow' + (playing ? ' on' : '')}></div>
            <Cover track={track} glyph={false} className={'room-cover' + (playing ? ' spinning' : '')} />
            <div className="reactions">
              {reactions.map(r => <span key={r.id} className="reaction" style={{ left: r.x + '%' }}>{r.emoji}</span>)}
            </div>
          </div>

          <div className="room-track-meta">
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <AccessChip track={track} granted />
              {track.verified && <span className="chip chip-verified"><Icon name="verified" size={13} />Artist-owned</span>}
            </div>
            <h1>{track.title}</h1>
            <p className="muted">{track.artist}</p>
          </div>

          {/* Transport */}
          <div className="room-transport glass">
            <div className="dock-scrub" style={{ maxWidth: '100%' }}>
              <small>{fmtTime(progress * duration)}</small>
              <div className="scrub" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width); }}>
                <div className="scrub-fill" style={{ width: (progress * 100) + '%' }}></div>
              </div>
              <small>{fmtTime(duration)}</small>
            </div>
            <div className="room-transport-controls">
              <button className="dock-controls" style={{ color: 'var(--fg-2)' }} aria-label="Previous"><Icon name="skipBack" size={22} /></button>
              <button className="dock-play" style={{ width: 60, height: 60 }} onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                <Icon name={playing ? 'pause' : 'play'} size={26} />
              </button>
              <button className="dock-controls" style={{ color: 'var(--fg-2)' }} aria-label="Next"><Icon name="skipFwd" size={22} /></button>
            </div>
            {!isHost
              ? <p className="room-sync-note"><span className="live-dot" style={{ background: 'var(--green)' }}></span>Following {room.host.name} · in sync</p>
              : <p className="room-sync-note muted-3">You're hosting — everyone hears what you play. You hold the key; they just listen.</p>}
          </div>

          <div className="room-react-bar">
            {['❤️', '🔥', '🌿', '✨', '🙌', '🥲'].map(e => (
              <button key={e} className="react-btn" onClick={() => react(e)}>{e}</button>
            ))}
          </div>
        </div>

        {/* People + chatter */}
        <aside className="room-aside glass">
          <div className="room-aside-head">
            <h3>In the room</h3>
            <span className="chip"><Icon name="users" size={13} />{everyone.length}</span>
          </div>
          <div className="room-people">
            {everyone.map((p, i) => (
              <div className="room-person" key={p.id}>
                <Avatar person={p} size={38} style={presenceStyle} host={i === 0} />
                <div style={{ minWidth: 0 }}>
                  <strong>{p.name}{i === 0 && <span className="host-tag">host</span>}{p.id === 'p1' && i !== 0 && <span className="you-tag">you</span>}</strong>
                  <span className="muted-3">{i === 0 ? 'holds the key' : 'listening'}</span>
                </div>
                <span className="eq" aria-hidden="true"><i></i><i></i><i></i></span>
              </div>
            ))}
          </div>
          <div className="room-feed">
            {feed.map(m => (
              <div className="feed-line" key={m.id}>
                <strong style={{ color: m.host ? 'var(--aura-accent)' : 'var(--fg)' }}>{m.who}</strong>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <div className="room-say">
            <input placeholder="Say something to the room…" onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                setFeed(f => [...f, { id: Date.now(), who: 'You', text: e.target.value.trim() }]);
                e.target.value = '';
              }
            }} />
            <button className="btn-icon" style={{ background: 'var(--lead)', color: 'var(--on-lead)', width: 38, height: 38 }} aria-label="Send"><Icon name="send" size={16} /></button>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.RoomScreen = RoomScreen;
