# Compact object reader candidate — 2026-11-11

Refs #407. Base: merged `dev` `8213d93fdce1c6ecf189da2224990bde234fb2d6`, whose
source matches the tested #434 candidate. Tested code:
**`f260e09b18d6fef9c05debd3c7fedbe91ae920f2`**. Documentation follows in a separate
commit. [Decision](../../../adr/0053-bulletin-compact-object-readers.md) ·
[Reader contract](../../../reference/bulletin-compact-reader.md).

## What this candidate proves

The fixed compact constructor can be read by internal API and Host adapters
through one portable range engine. The same disposable synthetic vector binds
the constructor, Node authentication and browser WebCrypto/object decryption.
Its key and ciphertext are public deterministic test fixtures, not artist data.
Only a selected object's intersecting children are reconstructed. The test trace
excludes the archive and other qualities and does not fetch the whole pack.

Authentication/scope and invalid-path/size failures occur before block I/O.
Fixed marker, exact authenticated manifest/root binding, CID corruption and
readdressed malformed UnixFS sizes/depth fail closed. A readdressed altered
ciphertext still fails the ordinary object-GCM verifier. Init/segment zero and
a one-segment rendition remain compatible with the fixed constructor.

Host cancellation returns promptly while actual SDK calls keep their slots
until settlement. Tests cover two outstanding cancelled SDK calls, refusal of
a third, reuse only after settlement, shared standard/compact media budgets,
owner retirement, input mutation and absence of a Host. The five existing Host
reader/public-asset cases remain green. No old registered reference is inferred
to be compact and no current route, player or publisher selects the new seams.

## Validation

| Check                                            | Result and scope                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Full API tests                                   | **452 passed / 42 suites**, zero failures or skips; includes 8 new reader cases and existing publication/journal/key/access/recovery coverage |
| API typecheck and build                          | Pass                                                                                                                                          |
| Full Web unit suite                              | **1,134 passed / 148 files**, including 8 new compact Host cases                                                                              |
| Focused Host suite                               | **13 passed**: 8 compact + 5 existing standard/public-asset cases                                                                             |
| Web and frozen Product DevNet builds             | Pass with API `node_modules` temporarily absent; restored afterwards                                                                          |
| Web lint                                         | Zero errors; two existing App hook warnings                                                                                                   |
| Web formatting and changed API source formatting | Pass                                                                                                                                          |
| Offline backlog consistency                      | Pass                                                                                                                                          |

The isolated Web/Product check verifies that importing the portable source does
not require installed API packages or Node dependencies. Platform codecs come
from each adapter's own dependency graph. Lockfiles, SDK and signer versions
are unchanged. Builds retain existing large-chunk warnings. No dependency audit
is rerun or claimed by this slice; #432/#433 retain their security scope.

## Limits and remaining acceptance

The fixtures contain authenticated synthetic bytes, not a playable AAC release.
This is not an audible test, a Host SDK integration test on a physical device,
a crowd/load/memory benchmark or a publication speed comparison. Accepted read
bytes, block counts, depth and query/SDK lifetimes are bounded as described in
the reference. Bounds do not prove acceptable latency or eliminate cold-seek
overfetch. SDK-internal allocation cannot be controlled by the caller.

Next: explicit registered reference and matching ordinary Web/API/Host dispatch,
immutable per-identity admission, then real AAC startup/seek/adaptation, legacy
playback, Room/background, first sound, restart/reconciliation and memory
acceptance. The API adapter takes an already authorized key and is not exposed
as an HTTP route. The Host adapter cannot grant an entitlement or a Room role.

No signer, production state, artist file or live Room was used. No image upload,
service maintenance, chain write, renewal, new allowance, key transfer or
deployment occurs. Custody remains #426; Web/Product/public APIs remain 0.1.82.
#407 stays open in the selected sequence before Room/artwork/CASH.
