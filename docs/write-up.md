# FoundFlow - Launchpad 2026 Write-up

Staff-confirmed, photo-linked item logging for Changi Airport's Lost & Found.

---

## 1. Problem

Changi Airport handles **54,000 lost items per year** across four terminals serving 58.9 million passengers [1]. When a bag contains 10-15 nested items with mixed-currency cash requiring exact denomination counts, staff spend 20-30 minutes documenting by hand - photographing, then typing every label, quantity, and currency total.

**Scale of the problem:**

- SPF's Found and Unclaimed Property Office processed **50,000 found property reports in 2024**, up from 42,000 in 2022 [2]
- SITA estimates repatriation costs of up to **US$95 per item** [3]
- ICA officers at checkpoints spent ~8 minutes to report and ~10 minutes to search for a single item using physical logbooks [4]

**Why existing approaches fall short:**

- **FindX** (ICA/GovTech, 2025) digitised reporting and tracking - reduced report time from 8 to 3 min - but focuses on logging and search, not structured multi-item extraction [4]
- **SPF FUPO** uses AI optical cameras + RPA to read serial numbers and auto-fill inventory - but processes items after they reach the central office, not at point of discovery [2]
- **SITA WorldTracer** handles matching across 2,800 airports - but relies on staff manually entering item descriptions [3]
- None handle **nested container intake**: documenting what's inside a bag with multiple compartments, mixed currencies, and layered contents

**Success criteria (defined before building):**

- Reduce intake time for complex multi-item cases
- Maintain or improve item recall and quantity accuracy
- Preserve container hierarchy (bag → pouch → contents)
- Never allow AI to auto-approve - staff must confirm every record

---

## 2. Approach

**Core idea: replace typing with scanning, keep humans in the loop.** Staff photograph each container level. AI drafts a structured inventory. Staff verify and correct.

**Alternatives ruled out:**

- *Fully autonomous AI* - accountability requires human sign-off, especially for currency and ID documents
- *Single-pass extraction* - missed items and quantity errors. Replaced with a **two-pass pipeline** (extraction + independent verifier)
- *Flat AI inventory* - loses nesting relationships. We preserve parent-child hierarchies throughout

**Key design decisions:**

- **Guided photography** - outer item first, one container level at a time. Reduces occlusion, improves detection
- **Two-model verification** - gpt-5.6-sol for both extraction and independent re-verification. The verifier never sees the first pass's output
- **Per-item bounding boxes** - every record links to a specific region in its source photo
- **Review gating** - money, documents, and uncertain items require explicit staff confirmation before case completion
- **Private matching details** - hidden from search, used only during ownership claim verification
- **Dual AI provider** - OpenAI (primary) and Agnes AI (sponsor, alternative) as selectable scan channels
- **Graceful degradation** - if AI fails, staff complete intake manually. No data is lost

---

## 3. Evidence

**Staged test:** Herschel backpack containing mixed-currency cash (4 currencies), electronics, and personal accessories - 12 distinct items spread for photography.

**Items detected from Evidence.png:**

| # | Item | Category | Details |
|---|------|----------|---------|
| 1 | Herschel backpack | Bags | Black, roll-top, red/white striped lining |
| 2 | Facial beauty device | Electronics | White, handheld wand |
| 3 | Power bank / charger case | Electronics | White, compact, ring holder |
| 4 | Perfume roller bottle | Personal | Small glass tube, gold cap |
| 5 | Game controller (Joy-Con) | Electronics | Grey, carabiner clip attached |
| 6 | MYR RM1 notes x3 | Currency | MYR 3.00 |
| 7 | MYR RM5 note x1 | Currency | MYR 5.00 |
| 8 | MYR RM10 notes x2 | Currency | MYR 20.00 |
| 9 | USD $100 note x1 | Currency | USD 100.00 |
| 10 | EUR 100 note x1 | Currency | EUR 100.00 |
| 11 | PHP 1000 notes x2 | Currency | PHP 2,000.00 |
| 12 | Mixed coins (~4-5) | Currency | Requires closer inspection |

**Currency totals (4 currencies, 6 denomination groups):**

- MYR 28.00 (3 denomination groups: RM1 x3, RM5 x1, RM10 x2)
- USD 100.00 ($100 x1)
- EUR 100.00 (100 x1)
- PHP 2,000.00 (1000 x2)

**Results:**

