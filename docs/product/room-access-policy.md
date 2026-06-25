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
| Public / unrestricted | Not required | Full stream | No |
| Classic protected | Host paid/unlocked | Full stream | No |
| Classic protected | Host not unlocked | 42% preview + host unlock CTA + auto-advance | No |
| Human Free protected | Host satisfies personhood | Full stream | No |
| Human Free protected | Host lacks personhood | 42% preview + host personhood CTA + auto-advance | No |

## Room metadata

Room metadata should expose enough information for the UI and tests without leaking keys or protected source references.

Recommended shape:

```ts
type RoomPlaybackMode = 'full' | 'preview';

type RoomMetadata = {
  roomId: string;
  title: string;
  hostAddress?: `0x${string}`;
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

## Unauthorized host fallback

If a host attempts to stream a protected track without access:

1. Dotify does not block or destroy the room.
2. Dotify plays the 42% preview.
3. Dotify shows a discreet host-facing CTA:
   - `Unlock full stream` for Classic tracks;
   - `Verify personhood` for Human Free tracks.
4. Dotify updates room metadata to `playbackMode: preview`.
5. Dotify auto-advances to the next playlist track when the preview ends.
6. Room guests keep listening without wallet interruption.

Implementation note: for tracks encrypted with the backend-held production key,
the 42% preview requires a separate preview asset published with the track. The
browser must not receive or derive the full-track production key merely to build
a preview. See `docs/backlog/18-production-preview-assets.md`.

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
