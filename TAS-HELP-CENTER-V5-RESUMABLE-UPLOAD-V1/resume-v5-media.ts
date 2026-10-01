import { config as dotenvConfig } from "dotenv";
import { access, copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq, like } from "drizzle-orm";
import { getDb } from "../server/db.js";
import { globalFileStorageObjects } from "../drizzle/schema.js";
import {
  retryStorageObjectNow,
  storagePutFile,
  storageResolvePath,
} from "../server/storage.js";
import { verifyPrimaryStorageObject } from "../server/services/GoogleDrivePrimaryStorageService.js";

dotenvConfig({ path: path.join(process.cwd(), ".env"), override: false });

type MediaRecord = {
  guide: string;
  language: "ar" | "en";
  step: number;
  filename: string;
  storageKey: string;
  url: string;
  sha256: string;
  bytes: number;
};

type StorageRow = typeof globalFileStorageObjects.$inferSelect;

const manifestPath = process.env.TAS_HELP_V5_MANIFEST || "";
const mediaRoot = process.env.TAS_HELP_V5_MEDIA_ROOT || "";
const startIndex = Math.max(0, Number(process.env.TAS_HELP_V5_START_INDEX || "0"));
const limit = Math.max(1, Number(process.env.TAS_HELP_V5_LIMIT || "8"));
const verifyOnly = process.env.TAS_HELP_V5_VERIFY_ONLY === "1";

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findRow(key: string): Promise<StorageRow | null> {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db
    .select()
    .from(globalFileStorageObjects)
    .where(and(
      eq(globalFileStorageObjects.storageKey, key),
      eq(globalFileStorageObjects.entityType, "help_center_media"),
      eq(globalFileStorageObjects.entityId, "service-v1"),
    ))
    .limit(1);
  return rows[0] || null;
}

async function driveVerified(row: StorageRow | null): Promise<boolean> {
  if (!row?.driveFileId) return false;
  try {
    return await verifyPrimaryStorageObject(row.driveFileId);
  } catch (error: any) {
    console.warn(`VERIFY_WARNING=${row.storageKey}:${error?.message || error}`);
    return false;
  }
}

async function uploadedAndVerified(row: StorageRow | null): Promise<boolean> {
  return Boolean(row && row.uploadStatus === "uploaded" && row.driveFileId && await driveVerified(row));
}

async function ensureUploaded(record: MediaRecord, index: number, stageRoot: string) {
  let row = await findRow(record.storageKey);

  if (await uploadedAndVerified(row)) {
    const localPath = storageResolvePath(record.storageKey);
    if (await exists(localPath) && row) {
      await retryStorageObjectNow(row.id).catch(() => undefined);
      row = await findRow(record.storageKey);
    }
    if (await uploadedAndVerified(row)) {
      console.log(`[${String(index + 1).padStart(2, "0")}/64] VERIFIED_SKIP ${record.storageKey}`);
      return "verified";
    }
  }

  if (row) {
    const localPath = storageResolvePath(record.storageKey);
    if (await exists(localPath)) {
      try {
        await retryStorageObjectNow(row.id);
      } catch (error: any) {
        console.warn(`RETRY_WARNING=${record.storageKey}:${error?.message || error}`);
      }
      row = await findRow(record.storageKey);
      if (await uploadedAndVerified(row)) {
        console.log(`[${String(index + 1).padStart(2, "0")}/64] RETRIED ${record.storageKey}`);
        return "retried";
      }
    }
  }

  const source = path.join(mediaRoot, record.language, record.filename);
  if (!(await exists(source))) throw new Error(`SOURCE_MISSING:${record.filename}`);

  const staged = path.join(stageRoot, `${index}-${record.filename}`);
  await copyFile(source, staged);

  const contentType = record.filename.toLowerCase().endsWith(".webp") ? "image/webp" : "image/png";
  const result = await storagePutFile(record.storageKey, staged, contentType, {
    ownerUserId: null,
    entityType: "help_center_media",
    entityId: "service-v1",
    accessScope: "authenticated",
    sha256: record.sha256,
  });

  row = await findRow(record.storageKey);
  if (result.uploadStatus !== "uploaded" || !(await uploadedAndVerified(row))) {
    if (row) {
      try {
        await retryStorageObjectNow(row.id);
      } catch (error: any) {
        console.warn(`POST_UPLOAD_RETRY_WARNING=${record.storageKey}:${error?.message || error}`);
      }
      row = await findRow(record.storageKey);
    }
  }

  if (!(await uploadedAndVerified(row))) {
    throw new Error(`NOT_VERIFIED:${record.storageKey}:status=${row?.uploadStatus || result.uploadStatus}`);
  }

  console.log(`[${String(index + 1).padStart(2, "0")}/64] UPLOADED ${record.storageKey}`);
  return "uploaded";
}

