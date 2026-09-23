# TAS Service Capacity — Phase 1 Foundation Audit V1

Purpose: establish a production-safe baseline for the current TAS Service module before adding configurable branch scheduling, Bays, maintenance plans, and the new booking engine.

TAS master reference: `94e81d20ed53b03763daf144e1429813252cea83`

## Safety contract

This phase is READ-ONLY for production data and does not change TAS application behavior.

- No database writes.
- No migrations.
- No source edits.
- No deploy.
- No PM2 restart.
- No Git push.
- No customer PII in output.

The audit may run TypeScript with `--noEmit` and use a temporary log under `/tmp` only.

## Baseline being verified

Current TAS code already has:

- `tas_branches` with branch-level capacity and working-hour fields.
- `tas_service_types` with `durationMinutes` and `slotCapacity`.
- `tas_service_bookings` with branch/service/date/time/start/end/status fields.
- `getAvailableTASSlots()` in `server/tasDb.ts`.
- an automotive service API exposing available slots.

Current TAS Service UI still uses manual date/time inputs and does not manage physical Bays as first-class records.

## Required evidence

The audit reports:

- runtime/source location and git HEAD when available;
- whether runtime HEAD matches the approved TAS master reference;
- PM2 and local HTTP baseline when discoverable;
- TypeScript no-emit baseline;
- current Service source contracts;
- whether Bay or maintenance-plan entities already exist;
- production table/column presence for branches, service types, and bookings;
- branch/service/booking counts without PII;
- duration/capacity/slot ranges;
- missing start/end timestamps;
- orphan branch/service references;
- booking status distribution.

## Acceptance

Phase 1 is complete when the live source and schema baseline are captured with no production behavior change. Phase 2 Branch Scheduling Settings must be designed from this evidence, not assumptions.
