/* ============================================================================
   DOTIFY — Modals: create room · wallet · unlock
   ========================================================================= */
const { useState, useEffect, useMemo } = React;
function Modal({ children, onClose, align = 'center', wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="modal-overlay" data-align={align} onMouseDown={onClose}>
      <div className={'modal glass' + (wide ? ' modal-wide' : '')} onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-x btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        {children}
      </div>
    </div>
  );
}

/* ---- Create / share a room ---- */
function CreateRoomModal({ data, initialTrack, onClose, onOpenRoom }) {
  const { tracks } = data;
  const [picked, setPicked] = useState(initialTrack || tracks[0]);
  const [mood, setMood] = useState('Late night');
  const moods = ['Late night', 'Morning', 'Focus', 'Drive', 'Together'];
  const code = useMemo(() => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 30)]).join(''), []);

  return (
    <Modal onClose={onClose} wide>
      <div style={{ ...coverVars(picked) }}>
        <span className="eyebrow">Start a room</span>
        <h2 style={{ fontSize: 26, margin: '8px 0 4px' }}>As easy as sharing a link</h2>
        <p className="muted" style={{ marginBottom: 20 }}>Pick what's playing. Anyone with the link can listen with you — no wallet, no sign-up.</p>

        <div className="create-preview">
          <Cover track={picked} glyph={false} style={{ width: 92, height: 92, flex: '0 0 auto' }} />
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: 18, fontWeight: 700, display: 'block' }}>{picked.title}</strong>
            <span className="muted" style={{ display: 'block', marginBottom: 8 }}>{picked.artist}</span>
            <div className="create-link">
              <Icon name="link" size={15} style={{ color: 'var(--aura-accent)' }} />
              <span className="tnum">dotify.dot.li/r/{code}</span>
            </div>
          </div>
        </div>

        <label className="field-label">Now playing</label>
        <div className="track-picker">
          {tracks.map(t => (
            <button key={t.id} className={'track-pick' + (t.id === picked.id ? ' on' : '')} onClick={() => setPicked(t)} title={t.title}>
              <Cover track={t} glyph={false} style={{ width: '100%', height: '100%' }} />
            </button>
          ))}
        </div>

        <label className="field-label">Mood</label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          {moods.map(m => <button key={m} className={'chip' + (m === mood ? ' chip-on' : '')} onClick={() => setMood(m)} style={{ cursor: 'pointer', height: 32 }}>{m}</button>)}
        </div>

        <div className="row" style={{ gap: 12 }}>
          <button className="btn btn-lead" style={{ flex: 1 }} onClick={() => onOpenRoom({ code, host: data.people[0], track: picked, listenerIds: [], started: 'just now', mood })}>
            <Icon name="radio" size={18} />Open room & copy link
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
        <p className="muted-3" style={{ fontSize: 12.5, marginTop: 14, textAlign: 'center' }}>
          You'll host. Guests just listen — only you need access to the track.
        </p>
      </div>
    </Modal>
  );
}

