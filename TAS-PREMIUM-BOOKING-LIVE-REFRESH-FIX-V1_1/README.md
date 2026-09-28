# TAS Premium Booking Live Refresh Fix V1.1

Cache/source-safe retry of the Premium Booking live refresh UAT fix.

V1 failed because the target source no longer matched the old "no utils" anchor. Another TAS patch,
`TAS-SERVICE-LIVE-QUERY-INVALIDATION-FIX-V1`, implements the same four invalidations, so V1.1 first
detects equivalent behavior and does not duplicate it.

Required behavior after a successful Premium Booking:
- invalidate `tas.service.listAppointments`
- invalidate `tas.service.getScheduler`
- invalidate `tas.service.getAvailableSlots`
- invalidate `tas.service.getPartsPreparationBoard`
- preserve `onCreated`
- preserve form reset

If all behavior is already present, deployment exits successfully with:
`PREMIUM_BOOKING_LIVE_REFRESH=ALREADY_SATISFIED`.

Otherwise V1.1 adds the missing behavior only.

No schema/data mutation. No stage/commit/push/stash/reset.
