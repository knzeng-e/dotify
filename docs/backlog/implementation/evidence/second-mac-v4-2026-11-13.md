# Refreshed generated second-Mac reader — 2026-11-13

The owner reports **V4: reconstruction OK / authentication OK** on the selected
Apple Silicon M4 Mac with Docker Desktop. This updates the earlier
[portable-v2 acceptance](second-mac-synthetic-2026-11-13.md), which used an older
runtime. Destination raw reports were not inspected remotely. No real artist
music, private master, signing key or service recovery is accepted by this result.

The v3 producer trial passed locally, but the Mini stopped after archive-copy
progress on Docker's `getent` lookup for `501:20`. V4 reuses the immutable v3
image/data and replaces that transport with the image's ordinary Linux `node`
account creating private files itself through stdin. Exclusive/no-follow opens,
length/hash checks and ownership checks remain; root only prepares empty volumes
before payload entry. No reader runs as root or changes ownership of incoming
keys. No host bind or network is available to the reader.

Artifact-bound identities:

- v4 launcher: 14,839 bytes; SHA-256
  `48d0b91ef78cbdb3d3cf5c6ed2fcaf619a6e4da30c2b555757e6caa054ea8b0c`.
- Reused v3 ZIP: 145,813,118 bytes; SHA-256
  `01f84ff74c57c22cc873232a663ae1bc7bd47afb42444918bf6bdd907b5813a3`.
- Linux arm64 reader config:
  `sha256:9879d34bd38efc8f6c0062b5b8c848b38d5af1d37879eaa74bdf1667fa2da0d4`.
- Reader filesystem uses the tested API tree
  `8a740639942fe2f39539e05cecf880e3f5b1ec3d` and maintained Node 22.23.5 recipe
  from #450; the derivative adds a package identity label only.

The local cold-import trial checks 55 input files, reconstructs both standard
and compact layouts, then authenticates fourteen generated structural objects
per layout after input-volume removal. Eight ingress refusal cases and changed
base-manifest/fixture controls pass. A CLI shim models the reported copy/user
lookup failure; it is not an execution on the Mini's older engine. The owner
report is the separate physical destination observation.

A subsequent **local** macOS encrypted-staging bridge uses two AES-256 images
and public, distinct passwords. The same 55 data files enter from a read-only
mounted image. A separate public key enters a private 128-KiB Docker tmpfs
straight on stdin, without a temporary plaintext host key file. Input Docker
storage is removed and both encrypted input images are detached before readback.
Both layouts authenticate fourteen objects; writer/history/key-origin flags
stay false. Reader UID1000, no network/host bind, read-only root, dropped
capabilities, no new privileges, one CPU/1-GiB memory with no extra cgroup swap
and 64-PID limits are inspected. Scoped temporary resources are removed.
The bridge is not a Mini/AirDrop transfer or real-key custody/provenance result.

## Remaining boundary

These generated structural objects are not a real AAC/audibility test. Real
independent data and separately recovered masters, original current history,
service/image rollback, capacity and physical listening remain unaccepted.
A metadata-only checkpoint with pruned audio cannot complete audio recovery;
the [separate published-graph archive candidate](../../../operations/bulletin-published-archive.md)
addresses the data side without fabricating queue files or changing history.
No new live capture, download, key export or deployment is authorized here.
