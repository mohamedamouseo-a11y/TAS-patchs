# TAS After Sales Service Menu V3

Transforms the existing standalone **After Sales Service** sidebar link into a professional collapsible parent menu immediately below **Sales**.

## Final submenu order

1. Overview
2. New Service Booking
3. Service Appointments
4. Availability & Scheduler
5. Maintenance Plans
6. Vehicle Mapping
7. Service Bays
8. Branch Scheduling

Arabic labels are included in the source.

## Page behavior

The previous long `/tas/service` page is split into focused routed views:

- `/tas/service` — Overview
- `/tas/service/book`
- `/tas/service/appointments`
- `/tas/service/availability`
- `/tas/service/maintenance-plans`
- `/tas/service/vehicle-mapping`
- `/tas/service/service-bays`
- `/tas/service/branch-scheduling`

The existing components and business logic are reused; this patch reorganizes navigation and presentation rather than rewriting service logic.

**Help Center is intentionally excluded from the After Sales Service submenu.**

No database migration.
No backend API change.
No booking-data mutation.
OpenHands must not commit or push.
