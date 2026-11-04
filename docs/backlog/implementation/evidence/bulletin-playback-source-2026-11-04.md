# Bulletin playback selection, 2026-11-04

Refs #288 / W33. The owner reports successful publication but silent playback on Web, Desktop and mobile, without a player error. This candidate fixes selection; it does not deploy or republish the release.

## Cause and correction

`bulletinAssetUrl` intentionally returns an empty URL list for a bare Bulletin audio directory: it is not a public cover or release JSON file. Consequently `resolveAudioAssetRef` returns no `localUrl` for this registered encrypted reference. `selectTrack` incorrectly required `localUrl` before entering protected audio preparation. It skipped the key/manifest/media path, left no source, and displayed “Full track opened”. The same guard skipped standby preparation.

Both paths now admit an encrypted track independently of a direct URL. Explicit selection still checks runtime access first, then requests an authorized key and invokes the existing authenticated streaming reader. Standby preparation still requires its existing live key grant. Unencrypted audio still needs its direct URL. A failed streaming operation enters the existing error/retry state.

Do not fabricate a Pinata/public-asset URL for Bulletin audio: native preimage and catalog-gated API readers own ciphertext delivery; neither grants a content key. This change preserves the registered identity, encryption, price, custody state and storage allowances. No server or environment changes are required.

## Evidence

Read-only live checks found the registered synthetic release in the fresh public catalog, with the expected artist/runtime/content hash, an encrypted Bulletin root, and active Classic access. The API returned HTTP 200 for its manifest (1,990 bytes), 96 kbps init (781 bytes) and first encrypted segment (48,419 bytes). These prove ciphertext availability, not authorized decryption or audible output.

The browser regression uses an isolated Classic fixture with a Bulletin reference and no `localUrl`. It checks that locked selection makes no key request; after simulated access approval, the real selection coordinator requests the key and attaches its deterministic media source. The fixture replaces payment/key/media adapters: it does not claim a real wallet payment or audible production playback. Existing transport tests separately cover native selection, API recovery and cancellation.

The owner must not publish again. After review and a client rollout, retry listening to the same registered release on Web/Desktop/mobile. Physical protected playback, retention/renewal, off-volume restore and the other W33 gates remain open.

Local validation: the new browser regression failed on the original selection guard (zero key requests after access approval), then passed with the correction. All 15 Classic browser scenarios pass, including denied access and uncertain-payment recovery. The six related unit suites pass (24 tests). Production Web build succeeds; lint reports zero errors and two existing `App.tsx` effect-dependency warnings. Build warnings concern existing dependency annotations, outdated Browserslist data and large chunks. This is a local client build, not a deployed Product release or audible device measurement.
