/* ============================================================================
   DOTIFY — Artist studio: overview · publish · releases · royalties
   ========================================================================= */
const { useState } = React;

const AURA_PRESETS = [
  { a: '#6a7bff', b: '#9b6aff', accent: '#7d8bff', deg: 160 },
  { a: '#ffc05c', b: '#ff5e3a', accent: '#ff9a4d', deg: 145 },
  { a: '#2bd3e8', b: '#1f8a8f', accent: '#2bd3e8', deg: 150 },
  { a: '#ff6a9a', b: '#ff9ec4', accent: '#ff6a9a', deg: 135 },
  { a: '#29e87a', b: '#1f9e8f', accent: '#29e87a', deg: 155 },
];

function StudioGate({ onShowWallet, onExit }) {
  return (
    <div className="studio" style={{ maxWidth: 560 }}>
      <button className="btn btn-ghost btn-sm" onClick={onExit} style={{ marginBottom: 24 }}>
        <Icon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} />Back to listening
      </button>
      <div className="glass" style={{ padding: 28 }}>
        <span className="eyebrow">For artists</span>
        <h1 style={{ fontSize: 28, margin: '10px 0 8px' }}>Your music. Your space. Your rules.</h1>
        <p className="muted" style={{ marginBottom: 22 }}>Publishing on Dotify gives you a runtime you own — you set access, rights and how value flows back. Connect once to open your studio.</p>
        <button className="btn btn-lead" onClick={onShowWallet}><Icon name="key" size={18} />Connect & open studio</button>
        <p className="muted-3" style={{ fontSize: 12.5, marginTop: 14 }}><Icon name="lock" size={12} style={{ verticalAlign: -1, marginRight: 4 }} />You keep your keys. Dotify never takes custody of your catalog.</p>
      </div>
    </div>
  );
}

function StudioOverview({ data, artist, tracks, onPublish, onOpenTrack }) {
  const listeners = tracks.reduce((n, t) => n + t.nowListening, 0);
  const earned = (data.royalties.reduce((n, r) => n + parseFloat(r.amount), 0)).toFixed(2);
  return (
    <div className="studio-grid">
      <div>
        <div className="metric-row">
          <div className="metric-card glass"><div className="v tnum">{tracks.length}</div><div className="k">Releases</div></div>
          <div className="metric-card glass"><div className="v tnum">{listeners}</div><div className="k">Listening now</div></div>
          <div className="metric-card glass"><div className="v tnum">{earned} <small>DOT</small></div><div className="k">Earned · paid direct</div></div>
        </div>

        <div className="glass" style={{ padding: 18, marginBottom: 22 }}>
          <div className="spread" style={{ marginBottom: 6 }}>
            <p className="studio-section-title" style={{ margin: 0 }}>Your releases</p>
            <button className="btn btn-aura btn-sm" onClick={onPublish}><Icon name="plus" size={15} />New release</button>
          </div>
          {tracks.map(t => (
            <div className="release-row" key={t.id} onClick={() => onOpenTrack(t)} style={{ cursor: 'pointer' }}>
              <Cover track={t} glyph={false} />
              <div className="meta"><strong>{t.title}</strong><span>{t.mode === 'human-free' ? 'Free for humans' : `${t.price} DOT`} · {t.year}</span></div>
              <div className="stat"><span className="live-dot" style={{ background: 'var(--aura-accent)', display: 'inline-block', marginRight: 6 }}></span>{t.nowListening} now</div>
            </div>
          ))}
        </div>

        <div className="glass" style={{ padding: 18 }}>
          <p className="studio-section-title">Latest support</p>
          {data.royalties.slice(0, 3).map(r => (
            <div className="roy-row" key={r.id}>
              <Avatar person={r.who} size={36} style="initials" />
              <div className="meta"><strong>{r.who.name}</strong><span>unlocked {r.track.title}</span></div>
              <div><div className="amt">+{r.amount} DOT</div><div className="when" style={{ textAlign: 'right' }}>{r.when}</div></div>
            </div>
          ))}
        </div>
      </div>

      <aside className="sovereign-card glass">
        <h3>You own this space</h3>
        <p>Not a profile on a platform — a runtime that's yours.</p>
        <div className="sov-item"><div className="sov-ic"><Icon name="key" size={16} /></div><div><strong>You hold the keys</strong><span>Your catalog can't be quietly taken down or re-listed without you.</span></div></div>
        <div className="sov-item"><div className="sov-ic"><Icon name="lock" size={16} /></div><div><strong>You set the access</strong><span>Free for verified humans, or a price in DOT — per track, your call.</span></div></div>
        <div className="sov-item"><div className="sov-ic"><Icon name="heart" size={16} /></div><div><strong>Value flows to you</strong><span>Payments land in your wallet directly, split how you define. No middle cut.</span></div></div>
      </aside>
    </div>
  );
}

