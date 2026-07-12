# Dotify room access policy

## Purpose

This document defines how Dotify handles access control inside listening rooms.

The room is a social doorway. It should not become a wallet checkpoint.

## Core doctrine

Room playback is **host-access based**.

- The host is responsible for satisfying the track access policy.
- Room listeners join through a link without wallet/signature requirements.
- Room listeners receive only an ephemeral WebRTC stream.
- Room listeners never receive the encrypted source file or content key.

## Playback cases

| Track type | Host access | Room behavior | Listener wallet required? |
| --- | --- | --- | --- |
| Free / unrestricted | Not required | Full stream | No |
| Classic protected | Host paid/unlocked | Full stream | No |
| Classic protected | Host not unlocked | No protected stream + host unlock CTA; host switches to a playable track | No |
| Human Free protected | Host satisfies personhood | Full stream | No |
| Human Free protected | Host lacks personhood | No protected stream + host personhood CTA; host switches to a playable track | No |

## Room metadata

Room metadata should expose enough information for the UI and tests without leaking keys or protected source references.

Recommended shape:

```ts
type RoomPlaybackMode = 'full' | 'preview'; // preview is legacy wire compatibility only

type RoomMetadata = {
  roomId: string;
  title: string;
  hostDisplayName?: string;
  currentTrack?: {
    title: string;
    artist: string;
    contentHash?: `0x${string}`;
  };
  playbackMode: RoomPlaybackMode;
  hostAccessRequired: boolean;
  listenersNeedWalletAccess: false;
  listenerCount: number;
  createdAt: string;
};
```

Public room payloads deliberately omit wallet addresses, `audioRef`, and
source-bearing manifest references. The cover, title, artist, host pseudonym,
access label, real presence, and playback state are sufficient to enter a room.

## Unauthorized host fallback

If a host attempts to stream a protected track without access:

1. Dotify does not block or destroy the room.
2. Dotify withholds the protected stream; no preview audio is generated.
3. Dotify shows a discreet host-facing CTA:
   - `Unlock full stream` for Classic tracks;
   - `Verify personhood` for Human Free tracks.
4. Dotify keeps room metadata wire-compatible (`playbackMode: full`) while no protected audio is streamed.
5. The host can switch to a track they can play, including Free tracks.
6. Room guests stay in the room without wallet interruption.

Implementation note: access model v2 retired the 42% preview boundary. The
browser must not receive or derive the full-track production key merely to build
a teaser.

## Listener rule

Room listeners must not be required to connect a wallet, sign a message, pay, or prove personhood merely to listen to a host stream.

This is a product rule, not only a technical detail.

The listener receives presence. The host receives the key.

## Security boundary

Dotify protects source-file distribution access.

It does not claim that an authorized host stream cannot be recorded by someone hearing it.

The access policy prevents unauthorized users from directly fetching and decrypting full source audio through Dotify.

## Future policies

Future room policies may add:

- private rooms;
- invite-only rooms;
- artist-approved rooms;
- token-gated community rooms;
- personhood-only rooms;
- maximum listener limits;
- community moderation.

These future policies must not undermine the default low-friction public room principle unless explicitly designed and documented.

## Product mantra

Protect the artist without killing the room.
