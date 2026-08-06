# AI Scan Workflow Enhancements Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Reduce scan latency, report truthful scan progress, make the photo-linked item hierarchy easier to review, add an operational guide, and provide a deterministic automated demonstration plus full workflow regression coverage.

**Architecture:** Keep one multi-photo scan operation and one resulting nested draft. Read photos concurrently, then run the independent primary extraction and strong verification concurrently because neither depends on the other's output. Move the scan pipeline into a reusable server module with progress callbacks and expose it through an authenticated streaming route whose newline-delimited events drive a determinate client progress bar. Keep AI as a draft and preserve provider fallback, source-photo ownership, review gates and manual completion. The automated demo is a Playwright-driven deterministic walkthrough, not a live-provider dependency.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, AI SDK v6, Zod, Turso/libSQL, Vercel Blob, Playwright.

---

### Task 1: Isolate and parallelise the multi-photo scan pipeline

**Objective:** Make independent I/O and AI stages run concurrently without changing the single linked-inventory result or provider fallback semantics.

**Files:**
- Create: `src/lib/ai-scan.ts`
- Modify: `src/app/cases/actions.ts`
- Test: `tests/domain.test.ts`

**Steps:**
1. Add failing tests for concurrent stage orchestration, verifier precedence, verifier failure fallback, and provider failure aggregation.
2. Extract reusable scan types, provider attempt construction, image loading and draft persistence from `handleAiAnalysis` into `src/lib/ai-scan.ts`.
3. Read all uploaded images with `Promise.all`, retaining each image's source-photo ID and original order.
4. Start primary provider fallback and independent strong verification together. Use the verified draft when it succeeds; otherwise retain the review-gated primary draft.
5. Preserve OpenAI-primary/Agnes-fallback behavior and environments with only one configured provider.
6. Keep one case update after all stages complete so partial AI results never corrupt persisted inventory.
7. Run `npm test`, `npm run typecheck`, and `npm run lint`.

### Task 2: Stream truthful scan progress

**Objective:** Show progress tied to completed server stages instead of a fake elapsed-time animation.

**Files:**
- Create: `src/app/api/cases/[id]/scan/route.ts`
- Create: `src/lib/scan-events.ts`
- Modify: `src/lib/ai-scan.ts`
- Modify: `src/app/cases/[id]/CaseDetailClient.tsx`
- Modify: `src/app/cases/[id]/scan/page.tsx`
- Test: `tests/playwright/scan-progress.spec.mjs`

**Steps:**
1. Define a small discriminated event contract: `started`, `photos_loaded`, `primary_complete`, `verification_complete`, `saving`, `complete`, and `error`, each with a monotonic percentage and concise user-facing label.
2. Add an authenticated `POST` Route Handler returning newline-delimited JSON from a `ReadableStream` with `Cache-Control: no-store` and buffering-resistant headers.
3. Drive the existing scan pipeline through a progress callback; never send credentials, provider errors, image data or internal prompts to the browser.
4. Replace direct `handleAiAnalysis` invocation in both scan UIs with a shared stream consumer.
5. Render a semantic `<progress>` element, current phase text, photo count, disabled scan controls and `aria-live` status. Keep the bar visible at 100% until the refreshed item list is ready.
6. Make stream disconnects fail safely without persisting partial output.
7. Add browser coverage for phase order, progress monotonicity, success refresh, provider failure and a compact viewport.

### Task 3: Reorganise the linked inventory

**Objective:** Make hierarchy, source-photo ownership, review state and actions easy to scan without flattening nested containers.

**Files:**
- Create: `src/app/cases/[id]/LinkedInventory.tsx`
- Modify: `src/app/cases/[id]/CaseDetailClient.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/playwright/linked-inventory.spec.mjs`

