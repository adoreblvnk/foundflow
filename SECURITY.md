# Security Policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub Security Advisories for this repository. Do not open a public issue containing credentials, claimant information, item-photo URLs, database locations or reproduction data copied from a live deployment.

Include the affected route or component, impact, minimal reproduction steps and whether synthetic data can reproduce the issue. Use synthetic records in all reports.

## Supported code

Security fixes are applied to the actively deployed commit and the current `main` line. Prototype branches receive fixes while they are being evaluated but are not production support channels.

## Data-handling boundaries

FoundFlow treats item photos, claimant details, private matching details, identity fragments, storage locations and audit details as protected operational data.

- AI output remains a draft and cannot authorise collection.
- Login-disabled mode is restricted to synthetic demo records.
- Item photos and selected sensitive database fields support application-layer AES-256-GCM encryption.
- Production data protection fails closed when encryption keys are unavailable.
- Provider-bound semantic search is opt-in and excludes claimant details, staff identities, OCR text and private matching fields.
- Secrets must stay in deployment secret stores and ignored local environment files.

Operational setup, key rotation and migration procedures are documented in [`docs/data-protection.md`](docs/data-protection.md).