async function finalVerify(manifest: MediaRecord[]) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");

  const rows = await db
    .select()
    .from(globalFileStorageObjects)
    .where(like(globalFileStorageObjects.storageKey, "help-center/service/v1/%"));

  const expected = new Set(manifest.map((item) => item.storageKey));
  const current = rows.filter((row) => expected.has(row.storageKey) && !row.deletedAt);
  const byKey = new Map(current.map((row) => [row.storageKey, row]));

  let verified = 0;
  let localCopies = 0;
  let arRows = 0;
  let enRows = 0;
  let uploaded = 0;
  let pending = 0;
  let uploading = 0;
  let failed = 0;
  let withDrive = 0;

  for (const item of manifest) {
    const row = byKey.get(item.storageKey) || null;
    if (item.language === "ar") arRows += row ? 1 : 0;
    else enRows += row ? 1 : 0;
    if (row?.uploadStatus === "uploaded") uploaded += 1;
    if (row?.uploadStatus === "pending") pending += 1;
    if (row?.uploadStatus === "uploading") uploading += 1;
    if (row?.uploadStatus === "failed") failed += 1;
    if (row?.driveFileId) withDrive += 1;
    if (row?.driveFileId && await driveVerified(row)) verified += 1;
    if (await exists(storageResolvePath(item.storageKey))) localCopies += 1;
  }

  console.log(`TOTAL_ROWS=${current.length}`);
  console.log(`AR_ROWS=${arRows}`);
  console.log(`EN_ROWS=${enRows}`);
  console.log(`UPLOADED=${uploaded}`);
  console.log(`PENDING=${pending}`);
  console.log(`UPLOADING=${uploading}`);
  console.log(`FAILED=${failed}`);
  console.log(`WITH_DRIVE_ID=${withDrive}`);
  console.log(`WITHOUT_DRIVE_ID=${current.length - withDrive}`);
  console.log(`DRIVE_VERIFIED=${verified}`);
  console.log(`PERMANENT_SERVER_MEDIA=${localCopies}`);

  if (
    current.length !== 64 ||
    arRows !== 32 ||
    enRows !== 32 ||
    verified !== 64 ||
    localCopies !== 0
  ) {
    process.exitCode = 2;
  }
}

async function main() {
  if (!manifestPath || !mediaRoot) throw new Error("V5_MEDIA_ENV_MISSING");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as MediaRecord[];
  if (manifest.length !== 64) throw new Error(`EXPECTED_64_MANIFEST_RECORDS_GOT_${manifest.length}`);

  if (verifyOnly) {
    await finalVerify(manifest);
    return;
  }

  const selected = manifest.slice(startIndex, Math.min(startIndex + limit, manifest.length));
  if (!selected.length) throw new Error("EMPTY_BATCH");

  const stageRoot = await mkdtemp(path.join(os.tmpdir(), "tas-help-v5-resume-"));
  let verifiedSkipped = 0;
  let newlyUploaded = 0;
  let retriedUploaded = 0;
  let failures = 0;

  try {
    for (let offset = 0; offset < selected.length; offset += 1) {
      const absoluteIndex = startIndex + offset;
      try {
        const state = await ensureUploaded(selected[offset], absoluteIndex, stageRoot);
        if (state === "verified") verifiedSkipped += 1;
        else if (state === "retried") retriedUploaded += 1;
        else newlyUploaded += 1;
      } catch (error: any) {
        failures += 1;
        console.error(`[${String(absoluteIndex + 1).padStart(2, "0")}/64] FAILED ${selected[offset].storageKey} :: ${error?.message || error}`);
      }
    }
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }

  console.log(`BATCH_START=${startIndex}`);
  console.log(`BATCH_LIMIT=${selected.length}`);
  console.log(`VERIFIED_SKIPPED=${verifiedSkipped}`);
  console.log(`NEWLY_UPLOADED=${newlyUploaded}`);
  console.log(`RETRIED_UPLOADED=${retriedUploaded}`);
  console.log(`FAILED_UPLOADS=${failures}`);

  if (failures > 0) process.exitCode = 3;
}

main().catch((error) => {
  console.error(`ERROR=${error?.message || error}`);
  process.exit(1);
});
