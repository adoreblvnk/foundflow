# Data protection

FoundFlow uses layered controls. Encryption does not replace authentication, least-privilege database credentials, private Blob access, staff review or deletion procedures.

## Protected data

Application-layer AES-256-GCM envelopes cover:

- item-photo bytes and original upload filenames in local storage or private Vercel Blob storage;
- case notes and storage locations;
- claimant names, contact details, masked identifiers, report references, verification notes and decision reasons;
- OCR text, names on items, serial numbers, partial identifiers and private matching details;
- audit-detail text.

Operational fields needed for queues and structured search remain queryable. Existing plaintext records remain readable so deployments can migrate without downtime.

## Configuration

Production defaults to `DATA_PROTECTION_MODE=required`. Configure a keyring before starting the application:

```env
DATA_PROTECTION_MODE=required
DATA_ENCRYPTION_KEYS=2026q3:<base64-encoded-32-byte-key>
```

Generate a key without printing it into shell history:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
```

Store the result directly in the deployment secret manager. Never commit it. Key IDs may contain letters, numbers, `_` and `-`.

Modes:

- `required`: writes and encrypted reads fail closed if the keyring is missing or invalid;
- `optional`: existing development behavior, encrypting when keys are configured;
- `disabled`: deterministic tests only.

## Key rotation

The first key is active for new writes. Retain older keys after it so existing envelopes remain readable:

```env
DATA_ENCRYPTION_KEYS=2026q4:<new-key>,2026q3:<previous-key>
```

1. Back up the database and private item-photo storage.
2. Deploy the expanded keyring.
3. Dry-run migration:

   ```bash
   npm run security:reencrypt
   ```

4. Apply migration during a controlled maintenance window:

   ```bash
   npm run security:reencrypt -- --apply
   ```

5. Verify the application and rerun the dry-run. Database fields using the active key should no longer be listed. The migration rewrites item photos with the active key.
6. Remove the previous key only after backups and every live environment have been verified.

Do not run migration concurrently with staff edits or photo uploads.

## Temporary login-disabled mode

Set `AUTH_DISABLED=true` only for the synthetic demonstration. The application then:

- redirects `/login` to the case workspace;
- records actions as `demo-staff`;
- hides every non-demo case at the data layer;
- marks newly created cases as demo records;
- blocks live provider scans by default to protect provider data and spend;
- displays a synthetic-data warning.

Re-enable login by removing the variable or setting it to `false`. `DEMO_AI_SCAN_ENABLED=true` is an explicit exception for approved synthetic demonstrations; leave it false otherwise. Do not add a separate route-level bypass.

## AI data minimisation

Image scanning sends selected item photos to configured providers because that is the explicit workflow. Staff must use staged or approved operational data according to the provider agreement.

Semantic search is local by default. `AI_SEARCH_ENABLED=true` opts into provider-assisted reranking. Provider requests omit claimant records, staff identities, OCR text and private matching details. The free-text query itself is sent when this mode is enabled, so staff must not enter contact details, identity numbers or other unnecessary personal data.

Provider failures suppress request, response and credential-bearing error details from application logs.

## HTTP and supply-chain controls

Every route receives CSP, frame, MIME-sniffing, referrer, permissions, cross-origin and HSTS headers. Sensitive JSON and item-photo responses use private `no-store` caching.

The security workflow uses least-privilege job permissions and SHA-pinned third-party actions. It runs secret-history scanning, dependency auditing, npm registry-signature verification, CodeQL analysis, pull-request dependency review and SBOM generation.

## Incident response

1. Disable affected provider or deployment credentials.
2. Re-enable login immediately if demo bypass is active.
3. Preserve audit records without copying protected values into chat or issue trackers.
4. Rotate database, Blob, session, provider and data-encryption credentials as applicable.
5. Determine whether encrypted item photos or protected database fields were exposed.
6. Restore from a verified backup and run the complete security, domain and browser gates before reopening access.
