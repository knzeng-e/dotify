# A continuous listening surface

Partial [#392](https://github.com/knzeng-e/dotify/issues/392). The owner supplied a
67.6-second interaction video on 2026-11-05. Local review focused on the player
opening near 32 seconds, layered context actions near 12–18 seconds, and the Queue
sheet near 54–66 seconds. The video/reference frames remain local: no third-party
UI, notification content, branding or private source file is published here.

## The movement has a job

The persistent dock and full player are two views of the same listening session.
Explicit dock expansion rises from below; the player's collapse returns toward
the dock, with a shared artwork position when the browser supports View
Transitions. The existing provider's audio element remains outside those image
snapshots; no duplicate mounted player or new transport owner is introduced.
Automatic account/access/room redirects retain their existing navigation. Cancelling
an uncompleted room entry stays immediate, without waiting for a snapshot.

Queue is a mobile sheet above the still-playing player, with a handle, a compact
current-track/artist row and the existing play/pause action. Its list uses the
same controller choices, access checks and ordinary openTrack path; this is not
playlist storage or a new queue model. A short downward pull settles back, a pull
past 80px dismisses. Only the handle owns drag; the list and seek/form controls
keep normal scrolling. Desktop stays a bounded dialog.

## Reliability and accessibility

The existing Dialog retains its history lease, inert background, focus trap and
focus restoration. Close, Escape and Back use a 200ms presentation exit; selection
of another track follows the existing immediate, explicit access-checked path.
Repeated closes are ignored; unmount clears timers. The Queue trigger explicitly
focuses itself before opening so WebKit pointer activation also has a reliable
focus-restoration target. Closing from a pull continues from the current offset. Reduced motion closes and
navigates immediately. Unsupported/hidden View Transitions also commit immediately.
A reversed gesture commits earlier intent once before applying the latest intent,
and a delayed old callback cannot reopen an old route or clear a newer animation.
Ordinary navigation also invalidates pending work synchronously at intent time:
`NavigationProvider` wraps view, artist-profile and portal setters, including
Back/Forward and automatic redirects. Unmount and invitation-URL cleanup retire
pending captures too. Retirement marks the callback cancelled before skipping the
platform transition, so neither a late update nor a rejected-update fallback can
push obsolete history. The coordinator exempts only the synchronous application
of its own route, preserving the intended animation. A render/effect-only check
would miss same-view intent and leave a stale-history race.
No animation starts audio, leaves a room, requests a key or submits a payment.

[W3C View Transitions](https://www.w3.org/TR/css-view-transitions-1/) defines the
snapshot/update lifecycle. [WebKit documents Safari 18 support](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/),
but each embedded Host still needs capability detection and physical validation.
The 280–320ms client transitions and direct-manipulation sheet are progressive
enhancement; navigation and listening must work without them. No extra library,
service, schema migration or rollout occurs in this PR.

## Review and evidence

Review `playerMotion.ts` and its deferred-callback tests first, then its two
explicit UI callers and `NavigationProvider` route setters. Review `useQueueSheet.ts` with `PlayerQueueDialog.tsx` and
the existing Dialog/history contract. Finish with `listening-motion.css` and
browser evidence: current audio element identity, repeated expand/collapse,
short/long pulls, Escape/Back/focus, reduced/unsupported fallback and safe-area
geometry. Local/browser counts and remaining native limitations are recorded in
the PR. A matching rollout and physical iPhone gesture check remain separate.


Local validation: **1,081 unit tests** pass, including four deferred-transition
failure/reversal contracts. Web build and lint pass with the two existing
App.tsx hook warnings and existing bundle/Browserslist notices. Four WebKit
browser tests verify repeated expand/collapse, Queue drag/Escape/Back/focus,
reduced/unsupported fallback and unchanged membership/audio in a live room.
The final Chromium regression run passes **25 tests** across motion, six player
sizes, room arrival and host/guest access/continuity. Review captures are local
synthetic browser output; they do not claim physical native gesture acceptance.
No prior reference video or notification content is included in those captures.
The [verified 0.1.75 rollout](../backlog/implementation/evidence/product-0.1.75-rollout-2026-11-05.md)
now publishes matching Web/Product clients. Native Polkadot app gesture feel
still requires physical acceptance; the local evidence above is not that proof.


Review follow-up, 2026-11-05: **1,087 unit tests** pass, including seven
coordinator contracts. The six motion browser tests pass in both Chromium and
WebKit after synchronizing with merged dev (#390/#391). Two added tests hold a
snapshot callback, navigate through a primary tab or browser Back, then release
the stale callback: the newer view, history length and forward entry survive,
and the original audio element keeps playing. The motion fixture answers only its
two synthetic protected-manifest prefetches locally with a CORS-safe 404, keeping
external gateway availability out of the no-page-error assertion. Web build, targeted ESLint and
changed-file formatting checks pass. No deployment or physical acceptance is
claimed by this review fix.
