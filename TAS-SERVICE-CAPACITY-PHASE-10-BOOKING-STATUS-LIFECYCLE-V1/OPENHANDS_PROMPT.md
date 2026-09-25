Run exactly this command:

curl -fsSL https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-SERVICE-CAPACITY-PHASE-10-BOOKING-STATUS-LIFECYCLE-V1/run.sh | bash

Return only the output.

STRICT:
- Do not stage anything.
- Do not commit anything.
- Do not push anything.
- Do not stash anything.
- Do not reset/checkout/restore Git files.
- Do not modify the deploy script or work around any guard.
- If the script exits with any error, stop immediately and return that exact output only.
