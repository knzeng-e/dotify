# Dotify agent working protocol

## Purpose

This file tells AI coding agents how to work inside the Dotify repository without losing the project's coherence.

Dotify has three inseparable layers:

1. product experience;
2. technical architecture;
3. philosophical/social purpose.

A change that improves one while damaging the others should be challenged.

## Before coding

Read, in this order:

1. `AGENTS.md` or `CLAUDE.md` depending on the agent;
2. `docs/context/README.md`;
3. `docs/backlog/README.md`;
4. the specific issue/ticket file under `docs/backlog/`;
5. related source files.

Do not start broad refactors unless the issue asks for them.

## Work pattern

For each task:

1. Restate the implementation target.
2. Identify affected modules.
3. Check existing behavior.
4. Implement the smallest coherent change.
5. Add or update tests.
6. Run relevant checks.
7. Update docs if setup, architecture, or behavior changes.

## Security posture

Assume public users are not trusted.

Assume frontend bundles are public.

Assume uploaded files are hostile.

Assume wallet/network/RPC/IPFS/signaling can fail.

Fail closed on access ambiguity.

Production content keys must never be bundled into the frontend. Room listeners must never receive content keys or encrypted source files.

## Product posture

Do not make the user feel the machinery first.

The first felt value should be:

```txt
I can listen with someone.
```

The second should be:

```txt
The artist remains sovereign.
```

The third should be:

```txt
The system is trustworthy.
```

## Room access doctrine

Room playback is host-access based.

- Individual full playback checks the listener's access.
- Room full playback checks the host's access.
- Room guests join without wallet/signature requirements.
- Room guests receive only the WebRTC stream.
- Unauthorized hosts should get 42% preview fallback, a discreet host CTA, and auto-advance.

Do not “secure” rooms by killing the social flow.

## Coding posture

- Prefer explicit types.
- Prefer small services/hooks.
- Prefer narrow PRs.
- Avoid new dependencies unless justified.
- Avoid unrelated formatting churn.
- Avoid vague catch-all errors.
- Avoid silent fallbacks.
- Avoid hiding dev-only assumptions.

## Documentation posture

When adding a production-relevant behavior, document:

- how to run it;
- what env vars it needs;
- what security boundary it provides;
- what it does not protect;
- how to test it.

When changing public product positioning, roadmap, room policy, architecture narrative, presentation links, or visual identity, update `docs/index.html` in the same PR.

## Review checklist

Before considering work done, ask:

- Does this keep secrets out of the frontend?
- Does this preserve or improve the shared-listening experience?
- Does this preserve artist sovereignty?
- Does this make failure modes visible?
- Does this reduce or contain complexity?
- Are room guests kept free from wallet friction unless explicitly required by a future documented policy?
- Are tests or manual verification steps included?
- Are docs updated where needed?

## Final rule

If a change makes Dotify more impressive to engineers but less usable or less coherent for humans, it is probably the wrong change right now.