function PublishFlow({ artist, onPublished }) {
  const steps = ['Assets', 'Details', 'Access', 'Review'];
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    title: 'Untitled release', desc: '', tags: 'Harp, Gabon',
    mode: 'classic', price: '0.40', royalty: 80, auraIdx: 0,
  });
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const aura = AURA_PRESETS[draft.auraIdx];
  const previewTrack = { title: draft.title || 'Untitled', artist: artist.name, aura, mode: draft.mode, price: draft.price, verified: artist.verified };

  return (
    <div className="publish-grid">
      <div>
        <div className="stepper">
          {steps.map((s, i) => (
            <div className="s" key={s} data-state={i === step ? 'active' : i < step ? 'done' : 'idle'} onClick={() => setStep(i)} style={{ cursor: 'pointer' }}>
              <span className="n">{i < step ? '✓' : i + 1}</span><span>{s}</span>
            </div>
          ))}
        </div>

        <div className="publish-panel glass" style={coverVars(previewTrack)}>
          {step === 0 && (
            <>
              <h2>Bring your track in</h2>
              <p className="hint">Your audio is encrypted before it ever leaves the browser. Only listeners who meet your access rule get a key.</p>
              <div className="dz-row">
                <div className="dropzone"><div className="di"><Icon name="volume" size={20} /></div><strong>Drop audio</strong><span>wav · flac · mp3</span></div>
                <div className="dropzone"><div className="di"><Icon name="sparkle" size={20} /></div><strong>Drop cover</strong><span>or pick a light below</span></div>
              </div>
              <label className="f-label">Cover light</label>
              <div className="row" style={{ gap: 10 }}>
                {AURA_PRESETS.map((p, i) => (
                  <button key={i} onClick={() => set('auraIdx', i)} title="Aura"
                    style={{ width: 46, height: 46, borderRadius: 12, ...{ '--c-a': p.a, '--c-b': p.b, '--c-deg': p.deg + 'deg' }, background: `linear-gradient(${p.deg}deg, ${p.a}, ${p.b})`, boxShadow: draft.auraIdx === i ? `0 0 0 2px ${p.accent}, 0 6px 16px -6px ${p.accent}` : 'inset 0 0 0 1px rgba(255,255,255,.15)' }}></button>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Tell its story</h2>
              <p className="hint">A title and a few honest words. This is how a listener meets your work before they hear a note.</p>
              <label className="f-label">Title</label>
              <input className="f-input" value={draft.title} onChange={e => set('title', e.target.value)} />
              <label className="f-label">Description</label>
              <textarea className="f-area" value={draft.desc} placeholder="Where it comes from, who played on it, what it's for…" onChange={e => set('desc', e.target.value)} />
              <label className="f-label">Tags</label>
              <input className="f-input" value={draft.tags} onChange={e => set('tags', e.target.value)} />
            </>
          )}
          {step === 2 && (
            <>
              <h2>How should it circulate?</h2>
              <p className="hint">You decide who can listen — and what they give back. You can change this later.</p>
              <div className="access-choice">
                <button className="access-opt" data-on={draft.mode === 'human-free'} onClick={() => set('mode', 'human-free')}>
                  <div className="ao-ic"><Icon name="users" size={18} /></div>
                  <strong>Free for humans</strong>
                  <p>Open to anyone verified as a real person. No payment, no ad profile.</p>
                </button>
                <button className="access-opt" data-on={draft.mode === 'classic'} onClick={() => set('mode', 'classic')}>
                  <div className="ao-ic"><Icon name="heart" size={18} /></div>
                  <strong>Paid in DOT</strong>
                  <p>A one-time unlock. The payment lands in your wallet directly.</p>
                </button>
              </div>
              {draft.mode === 'classic' && (
                <div className="price-row">
                  <div className="price-input"><input value={draft.price} onChange={e => set('price', e.target.value)} /><span className="u">DOT</span></div>
                  <span className="muted" style={{ fontSize: 13 }}>per unlock · listeners keep the access proof</span>
                </div>
              )}
              <label className="f-label" style={{ marginTop: 22 }}>Royalty split · you keep {draft.royalty}%</label>
              <div className="royalty-split">
                <div className="split-bar"><i style={{ width: draft.royalty + '%', background: 'var(--aura-accent)' }}></i><i style={{ width: (100 - draft.royalty) + '%', background: 'var(--glass-2)' }}></i></div>
                <input className="range" type="range" min="50" max="100" value={draft.royalty} onChange={e => set('royalty', +e.target.value)} />
                <p className="muted-3" style={{ fontSize: 12.5, marginTop: 6 }}>{draft.royalty}% to you · {100 - draft.royalty}% to collaborators (set addresses at publish)</p>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2>Ready to publish</h2>
              <p className="hint">This registers the release on your runtime and mints the original to you. Encrypted audio is pinned to IPFS.</p>
              <div className="preview-meta" style={{ borderTop: 0, paddingTop: 0 }}>
                <div className="pm"><span>Title</span><strong>{draft.title}</strong></div>
                <div className="pm"><span>Access</span><strong>{draft.mode === 'human-free' ? 'Free for humans' : `${draft.price} DOT`}</strong></div>
                <div className="pm"><span>You keep</span><strong>{draft.royalty}%</strong></div>
                <div className="pm"><span>Runtime</span><strong style={{ color: 'var(--cyan-soft)' }}>{artist.runtime}</strong></div>
                <div className="pm"><span>Storage</span><strong>Encrypted · IPFS</strong></div>
              </div>
            </>
          )}

          <div className="publish-foot">
            <button className="btn btn-ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
            {step < 3
              ? <button className="btn btn-lead" onClick={() => setStep(s => s + 1)}>Continue<Icon name="arrowRight" size={17} /></button>
              : <button className="btn btn-lead" onClick={() => onPublished(draft.title)}><Icon name="check" size={17} />Publish release</button>}
          </div>
        </div>
      </div>

      <aside className="preview-card glass" style={coverVars(previewTrack)}>
        <div className="pc-eyebrow">Live preview</div>
        <Cover track={previewTrack} glyph={false} className="preview-cover" />
        <h3>{draft.title || 'Untitled'}</h3>
        <div className="pby">{artist.name}{artist.verified && <VerifiedMark size={12} />}</div>
        <AccessChip track={previewTrack} />
        <div className="preview-meta">
          <div className="pm"><span>How it circulates</span><strong>{draft.mode === 'human-free' ? 'Free · humans' : 'Paid · DOT'}</strong></div>
          <div className="pm"><span>You keep</span><strong>{draft.royalty}%</strong></div>
        </div>
      </aside>
    </div>
  );
}

function StudioReleases({ tracks, onOpenTrack }) {
  return (
    <div className="glass" style={{ padding: 18, maxWidth: 760 }}>
      <p className="studio-section-title">All releases · {tracks.length}</p>
      {tracks.map(t => (
        <div className="release-row" key={t.id}>
          <Cover track={t} glyph={false} />
          <div className="meta"><strong>{t.title}</strong><span>{t.tags.join(' · ')} · {t.year}</span></div>
          <AccessChip track={t} />
          <button className="btn btn-ghost btn-sm" onClick={() => onOpenTrack(t)}>Open</button>
        </div>
      ))}
    </div>
  );
}

function StudioRoyalties({ data, tracks }) {
  const earned = (data.royalties.reduce((n, r) => n + parseFloat(r.amount), 0)).toFixed(2);
  return (
    <div className="studio-grid">
      <div className="glass" style={{ padding: 18 }}>
        <div className="spread" style={{ marginBottom: 14 }}>
          <p className="studio-section-title" style={{ margin: 0 }}>Direct payments</p>
          <span className="chip"><Icon name="globe" size={13} />on-chain · auditable</span>
        </div>
        {data.royalties.map(r => (
          <div className="roy-row" key={r.id}>
            <Avatar person={r.who} size={38} style="initials" />
            <div className="meta"><strong>{r.who.name}</strong><span>unlocked {r.track.title}</span></div>
            <div style={{ textAlign: 'right' }}><div className="amt">+{r.amount} DOT</div><div className="when">{r.when}</div></div>
          </div>
        ))}
      </div>
      <aside className="metric-card glass" style={{ padding: 20 }}>
        <span className="eyebrow">All time</span>
        <div className="v tnum" style={{ fontSize: 38, fontWeight: 800, margin: '10px 0 2px' }}>{earned} <small style={{ fontSize: 18, color: 'var(--aura-accent)' }}>DOT</small></div>
        <div className="k" style={{ marginBottom: 16 }}>paid straight to your wallet</div>
        <p className="muted-3" style={{ fontSize: 12.5, lineHeight: 1.5 }}>Every unlock settles on-chain to the split you defined. No payout schedule, no platform cut — it's already yours.</p>
      </aside>
    </div>
  );
}

function ArtistStudio({ data, wallet, onExitPortal, onShowWallet, onOpenTrack, onToast }) {
  const [tab, setTab] = useState('overview');
  const artist = data.artistSelf;
  const tracks = artist.trackIds.map(id => data.byId(id));

  // give the studio a calm signature aura
  React.useEffect(() => {
    const r = document.documentElement, a = AURA_PRESETS[0];
    r.style.setProperty('--aura-a', a.a); r.style.setProperty('--aura-b', a.b);
    r.style.setProperty('--aura-accent', a.accent); r.style.setProperty('--aura-deg', a.deg + 'deg');
  }, []);

  if (!wallet.connected) return <StudioGate onShowWallet={onShowWallet} onExit={onExitPortal} />;

  return (
    <div className="studio">
      <div className="studio-head">
        <div className="studio-avatar"></div>
        <div className="studio-id">
          <h1>{artist.name}{artist.verified && <VerifiedMark size={20} />}</h1>
          <div className="sub"><span>@{artist.handle}</span><code>{artist.runtime}</code><span>· since {artist.joined}</span></div>
        </div>
        <div className="spacer"></div>
        <button className="btn btn-ghost btn-sm" onClick={onExitPortal}><Icon name="headphones" size={16} />Listener app</button>
        <button className="btn btn-lead btn-sm" onClick={() => setTab('publish')}><Icon name="plus" size={16} />New release</button>
      </div>

      <div className="studio-tabs">
        {[['overview', 'Overview'], ['publish', 'Publish'], ['releases', 'Releases'], ['royalties', 'Royalties']].map(([id, label]) => (
          <button key={id} className="studio-tab" data-active={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && <StudioOverview data={data} artist={artist} tracks={tracks} onPublish={() => setTab('publish')} onOpenTrack={onOpenTrack} />}
      {tab === 'publish' && <PublishFlow artist={artist} onPublished={(title) => { onToast(`"${title}" published to your runtime`); setTab('releases'); }} />}
      {tab === 'releases' && <StudioReleases tracks={tracks} onOpenTrack={onOpenTrack} />}
      {tab === 'royalties' && <StudioRoyalties data={data} tracks={tracks} />}
    </div>
  );
}

window.ArtistStudio = ArtistStudio;
