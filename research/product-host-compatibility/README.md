# Product Host compatibility laboratory

This isolated Node project exercises published TrUAPI 0.25, 0.26, 0.29 and 0.31
codecs through an in-memory provider. It is not imported by Dotify. Installation
downloads npm packages; tests and reports make no network, real Host, account,
permission, balance or payment calls.

```sh
npm ci --ignore-scripts --prefix research/product-host-compatibility
npm test --prefix research/product-host-compatibility
npm run --silent report --prefix research/product-host-compatibility
```

Use Node 22. The lockfile pins all four aliased protocol packages. Fourteen
tests exercise fixed codec-3 handshakes, matched info responses, cross-version
decoding and the distinction between an API fingerprint and payment support.

All versions answer the same handshake. The 0.31 client cannot decode a 0.25
or 0.26 `system.info` response because its newer shape requires a trailing
`truapiVersion`. Old clients ignore that extra field. Versions 0.29 and 0.31
share this info shape despite different whole-API fingerprints. Neither a
handshake nor this one successful method establishes other methods' support.

`cashEnabled=false` describes this laboratory: it never supplies an executable
payment adapter. The matrix does not query actual device capabilities or grant
an entitlement. See the [upgrade decision](../../docs/design/product-sdk-host-upgrade-decision-2026-11-17.md)
for artifact identities, the phone/Desktop observations and the current hold.
