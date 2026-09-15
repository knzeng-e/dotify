# Room keyboard transitions

Scope: follow-up to W10 / #151, based on `dev` at
`ee695caeaf18f4ce52f5ea71f48b8204d909162b`.

The supplied Polkadot Mobile recording contains a white frame during keyboard
opening. The page had gradient backgrounds but transparent computed root/body
background colors. In addition, composition resized artwork, hid the artist and
shrunk the timeline at the same time as removing navigation.

The correction gives html, body and the compact room an opaque navy backing.
WebKit's [underpage background](https://developer.apple.com/documentation/webkit/wkwebview/underpagebackgroundcolor)
is relevant here, but browser tests cannot establish the cause of every native
white frame. A host that supplies its own background or replaces its WebView can
still require a native correction.

The first viewport measurement now runs before paint. Empty or non-finite
viewport samples retain the last valid geometry and composition state. Focus
alone still does not change layout; measured keyboard occlusion does. Existing
zoom normalization, browser inset tracking, rotation, closing hysteresis and
pressed-control protection remain intact.

Artwork, artist metadata and timeline keep their size. Compact composition
reclaims gaps around tabs and chat instead, preserving the 44px composer and
transport controls even in a simulated 310px visible viewport. Only the root
scroll is constrained in a compact room; chat remains scrollable and ordinary
catalog scrolling returns on navigation. No audio element or draft is remounted.

## Verification

Automated evidence is recorded in the companion handoff. The regression covers
Chat and Requests, repeated opening/closing, transient zero/NaN measurements,
opaque backgrounds, stable player height, visible input, preserved audio/draft,
and restored catalog scrolling. Existing suites cover zoom, browser chrome,
rotation, hardware keyboards, pressed tabs, desktop and guest/host listening.

Physical-device acceptance remains: on the same Polkadot Mobile/iPhone build,
open Chat and Requests repeatedly, type, switch tabs, dismiss using Done and the
native keyboard control, rotate, and navigate back to Music while listening.
Record whether any native white frame remains. Simulated VisualViewport tests
are not a real iOS keyboard/compositor test.

No new permission, configuration, dependency, contract, key or deployment change.
