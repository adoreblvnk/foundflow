# FoundFlow Intake Copilot

Staff-confirmed, photo-linked item logging for found-property teams.

FoundFlow helps airport and transit staff document complex found-property cases. Its guided workflow captures outer containers and each nesting level (e.g. Backpack → Pouch → Currency), drafts a structured item list with OCR attributes and exact denomination × quantity totals for notes and coins, highlights uncertainty for staff review, and requires confirmation before completion and export.

*Note: This application is a functional hosted prototype for controlled demonstrations; production roll-out would require organisational access controls and operational review.*

---

## 🚀 Active Routes & Capabilities

- **Landing Page (`/`)**: Product overview and security entry.
- **Sign In (`/login`)**: Configurable staff authentication; the hosted demo can temporarily bypass login with `AUTH_DISABLED=true`.
- **Dashboard (`/cases`)**: View and manage found-property cases. Supports controlled demo seeding.
- **New Case (`/cases/new`)**: Document a new found-property container.
- **Case Intake Workspace (`/cases/[id]`)**: Unified hub to:
  - Add item photos (validated using JPG/PNG/WebP magic-number signatures).
  - Trigger live AI vision analysis (using AI SDK v6).
  - Apply quick text commands to manage the item list.
  - Edit items, manage parent nesting, and assign source photos.
  - Complete confirmed cases while blocking unresolved items or invalid structures.
- **Private Photos (`/api/uploads/[id]`)**: Application endpoint for stored item photos.
- **Confirmed Exports (`/api/cases/[id]/export/json` and `/api/cases/[id]/export/csv`)**: Completed item lists with parent relationships, OCR text, and attributes, protected against CSV formula injection.

---

## 🛠️ Local Setup & Environment Configuration

Local development requires no cloud database or object-storage account. The Vercel deployment uses managed Turso and private Vercel Blob resources.

### Prerequisites
- **Node.js v24.11.1+ Required**: Matches the CI and Vercel runtime.
- **OpenAI API Key**: Required to invoke the vision model for AI analysis.

### 1. Initialize Configuration
Copy the environment variables template:
```bash
cp .env.example .env
```

### 2. Configure Environment Variables
Open the `.env` file and replace every variable with your secure values. Do not use or commit defaults:
```env
# Secure cookie signing secret (Provide a secure cryptographically random string of at least 32 characters)
AUTH_SECRET=

# Required username for prototype login (minimum 4 characters)
LOGIN_USERNAME=

# Required password for prototype login (minimum 8 characters)
LOGIN_PASSWORD=

# OpenAI API key and optional model override
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

# Local libSQL database and uploads
DATA_DIR=./data
```

---

## 📦 Script Commands & Verification

### Install Dependencies
FoundFlow uses **AI SDK v6** and the **@ai-sdk/openai** provider:
```bash
npm ci
```

### Run Locally (Development)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000), sign in when authentication is enabled, then select **Load Demo Case** for the staged backpack workflow. The deterministic demo includes one synthetic item photo, an eleven-record nested item list, five denomination-level currency reviews, exact totals of SGD 104.00 and MYR 50.40, completion and JSON / CSV exports. Selecting **Reset Demo Case** restores the fixture for another walkthrough.

### Run Static Typecheck
```bash
npm run typecheck
```

### Run ESLint Checks
```bash
npm run lint
```

### Run Automated Unit/Domain Tests
Runs the comprehensive test suite validating session parsing, magic number validations, cycle detection, CSV formula escaping, and finalisation rules:
```bash
npm run test
```

### Run AI Vision Smoke Test
Verifies OpenAI API connectivity and structured multimodal responses using harmless staged image data:
```bash
npm run test:ai
```
For the optional local-only Codex backup provider, run `npm run test:ai:codex`. Production never invokes Codex CLI.

### Run Playwright CLI Production Demo Verification
Builds the production app, starts an isolated server through Playwright CLI, signs in, loads the photo-linked fixture, checks the 375×500 mobile dialog, resolves all reviews, completes the case and verifies both exports and their activity records:
```bash
npm run test:e2e:playwright
```
This path requires no model call and is the reliable presentation fallback.

### Run Live-AI Browser Verification
With a production server running, exercises authentication, rejected and accepted uploads, representative object detection and OCR, nested relationships, review gating, correction handling, finalisation, exports and audit records:
```bash
BASE_URL=http://127.0.0.1:3000 \
E2E_USERNAME="$LOGIN_USERNAME" \
E2E_PASSWORD="$LOGIN_PASSWORD" \
npm run test:e2e
```
The test uses `public/demo/found-property-evidence.webp` by default. Override `E2E_EVIDENCE_PATH` only when validating another staged image. Use staged or synthetic property only; do not place real passenger records in the repository.

### Compile Production Build
```bash
npm run build
```

---

## 🤖 OpenAI Vision Setup
FoundFlow uses the `@ai-sdk/openai` provider with AI SDK v6 to call OpenAI's vision models directly via API. An `OPENAI_API_KEY` is required.

1. Run `npm ci` to install all dependencies.
2. Set your `OPENAI_API_KEY` in `.env`.
3. Verify provider connectivity:
   ```bash
   npm run test:ai
   ```

---

## 🛡️ Prototype Design & Security Safeguards

- **Durable Shared Persistence**: One async libSQL data layer uses a local file in development and Turso on Vercel. Case mutations and audit entries are committed in atomic batches.
- **Private Photo Storage**: Item photos stay under `DATA_DIR` locally and in a private Vercel Blob store when hosted.
- **Upload Hardening**: magic number file-signature checks (JPG/PNG/WebP), cryptographically secure UUID file IDs, and strict path protection.
- **CSV Formula Escape**: Guards formula prefixes (`=`, `+`, `-`, `@`) even after leading whitespace before CSV generation.
- **Constant-Time Verification**: Cryptographic HMAC session verification with SHA-256 timing-safe string comparison. Require exactly two token segments for parsed authentication tokens.
- **Atomic Transactions**: All state mutations and their corresponding timeline log records are wrapped inside a single database transaction, ensuring no orphan logs or desynced states occur.

---

## ⚠️ Deployment Limits & Constraints

- **Hosted Prototype**: Vercel, Turso, and private Blob support stateless function instances. This remains a controlled airport lost-property prototype.
