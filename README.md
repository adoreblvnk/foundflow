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
- **AI vision scan:** Two-pass extraction and independent verification with per-item photo boxes
- **Dual AI provider:** OpenAI (`gpt-5.6-sol`) and Agnes AI (`agnes-2.0-flash`) as selectable scan channels
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

### OpenAI (primary)
- Model: `gpt-5.6-sol` for both extraction and verification
- Two-pass pipeline: extraction → independent verification
- Sends images as file buffers (base64)

### Agnes AI (sponsor alternative)
- Model: `agnes-2.0-flash`
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
- Atomic database transactions prevent orphan logs and desynchronised states
- Private photo storage (never publicly accessible)
- Passport/IC stored as last-four-characters only
- Private matching details segregated from search
- Full audit trail on every action

---

## Acknowledgements

- **Changi Airport Group:** 54,000 lost items/year context and operational reference
- **Agnes AI:** Launchpad 2026 sponsor and alternative AI vision provider
- **OpenAI:** Primary vision model and API credits
- **Launchpad 2026:** Challenge framework and judging structure
