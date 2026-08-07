# FoundFlow

Staff-confirmed, photo-linked found-item intake for airport teams.

**Team Name:** Adore

**Team Members:** Joseph & Tze Kai

FoundFlow helps staff turn guided item photos into a structured item list, preserve nested relationships such as bag → pouch → contents, and review every AI-drafted detail before completion. Confirmed records can then support ownership verification and audited collection.

> Built for the Launchpad 2026 AI Challenge. This is a functional hosted prototype. Production deployment requires organisational access controls, operational review, and integration with existing airport systems.

---

## What It Does

| Workflow | Description |
|----------|-------------|
| **Log Found Item** | Staff document where and when an item was found, then add guided item photos |
| **Manage Cases** | Track items through intake → review → confirmation → storage → collection |
| **Search Records** | Find items across all cases using keyword or natural language |
| **Ownership Verification** | Record a lost report ID or walk-in claim, then verify ownership through independent checks |
| **Collection** | Record handover with full audit trail |

---

## Key Features

- **Guided intake:** Terminal, area, specific location, date and time, outer item, and storage location
- **AI vision scan:** Parallel extraction and independent verification with per-item photo boxes and streamed stage progress
- **Automatic AI fallback:** One scan action uses OpenAI first and retries with Agnes AI if needed
- **Nested containers:** Bag → pouch → contents hierarchy preserved throughout
- **Currency precision:** Separate records per denomination with quantity × value totals
- **Conditional matching fields:** Brand, colour, model, document, jewellery, and electronics details
- **Private matching details:** Hidden from search and used only during ownership verification
- **Review gating:** Money, documents, and uncertain items require staff confirmation
- **Ownership claims:** Support lost-report-linked and staff-initiated walk-in claims
- **Adaptive search:** Short queries use keyword matching; longer queries use AI semantic search
- **Activity history:** Every action records the staff identity and timestamp

---

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Home: Log Found Item, Manage Cases, Search Records |
| `/login` | Staff authentication |
| `/cases` | Cases dashboard (pending, ready, confirmed, collected, archived) |
| `/cases/new` | Step-by-step instructions + intake form |
| `/cases/[id]` | Case workspace: photos, AI scan, item list, review, completion |
| `/cases/[id]/claim` | Ownership verification and collection |
| `/search` | Search across all confirmed items |
| `/guide` | Operational guide for intake, review, completion and collection |
| `/about` | Product purpose, workflow, privacy, and scope |
| `/challenge` | Launchpad 2026 write-up (printable) |

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐     ┌────────────┐
│  Item Found │ ──▶ │  Photo Scan  │ ──▶ │ Staff Review│ ──▶ │  Confirmed │ ──▶ │ Collection │
│  (Intake)   │     │  (AI Draft)  │     │ (Verify)    │     │  (Stored)  │     │ (Handover) │
└─────────────┘     └──────────────┘     └─────────────┘     └────────────┘     └────────────┘
                                                                     ▲
                                                                     │
                                                              ┌──────┴──────┐
                                                              │ Lost Report │
                                                              │  (Match)    │
                                                              └─────────────┘
```

1. **Item found:** Staff record where, when, and what was found.
2. **Photo scan:** AI drafts a structured item list from guided photographs.
3. **Staff review:** Staff confirm or correct every AI-drafted item.
4. **Confirmed and stored:** The completed case is locked and retained.
5. **Ownership claim:** Staff record a lost report ID or create a walk-in claim and apply independent verification checks.
6. **Collection:** Staff record the verified handover in activity history.

---

## Local Setup

### Prerequisites
- **Node.js v24.11.1+**
- **OpenAI API key** and/or **Agnes AI API key**. At least one is required for AI scanning.

### 1. Install dependencies
```bash
npm ci
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
AUTH_SECRET=           # Secure random string (32+ chars)
LOGIN_USERNAME=        # Staff login username (4+ chars)
LOGIN_PASSWORD=        # Staff login password (8+ chars)
AUTH_DISABLED=false    # Set true only for the synthetic demo; non-demo records are hidden

DATA_PROTECTION_MODE=required
DATA_ENCRYPTION_KEYS=2026q3:<base64-encoded-32-byte-key>

