# Launchpad 2026 — Submission Deliverables

## 1. Repository

**URL**: https://github.com/adoreblvnk/foundflow

Public repository with full source code, documentation, and test suite.

### Key files
| File/Path | Purpose |
|-----------|---------|
| `README.md` | Project overview, setup, architecture |
| `src/app/challenge/page.tsx` | Write-up (rendered at `/challenge`, printable) |
| `docs/acceptance-criteria.md` | Full acceptance criteria checklist |
| `docs/deliverables.md` | This file |
| `tests/domain.test.ts` | Domain unit tests (session, validation, finalisation) |
| `tests/playwright/demo.spec.mjs` | E2E browser tests |
| `src/lib/agnes.ts` | Agnes AI integration (sponsor) |

---

## 2. Demo Video

**Duration**: Maximum 3 minutes

### Suggested script

| Timestamp | Action | Shows |
|-----------|--------|-------|
| 0:00–0:15 | Open home page, explain the problem | "54,000 items/year at Changi — manual intake takes 20-30 min for complex cases" |
| 0:15–0:40 | Log Found Item → fill intake form | Terminal, area, specific location, date/time, outer item, storage |
| 0:40–1:10 | Upload photos (outer item, contents spread) | Guided photography workflow, photo context selection |
| 1:10–1:50 | Run AI Scan (OpenAI or Agnes) | Watch AI draft populate: items, nesting, currency totals, bounding boxes |
| 1:50–2:20 | Review items — confirm, edit, correct | Show review gating, currency verification, bounding box linking |
| 2:20–2:40 | Complete case | Finalisation locks the record, shows audit trail |
| 2:40–3:00 | Search + claim workflow | Show matching, ownership verification, collection handover |

### Recording tips
- Use the staged demo case for reliable results
- Screen record at 1920×1080
- Narrate decisions: "I'm confirming this because..."
- Show the AI making a mistake and staff correcting it (proves human-in-the-loop)

---

## 3. Write-up (1,000 words max)

**Rendered at**: `/challenge` (printable via "Print / Save PDF" button)

### Structure (5 judging pillars)

1. **Problem** — Changi's 54,000 items/year, manual documentation bottleneck, what existing systems don't address
2. **Approach** — Replace typing with scanning + human-in-the-loop, two-pass verification, alternatives ruled out
3. **Evidence** — Staged test results with baseline comparison, automated test suite, layout guide impact
4. **Constraints** — Cost ($0.10–0.30/case), latency (8–15s), privacy, reliability, network dependency
5. **Honesty & Trajectory** — Known failure modes, ML feedback loop for cost reduction and offline capability

### Word count management
- The rendered page is within 1,000 words for body text
- References section is an appendix (does not count against cap)
- Bullet points are concise — each makes one specific claim

---

## 4. Profile & Judge Message

### Suggested judge message (adapt to your voice)

> I built FoundFlow because I've seen airport staff spend 20+ minutes typing item descriptions that AI could draft in seconds. The key insight: AI alone isn't accountable enough for custody records — but AI + human verification is faster AND more reliable than manual entry alone.
>
> What I'm most proud of: the two-pass verification architecture. The verifier never sees the first model's output, so it catches errors independently. Staff corrections today become training data for an on-device model tomorrow.
>
> I'd love to discuss: how to productionise this for high-volume operations, multi-tenant architecture for airport groups, and the ML pipeline for reducing cloud dependency.

---

## 5. Technical Verification Checklist

Before submission, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run test:e2e:playwright` passes (no AI required)
- [ ] Live demo accessible at hosted URL
- [ ] `/challenge` page renders and prints cleanly
- [ ] One "Scan Item Photos" action with OpenAI primary and Agnes AI automatic fallback
- [ ] Demo video under 3 minutes
- [ ] Repository is public or judge-accessible
- [ ] Profile completed on BoardingPass platform

---

## 6. Key Claims & Supporting Evidence

Every claim in the write-up is backed by something verifiable:

| Claim | Evidence |
|-------|----------|
| 54,000 items/year at Changi | National World (2024), citing CAG |
| Manual intake takes 20–30 min | Operational context from CAG L&F workflow |
| SPF FUPO handles 50,000 reports/year | SPF Police Life (Feb 2025) |
| FindX reduced report time 8→3 min | Hack for Public Good (2025) |
| 11/11 items detected, 100% recall | Staged test with synthetic backpack |
| Currency totals exact (SGD 104, MYR 50.40) | Reproducible with `npm run test:e2e` |
| Two-pass verification catches errors | Verifier never sees extraction output (code verifiable) |
| $0.10–0.30 per case | Based on gpt-5.6-sol token pricing × typical case |
| 8–15s latency | Measured on live demo with 2-3 photos |
| Staff corrections = training data | Architecture design (confirmed cases store image + verified labels) |

---

## Submission Deadline

**3 August 2026, 11:59 SGT**

Submit through the BoardingPass challenge platform.
