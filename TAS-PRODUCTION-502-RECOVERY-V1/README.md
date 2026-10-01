# TAS Production 502 Recovery V1

Purpose: restore the existing TAS production PM2 process after it was intentionally stopped during Help Center media seeding and not restarted because the seeder timed out.

This patch:
- does not change TAS source;
- does not build;
- does not touch the database;
- does not touch Google Drive;
- does not resume V5 seeding;
- restarts the existing PM2 app named `TAS`;
- if the PM2 app is absent, starts the verified current runtime through `current/deploy/ecosystem.current.config.cjs`;
- verifies local port 3600 and public TAS URLs.

Run:

```bash
bash TAS-PRODUCTION-502-RECOVERY-V1/recover.sh
```

Do not commit or push from OpenHands.
