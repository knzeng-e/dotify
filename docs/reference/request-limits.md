# API request limits

These are the limits in the #434 security candidate. They describe source
behavior, not the deployed service version. For component rollout checks, use
[Verify a deployment configuration](../operations/deployment-configuration.md).

## Parsed JSON

[The app hook](../../services/api/src/app.ts) runs
[the structural guard](../../services/api/src/services/jsonBodyBudget.ts) before
route schemas validate parsed `application/json` and `application/*+json` bodies.
Byte limits and structural limits apply independently.

| Limit                                              | Maximum                                                 |
| -------------------------------------------------- | ------------------------------------------------------- |
| Default raw body                                   | 1 MiB (1,048,576 bytes); routes can set their own limit |
| Upload metadata body                               | 50 KiB (51,200 bytes)                                   |
| Nodes visited or scheduled by the structural guard | 8,192                                                   |
| Nesting depth                                      | 16; the root is depth 0                                 |
| Entries in one array                               | 256                                                     |
| Fields in one object                               | 128                                                     |
| Property name                                      | 256 UTF-16 code units                                   |
| String value                                       | 65,536 UTF-16 code units                                |

The structural guard refuses oversized input with HTTP **413** and code
`BODY_STRUCTURE_TOO_LARGE`, without accumulating or returning schema issues.
Byte-limit refusals belong to the parser or route and need not use that code.
A body inside these limits can still fail authentication, schema validation or
access checks. A limit never grants authority.

Actual Node `Readable` streams and `Buffer` instances forwarded to custody are
not traversed or consumed by this hook. Custody validates the parsed JSON body.
An ordinary JSON property named `pipe` does not bypass the guard. Multipart has
its own byte/part limits; this table does not set an audio upload allowance.
Private journals and persisted schemas are outside this network-body guard.

The guard mitigates request amplification independently of the validator. The
[#432 candidate](api-schema-compatibility.md) replaces Zod 3 with patched Zod 4
while retaining these limits; a source update is not a deployment record.


## Artist upload limits

The [upload routes](../../services/api/src/routes/uploads.ts) enforce ceilings
of 50 MiB for audio, 5 MiB for covers and 50 KiB for release metadata. The
[media checks](../../services/api/src/services/mediaValidation.ts) recognize MP3,
WAV, FLAC, M4A, AAC, Ogg and WebM audio, and JPEG, PNG, WebP and GIF artwork.
The [streaming encoder](../../services/api/src/services/streamingTranscoder.ts)
also checks decodability and a 15-minute duration ceiling.

File limits, temporary upload windows, Dotify release slots, and finalized
Bulletin authorization are independent. The authenticated routes return a
capacity conflict as HTTP 409 with code `STREAMING_PUBLICATION_CAPACITY`.
An accepted audio job can report the same detail under `failure.capacity` in
its owner-scoped status. Refill details contain only a public Bulletin account,
network genesis, and a finalized minimum expiry or shortfall. Byte counts are
decimal strings. If the shortfall covers only the retained renewal reserve,
`retainedOnly` is true. The slot response gives no Bulletin grant details.
See [resume after a capacity stop](../operations/bulletin-artist-publication.md#resume-after-a-capacity-stop).
