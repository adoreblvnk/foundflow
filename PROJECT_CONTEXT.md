# FoundFlow Project Context

## Product

FoundFlow is a human-in-the-loop intake copilot for found-item teams. It converts guided photographs and spoken observations into a structured, photo-linked item list while preserving nested relationships such as bag → pouch → contents.

The initial use case is airport customer service, grounded in direct frontline experience at Changi Airport. The product should generalise to hotels, transport operators, shopping centres, universities, hospitals and event venues.

## Product thesis

Existing systems can store and search lost-item records. FoundFlow improves the first operational step: creating a complete and reliable record, especially when one container holds many small or nested items.

## Core workflow

1. Staff acknowledge the concise guided-photo and review order.
2. Create a case and capture the outer item.
3. Add contents one container level at a time.
4. Generate a structured draft from images and optional speech.
5. Link every proposed item to its source photo.
6. Highlight uncertainty and require staff review.
7. Finalise only after mandatory fields and uncertain items are resolved.
8. Use the confirmed item list for ownership verification and collection.

## Non-negotiable product rules

- AI drafts; authorised staff make the final decision.
- Every final item must link to a captured photo or be explicitly added by a staff member.
- Nested container relationships must survive extraction, correction, completion and collection.
- Notes and coins must be separated by currency and denomination, with exact denomination × quantity totals; unreadable values remain unresolved and cannot be guessed.
- Uncertain quantities, currencies and identifiers require explicit review.
- Money, identification documents and perishable items require explicit staff confirmation.
- The challenge dataset must use staged items and synthetic identifiers, not real passenger data.
- Live-provider failure must not destroy a case or prevent manual completion.

## Challenge scope

Build a polished vertical slice covering operations → guided intake → nested draft → correction → completion → verified collection. Include deterministic demonstration data and a live AI adapter only after its image and structured-output capabilities are verified.

Out of scope for the initial challenge build: public marketplace, chat, maps, social posting, continuous CCTV, autonomous ownership approval and nationwide record exchange.

## Evaluation

Compare manual entry, generic image captioning, flat AI inventory and FoundFlow's guided nested workflow. Measure item precision/recall, quantity and hierarchy accuracy, omission rate, corrections, completion time, latency and cost per case.

## User-facing terminology

- Use **airport staff** or **staff**, not officer.
- Use **item photos** or **source photos**, not evidence.
- Use **item list**, not manifest, in the interface.
- Use **item details** and **activity history**, not property or custody terminology.
- Internal schema and API identifiers may retain `manifest`, `evidenceId`, `finalised` and the `property` item-type enum for compatibility.

## Positioning guardrails

Do not claim that FoundFlow replaces FindX or SPF systems. FindX focuses on reporting, tracking and search. SPF has AI optical cameras for selected item recognition and identifier extraction. FoundFlow's tested differentiator is portable, staff-facing intake for complex nested item cases.
