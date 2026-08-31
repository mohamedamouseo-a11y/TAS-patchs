export const AUTOMOTIVE_VEHICLES_TABLE = "automotive_vehicles";

export const AUTOMOTIVE_VEHICLES_REQUIRED_BASE_COLUMNS = ["id", "brand", "model"] as const;

// Additive-only runtime columns required by server/automotiveCatalogCompat.ts.
// Existing columns are never altered by this hotfix.
export const AUTOMOTIVE_VEHICLES_ADDITIVE_COLUMNS: Record<string, string> = {
  brandId: "`brandId` int NULL",
  trim: "`trim` varchar(120) NULL",
  modelYear: "`modelYear` int NULL",
  nameAr: "`nameAr` varchar(255) NULL",
  nameEn: "`nameEn` varchar(255) NULL",
  descriptionAr: "`descriptionAr` text NULL",
  descriptionEn: "`descriptionEn` text NULL",
  bodyType: "`bodyType` varchar(80) NULL",
  engine: "`engine` varchar(255) NULL",
  transmission: "`transmission` varchar(120) NULL",
  fuelType: "`fuelType` varchar(120) NULL",
  driveType: "`driveType` varchar(120) NULL",
  seatingCapacity: "`seatingCapacity` int NULL",
  doorsCount: "`doorsCount` int NULL",
  colors: "`colors` json NULL",
  specs: "`specs` json NULL",
  faq: "`faq` json NULL",
  warrantyAr: "`warrantyAr` text NULL",
  warrantyEn: "`warrantyEn` text NULL",
  paymentTermsAr: "`paymentTermsAr` text NULL",
  paymentTermsEn: "`paymentTermsEn` text NULL",
  deliveryTermsAr: "`deliveryTermsAr` text NULL",
  deliveryTermsEn: "`deliveryTermsEn` text NULL",
  offerValidityDays: "`offerValidityDays` int NOT NULL DEFAULT 3",
  taxIncluded: "`taxIncluded` tinyint NOT NULL DEFAULT 1",
  taxRate: "`taxRate` decimal(5,2) NOT NULL DEFAULT 14.00",
  cashPrice: "`cashPrice` decimal(12,2) NULL",
  currency: "`currency` varchar(10) NOT NULL DEFAULT 'EGP'",
  availabilityStatus: "`availabilityStatus` varchar(32) NOT NULL DEFAULT 'available'",
  stockQuantity: "`stockQuantity` int NOT NULL DEFAULT 0",
  sku: "`sku` varchar(120) NULL",
  primaryImageStorageObjectId: "`primaryImageStorageObjectId` int NULL",
  sortOrder: "`sortOrder` int NOT NULL DEFAULT 0",
  isActive: "`isActive` tinyint NOT NULL DEFAULT 1",
  createdBy: "`createdBy` int NULL",
  updatedBy: "`updatedBy` int NULL",
  createdAt: "`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
  updatedAt: "`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
};

export const AUTOMOTIVE_VEHICLES_RUNTIME_COLUMNS = [
  ...AUTOMOTIVE_VEHICLES_REQUIRED_BASE_COLUMNS,
  ...Object.keys(AUTOMOTIVE_VEHICLES_ADDITIVE_COLUMNS),
];