| Metric | Result | Baseline |
|--------|--------|----------|
| Item recall | 12/12 detected | Generic captioning: ~6-7/12 |
| Currency groups | 6/6 separated correctly | Flat AI: lumps into "some money" |
| Multi-currency | 4 currencies identified (MYR, USD, EUR, PHP) | Manual: same but 15+ min typing |
| Denomination arithmetic | 5/6 correct, 1 overcounted (USD) | - |
| Nesting | All items linked to outer container | Flat AI: no hierarchy |
| False positives | 1 (USD $100 counted as x2, actual x1) | - |
| Coins flagged for review | Yes (unreadable denominations) | - |

**False detection analysis:**

The AI reported 2x USD $100 when only 1 note was present. This is a known limitation: the front and back of a banknote visible in the same photo, or reflections on a glossy tile surface, can cause the model to double-count. This is precisely why FoundFlow's workflow requires **mandatory staff confirmation** before any currency record is finalised. The system correctly flags all currency for review - staff would catch and correct the quantity from 2 to 1 during the verification step. This demonstrates the human-in-the-loop design working as intended: AI drafts, staff decide.

**Additional verification:**

- Automated domain tests - session security, upload magic-number validation, cycle detection, finalisation rules
- Playwright E2E - full workflow from sign-in through photo upload, AI scan, review, completion, and collection
- Layout guide impact - spread items reliably detected; piled items correctly flagged for review (not silently misidentified)

---

## 4. Constraints

Real-world limits we measured and designed around:

- **Cost:** ~$0.10-0.30 per case (two gpt-5.6-sol calls). Acceptable vs. 20-30 min of staff time at airport labour rates
- **Latency:** 8-15 seconds per scan. Non-blocking - staff review existing items while AI processes
- **Reliability:** Verifier failure retains primary draft with review gates. Complete AI failure allows manual completion. No data loss path
- **Privacy:** Passport/IC stored as last-four-characters only. Private matching details segregated from search. Photos in access-controlled storage
- **Network:** Required for AI scan. Manual intake remains functional offline. Service worker queue planned
- **Security:** Constant-time HMAC verification, magic-number file signatures, atomic database transactions, audit trail on every action

---

## 5. Honesty & Trajectory

**Known failure modes:**

- Bounding boxes can be imprecise for small or overlapping objects - staff correction needed
- Piled items (not spread apart) significantly reduce detection accuracy
- Worn/damaged currency with illegible markings requires manual entry
- No concurrent multi-staff editing on the same case
- No offline AI - manual entry only without network

**What we would build next:**

1. **On-device ML from staff corrections** - every confirmed/corrected item is a labeled training sample. Fine-tune a lightweight model (YOLO for detection, small VLM for classification) on Changi-specific items to reduce cloud API dependency and enable offline intake
2. Offline capture queue (service worker + IndexedDB sync) with local model for basic detection
3. Optimistic locking for multi-staff concurrent access
4. Barcode/QR scanning for tagged item bags
5. Vector-indexed semantic search (pgvector) for production-scale matching
6. Passenger-facing lost report portal with auto-matching against found items

**ML trajectory:** Phase 1 (current) - cloud AI for all scans, staff corrections build a labeled dataset. Phase 2 - fine-tuned local model handles common items (bags, phones, wallets, SGD/MYR currency), cloud only for edge cases. Phase 3 - fully offline-capable on-device model, cloud as optional verifier. Each staff confirmation today makes the system cheaper and faster tomorrow.

**Scope statement:** This is a functional prototype demonstrating a complete vertical slice - intake → nested draft → correction → completion → verified collection. Production deployment requires organisational access controls, operational review, and integration with existing airport systems.

---

## References

1. National World (2024). "World's best airport reveals unusual items left behind" - Changi Airport handles 54,000 lost items/year, 58.9M passengers. *nationalworld.com*
2. Singapore Police Force (2025). "Lost and Found: The SPF's Tech-Powered Property Detectives" - FUPO processed 50,000 reports in 2024 (up from 42,000 in 2022). AI optical cameras + RPA reduce manual entry. *police.gov.sg*
3. SITA (2021). "WorldTracer Lost and Found Property" - Industry-standard matching across 500+ airlines, 2,800 airports. Repatriation costs up to US$95/item. *sita.aero*
4. Hack for Public Good (2025). "FindX" - ICA digital platform replacing physical logbooks at Woodlands Checkpoint. Reduced report time from 8 min to 3 min, search from 10 min to <5 min. *hack.gov.sg/2025/findx*
