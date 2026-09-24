import "dotenv/config";
import { getAvailableTASSlots, getTASBranches, getTASServiceTypes } from "../server/tasDb";

async function main() {
  const branches = await getTASBranches();
  const services = await getTASServiceTypes();
  const branch = branches.find((row: any) => Number(row.isActive) === 1) ?? branches[0];
  const service = services.find((row: any) => Number(row.isActive) === 1) ?? services[0];

  if (!branch) throw new Error("No service branch available for runtime verification");
  if (!service) throw new Error("No service type available for runtime verification");

  let checkedSlots: any[] = [];
  let checkedDate = "";

  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    const slots = await getAvailableTASSlots({
      day,
      branchId: Number(branch.id),
      serviceTypeId: Number(service.id),
    });
    if (slots.length) {
      checkedSlots = slots;
      checkedDate = day.toISOString().slice(0, 10);
      break;
    }
  }

  if (!checkedSlots.length) throw new Error("Availability V2 returned no verifiable slots in the next 8 days");

  for (const slot of checkedSlots) {
    if (Number(slot.engineVersion) !== 2) throw new Error("Slot missing engineVersion=2");
    if (!["service_bays", "legacy_capacity"].includes(String(slot.capacitySource))) {
      throw new Error("Invalid capacitySource");
    }
    if (!Number.isFinite(Number(slot.availableCapacity)) || Number(slot.availableCapacity) < 0) {
      throw new Error("Invalid availableCapacity");
    }
    if (!Number.isFinite(Number(slot.reservedCount)) || Number(slot.reservedCount) < 0) {
      throw new Error("Invalid reservedCount");
    }
    if (!Array.isArray(slot.assignedOccupiedBayIds) || !Array.isArray(slot.freeBayIds)) {
      throw new Error("Missing Bay diagnostics arrays");
    }
  }

  console.log("TAS_AVAILABILITY_ENGINE_V2_RUNTIME_VERIFY=PASS");
  console.log("BRANCH_ID=" + Number(branch.id));
  console.log("SERVICE_TYPE_ID=" + Number(service.id));
  console.log("CHECKED_DATE=" + checkedDate);
  console.log("SLOTS_CHECKED=" + checkedSlots.length);
  console.log("CAPACITY_SOURCE=" + String(checkedSlots[0]?.capacitySource ?? ""));
  console.log("ERROR=NONE");
}

main().catch((error) => {
  console.error("TAS_AVAILABILITY_ENGINE_V2_RUNTIME_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
