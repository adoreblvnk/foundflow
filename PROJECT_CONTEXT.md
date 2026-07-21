# FoundFlow Project Context

## Product

FoundFlow is a human-in-the-loop intake copilot for found-property teams. It converts guided photographs and spoken observations into a structured, evidence-linked inventory manifest while preserving nested relationships such as bag → pouch → contents.

The initial use case is airport customer service, grounded in direct frontline experience at Changi Airport. The product should generalise to hotels, transport operators, shopping centres, universities, hospitals and event venues.

## Product thesis

Existing systems can store and search lost-property records. FoundFlow improves the first operational step: creating a complete and reliable record, especially when one container holds many small or nested items.

## Core workflow

1. Create a case and capture the outer property.
2. Add contents one container level at a time.
3. Generate a structured draft from images and optional speech.
4. Link every proposed item to source evidence.
5. Highlight uncertainty and require staff review.
6. Finalise only after mandatory fields and uncertain items are resolved.
7. Export the approved manifest to an existing system.

## Non-negotiable product rules

- AI drafts; authorised staff make the final decision.
- Every final item must link to captured evidence or be explicitly added by a staff member.
- Nested container relationships must survive extraction, correction and export.
- Uncertain quantities, currencies and identifiers require explicit review.
- The challenge dataset must use staged property and synthetic identifiers, not real passenger data.
- Live-provider failure must not destroy a case or prevent manual completion.

## Challenge scope

Build a polished vertical slice covering landing → guided intake → nested draft → correction → approval → export. Include deterministic demonstration data and a live AI adapter only after its image and structured-output capabilities are verified.

Out of scope for the initial challenge build: public marketplace, chat, maps, social posting, continuous CCTV, autonomous ownership approval and nationwide record exchange.

## Evaluation

Compare manual entry, generic image captioning, flat AI inventory and FoundFlow's guided nested workflow. Measure item precision/recall, quantity and hierarchy accuracy, omission rate, corrections, completion time, latency and cost per case.

## Evidence-safe positioning

Do not claim that FoundFlow replaces FindX or SPF systems. FindX focuses on reporting, tracking and search. SPF has AI optical cameras for selected item recognition and identifier extraction. FoundFlow's tested differentiator is portable, staff-facing intake for complex nested property cases.
