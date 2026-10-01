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

function log(message: string) {
  process.stdout.write(message + "\n");
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function withTimeout<T>(label: string, ms: number, promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT_${ms}MS`)), ms);
        (timer as any).unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main() {
  const key = `help-center/cleanup-canary/${Date.now()}-cleanup-check.txt`;
  log(`CANARY_KEY=${key}`);
  log("CANARY_STAGE=UPLOAD_START");

  let result: Awaited<ReturnType<typeof storagePut>>;
  try {
    result = await withTimeout(
      "STORAGE_PUT",
      Number(process.env.TAS_CLEANUP_CANARY_UPLOAD_TIMEOUT_MS || 180000),
      storagePut(
        key,
        Buffer.from("TAS storage cleanup lease canary\n", "utf8"),
        "text/plain",
        {
          ownerUserId: null,
          entityType: "help_center_media_canary",
          entityId: "cleanup-v2",
          accessScope: "authenticated",
        },
      ),
    );
  } catch (error: any) {
    log(`CANARY_STAGE=UPLOAD_FAIL`);
    log(`CANARY_ERROR=${error?.message || error}`);
    process.exitCode = 2;
    return;
  }

  log(`CANARY_STAGE=UPLOAD_DONE`);
  log(`CANARY_UPLOAD_STATUS=${result.uploadStatus}`);
  log(`CANARY_DRIVE_ID=${result.driveFileId ? "YES" : "NO"}`);

  let driveVerified = false;
  if (result.driveFileId) {
    log("CANARY_STAGE=VERIFY_START");
    try {
      driveVerified = await withTimeout(
        "DRIVE_VERIFY",
        Number(process.env.TAS_CLEANUP_CANARY_VERIFY_TIMEOUT_MS || 60000),
        verifyPrimaryStorageObject(result.driveFileId),
      );
    } catch (error: any) {
      log(`CANARY_VERIFY_ERROR=${error?.message || error}`);
    }
    log(`CANARY_STAGE=VERIFY_DONE`);
  }

  const localExists = await exists(storageResolvePath(key));
  log(`CANARY_DRIVE_VERIFIED=${driveVerified ? "YES" : "NO"}`);
  log(`CANARY_LOCAL_COPY=${localExists ? "PRESENT" : "ABSENT"}`);

  // Cleanup is bounded and is never allowed to hide the primary canary result.
  log("CANARY_STAGE=DELETE_START");
  try {
    await withTimeout(
      "STORAGE_DELETE",
      Number(process.env.TAS_CLEANUP_CANARY_DELETE_TIMEOUT_MS || 60000),
      storageDelete(key),
    );
    log("CANARY_DELETE=PASS");
  } catch (error: any) {
    log(`CANARY_DELETE=WARNING:${error?.message || error}`);
  }

  if (result.uploadStatus !== "uploaded" || !driveVerified || localExists) {
    process.exitCode = 3;
  }
}

main().catch((error) => {
  log(`ERROR=${error?.message || error}`);
  process.exit(1);
});