/* ---- Wallet ---- */
function WalletModal({ wallet, onClose, onConnect, onDisconnect, supportingCount }) {
  if (wallet.connected) {
    return (
      <Modal onClose={onClose}>
        <span className="eyebrow">Your wallet</span>
        <div className="wallet-id">
          <span className="ava" data-style="orb" style={{ '--s': '52px', '--hue': 150 }}></span>
          <div>
            <strong className="tnum" style={{ fontSize: 18 }}>{wallet.address}</strong>
            <span className="muted" style={{ display: 'block', fontSize: 13 }}>dotify.dot.li handle linked</span>
          </div>
        </div>
        <div className="wallet-stats">
          <div><strong className="tnum">{wallet.balance}</strong><span>balance</span></div>
          <div><strong className="tnum">{supportingCount}</strong><span>artists supported</span></div>
          <div><strong className="tnum">3</strong><span>tracks unlocked</span></div>
        </div>
        <div className="trust-item" style={{ borderTop: 0, paddingBottom: 0 }}>
          <div className="trust-ic"><Icon name="lock" size={17} /></div>
          <div><strong>You hold your keys</strong><span>Dotify never sees your seed. Payments and access proofs are signed by you, on your device.</span></div>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 18 }} onClick={onDisconnect}>Disconnect</button>
      </Modal>
    );
  }
  return (
    <Modal onClose={onClose}>
      <span className="eyebrow">Connect</span>
      <h2 style={{ fontSize: 25, margin: '8px 0 6px' }}>Bring your wallet — keep your music</h2>
      <p className="muted" style={{ marginBottom: 22 }}>Connecting lets you unlock full tracks and pay artists directly. No account, no email. You can listen in rooms without it.</p>
      <button className="wallet-option" onClick={onConnect}>
        <div className="wallet-opt-ic" style={{ color: 'var(--green-soft)' }}><Icon name="key" size={20} /></div>
        <div><strong>Use a passkey</strong><span>Face or fingerprint. No extension, no seed phrase to write down.</span></div>
        <Icon name="chevron" size={18} style={{ color: 'var(--fg-3)' }} />
      </button>
      <button className="wallet-option" onClick={onConnect}>
        <div className="wallet-opt-ic" style={{ color: 'var(--cyan-soft)' }}><Icon name="wallet" size={20} /></div>
        <div><strong>Browser wallet</strong><span>Connect an existing Polkadot or EVM extension.</span></div>
        <Icon name="chevron" size={18} style={{ color: 'var(--fg-3)' }} />
      </button>
      <p className="muted-3" style={{ fontSize: 12.5, marginTop: 16, textAlign: 'center' }}>
        <Icon name="lock" size={12} style={{ verticalAlign: -1, marginRight: 4 }} />Your wallet handles the payment and the access proof.
      </p>
    </Modal>
  );
}

/* ---- Unlock (paid / human-free) ---- */
function UnlockModal({ track, wallet, onClose, onConnect, onPay, onPreview, paying }) {
  const isFree = track.mode === 'human-free';
  return (
    <Modal onClose={onClose}>
      <div style={{ ...coverVars(track), textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Cover track={track} glyph={false} style={{ width: 110, height: 110 }} />
        </div>
        {isFree ? (
          <>
            <h2 style={{ fontSize: 24, marginBottom: 6 }}>Free for verified humans</h2>
            <p className="muted" style={{ marginBottom: 20 }}><strong style={{ color: 'var(--fg)' }}>{track.title}</strong> is open to anyone who's a real person — no payment, no ad profile. {wallet.connected ? 'You\u2019re verified.' : 'Connect once to prove you\u2019re human.'}</p>
            {wallet.connected
              ? <button className="btn btn-lead" style={{ width: '100%' }} onClick={() => onPay(track)}><Icon name="check" size={18} />Unlock & play</button>
              : <button className="btn btn-lead" style={{ width: '100%' }} onClick={onConnect}><Icon name="users" size={18} />Verify I'm human</button>}
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 24, marginBottom: 6 }}>Unlock the full track</h2>
            <p className="muted" style={{ marginBottom: 18 }}><strong style={{ color: 'var(--fg)' }}>{track.price} DOT</strong> goes straight to <strong style={{ color: 'var(--fg)' }}>{track.artist}</strong> — no middle cut. You'll own the access proof.</p>
            <div className="unlock-price"><span className="muted-3" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>One-time</span><strong>{track.price} <span style={{ fontSize: 16, color: 'var(--aura-accent)' }}>DOT</span></strong></div>
            {wallet.connected
              ? <button className="btn btn-lead" style={{ width: '100%' }} onClick={() => onPay(track)} disabled={paying}>{paying ? 'Confirming…' : <><Icon name="heart" size={17} />Pay {track.price} DOT to the artist</>}</button>
              : <button className="btn btn-lead" style={{ width: '100%' }} onClick={onConnect}><Icon name="wallet" size={18} />Connect a wallet to unlock</button>}
          </>
        )}
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={onPreview}>Keep the 42% preview</button>
        <p className="muted-3" style={{ fontSize: 12, marginTop: 14 }}>Or open a room — guests listen free while you host.</p>
      </div>
    </Modal>
  );
}

Object.assign(window, { Modal, CreateRoomModal, WalletModal, UnlockModal });
