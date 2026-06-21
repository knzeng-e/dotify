/* ============================================================================
   DOTIFY — Public artist profile (listener side)
   ========================================================================= */
const { useState } = React;

function fmtFollowers(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return '' + n;
}

function ArtistProfile({ artist, data, presence, onBack, onOpenTrack, onJoinRoom, onStartRoom, onOpenArtist }) {
  const [following, setFollowing] = useState(false);
  const liveRooms = data.rooms.filter(r => r.track.artist === artist.name);
  const cv = { '--c-a': artist.aura.a, '--c-b': artist.aura.b, '--c-deg': artist.aura.deg + 'deg',
    '--aura-a': artist.aura.a, '--aura-b': artist.aura.b, '--aura-accent': artist.aura.accent, '--aura-deg': artist.aura.deg + 'deg' };

  // bathe the page in this artist's light
  React.useEffect(() => {
    const r = document.documentElement, a = artist.aura;
    r.style.setProperty('--aura-a', a.a); r.style.setProperty('--aura-b', a.b);
    r.style.setProperty('--aura-accent', a.accent); r.style.setProperty('--aura-deg', a.deg + 'deg');
  }, [artist.name]);

  return (
    <div className="profile" style={cv}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 18 }}>
        <Icon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} />Back
      </button>

      <div className="profile-hero glass">
        <div className="profile-hero-glow"></div>
        <div className="profile-id">
          <div className="profile-avatar"></div>
          <div className="profile-id-text">
            <h1>{artist.name}{artist.verified && <VerifiedMark size={20} />}</h1>
            <div className="sub">
              <span>@{artist.handle}</span>
              <span><b>{fmtFollowers(artist.followers)}</b> followers</span>
              <span className="row" style={{ gap: 6 }}><span className="live-dot" style={{ background: 'var(--aura-accent)' }}></span><b>{artist.nowListening}</b>&nbsp;listening now</span>
            </div>
          </div>
        </div>

        <p className="profile-bio">{artist.bio}</p>

        <div className="profile-actions">
          <button className={following ? 'btn btn-ghost' : 'btn btn-lead'} onClick={() => setFollowing(f => !f)}>
            <Icon name={following ? 'check' : 'plus'} size={17} />{following ? 'Following' : 'Follow'}
          </button>
          <button className="btn btn-ghost" onClick={() => onOpenTrack(artist.tracks[0], true)}><Icon name="play" size={16} />Listen</button>
          <button className="btn btn-aura" onClick={() => onStartRoom(artist.tracks[0])}><Icon name="radio" size={16} />Open a room</button>
          <span className="chip chip-verified" style={{ marginLeft: 'auto' }}><Icon name="key" size={13} />Artist-owned space</span>
        </div>
      </div>

      {liveRooms.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>Live with {artist.name.split(' ')[0]} now</h2></div>
          <div className="rooms-strip">
            {liveRooms.map(r => <RoomCard key={r.code} room={r} people={data.people} onJoin={onJoinRoom} presence={presence} />)}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head"><h2>Releases</h2><span className="muted-3" style={{ fontSize: 13, fontWeight: 600 }}>{artist.tracks.length} tracks</span></div>
        <div className="catalog">
          {artist.tracks.map(t => <TrackCard key={t.id} track={t} onOpen={onOpenTrack} onOpenArtist={onOpenArtist} />)}
        </div>
      </div>
    </div>
  );
}

window.ArtistProfile = ArtistProfile;
