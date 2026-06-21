/* ============================================================================
   DOTIFY — Home / discovery
   Shared listening leads; web3 stays quiet & warm.
   ========================================================================= */
function HomeScreen({ data, wallet, onOpenTrack, onJoinRoom, onStartRoom, onOpenArtist, presence }) {
  const { tracks, people, rooms } = data;
  const featured = tracks[0];
  const totalListening = rooms.reduce((n, r) => n + r.listenerIds.length + 1, 0);
  const artistCount = new Set(tracks.map(t => t.artist)).size;

  return (
    <div className="main">
      {/* Hero — a real product moment, not a landing page */}
      <div className="hero">
        <div className="hero-listen glass fade-up">
          <div>
            <span className="eyebrow"><span className="live-dot"></span>{totalListening} people listening together right now</span>
            <h1>Press play <em style={{ fontStyle: 'normal', color: 'var(--aura-accent)' }}>with</em> someone — not just at them.</h1>
            <p className="lede">Open a room, share the link, and let a track play in the same moment for everyone inside. The artist keeps the keys; you just bring the people.</p>
          </div>
          <div className="col" style={{ gap: 18 }}>
            <div className="hero-cta-row">
              <button className="btn btn-lead" onClick={onStartRoom}><Icon name="radio" size={18} />Start a room</button>
              <button className="btn btn-ghost" onClick={() => onOpenTrack(featured)}><Icon name="headphones" size={18} />Listen solo</button>
            </div>
            <div className="hero-meta">
              <div><strong className="tnum">{rooms.length}</strong><span>open rooms</span></div>
              <div><strong className="tnum">{totalListening}</strong><span>listeners</span></div>
              <div><strong className="tnum">{artistCount}</strong><span>artists</span></div>
            </div>
          </div>
        </div>

        <div className="hero-featured glass fade-up" onClick={() => onOpenTrack(featured)} style={{ cursor: 'pointer' }}>
          <Cover track={featured} glyph={false} />
          <div className="cover-veil"></div>
          <button className="play-fab" onClick={(e) => { e.stopPropagation(); onOpenTrack(featured, true); }} aria-label="Play featured"><Icon name="play" /></button>
          <div className="hero-featured-body">
            <span className="eyebrow" style={{ color: 'rgba(255,255,255,0.8)' }}>Featured today</span>
            <h3 style={{ marginTop: 8 }}>{featured.title}</h3>
            <div className="hf-artist">
              <span className="muted" style={{ fontWeight: 600, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onOpenArtist && onOpenArtist(featured.artist); }}>{featured.artist}</span>
              {featured.verified && <VerifiedMark />}
            </div>
            <div className="hf-chips">
              <AccessChip track={featured} />
              <span className="chip"><Icon name="users" size={13} />{featured.nowListening} now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Happening now — the social core, surfaced first */}
      <div className="section">
        <div className="section-head">
          <h2>Happening now</h2>
          <span className="link" onClick={() => onJoinRoom(null, 'browse')}>All rooms <Icon name="chevron" size={14} style={{ verticalAlign: -2 }} /></span>
        </div>
        <div className="rooms-strip">
          {rooms.map(r => <RoomCard key={r.code} room={r} people={people} onJoin={onJoinRoom} presence={presence} />)}
        </div>
      </div>

      {/* Discover + quiet trust */}
      <div className="home-grid">
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-head"><h2>Discover</h2><span className="link">Browse all <Icon name="chevron" size={14} style={{ verticalAlign: -2 }} /></span></div>
          <div className="catalog">
            {tracks.map(t => <TrackCard key={t.id} track={t} onOpen={onOpenTrack} onOpenArtist={onOpenArtist} />)}
          </div>
        </div>

        <aside className="trust glass" style={{ position: 'sticky', top: 80 }}>
          <h3>Access, the human way</h3>
          <p>Proof, not profiles. Here's how listening works.</p>
          <div className="trust-item">
            <div className="trust-ic"><Icon name="key" size={17} /></div>
            <div><strong>The artist keeps the keys</strong><span>Every track lives in the artist's own space. No platform can quietly take it down.</span></div>
          </div>
          <div className="trust-item">
            <div className="trust-ic"><Icon name="heart" size={17} /></div>
            <div><strong>Pay the artist directly</strong><span>When a track costs DOT, that payment goes straight to the artist — no middle cut.</span></div>
          </div>
          <div className="trust-item">
            <div className="trust-ic"><Icon name="users" size={17} /></div>
            <div><strong>Free for verified humans</strong><span>Some music is free to anyone who's simply a real person. No account, no ad profile.</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.HomeScreen = HomeScreen;
