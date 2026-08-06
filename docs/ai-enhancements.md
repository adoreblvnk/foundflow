# Further AI and matching enhancements

These improvements preserve FoundFlow's human-in-the-loop rule: models propose candidates and prioritise review; staff confirm records and ownership.

## 1. Incremental scanning for newly added photos

**Why:** Re-running the complete vision pipeline after one close-up repeats work and increases latency and cost.

**Approach:** Store a content hash and scan revision for each source photo. Analyse only new or changed photos, then reconcile their proposals against the current staff-owned hierarchy. Never overwrite confirmed staff records.

**Acceptance:** Adding one new photo does not resend unchanged photos. Existing staff edits remain intact. New records retain the new source-photo ID.

## 2. Fast OCR and barcode pre-pass

**Why:** Serial numbers, document fragments, product labels and currency text are strong retrieval features but do not always require a full multimodal reasoning pass.

**Approach:** Run a bounded OCR/barcode pass per photo in parallel with visual extraction. Supply the extracted text as untrusted observations to the structured model, then require staff confirmation for sensitive identifiers.

**Acceptance:** OCR text is linked to one source photo, never treated as instructions, masked where necessary, and does not bypass review.

## 3. Cross-photo deduplication with perceptual evidence

**Why:** Outer, inner and close-up views can show the same object more than once.

**Approach:** Generate image-region embeddings and perceptual hashes for candidate objects. Combine visual similarity with compatible category, visible text, colour and container context. Mark likely duplicates for review instead of merging automatically.

**Acceptance:** The interface explains which records may describe the same object and lets staff keep or merge them. No cross-photo merge occurs solely from overlapping normalized coordinates.

## 4. Hybrid lost-item candidate retrieval

**Why:** Exact text search misses differently worded descriptions, while pure semantic search can ignore decisive identifiers.

**Approach:** Retrieve candidates using structured filters first: status, date window, location, category, currency, brand and masked identifiers. Add multilingual text/image embeddings for broader recall, then rerank the small candidate set using verified attributes and contradictions.

**Acceptance:** Candidate results expose the matched and conflicting fields. Sensitive details remain staff-only. The system never approves ownership automatically.

## 5. Uncertainty-driven review ordering

**Why:** Staff should inspect high-risk and low-confidence records before ordinary objects.

**Approach:** Use deterministic policy first: identity documents, money, medication, serial identifiers, missing source links, quantity/box mismatch and invalid hierarchy. Within each policy tier, use calibrated model uncertainty to order the queue.

**Acceptance:** Every priority has an explainable reason. Model confidence cannot lower the required review tier for sensitive items.

## 6. Dedicated localisation pass only where needed

**Why:** A full strong-model verification pass improves boxes but adds latency to every case.

**Approach:** Keep the independent verification pass concurrent with extraction. Later, evaluate a cascade: accept only boxes that pass geometry and quantity checks; run a dedicated localisation retry for unresolved records or photos. Staff still inspect the rendered result.

**Acceptance:** The cascade is enabled only after evaluation on staged multi-photo cases shows no reduction in object or box agreement. Missing objects remain review-gated.

## 7. Scan telemetry and adaptive routing

**Why:** Provider choice should be based on measured case behavior rather than assumptions.

**Approach:** Record privacy-safe stage timing, image count, input dimensions, provider, fallback use, completion state and staff correction counts. Do not store prompts, image bytes or sensitive extracted values in telemetry.

**Acceptance:** The team can compare median and tail latency, failure rate, correction rate and cost per staged case. Routing changes require measured quality parity.

## 8. Photo-quality feedback before scanning

**Why:** Blur, glare, occlusion and unreadable denominations create slow scans that still require manual correction.

**Approach:** Run inexpensive local checks for blur, overexposure, image dimensions and likely occlusion immediately after upload. Ask for a specific retake before the expensive scan when quality is inadequate.

**Acceptance:** Feedback names one actionable problem, never blocks manual completion, and does not claim an object is absent merely because image quality is poor.

## Recommended order

1. Ship concurrent extraction/verification, real progress and stage telemetry.
2. Add incremental photo scanning.
3. Add OCR/barcode pre-processing.
4. Evaluate cross-photo duplicate suggestions on staged cases.
5. Build hybrid candidate retrieval and explainable reranking.
6. Introduce adaptive provider/localisation routing only after measured quality gates pass.
