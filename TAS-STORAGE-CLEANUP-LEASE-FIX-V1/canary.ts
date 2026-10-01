import { config as dotenvConfig } from "dotenv";
import path from "node:path";
import { access } from "node:fs/promises";
import {
  storageDelete,
  storagePut,
  storageResolvePath,
} from "../server/storage.js";
import { verifyPrimaryStorageObject } from "../server/services/GoogleDrivePrimaryStorageService.js";

dotenvConfig({ path: path.join(process.cwd(), ".env"), override: false });

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const key = `help-center/cleanup-canary/${Date.now()}-cleanup-check.txt`;
  let driveFileId: string | null = null;
  try {
    const result = await storagePut(
      key,
      Buffer.from("TAS storage cleanup lease canary\n", "utf8"),
      "text/plain",
      {
        ownerUserId: null,
        entityType: "help_center_media_canary",
        entityId: "cleanup-v1",
        accessScope: "authenticated",
      },
    );

    driveFileId = result.driveFileId || null;
    const driveVerified = Boolean(driveFileId && await verifyPrimaryStorageObject(driveFileId));
    const localExists = await exists(storageResolvePath(key));

    console.log(`CANARY_UPLOAD_STATUS=${result.uploadStatus}`);
    console.log(`CANARY_DRIVE_ID=${driveFileId ? "YES" : "NO"}`);
    console.log(`CANARY_DRIVE_VERIFIED=${driveVerified ? "YES" : "NO"}`);
    console.log(`CANARY_LOCAL_COPY=${localExists ? "PRESENT" : "ABSENT"}`);

    if (result.uploadStatus !== "uploaded" || !driveVerified || localExists) {
      process.exitCode = 2;
      return;
    }
  } finally {
    await storageDelete(key).catch((error: any) => {
      console.error(`CANARY_DELETE_WARNING=${error?.message || error}`);
    });
  }
}

main().catch((error) => {
  console.error(`ERROR=${error?.message || error}`);
  process.exit(1);
});
