# 02 — Server-side Pinata uploads

## Sprint
Sprint 0 — Production spine

## Priority
P0

## Objective
Move Pinata upload operations out of the browser and into the backend service.

The frontend must not expose `VITE_PINATA_JWT` or any unrestricted upload credential in production.

## Context
The prototype uploads audio, cover images, and metadata to Pinata directly from the browser. This is convenient but unsafe for public use because Vite exposes client-side environment variables in the built frontend.

## Scope
Implement backend-mediated upload endpoints and update the frontend artist portal to use them in production mode.

## Required endpoints

```txt
POST /api/uploads/audio
POST /api/uploads/cover
POST /api/uploads/metadata
```

## Required behavior

### Audio

- Accept multipart upload.
- Enforce size limits.
- Validate MIME type conservatively.
- Compute content hash server-side or verify a frontend-provided content hash.
- Encrypt audio server-side or accept already encrypted bytes only if the key never comes from bundled frontend config.
- Pin encrypted object to Pinata.
- Return a Dotify audio reference:

```txt
dotify:enc:ipfs://<CID>
```

### Cover

- Accept image upload.
- Enforce size and MIME limits.
- Pin to Pinata.
- Return `ipfs://<CID>`.

### Metadata

- Validate canonical Dotify metadata manifest shape.
- Pin JSON to Pinata.
- Return `ipfs://<CID>`.

## Security requirements

- Pinata JWT must live only in backend env.
- No upload endpoint should accept arbitrary unbounded files.
- Return typed error responses.
- Avoid logging raw file contents, secrets, or keys.
- Use upload-scoped limits.
- Add TODO markers for virus scanning/content moderation, but do not block this ticket on full moderation.

## Frontend integration

- Add `VITE_DOTIFY_API_URL`.
- Use backend uploads when `VITE_DOTIFY_API_URL` is configured.
- Keep current browser upload path only as `demo/local` mode and label it clearly.
- Remove references encouraging public use of browser Pinata JWT.

## Acceptance criteria

- Artist portal can upload audio, cover, and metadata through backend endpoints.
- Pinata JWT is no longer required in frontend production env.
- Existing local demo can still run with documented fallback.
- Upload failures show clear user-facing errors.
- README and `.env.example` are updated.

## Non-goals

- Do not implement final key delivery here; use Ticket 03 for wallet-gated key release.
- Do not introduce paid storage or billing logic.

## Senior-engineer notes

Treat uploads as hostile input. The endpoint is public attack surface. Make the happy path simple, but design the error path like someone will abuse it, because someone eventually will.