**Steps:**
1. Extract hierarchy sorting and depth calculation into tested pure helpers.
2. Render the outer item as the hierarchy root, then grouped nested children in stable source order.
3. Add a compact summary strip for total listed records, review count, boxed/listed agreement and currency groups.
4. Give each row a visible hierarchy connector, quantity, review/confirmed state, source-photo chip and concise warning. Keep the full reason in accessible detail.
5. Keep one-click photo selection, edit, delete and confirmation. Preserve all existing source-photo region behavior.
6. Avoid horizontal indentation overflow on compact screens; cap visual indentation while preserving accessible parent labels.
7. Add tests for nested ordering, duplicate labels, source-photo selection, compact overflow, edit persistence and currency totals.

### Task 4: Add the operational Guide page

**Objective:** Give staff a concise guide for the full intake and handover workflow without placing explainer content ahead of active work.

**Files:**
- Create: `src/app/guide/page.tsx`
- Modify: `src/components/AppHeader.tsx`
- Test: `tests/playwright/guide.spec.mjs`

**Steps:**
1. Add sections for guided photo order, scan and progress, linked-inventory review, box correction, completion, search, ownership verification and collection.
2. State that AI drafts are provisional, one scan handles all uploaded photos, and every item must retain a source photo or explicit staff-added origin.
3. Include direct links to New Case, Cases and Search.
4. Restore a Guide navigation item with active-route styling and compact wrapping.
5. Verify desktop/mobile readability, keyboard navigation and no horizontal overflow.

### Task 5: Add a deterministic automated full-workflow demo

**Objective:** Provide a repeatable browser demonstration that fills the complete workflow without relying on live AI latency or credentials.

**Files:**
- Create: `tests/playwright/automated-demo.spec.mjs`
- Create: `playwright.demo.config.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/app/guide/page.tsx`

**Steps:**
1. Add `npm run demo:automated` for a headed, one-worker Playwright run with video recording and deliberate short action pacing.
2. Fill login, intake acknowledgement, every case field, photo context, upload, deterministic scan fixture, nested item editing, region review, confirmation, finalisation, search, claim verification, approval and collection.
3. Use only staged synthetic values and a temporary isolated database.
4. Add a fast headless variant used in CI without artificial pauses.
5. Save video/trace artifacts under Playwright output and document how to run and locate them.
6. Clean up the disposable case and data directory after successful completion.

### Task 6: Expand and repair the complete test suite

**Objective:** Make every supported workflow executable in CI and remove stale assertions.

**Files:**
- Modify: `tests/playwright/demo.spec.mjs`
- Modify: `tests/playwright/provider-fallback.spec.mjs`
- Modify: `tests/playwright/edit-item.spec.mjs`
- Modify: `tests/domain.test.ts`
- Modify: `playwright.config.mjs`
- Modify: `.github/workflows/ci.yml` if present

**Steps:**
1. Update stale home, intake and item-list selectors to current accessible names.
2. Split the oversized historical demo test into isolated workflow specs where shared mutable demo state makes failures order-dependent.
3. Cover authentication, create, upload/delete, scan stream, provider fallback, hierarchy, boxes, edit/add/delete, confirm, finalise, search, claim decisions, collection, archive/restore/delete and Guide.
4. Assert no uncaught page errors, failed same-origin requests, horizontal overflow or inaccessible modal controls.
5. Keep live provider smoke tests opt-in; CI must remain deterministic.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and all Playwright tests.

### Task 7: Integration review and delivery

**Objective:** Prove the branch is coherent, secure and ready for review without deploying it over production.

**Files:**
- Review all changed files
- Update: `docs/deliverables.md`

**Steps:**
1. Run spec-compliance review against every requested enhancement.
2. Run code-quality/security review for auth, streamed errors, concurrency, partial writes and test isolation.
3. Run `git diff --check` and a staged secret scan; verify `.env` remains ignored.
4. Run the complete deterministic gate from a clean build.
5. Capture desktop and compact screenshots of scan progress, linked inventory and Guide.
6. Commit cohesive changes to `enhancement/ai-scan-workflow` and push that branch only.
7. Do not merge or deploy until the user reviews the branch.
