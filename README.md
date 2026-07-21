# FoundFlow

Human-verified, evidence-linked inventory logging for found-property teams.

FoundFlow helps frontline staff document complex found-property cases. Its guided workflow captures an outer property and each container level, drafts a nested manifest, highlights uncertainty and requires staff approval before finalisation.

## Current state

The repository currently contains the initial Next.js product shell and a deterministic complex-bag intake workflow. The fixture demonstrates nested inventory, confidence states and mandatory human review without sending personal property to a live model provider.

## Run locally

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000` — product overview
- `http://localhost:3000/intake` — interactive complex-bag workflow

## Verify

```bash
npm run lint
npm run build
```

## Core principles

- AI drafts; staff decide.
- Every final item is linked to evidence.
- Nested relationships such as bag → pouch → contents are first-class data.
- Uncertain details block finalisation until reviewed.
- A failed AI request never destroys the case or blocks manual completion.

## Challenge direction

FoundFlow is being developed for the Launchpad 2026 AI Challenge. The intended submission includes a reproducible comparison against manual logging using staged simple, nested and difficult property cases.

Singapore context:

- SPF received approximately 50,000 found-property reports in 2024.
- Changi Airport handled 68.4 million passenger movements in FY2024/25.

Sources:

- [SPF: Lost and Found — The SPF's Tech-Powered Property Detectives](https://www.police.gov.sg/Media-Hub/Police-Life/2025/02/Lost-and-Found-The-SPFs-Tech-Powered-Property-Detectives)
- [Changi Airport Group annual reports](https://www.changiairport.com/en/corporate/our-media-hub/publications/reports.html)
- [FindX — Hack for Public Good](https://www.hack.gov.sg/2025/findx/)

## Documentation

`PROJECT_CONTEXT.md` is the canonical product brief for future development.

## License

Copyright remains with the project team. A distribution licence will be selected before public release.
