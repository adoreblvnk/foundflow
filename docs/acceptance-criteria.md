# End-to-end acceptance criteria

FoundFlow's challenge MVP is accepted only when all criteria below pass using staged or synthetic property. Real passenger records, identity documents, credentials, and serial numbers must never be committed.

## Intake and photos

- [x] When authentication is enabled, an unauthenticated request to a case or photo resource is rejected or redirected to login. The hosted demo may temporarily set `AUTH_DISABLED=true`.
- [x] A configured staff identity can sign in through an HTTP-only signed session cookie.
- [x] Staff can create a case with location, found time, and outer-item description.
- [x] PNG, JPEG, and WebP item photos can be uploaded at outer-item, bag-contents, or inner-container level.
- [x] Claimed image files with invalid byte signatures are rejected.
- [x] Item photos are stored outside Git and served through a non-cacheable application route.

## AI draft and review

- [x] Production analysis sends actual uploaded image bytes to the AI SDK v6 OpenAI provider and returns schema-validated nested records.
- [x] OCR text, visible attributes, confidence, review reason, parent relationship, quantity, and photo ID are retained.
- [x] Invalid photo IDs, invalid parents, duplicate temporary IDs, cycles, and sensitive categories are rejected, normalised, or forced into review without being silently trusted.
- [x] Cash, currency, identity documents, valuables, and serial identifiers cannot be finalised without staff confirmation.
- [x] Notes and coins are separated by ISO currency and denomination, use exact decimal arithmetic, and leave unreadable counts or values unresolved rather than guessed.
- [x] Rerunning AI analysis preserves records that staff added, confirmed, or corrected.
- [x] Empty or unsupported inference never falls back to fabricated fixture output.

## Corrections, persistence, and history

- [x] Staff can add, edit, confirm, and delete nested records.
- [x] Browser speech recognition fills a transcript; staff must review it and select **Apply** before a correction changes the item list.
- [x] A deterministic text-command fallback exercises the same correction path when Web Speech API is unavailable.
- [x] Cases, private photos, source links, and append-only activity events survive serverless function restarts through Turso and Vercel Blob.
- [x] State mutations and their corresponding audit records commit atomically.
- [x] Completion remains disabled until a photo exists and every review item is resolved.
- [x] Completed cases are locked against further mutation.
- [x] Confirmed item lists export as JSON and CSV; CSV cells resist spreadsheet-formula injection.

## Required verification

```bash
npm test
npm run typecheck
npm run lint
npm run test:ai
npm run build
npm audit --audit-level=moderate
```

The browser test additionally requires a running production server, configured test credentials, local Chrome, and a staged item photo; see `README.md` for `npm run test:e2e`.

## Explicit MVP boundaries

- Authentication is a single configured staff identity, not production RBAC or identity federation.
- Speech recognition depends on browser Web Speech API support; the checked transcript is the staff-confirmed action.
- Production inference uses the configured OpenAI API account and sends selected photos to that provider; it is not local inference.
- Codex CLI remains an optional local backup smoke path and is not used by the Vercel deployment.
- No FindX or external records-system write integration is claimed.
