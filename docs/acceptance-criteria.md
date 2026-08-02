# End-to-end acceptance criteria

FoundFlow's challenge MVP is accepted only when all criteria below pass using staged or synthetic property. Real passenger records, identity documents, credentials, and serial numbers must never be committed.

## Intake and photos

- [x] When authentication is enabled, an unauthenticated request to a case or photo resource is rejected or redirected to login. The hosted demo may temporarily set `AUTH_DISABLED=true`.
- [x] A configured staff identity can sign in through an HTTP-only signed session cookie.
- [x] Staff can create a case with location, found time, and outer-item description.
- [x] PNG, JPEG, and WebP item photos can be uploaded at outer-item, bag-contents, or inner-container level.
- [x] Photos may explicitly describe a loose or standalone item with no container; container nesting is optional rather than assumed.
- [x] Claimed image files with invalid byte signatures are rejected.
- [x] Item photos are stored outside Git and served through a non-cacheable application route.

## AI draft and review

- [x] Production analysis sends actual uploaded image bytes to the AI SDK v6 OpenAI provider and returns schema-validated nested records.
- [x] Every photo scan receives a second independent verification pass using the configured strong vision model for tighter full-image object regions; failures retain the primary draft under review.
- [x] OCR text, visible attributes, confidence, review reason, parent relationship, quantity, and photo ID are retained.
- [x] Readable or unmistakable product brands and visible model names are included in item-list labels; uncertain brands, models, and authenticity are never inferred.
- [x] Both fast extraction and strong verification return one normalised photo region per visible physical instance, including uncertain objects and the visible outer property; invalid coordinates and count mismatches require review.
- [x] Currency fields force the canonical currency item type even when the model returns an inconsistent type label.
- [x] A visible outer property updates the existing root record with a proposed region instead of creating a duplicate item.
- [x] Invalid photo IDs, invalid parents, duplicate temporary IDs, cycles, and sensitive categories are rejected, normalised, or forced into review without being silently trusted.
- [x] Cash, currency, identity documents, valuables, and serial identifiers cannot be finalised without staff confirmation.
- [x] Money, identification documents, and perishable items require one explicit staff confirmation before completion.
- [x] Notes and coins use exact decimal arithmetic when currency, denomination, and count are known; unreadable values may be staff-confirmed without contributing to currency totals.
- [x] Rerunning AI analysis preserves records that staff added, confirmed, or corrected.
- [x] Empty or unsupported inference never falls back to fabricated fixture output.

## Corrections, persistence, and history

- [x] Staff can add, edit, confirm, and delete nested records.
- [x] Staff can select a record or box, compare cropped instances with the source photo, draw or remove boxes, and reassign boxes between records linked to the same photo.
- [x] Visual verification occupies the wider inventory column so source images and region boxes remain large enough for practical review.
- [x] Visual verification reports marked-versus-listed instance coverage and gives every box a unique visible number; missing boxes remain explicit staff work and staff are reminded to inspect for unlisted objects.
- [x] Photo scanning is launched directly below the item-photo gallery and before the add-photo form.
- [x] Currency totals appear after the item list rather than interrupting visual review.
- [x] Review and coverage warnings remain short; full technical reasons remain available through detail text or hover titles.
- [x] Confirmed records with photo regions require one region per visible instance.
- [x] Browser speech recognition fills a transcript; staff must review it and select **Apply** before a correction changes the item list.
- [x] A deterministic text-command fallback exercises the same correction path when Web Speech API is unavailable.
- [x] Cases, private photos, source links, and append-only activity events survive serverless function restarts through Turso and Vercel Blob.
- [x] State mutations and their corresponding audit records commit atomically.
- [x] Completion remains disabled until a photo exists and every review item is resolved.
- [x] Completed cases are locked against further mutation.
- [x] Confirmed item lists export photo regions in JSON and CSV; CSV cells resist spreadsheet-formula injection.

## Collection and handover

- [x] Every handover requires a persisted claim, staff decision, reason and claimant acknowledgement.
- [x] Walk-in claims remain valid when ownership is established without a prior lost report.
- [x] Claim creation and approval both enforce at least two independent evidence groups.
- [x] Identity-bearing property requires an identity check plus an independent ownership signal.
- [x] Lost-report claims record the supplied ID without falsely claiming an external-system link.
- [x] Complete Singapore identity numbers are rejected from staff notes; masked references are validated.
- [x] Concurrent or repeated decisions cannot create a second transition or false audit event.
- [x] Rejected or escalated claims remain in activity history and permit a later claim; collected property does not.

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
