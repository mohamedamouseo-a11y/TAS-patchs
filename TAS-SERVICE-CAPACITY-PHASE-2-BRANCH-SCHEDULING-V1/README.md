# TAS Service Capacity — Phase 2 Branch Scheduling V1

Base TAS source: `1d4fe47fcf3bbe13dfb8be604060612ae709f609`.

## Scope

This phase adds the first production UI/settings layer for Service scheduling while preserving the current booking model.

### End-user behavior

Inside the existing TAS Service page, users can now manage real service branches and configure:

- branch name, city, address, phone;
- active/inactive state;
- working days;
- workday start/end with minute precision;
- first allowed booking start;
- last allowed booking start;
- slot interval: 15 / 30 / 45 / 60 minutes;
- end-of-day safety buffer.

The existing availability engine is evolved to respect those settings immediately.

### Important correction

When the production database is available and `tas_branches` is empty, TAS no longer substitutes demo Cairo/Giza/Alexandria branches. An empty database now means no configured branch, and the Service UI asks the user to create the first real branch.

### Not in this phase

Physical Bays are intentionally not introduced here. Bay entities and actual Bay allocation remain Phase 3.

## Source changes

- premium branch-scheduling settings component;
- branch create/update/list-all API support;
- minute-level branch scheduling fields;
- working-day support;
- availability-window/buffer enforcement;
- TAS/Automotive branch router parity;
- TAS Service `getAvailableSlots` parity;
- reversible schema migration + verify + rollback scripts.

## Safety

Deployment uses TAS atomic release infrastructure.
The database migration is additive and reversible during deployment rollback.
No branch/service/booking seed rows are inserted.
Existing bookings are untouched.
Existing legacy hour/capacity columns are preserved for compatibility.

## Expected final markers

```text
TAS_SERVICE_BRANCH_SCHEDULING_MIGRATION=PASS
TAS_SERVICE_BRANCH_SCHEDULING_VERIFY=PASS
DEPLOY=PASS
PM2=online
HTTP=200
BRANCH_SCHEDULING_SETTINGS=ACTIVE
DEMO_BRANCH_FALLBACK_WITH_DB=REMOVED
LEGACY_BOOKINGS=PRESERVED=YES
ERROR=NONE
```
