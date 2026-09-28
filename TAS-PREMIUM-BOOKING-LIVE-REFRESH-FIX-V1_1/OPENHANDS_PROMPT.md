Run exactly this command:

curl -fsSL https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-PREMIUM-BOOKING-LIVE-REFRESH-FIX-V1_1/run.sh | bash

Return only the output.

STRICT:
- Do not stage anything.
- Do not commit anything.
- Do not push anything.
- Do not stash anything.
- Do not reset/checkout/restore Git files.
- Do not modify the runner/deploy script or work around guards.
- If the script reports PREMIUM_BOOKING_LIVE_REFRESH=ALREADY_SATISFIED, stop successfully and do not force another patch.
- If the script exits with any error, stop immediately and return that exact output only.
