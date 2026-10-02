# TAS After Sales Bay Availability V1

Minimal enhancement only. No duplicate booking system is created.

This patch reuses the existing `TASServiceScheduler` and places it inside:

`After Sales Service → Availability & Scheduler`

The page will show the existing Bay × Time board first, followed by the existing Availability Engine.

Visual clarification only:
- Empty timeline = Available
- Booking block = Booked

The existing scheduler data, Bay assignments, booking transactions, availability engine, and overbooking protection remain unchanged.

No backend logic.
No database change.
No new booking engine.
No Help Center change.
OpenHands must not commit or push.
