/* ============================================================================
   DOTIFY — App shell, navigation, dock, aura engine, tweaks
   ========================================================================= */
const DATA = window.DOTIFY_DATA;
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "auraStrength": 0.8,
  "ambient": "aurora",
  "presence": "photo",
  "accent": "green",
  "warmth": "cool",
  "glass": true,
  "density": "cozy",
  "lightsDown": true
}/*EDITMODE-END*/;

const ACCENTS = {
  album: { lead: 'var(--aura-accent)', soft: 'color-mix(in oklab, var(--aura-accent) 75%, white)', on: '#0a1020' },
  green: { lead: '#29e87a', soft: '#5cf0a0', on: '#052012' },
  cyan:  { lead: '#2bd3e8', soft: '#74e6f3', on: '#04181c' },
  pink:  { lead: '#ff2e93', soft: '#ff66b0', on: '#1c0413' },
};
const WARMTH = {
  warm: { base: '#0d1228', deep: '#080a1c', raise: '#141838' },
  cool: { base: '#08152d', deep: '#050d1f', raise: '#0c1d38' },
};

function RoomsBrowse({ data, onJoin, onStart, presence }) {
  const { rooms, people } = data;
  const [code, setCode] = useState('');
  return (
    <div className="main">
      <div className="spread" style={{ marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <span className="eyebrow"><span className="live-dot"></span>Shared listening, right now</span>
          <h1 style={{ fontSize: 'clamp(28px,4vw,42px)', marginTop: 10 }}>Live rooms</h1>
        </div>
        <button className="btn btn-lead" onClick={onStart}><Icon name="radio" size={18} />Start a room</button>
      </div>
      <div className="rooms-strip" style={{ marginBottom: 34 }}>
        {rooms.map(r => <RoomCard key={r.code} room={r} people={people} onJoin={onJoin} presence={presence} />)}
      </div>
      <div className="glass" style={{ padding: 22, maxWidth: 440 }}>
        <h3 style={{ fontSize: 17, marginBottom: 4 }}>Have a code?</h3>
        <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>Drop in the 6 letters a friend shared.</p>
        <div className="row" style={{ gap: 10 }}>
          <input className="room-say-input" value={code} maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123"
            style={{ flex: 1, height: 46, padding: '0 16px', borderRadius: 'var(--r-pill)', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--fg)', outline: 'none', letterSpacing: '0.18em', fontWeight: 700 }} />
          <button className="btn btn-lead" onClick={() => { const r = rooms.find(x => x.code === code) || rooms[0]; onJoin(r); }}><Icon name="headphones" size={17} />Join</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState('home');           // home | rooms
  const [current, setCurrent] = useState(null);        // track in dock
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);         // 0..1
  const [room, setRoom] = useState(null);              // active room or null
  const [isHost, setIsHost] = useState(false);
  const [portal, setPortal] = useState(false);         // artist studio
  const [profile, setProfile] = useState(null);        // public artist profile (name)
  const [modal, setModal] = useState(null);            // {type, track?}
  const [wallet, setWallet] = useState({ connected: false, address: '0xf24f…6cac', balance: '2.4 DOT' });
  const [unlocked, setUnlocked] = useState(() => new Set());
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  const auraTrack = room ? room.track : current;
  const isUnlocked = (tr) => tr.mode === 'human-free' ? wallet.connected : unlocked.has(tr.id);

  function showToast(msg) { setToast(msg); clearTimeout(showToast._t); showToast._t = setTimeout(() => setToast(null), 2600); }

  /* ---- Aura engine: paint the world with the current track ---- */
  useEffect(() => {
    const r = document.documentElement;
    const a = auraTrack ? auraTrack.aura : { a: '#3550a0', b: '#6a4fb0', accent: '#5b8cff', deg: 150 };
    r.style.setProperty('--aura-a', a.a);
    r.style.setProperty('--aura-b', a.b);
    r.style.setProperty('--aura-accent', a.accent);
    r.style.setProperty('--aura-deg', a.deg + 'deg');
  }, [auraTrack]);

  /* ---- Tweaks application ---- */
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--aura-strength', t.auraStrength);
    const ac = ACCENTS[t.accent] || ACCENTS.album;
    r.style.setProperty('--lead', ac.lead);
    r.style.setProperty('--lead-soft', ac.soft);
    r.style.setProperty('--on-lead', ac.on);
    const w = WARMTH[t.warmth] || WARMTH.warm;
    r.style.setProperty('--base', w.base);
    r.style.setProperty('--base-deep', w.deep);
    r.style.setProperty('--base-raise', w.raise);
    document.body.className = [
      t.glass ? '' : 'no-glass',
      'ambient-' + t.ambient,
      'density-' + t.density,
      t.lightsDown ? 'lights-down' : '',
    ].filter(Boolean).join(' ');
  }, [t]);

  /* ---- Playback ticker ---- */
  useEffect(() => {
    if (!playing || !auraTrack) return;
    const id = setInterval(() => {
      setProgress(p => { const np = p + 1 / auraTrack.duration; if (np >= 1) { return 0; } return np; });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, auraTrack]);

  /* ---- Actions ---- */
  function openTrack(track, autoplay = true) {
    setCurrent(track); setProgress(0); setPlaying(autoplay);
    if (track.mode === 'classic' && !unlocked.has(track.id)) showToast('Preview · unlock for the full track');
  }
  function startRoomFlow() { setModal({ type: 'create', track: current }); }
  function openCreate(track) { setModal({ type: 'create', track: track || current }); }
  function openArtist(name) { setProfile(name); setRoom(null); setPortal(false); window.scrollTo(0, 0); }
  function openRoom(roomObj) {
    setRoom(roomObj); setIsHost(true); setCurrent(roomObj.track); setProgress(0); setPlaying(true);
    setModal(null); setCopied(true); showToast('Link copied — share it with anyone');
    setTimeout(() => setCopied(false), 2500);
  }
  function joinRoom(roomObj, mode) {
    if (!roomObj && mode === 'browse') { setView('rooms'); return; }
    setRoom(roomObj); setIsHost(false); setCurrent(roomObj.track); setProgress(0); setPlaying(true);
  }
  function leaveRoom() { setRoom(null); setIsHost(false); }
  function connectWallet() { setWallet(w => ({ ...w, connected: true })); showToast('Wallet connected'); if (modal && modal.type === 'wallet') setModal(null); }
  function payTrack(track) {
    setPaying(true);
    setTimeout(() => {
      setUnlocked(s => new Set(s).add(track.id));
      setPaying(false); setModal(null); setCurrent(track); setPlaying(true); setProgress(0);
      showToast(track.mode === 'human-free' ? 'Unlocked — you\u2019re verified ✓' : `Unlocked — ${track.price} DOT sent to ${track.artist}`);
    }, 1100);
  }
  function copyRoomLink() { setCopied(true); showToast('Room link copied'); setTimeout(() => setCopied(false), 2500); }

  const supportingCount = new Set([...unlocked].map(id => DATA.byId(id)?.artist)).size + 1;
  const previewLocked = current && current.mode === 'classic' && !unlocked.has(current.id);

  return (
    <>
      <div className="aura-bg"></div>
      <div className="grain"></div>

      <div className="app">
        {/* Topbar */}
        <header className="topbar">
          <div className="brand" onClick={() => { setRoom(null); setView('home'); }}>
            <span className="brand-mark"></span>Dotify
          </div>
          <div className="topbar-search">
            <Icon name="search" size={17} />
            <input placeholder="Search artists, tracks, rooms…" />
          </div>
          <div className="topbar-spacer"></div>
          {!portal && <button className="btn btn-ghost btn-sm" onClick={() => setPortal(true)}><Icon name="sparkle" size={15} />For artists</button>}
          <StatusPill icon="wifi" label="Signal online" tone="online" />
          <WalletPill wallet={wallet} onClick={() => setModal({ type: 'wallet' })} />
        </header>

        {/* Artist studio takeover */}
        {portal ? (
          <ArtistStudio data={DATA} wallet={wallet}
            onExitPortal={() => setPortal(false)}
            onShowWallet={() => setModal({ type: 'wallet' })}
            onOpenTrack={(tr) => { setPortal(false); openTrack(tr); }}
            onToast={showToast} />
        ) : room ? (
          <RoomScreen room={room} data={DATA} wallet={wallet} isHost={isHost}
            playing={playing} progress={progress} duration={room.track.duration} presenceStyle={t.presence}
            onLeave={leaveRoom} onTogglePlay={() => setPlaying(p => !p)}
            onSeek={(v) => setProgress(Math.min(1, Math.max(0, v)))}
            onCopy={copyRoomLink} copied={copied} />
        ) : profile ? (
          <ArtistProfile artist={DATA.getArtist(profile)} data={DATA} presence={t.presence}
            onBack={() => setProfile(null)}
            onOpenTrack={openTrack}
            onJoinRoom={joinRoom}
            onStartRoom={(tr) => openCreate(tr)}
            onOpenArtist={openArtist} />
        ) : (
          <div className="body">
            <nav className="rail">
              <div className="rail-label">Listen</div>
              <div className="rail-item" data-active={view === 'home'} onClick={() => setView('home')}><Icon name="sparkle" size={19} />Discover</div>
              <div className="rail-item" data-active={view === 'rooms'} onClick={() => setView('rooms')}><Icon name="radio" size={19} />Rooms</div>
              <div className="rail-label">Library</div>
              <div className="rail-item"><Icon name="heart" size={19} />Liked</div>
              <div className="rail-item"><Icon name="users" size={19} />Following</div>
              <div className="rail-now glass">
                <span className="eyebrow">Now playing</span>
                {current ? (
                  <div className="rail-now-track">
                    <Cover track={current} glyph={false} />
                    <div style={{ minWidth: 0 }}><strong>{current.title}</strong><span>{current.artist}</span></div>
                  </div>
                ) : <p className="muted-3" style={{ fontSize: 13, marginTop: 8 }}>Nothing yet — pick a track.</p>}
              </div>
            </nav>

            {view === 'home'
              ? <HomeScreen data={DATA} wallet={wallet} onOpenTrack={openTrack} onJoinRoom={joinRoom} onStartRoom={startRoomFlow} onOpenArtist={openArtist} presence={t.presence} />
              : <RoomsBrowse data={DATA} onJoin={joinRoom} onStart={startRoomFlow} presence={t.presence} />}
          </div>
        )}

        {/* Player dock (hidden inside a room or studio) */}
        {current && !room && !portal && (
          <div className="dock">
            <div className="dock-inner glass">
              <div className="dock-track">
                <Cover track={current} glyph={false} />
                <div className="meta"><strong>{current.title}</strong><span style={{ cursor: 'pointer' }} onClick={() => openArtist(current.artist)}>{current.artist}</span></div>
                <button className="btn-icon" style={{ width: 36, height: 36, color: 'var(--fg-3)' }} aria-label="Like"><Icon name="heart" size={18} /></button>
              </div>
              <div className="dock-center">
                <div className="dock-controls">
                  <button aria-label="Shuffle"><Icon name="shuffle" size={17} /></button>
                  <button aria-label="Previous"><Icon name="skipBack" size={20} /></button>
                  <button className="dock-play" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} /></button>
                  <button aria-label="Next"><Icon name="skipFwd" size={20} /></button>
                  <button aria-label="Repeat"><Icon name="repeat" size={17} /></button>
                </div>
                <div className="dock-scrub">
                  <small>{fmtTime(progress * current.duration)}</small>
                  <div className="scrub" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setProgress((e.clientX - r.left) / r.width); }}>
                    <div className="scrub-fill" style={{ width: (progress * 100) + '%' }}></div>
                  </div>
                  <small>{fmtTime(current.duration)}</small>
                </div>
              </div>
              <div className="dock-right">
                {previewLocked ? (
                  <div className="dock-host-cta">
                    <span className="chip chip-paid">Preview · 42%</span>
                    <button className="btn btn-lead btn-sm" onClick={() => setModal({ type: 'unlock', track: current })}><Icon name="lock" size={15} />Unlock</button>
                  </div>
                ) : (
                  <div className="dock-host-cta">
                    <span className="dock-listening muted-3" style={{ fontSize: 12.5, fontWeight: 600 }}><Icon name="volume" size={17} /></span>
                    <button className="btn btn-aura btn-sm" onClick={startRoomFlow}><Icon name="radio" size={15} />Listen together</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {modal?.type === 'create' && <CreateRoomModal data={DATA} initialTrack={modal.track} onClose={() => setModal(null)} onOpenRoom={openRoom} />}
        {modal?.type === 'wallet' && <WalletModal wallet={wallet} supportingCount={supportingCount} onClose={() => setModal(null)} onConnect={connectWallet} onDisconnect={() => { setWallet(w => ({ ...w, connected: false })); setUnlocked(new Set()); setModal(null); showToast('Disconnected'); }} />}
        {modal?.type === 'unlock' && <UnlockModal track={modal.track} wallet={wallet} paying={paying} onClose={() => setModal(null)} onConnect={() => setModal({ type: 'wallet' })} onPay={payTrack} onPreview={() => setModal(null)} />}

        {toast && <div className="toast"><span className="toast-ic"><Icon name="check" size={17} /></span>{toast}</div>}

        <TweaksPanel title="Tweaks">
          <TweakSection label="The light" />
          <TweakSlider label="Aura strength" value={t.auraStrength} min={0} max={1.4} step={0.1}
            onChange={(v) => setTweak('auraStrength', v)} />
          <TweakRadio label="Ambient" value={t.ambient} options={['calm', 'halo', 'aurora']}
            onChange={(v) => setTweak('ambient', v)} />
          <TweakToggle label="Lights-down listening" value={t.lightsDown}
            onChange={(v) => setTweak('lightsDown', v)} />

          <TweakSection label="Color & surface" />
          <TweakRadio label="Accent lead" value={t.accent} options={['album', 'green', 'cyan', 'pink']}
            onChange={(v) => setTweak('accent', v)} />
          <TweakRadio label="Base warmth" value={t.warmth} options={['cool', 'warm']}
            onChange={(v) => setTweak('warmth', v)} />
          <TweakToggle label="Glass surfaces" value={t.glass}
            onChange={(v) => setTweak('glass', v)} />

          <TweakSection label="People & space" />
          <TweakRadio label="Presence" value={t.presence} options={['photo', 'orb', 'initials']}
            onChange={(v) => setTweak('presence', v)} />
          <TweakRadio label="Density" value={t.density} options={['cozy', 'regular', 'airy']}
            onChange={(v) => setTweak('density', v)} />
        </TweaksPanel>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
