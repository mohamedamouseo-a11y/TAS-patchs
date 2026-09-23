# TAS Service Capacity — Phase 1 Foundation Audit V2

Read-only follow-up for Phase 1.

Why V2:
- V1 ran from an OpenHands shell whose git HEAD was `1514ab5e`, while remote TAS master is `94e81d20`.
- GitHub comparison proves the only changes between those commits are `client/src/lib/i18n.ts` and `server/services/waGatewayIntegrationService.ts`; no Service-module file changed.
- V1 did not inherit `DATABASE_URL`.

V2 resolves the actual PM2 runtime, compares the four Service foundation files against the approved TAS master blob hashes, then reads the database using the TAS PM2 environment without printing any secret.

Safety: read-only only. No code edits, DB writes, migrations, deploy, restart, or push.

Approved TAS master: `94e81d20ed53b03763daf144e1429813252cea83`

Approved Service blob hashes:
- `client/src/pages/tas/TASServicePage.tsx`: `d49a36fd465d378c3e35347434e10c08734c7ca3`
- `server/tasDb.ts`: `be8e66094937b864939715ed2ba3f27a1762b3a5`
- `server/routers.ts`: `30e250dadf08d2cc7388e0e366dbbd5af226f8d4`
- `shared/schema.ts`: `96e2f9ea52c0d90a9863adaae22b666410a7b416`

Acceptance:
- PM2 runtime resolved.
- All four runtime Service files match approved master blobs.
- DB connection succeeds through the TAS runtime environment.
- Existing Service tables/columns are present.
- No production mutation occurred.
