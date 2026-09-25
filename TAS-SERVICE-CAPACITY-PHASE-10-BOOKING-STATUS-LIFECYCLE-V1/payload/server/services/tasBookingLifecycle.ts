import { sql } from "drizzle-orm";
import { getDb } from "../db";

type BookingStatus =
  | "Pending"
  | "PendingConfirmation"
  | "Confirmed"
  | "Completed"
  | "Cancelled"
  | "NoShow";

type AnyRow = Record<string, any>;

const ALL_STATUSES = new Set<BookingStatus>([
  "Pending",
  "PendingConfirmation",
  "Confirmed",
  "Completed",
  "Cancelled",
  "NoShow",
]);

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Pending: ["PendingConfirmation", "Confirmed", "Cancelled"],
  PendingConfirmation: ["Confirmed", "Cancelled"],
  Confirmed: ["Completed", "Cancelled", "NoShow"],
  Completed: [],
  Cancelled: [],
  NoShow: [],
};

const REASON_REQUIRED = new Set<BookingStatus>(["Cancelled", "NoShow"]);

function normalizeStatus(value: unknown): BookingStatus {
  const status = String(value ?? "") as BookingStatus;
  if (!ALL_STATUSES.has(status)) throw new Error("Invalid booking status");
  return status;
}

function cleanReason(value: unknown) {
  const reason = String(value ?? "").trim();
  if (reason.length > 2000) throw new Error("Status reason is too long");
  return reason || null;
}

export function getTASBookingAllowedTransitions(statusValue: unknown) {
  const status = normalizeStatus(statusValue);
  return [...ALLOWED_TRANSITIONS[status]];
}

export async function getTASBookingLifecycle(bookingIdValue: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const bookingId = Number(bookingIdValue ?? 0);
  if (!Number.isInteger(bookingId) || bookingId <= 0) throw new Error("Valid bookingId is required");

  const bookingRows = await db.execute(sql`
    SELECT
      b.id,
      b.status,
      b.customerName,
      b.phone,
      b.startAt,
      b.endAt,
      b.preferredDate,
      b.preferredTime,
      b.branchId,
      b.bayId,
      st.name AS serviceTypeName,
      bay.name AS bayName,
      bay.code AS bayCode
    FROM tas_service_bookings b
    LEFT JOIN tas_service_types st ON st.id = b.serviceTypeId
    LEFT JOIN tas_service_bays bay ON bay.id = b.bayId
    WHERE b.id = ${bookingId}
    LIMIT 1
  `);
  const booking = ((bookingRows as any)[0] ?? [])[0] as AnyRow | undefined;
  if (!booking) throw new Error("Service booking not found");

  const currentStatus = normalizeStatus(booking.status);

  const historyRows = await db.execute(sql`
    SELECT
      h.id,
      h.bookingId,
      h.fromStatus,
      h.toStatus,
      h.reason,
      h.actorUserId,
      h.actorRole,
      h.source,
      h.createdAt,
      u.name AS actorName
    FROM tas_service_booking_status_history h
    LEFT JOIN users u ON u.id = h.actorUserId
    WHERE h.bookingId = ${bookingId}
    ORDER BY h.createdAt DESC, h.id DESC
    LIMIT 50
  `);

  return {
    booking: {
      ...booking,
      id: Number(booking.id),
      branchId: booking.branchId == null ? null : Number(booking.branchId),
      bayId: booking.bayId == null ? null : Number(booking.bayId),
      status: currentStatus,
    },
    allowedTransitions: getTASBookingAllowedTransitions(currentStatus),
    terminal: ALLOWED_TRANSITIONS[currentStatus].length === 0,
    history: ((historyRows as any)[0] ?? []).map((row: AnyRow) => ({
      ...row,
      id: Number(row.id),
      bookingId: Number(row.bookingId),
      actorUserId: row.actorUserId == null ? null : Number(row.actorUserId),
    })),
  };
}

export async function transitionTASBookingStatus(input: {
  bookingId: number;
  toStatus: string;
  reason?: string | null;
  actorUserId?: number | null;
  actorRole?: string | null;
  source?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const bookingId = Number(input.bookingId ?? 0);
  if (!Number.isInteger(bookingId) || bookingId <= 0) throw new Error("Valid bookingId is required");

  const toStatus = normalizeStatus(input.toStatus);
  const reason = cleanReason(input.reason);
  if (REASON_REQUIRED.has(toStatus) && !reason) {
    throw new Error(`Reason is required when marking a booking as ${toStatus}`);
  }

  const actorUserId = Number(input.actorUserId ?? 0);
  const normalizedActorUserId = Number.isInteger(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const actorRole = String(input.actorRole ?? "").trim().slice(0, 120) || null;
  const source = String(input.source ?? "ServiceUI").trim().slice(0, 80) || "ServiceUI";

  return db.transaction(async (tx) => {
    const bookingRows = await tx.execute(sql`
      SELECT id, status
      FROM tas_service_bookings
      WHERE id = ${bookingId}
      LIMIT 1
      FOR UPDATE
    `);
    const booking = ((bookingRows as any)[0] ?? [])[0] as AnyRow | undefined;
    if (!booking) throw new Error("Service booking not found");

    const fromStatus = normalizeStatus(booking.status);
    if (fromStatus === toStatus) {
      return {
        success: true,
        changed: false,
        bookingId,
        fromStatus,
        toStatus,
        allowedTransitions: getTASBookingAllowedTransitions(fromStatus),
      };
    }

    const allowed = ALLOWED_TRANSITIONS[fromStatus];
    if (!allowed.includes(toStatus)) {
      throw new Error(`Invalid booking status transition: ${fromStatus} -> ${toStatus}`);
    }

    await tx.execute(sql`
      UPDATE tas_service_bookings
      SET status = ${toStatus}
      WHERE id = ${bookingId}
    `);

    const historyResult = await tx.execute(sql`
      INSERT INTO tas_service_booking_status_history (
        bookingId,
        fromStatus,
        toStatus,
        reason,
        actorUserId,
        actorRole,
        source,
        createdAt
      ) VALUES (
        ${bookingId},
        ${fromStatus},
        ${toStatus},
        ${reason},
        ${normalizedActorUserId},
        ${actorRole},
        ${source},
        NOW()
      )
    `);

    return {
      success: true,
      changed: true,
      historyId: Number((historyResult as any)[0]?.insertId ?? 0),
      bookingId,
      fromStatus,
      toStatus,
      reason,
      allowedTransitions: getTASBookingAllowedTransitions(toStatus),
      terminal: ALLOWED_TRANSITIONS[toStatus].length === 0,
    };
  });
}
