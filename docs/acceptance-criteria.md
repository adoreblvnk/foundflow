# End-to-end acceptance criteria

FoundFlow's challenge MVP is accepted only when all criteria below pass using staged or synthetic evidence. Real passenger records, identity documents, credentials, and serial numbers must never be committed.

## Intake and evidence

- [x] An unauthenticated request to a case or evidence resource is rejected or redirected to login.
- [x] A configured staff identity can sign in through an HTTP-only signed session cookie.
- [x] Staff can create a case with location, found time, and outer-custody description.
- [x] PNG, JPEG, and WebP evidence up to 5 MiB can be uploaded at outer-item, bag-contents, or inner-container level.
- [x] Claimed image files with invalid byte signatures are rejected.
- [x] Evidence files are stored outside Git and served only through an authenticated, non-cacheable route.

## AI draft and review

- [x] Live analysis sends actual uploaded image bytes to the AI SDK v6 Codex CLI provider and returns schema-validated nested records.
- [x] OCR text, visible attributes, confidence, review reason, parent relationship, quantity, and evidence ID are retained.
- [x] Invalid evidence IDs, invalid parents, duplicate temporary IDs, cycles, and sensitive categories are rejected, normalised, or forced into review without being silently trusted.
- [x] Cash, currency, identity documents, valuables, and serial identifiers cannot be finalised without staff confirmation.
- [x] Notes and coins are separated by ISO currency and denomination, use exact decimal arithmetic, and leave unreadable counts or values unresolved rather than guessed.
- [x] Rerunning AI analysis preserves records that staff added, confirmed, or corrected.
- [x] Empty or unsupported inference never falls back to fabricated fixture output.

## Corrections, persistence, and custody

- [x] Staff can add, edit, confirm, and delete nested records.
- [x] Browser speech recognition fills a transcript; staff must review it and select **Apply** before a correction changes the manifest.
- [x] A deterministic text-command fallback exercises the same correction path when Web Speech API is unavailable.
- [x] Cases, uploads, source provenance, and append-only audit events survive a process restart in SQLite.
- [x] State mutations and their corresponding audit records commit atomically.
- [x] Finalisation remains disabled until evidence exists and every review item is resolved.
- [x] Finalised cases are locked against further mutation.
- [x] Approved manifests export as authenticated JSON and CSV; CSV cells resist spreadsheet-formula injection.

## Required verification

```bash
npm test
npm run typecheck
npm run lint
npm run test:ai
npm run build
npm audit --audit-level=moderate
```

The browser test additionally requires a running production server, configured test credentials, local Chrome, and staged evidence; see `README.md` for `npm run test:e2e`.

## Explicit MVP boundaries

- Authentication is a single configured staff identity, not production RBAC or identity federation.
- Speech recognition depends on browser Web Speech API support; the checked transcript is the officer-confirmed action.
- Codex CLI inference uses the signed-in provider account and may send staged evidence to that provider; it is not local inference.
- `node:sqlite` is emitted with Node's experimental-feature warning on the tested Node 24 runtime.
- No FindX or external records-system write integration is claimed.
