# FoundFlow — Changi Airport Lost & Found Intake

AI-powered, staff-confirmed item logging for airport found-item teams.

FoundFlow helps Changi Airport staff document complex found-item cases quickly and accurately. Staff photograph items layer by layer, AI drafts a structured inventory (labels, nesting, bounding boxes, currency totals), and staff verify every record before the case is finalised. The system handles the full lifecycle: intake → photo scan → review → completion → ownership verification → collection.

> Built for the Launchpad 2026 AI Challenge. Functional hosted prototype — production deployment would require organisational access controls and operational review.

---

## Key Features

- **Guided intake workflow** — Terminal, area, specific location, date/time, storage location
- **AI vision scan** — Two-model pipeline (extraction + independent verifier) with per-item bounding boxes
- **Dual AI provider** — OpenAI (gpt-5.6-sol) and Agnes AI (agnes-2.0-flash) as scan channels
- **Nested container support** — Bag → Pouch → Contents hierarchy preserved throughout
- **Currency precision** — Separate records per denomination, exact quantity × value totals
- **Conditional matching fields** — Brand, colour, model, document details, jewellery, electronics specifics
- **Private matching details** — Hidden from search, used only during ownership verification
- **Review gating** — Money, documents, and uncertain items require explicit staff confirmation
- **Collection claim** — Ownership verification with independent evidence groups
- **Auto-detect search** — Keyword for short queries, AI semantic for natural language

---

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Home — Log Found Item, Manage Cases, Search Records |
| `/login` | Staff authentication |
| `/cases` | Active cases dashboard |
| `/cases/new` | Step-by-step instructions + intake form |
| `/cases/[id]` | Case workspace — photos, AI scan, item list, review, completion |
| `/cases/[id]/claim` | Ownership verification and collection |
| `/search` | Search across confirmed items |
| `/about` | About Changi Airport Lost & Found |
| `/guide` | Staff usage guide |
| `/challenge` | Launchpad 2026 write-up (printable) |

---

## Local Setup

### Prerequisites
- **Node.js v24.11.1+**
- **OpenAI API Key** and/or **Agnes AI API Key** — at least one required for AI scan

### 1. Install dependencies
```bash
npm ci
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
AUTH_SECRET=           # Secure random string (32+ chars)
LOGIN_USERNAME=        # Staff login username (4+ chars)
LOGIN_PASSWORD=        # Staff login password (8+ chars)

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
Open [http://localhost:3000](http://localhost:3000), sign in, and create a case from **Log Found Item**.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Static type checking |
| `npm run lint` | ESLint checks |
| `npm run test` | Domain unit tests (session, validation, cycle detection, finalisation) |
| `npm run test:ai` | AI provider smoke test |
| `npm run test:e2e:playwright` | Playwright E2E (no AI calls, reliable demo fallback) |
| `npm run test:e2e` | Live-AI browser verification (requires running server) |

---

## AI Providers

### OpenAI (Primary)
- Model: `gpt-5.6-sol` for both extraction and verification
- Sends images as file buffers (base64)
- Two-pass pipeline: extraction → independent verifier

### Agnes AI (Sponsor, Alternative)
- Model: `agnes-2.0-flash` (512K context, $0/1M tokens currently)
- OpenAI-compatible endpoint: `https://apihub.agnes-ai.com/v1`
- Singapore-based AI model company
- Select "Scan (Agnes)" in the case workspace

The system auto-falls back to Agnes if `OPENAI_API_KEY` is not set but `AGNES_API_KEY` is available.

---

## Architecture

- **Framework**: Next.js (App Router)
- **AI**: AI SDK v6 + `@ai-sdk/openai` provider (OpenAI-compatible for both providers)
- **Database**: libSQL (local file) / Turso (hosted)
- **Storage**: Local `DATA_DIR` / Vercel Blob (hosted)
- **Auth**: HMAC session tokens, constant-time verification
- **Security**: Magic-number upload validation, atomic transactions, audit trail

---

## Security

- Constant-time HMAC session verification (SHA-256)
- Magic-number file signatures for uploads (JPG/PNG/WebP only)
- Atomic database transactions — no orphan logs or desynced states
- Private photo storage (never publicly accessible)
- Passport/IC stored as last-four-characters only
- Private matching details segregated from search

---

## Acknowledgements

- **Changi Airport Group** — 54,000 lost items/year context and operational reference
- **Agnes AI** — Launchpad 2026 sponsor, alternative AI vision provider
- **OpenAI** — Primary vision model and API credits
- **Launchpad 2026** — Challenge framework and judging structure
