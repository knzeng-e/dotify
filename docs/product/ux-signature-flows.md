# Dotify UX signature flows

## Purpose

This document defines when Dotify should ask users to connect a wallet, sign a message, or submit an on-chain transaction.

The guiding principle is:

> Sign rarely, verify often.

Dotify must avoid wallet pop-up fatigue. Wallet prompts should appear only when they protect a meaningful boundary: full individual playback, host full-stream access, payments, artist publishing, or runtime ownership actions.

## UX rule summary

| Context | Wallet required? | Signature required? | Transaction required? |
| --- | --- | --- | --- |
| Browse catalog | No | No | No |
| Play preview | No | No | No |
| Join room as listener | No | No | No |
| Listen to host stream | No | No | No |
| Individual full playback | Yes | Yes, off-chain key request | Only if access requires payment |
| Room host full playback | Yes | Yes, off-chain key request | Only if access requires payment |
| Classic unlock | Yes | Maybe session signature + payment tx | Yes |
| Human Free unlock | Yes | Maybe session signature | No, unless proving/linking personhood requires one |
| Artist publishing | Yes | Yes/transaction depending on step | Yes for runtime/register actions |

## Individual playback flow

```mermaid
sequenceDiagram
  participant L as Listener
  participant UI as Dotify Frontend
  participant API as Dotify Backend
  participant RT as Artist SmartRuntime
  participant IPFS as IPFS Gateway

  L->>UI: Select protected track
  UI->>L: Request wallet connection if needed
  UI->>API: Request nonce(contentHash, purpose=individual)
  API-->>UI: Nonce + expiry
  UI->>L: Sign content-key request
  UI->>API: Submit signature + contentHash + purpose=individual
  API->>RT: musicAccCanAccess(contentHash, listener)
  RT-->>API: allowed / denied
  alt allowed
    API-->>UI: Temporary content key
    UI->>IPFS: Fetch encrypted audio
    IPFS-->>UI: Encrypted bytes
    UI->>UI: Decrypt locally
    UI-->>L: Full playback
  else denied
    API-->>UI: Preview-mode response
    UI-->>L: 42% preview + unlock/personhood CTA
  end
```

## Room playback flow

```mermaid
sequenceDiagram
  participant H as Host
  participant G as Room Guest
  participant UI as Dotify Frontend
  participant API as Dotify Backend
  participant RT as Artist SmartRuntime
  participant RTC as WebRTC Stream

  H->>UI: Create room from selected track
  UI->>API: Request nonce(contentHash, purpose=room_host)
  API-->>UI: Nonce + expiry
  UI->>H: Host signs key request
  UI->>API: Submit signature + purpose=room_host
  API->>RT: musicAccCanAccess(contentHash, host)
  RT-->>API: allowed / denied
  alt host allowed
    API-->>UI: Temporary content key for host only
    UI->>UI: Host decrypts full track
    UI->>RTC: Stream audio element capture
    G->>UI: Join room link
    UI-->>G: No wallet required
    RTC-->>G: Ephemeral audio stream
  else host denied
    API-->>UI: Preview-mode response
    UI->>UI: Host plays 42% preview
    G->>UI: Join room link
    UI-->>G: No wallet required
    RTC-->>G: Ephemeral preview stream
    UI-->>H: Discreet unlock/personhood CTA
    UI->>UI: Auto-advance after preview
  end
```

## Classic unlock flow

```mermaid
sequenceDiagram
  participant L as Listener
  participant UI as Dotify Frontend
  participant RT as Artist SmartRuntime
  participant API as Dotify Backend

  L->>UI: Click unlock full track
  UI->>L: Confirm Classic payment transaction
  L->>RT: musicRoyPayAccess(contentHash) + value
  RT-->>UI: Transaction confirmed
  UI->>API: Request content key after confirmation
  API->>RT: musicAccCanAccess(contentHash, listener)
  RT-->>API: allowed
  API-->>UI: Temporary content key
  UI-->>L: Full playback
```

## Human Free flow

```mermaid
sequenceDiagram
  participant L as Listener
  participant UI as Dotify Frontend
  participant API as Dotify Backend
  participant POP as Personhood Source
  participant RT as Artist SmartRuntime

  L->>UI: Select Human Free track
  UI->>API: Request content key or personhood check
  API->>POP: Verify personhood level or linked identity
  POP-->>API: DIM level / unavailable
  alt sufficient personhood
    API->>RT: musicAccCanAccess(contentHash, listener)
    RT-->>API: allowed
    API-->>UI: Temporary content key
    UI-->>L: Full playback
  else insufficient or unavailable
    API-->>UI: Preview-mode response
    UI-->>L: 42% preview + personhood CTA
  end
```

## Artist publishing flow

```mermaid
sequenceDiagram
  participant A as Artist
  participant UI as Artist Portal
  participant API as Dotify Backend
  participant IPFS as Pinata/IPFS
  participant RT as Artist SmartRuntime

  A->>UI: Connect wallet
  A->>UI: Upload audio + cover + metadata
  UI->>API: Upload assets
  API->>API: Validate, encrypt, pin
  API->>IPFS: Pin encrypted audio and metadata
  IPFS-->>API: CIDs
  API-->>UI: Dotify refs
  A->>RT: Register release with refs and access policy
  RT-->>UI: Registration confirmed
  UI-->>A: Release available in catalog
```

## UX principles

- Browsing must never require a wallet.
- Preview playback must never require a wallet.
- Room listening as a guest must never require a wallet.
- Full individual playback requires access verification.
- Full host room playback requires host access verification.
- Money movement still requires an explicit wallet transaction.
- Artist publishing must be explicit and reviewable.
- Dotify should prefer one session-level off-chain signature where feasible, not a signature per track.

## Non-goals

- Do not claim that WebRTC streams cannot be recorded.
- Do not give room guests content keys.
- Do not make social listening feel like an authentication ceremony.
