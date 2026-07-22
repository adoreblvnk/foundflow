# FoundFlow Intake Copilot

Human-verified, evidence-linked nested inventory logging for found-property teams.

FoundFlow is a secure, single-server prototype designed to help frontline airport and transit custody staff document complex found-property cases. Its guided, secure workflow captures outer containers and each nesting level (e.g., Backpack → Pouch → Coins), automatically drafts a structured, nested manifest with OCR attributes, highlights high-uncertainty areas for human review, and requires staff approval before finalisation and export.

*Note: This application is a fully functional prototype designed for single-server local deployment and is not called production-ready.*

---

## 🚀 Active Routes & Capabilities

- **Landing Page (`/`)**: Product overview and security entry.
- **Sign In (`/login`)**: Secure local staff authentication.
- **Dashboard (`/cases`)**: View and manage all active custody cases. Supports controlled demo seeding.
- **New Case (`/cases/new`)**: Initiate custody and document a fresh found-property container entry.
- **Case Intake Workspace (`/cases/[id]`)**: Unified hub to:
  - Upload photographic evidence (validated using JPG/PNG/WebP magic-number signatures).
  - Trigger live AI vision analysis (using AI SDK v6).
  - Apply spoken correction observations (Web Speech API) or text-command fallbacks.
  - Interactively edit manifest items, manage parent nesting, and assign evidence links.
  - Lock and finalise approved custody cases (blocking unresolved items or invalid structures).
- **Secure Private Uploads (`/api/uploads/[id]`)**: Authenticated endpoint that serves evidence files securely.
- **Approved Structured Exports (`/api/cases/[id]/export/json` and `/api/cases/[id]/export/csv`)**: Finalised manifest datasets with parent relationships, OCR text, and attributes, protected against CSV formula injection.

---

## 🛠️ Local Setup & Environment Configuration

FoundFlow requires zero third-party cloud database accounts or external OAuth credentials.

### Prerequisites
- **Node.js v24.11.1+ Required**: Built-in synchronous SQLite is powered by the native `node:sqlite` module, requiring Node 24.
- **Codex CLI**: Required to invoke the configured vision model from the local server; inference may use the hosted Codex service.

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

# Directory path for local SQLite database and uploads
DATA_DIR=./data
```

---

## 📦 Script Commands & Verification

### Install Dependencies
FoundFlow uses **AI SDK v6** and the compatible **1.x** Codex CLI provider:
```bash
npm ci
```

### Run Locally (Development)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000), sign in, then select **Load Demo Case** for the complete staged backpack workflow. The deterministic demo includes one synthetic evidence photograph, a nine-record nested manifest, three review decisions, finalisation and JSON / CSV exports. Selecting **Reset Demo Case** restores the fixture for another walkthrough.

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
Verifies Codex CLI connectivity and structured multimodal responses using harmless staged image data:
```bash
npm run test:ai
```

### Run Playwright CLI Production Demo Verification
Builds the production app, starts an isolated server through Playwright CLI, signs in, loads the evidence-backed fixture, checks the 375×500 mobile dialog, resolves all reviews, finalises the case and verifies both exports and their audit events:
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
The test uses `public/demo/found-property-evidence.webp` by default. Override `E2E_EVIDENCE_PATH` only when validating another staged image. Use staged or synthetic evidence only; do not place real passenger records in the repository.

### Compile Production Build
```bash
npm run build
```

---

## 🤖 Codex CLI Vision Setup
FoundFlow invokes `ai-sdk-provider-codex-cli` from the local Node.js server and authenticates through the existing `codex login` ChatGPT session, so no OpenAI API key is required. Application data and evidence storage stay local, but model inference uses the configured hosted Codex service; review its data-handling terms before processing real records.

1. Run `npm ci`; the provider installs its compatible Codex CLI `0.144.x` optional dependency.
2. Authenticate your ChatGPT subscription:
   ```bash
   codex login
   ```
3. Verify provider connectivity:
   ```bash
   npm run test:ai
   ```

---

## 🛡️ Prototype Design & Security Safeguards

- **Durable SQLite Persistence**: Normalized local tables and transactional state/audit mutations using Node 24 native `node:sqlite`. No native C++ compilation dependency.
- **Upload Hardening**: magic number file-signature checks (JPG/PNG/WebP), cryptographically secure UUID file IDs, and strict path protection.
- **CSV Formula Escape**: Guards formula prefixes (`=`, `+`, `-`, `@`) even after leading whitespace before CSV generation.
- **Constant-Time Verification**: Cryptographic HMAC session verification with SHA-256 timing-safe string comparison. Require exactly two token segments for parsed authentication tokens.
- **Atomic Transactions**: All state mutations and their corresponding timeline log records are wrapped inside a single database transaction, ensuring no orphan logs or desynced states occur.

---

## ⚠️ Deployment Limits & Constraints

- **Single-Server / Local Storage Only**: File uploads and database are stored inside the local `DATA_DIR` directory. Scale-out multi-server deployments require distributed file storage and a shared DB, which is out-of-scope.
- **Speech API Support**: Spoken correction uses the HTML5 Web Speech API, which requires browser-side microphone permissions (best supported in Google Chrome, Edge, and Safari).