# AI Providers (at least one required)
OPENAI_API_KEY=        # OpenAI API key
OPENAI_MODEL=gpt-5.6-sol
OPENAI_VERIFIER_MODEL=gpt-5.6-sol

AGNES_API_KEY=         # Agnes AI key (optional, sponsor)
AGNES_MODEL=agnes-2.0-flash

DATA_DIR=./data        # Local database and uploads
```

### 3. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and start from **Log Found Item**. When `AUTH_DISABLED=true`, login is skipped and FoundFlow operates in synthetic demo-only mode.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Static type checking |
| `npm run lint` | ESLint checks |
| `npm run test` | Domain and data-protection tests |
| `npm run test:security` | Encryption and protected-storage tests |
| `npm run security:reencrypt` | Dry-run encryption/key-rotation migration; append `-- --apply` to write |
| `npm run test:ai` | AI provider smoke test |
| `npm run test:e2e:playwright` | Complete deterministic Playwright suite (no AI calls) |
| `npm run test:e2e:demo` | Fast headless full-workflow demo verification |
| `npm run test:e2e:playwright:only` | Run the headless suite against an existing production build (used by CI) |
| `npm run demo:automated` | Headed paced walkthrough with video and trace artifacts |
| `npm run test:e2e` | Live-AI browser verification |

The automated demo uses only staged synthetic data and a temporary database under `/tmp`. In test mode, it exercises the authenticated production scan route with a deterministic pre-reviewed fixture, including NDJSON milestones and persistence, without contacting a live AI provider. Its video and trace are written to `test-results/automated-demo/`, and the HTML report is written to `playwright-report/demo/`. The fast headless demo covers the same workflow without deliberate pacing. On a headless Linux host, run `xvfb-run -a npm run demo:automated`.

---

## AI Providers

### OpenAI (primary)
- Model: `gpt-5.6-sol` for both extraction and verification
- Extraction and independent verification start together; the verified draft wins when it is valid
- Sends images as file buffers (base64)

### Agnes AI (automatic backup)
- Model: `agnes-2.0-flash`
- OpenAI-compatible endpoint: `https://apihub.agnes-ai.com/v1`
- Singapore-based AI model company
- Automatically used when OpenAI is unavailable or its scan fails

The case workspace exposes one scan button and a determinate progress bar tied to completed server stages. OpenAI extraction and independent verification run concurrently to avoid adding both model latencies. Agnes AI remains the automatic extraction fallback. If only one extraction provider is configured, FoundFlow uses it directly. Every AI result remains review-gated.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| AI | AI SDK v6 + `@ai-sdk/openai` (OpenAI-compatible for both providers) |
| Database | libSQL (local) / Turso (hosted) |
| Storage | Local `DATA_DIR` / Vercel Blob (hosted) |
| Auth | HMAC session tokens, constant-time verification |
| Security | AES-256-GCM data envelopes, private storage, security headers, atomic transactions, audit trail |

---

## Security

- Constant-time HMAC session verification (SHA-256)
- Temporary login-disabled mode is restricted to synthetic demo records
- AES-256-GCM application-layer encryption for item photos and sensitive database fields
- Fail-closed production encryption with versioned key rotation
- Magic-number file signatures for uploads (JPG/PNG/WebP only)
- Atomic database transactions prevent orphan logs and desynchronised states
- Private photo storage (never publicly accessible)
- Passport/IC stored as last-four-characters only
- Private matching details segregated from search
- Full audit trail on every action
- CSP, frame, cross-origin, permissions, referrer, MIME-sniffing and HSTS headers
- CI secret scanning, dependency auditing, CodeQL, dependency review and SBOM generation

See [`docs/data-protection.md`](docs/data-protection.md) for key setup, migration, rotation and incident response. Report vulnerabilities through the private process in [`SECURITY.md`](SECURITY.md).

---

## Acknowledgements

- **Changi Airport Group:** 54,000 lost items/year context and operational reference
- **Agnes AI:** Launchpad 2026 sponsor and alternative AI vision provider
- **OpenAI:** Primary vision model and API credits
- **Launchpad 2026:** Challenge framework and judging structure
