# FoundFlow — Changi Airport Lost & Found System

AI-powered lost and found management for Changi Airport.

FoundFlow is a complete lost and found ecosystem — from the moment an item is discovered to the moment it's returned to its owner. Staff log found items with AI-assisted documentation, passengers report lost belongings, and the system matches them together. Every step is guided, verified, and auditable.

> Built for the Launchpad 2026 AI Challenge. Functional hosted prototype — production deployment would require organisational access controls and operational review.

---

## What It Does

| Workflow | Description |
|----------|-------------|
| **Log Found Item** | Staff document items found on premises with guided photography and AI-drafted inventory |
| **Manage Cases** | Track items through intake → review → confirmation → storage → collection |
| **Search Records** | Find items across all cases using keyword or natural language |
| **Ownership Verification** | Verify claims through independent evidence before handover |
| **Collection** | Record handover with full audit trail |

---

## Key Features

- **Guided intake** — Terminal, area, specific location, date/time, storage location
- **AI vision scan** — Two-model pipeline (extraction + verifier) with per-item bounding boxes
- **Dual AI provider** — OpenAI (gpt-5.6-sol) and Agnes AI (agnes-2.0-flash) as scan channels
- **Nested containers** — Bag → Pouch → Contents hierarchy preserved throughout
- **Currency precision** — Separate records per denomination, exact quantity × value totals
- **Conditional matching fields** — Brand, colour, model, documents, jewellery, electronics
- **Private matching details** — Hidden from search, used only during claim verification
- **Review gating** — Money, documents, and uncertain items require staff confirmation
- **Ownership claims** — Compare passenger's report against staff observations
- **Auto-detect search** — Short queries use keyword match; longer queries use AI semantic search
- **Full audit trail** — Every action logged with staff identity and timestamp

---

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Home — Log Found Item, Manage Cases, Search Records |
| `/login` | Staff authentication |
| `/cases` | Cases dashboard (pending, ready, confirmed, collected, archived) |
| `/cases/new` | Step-by-step instructions + intake form |
| `/cases/[id]` | Case workspace — photos, AI scan, item list, review, completion |
| `/cases/[id]/claim` | Ownership verification and collection |
| `/search` | Search across all confirmed items |
| `/about` | About Changi Airport Lost & Found |
| `/guide` | Staff usage guide |
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

1. **Item found** — Staff record where, when, and what was found
2. **Photo scan** — AI extracts structured inventory from photographs
3. **Staff review** — Every AI-detected item confirmed by human
4. **Confirmed & stored** — Case locked, item safely stored
5. **Lost report match** — System compares found items against passenger descriptions
6. **Collection** — Ownership verified, item handed over with audit record

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

Edit `.env`:
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
Open [http://localhost:3000](http://localhost:3000), sign in, and start from **Log Found Item**.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Static type checking |
| `npm run lint` | ESLint checks |
| `npm run test` | Domain unit tests |
| `npm run test:ai` | AI provider smoke test |
| `npm run test:e2e:playwright` | Playwright E2E (no AI calls) |
| `npm run test:e2e` | Live-AI browser verification |

---

## AI Providers

### OpenAI (Primary)
- Model: `gpt-5.6-sol` for both extraction and verification
- Two-pass pipeline: extraction → independent verifier
- Sends images as file buffers (base64)

### Agnes AI (Sponsor, Alternative)
- Model: `agnes-2.0-flash` (512K context, $0/1M tokens currently)
- OpenAI-compatible endpoint: `https://apihub.agnes-ai.com/v1`
- Singapore-based AI model company
- Select "Scan (Agnes)" in the case workspace

Auto-fallback: if `OPENAI_API_KEY` is not set but `AGNES_API_KEY` is available, Agnes is used automatically.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| AI | AI SDK v6 + `@ai-sdk/openai` (OpenAI-compatible for both providers) |
| Database | libSQL (local) / Turso (hosted) |
| Storage | Local `DATA_DIR` / Vercel Blob (hosted) |
| Auth | HMAC session tokens, constant-time verification |
| Security | Magic-number upload validation, atomic transactions, audit trail |

---

## Security

- Constant-time HMAC session verification (SHA-256)
- Magic-number file signatures for uploads (JPG/PNG/WebP only)
- Atomic database transactions — no orphan logs or desynced states
- Private photo storage (never publicly accessible)
- Passport/IC stored as last-four-characters only
- Private matching details segregated from search
- Full audit trail on every action

---

## Acknowledgements

- **Changi Airport Group** — 54,000 lost items/year context and operational reference
- **Agnes AI** — Launchpad 2026 sponsor, alternative AI vision provider
- **OpenAI** — Primary vision model and API credits
- **Launchpad 2026** — Challenge framework and judging structure
