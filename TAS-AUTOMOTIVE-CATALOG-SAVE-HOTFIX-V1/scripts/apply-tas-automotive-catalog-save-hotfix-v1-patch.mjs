#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(scriptDir, "..");
const filesRoot = path.join(patchRoot, "files");
const targetIndex = process.argv.indexOf("--target");
const targetRoot = path.resolve(targetIndex >= 0 ? process.argv[targetIndex + 1] : process.cwd());

const catalogPage = path.join(targetRoot, "client", "src", "pages", "automotive", "VehicleCatalogPage.tsx");
const compatFile = path.join(targetRoot, "server", "automotiveCatalogCompat.ts");
if (!fs.existsSync(catalogPage) || !fs.existsSync(compatFile)) {
  throw new Error(`Invalid TAS automotive target: ${targetRoot}`);
}

const payload = [
  "scripts/tas-automotive-catalog-schema-v1-spec.ts",
  "scripts/apply-tas-automotive-catalog-schema-v1.ts",
  "scripts/verify-tas-automotive-catalog-schema-v1.ts",
];

for (const relative of payload) {
  const source = path.join(filesRoot, relative);
  const target = path.join(targetRoot, relative);
  if (!fs.existsSync(source)) throw new Error(`Missing patch payload: ${relative}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`[TAS Automotive Catalog Save Hotfix V1] copied ${relative}`);
}

const source = fs.readFileSync(catalogPage, "utf8");
const oldBlock = `    } catch (error: any) {\n      toast.error(error?.message || (isRTL ? "فشل حفظ السيارة" : "Failed to save vehicle"));\n    }`;
const newBlock = `    } catch (error: any) {\n      console.error("[VehicleCatalog] save failed", error);\n      toast.error(isRTL ? "تعذر حفظ السيارة. يرجى المحاولة مرة أخرى." : "Unable to save vehicle. Please try again.");\n    }`;

if (source.includes(newBlock)) {
  console.log("[TAS Automotive Catalog Save Hotfix V1] catalog error sanitization already applied");
} else if (source.includes(oldBlock)) {
  fs.writeFileSync(catalogPage, source.replace(oldBlock, newBlock));
  console.log("[TAS Automotive Catalog Save Hotfix V1] sanitized vehicle save error shown to users");
} else {
  throw new Error("VehicleCatalogPage save error block no longer matches the expected TAS baseline; refusing a blind edit");
}

console.log("TAS_AUTOMOTIVE_CATALOG_SAVE_PATCH_APPLY=PASS");
