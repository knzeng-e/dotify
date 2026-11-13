# Web/Product 0.1.83 delivery — 2026-11-13

**Delivered and independently verified; matching phone acceptance remains open.**
Web and `dotify-test01.dot` serve frozen release `929abe9306d0cc83fee4a74eb2f94b5416bdb8a5`,
from tested merged dev `0bb52754`. This brings the solo-to-Room continuity,
public artwork reuse and bounded local observation changes to users. Refs #395,
#388 and #407. [Machine-readable evidence](product-0.1.83-rollout-2026-11-13.json)
contains public artifact/readback facts; private reports, keys and histories stay
outside Git. The [preparation record](product-0.1.83-candidate-2026-11-13.md) retains
its earlier checkpoint.

## Artifact and readback

The [exact release CI](https://github.com/knzeng-e/dotify/actions/runs/43430333634)
and merged-dev CI are green. Verified Node 22.23.5 builds the package. Offline
verification authenticates 100 CAR blocks and compares 72 files; independent
finalized-chain/Bitswap readback then authenticates all 20 outer objects and
checks retention. Root/app DotNS records identify appVersion `[0,1,83]` and the
exact reviewed content/manifest; lab 0.3.1 is preserved.

- Application root: `bafybeietcvulu5opii4pg2ssxe7z2l422sns2nr3aheh7tijnm7k77jqiy`.
- CAR SHA-256: `64b121923712f8b9359e2925212118888dabee15a8ad513ff11178d98c5b4e26`.
- Actual use: **12 stores, eight one-off renewals, 9,508,017 application bytes,
  two DotNS signatures**, zero musical writes; one operation per object.
- At finalized Bulletin block 1630435, every object is retained, with earliest
  expiry 1831903. This is point-in-time retention, not a renewal service.

The owner published Netlify from the same release commit. Its observed
`clean=false` identity differs from the clean local Product build. A separate
Web reconstruction reproduces that flag using only an untracked non-code marker,
with unchanged tracked source and the existing public configuration. All 20
served files then match byte for byte. The 390×844 public shell opens with no
page errors or auth/upload/key requests; mutating HTTP methods are blocked by
the probe. This is shell evidence, not audible playback acceptance.

## Custody and operational boundaries

The owner authorizes the exact application budget, shared-account exclusion and
same-image restart; storage is reauthorized before signing. Custody is already
stopped when inspected. A separately approved waiting-process boot validates
14 inventories/five ready preparations with no active or uncertain work, then
restores its original configuration while stopped. No real recovery capture or
key transfer resumes.

The first local operator attempt fails during Node ESM linking before journal
creation or signing. Sequential dependency linking fixes the observed error;
three signer-free checks pass on the exact execution runtime before another
owner-activated signer is accepted. Its preflight now precedes key handoff.
No chain operation is repeated. Intent journals and signer cleanup remain;
the complete app budget is accounted for once.

After independent publication readback, custody starts once with the original
#426 image/configuration. The first health observation is too early; later
read-only verification gets health/readiness 200 twice, with unchanged protected
metadata/nonce fingerprints and an idle publisher lease. The earlier startup
failure's cause remains unproven. Public APIs and other server images are not
replaced; compact publication and #456 server proof optimization are not activated.
The signer variable is cleared and this operation's write authority is consumed.

## Separate CI Room-setup correction

The [#459 core-flow failure](https://github.com/knzeng-e/dotify/actions/runs/43434618336/job/131917725670)
is a distinct run from the green frozen release CI. Its trace shows a picker
click during the sheet's entry/scroll, then the default Classic track still
selected; the layout test consequently opens an access dialog.

The test-only fix at `6b4ec3d67c60592779d6d951c26beb85b980fe2d` waits for finite
entry motion and asserts the public choice is pressed before opening the Room.
No application source, timeout or layout assertion changes. Seven of eight
focused cases pass initially; the landscape case hits local ENOSPC while saving
a screenshot, not a UI assertion. After space is available, all six focused
portrait/landscape repetitions pass. Together the runs cover the eight selected
scenarios. Format/diff checks pass; renewed full #459 CI remains a separate check.

## Next acceptance

On the actual phone/Host, repeat same-track solo-to-Room preparation, Pause during
the wait, audible Web/Desktop guests, short and full-track locked listening,
Room-to-solo, repeated artwork locks/changes and disconnect. Use existing music;
copy the explicit local report before retrying. Startup latency and late native
artwork are not claimed fixed by deployment or browser tests. Keep #395/#388 open.
#407 server/format/capacity gates, conservation/access/value-flow acceptance and
the owner-deferred real independent recovery remain public-pilot requirements.
