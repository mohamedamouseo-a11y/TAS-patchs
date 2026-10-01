# TAS Storage Cleanup Lease Fix V1

Fixes the residual local-staging cleanup lease problem observed after the Help Center V5 media upload.

The previous DB-clock upload lease fix made all 64 Drive uploads durable, but local cleanup still required a forced filesystem cleanup.

This patch:
- keeps the existing upload lease architecture;
- requires TAS_STORAGE_DB_CLOCK_LEASE_FIX_V1;
- makes cleanup lease ownership use the MySQL/Drizzle database clock;
- makes cleanup lease acquisition use DATE_ADD(NOW(), INTERVAL 15 MINUTE);
- preserves generation/token checks;
- does not touch existing V5 media rows;
- validates the fix with a temporary Drive canary;
- requires the canary local copy to be absent after successful Drive upload;
- deletes the canary via the existing storageDelete flow.

Do not commit or push from OpenHands.
