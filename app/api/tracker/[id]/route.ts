// PATCH  /api/tracker/[id] — update status, follow-up date or notes. A status change adds a TrackerEvent.
// DELETE /api/tracker/[id] — remove a tracked application (its events are removed with it).
// Statuses are entered by the user and are NOT verified against government systems.

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { firstIssue, jsonError, readJsonBody } from "../../../../lib/api/shared";

const APPLICATION_STATUSES = [
  "INTERESTED",
  "PREPARING_DOCUMENTS",
  "READY_TO_APPLY",
  "APPLIED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

const TRACKER_SELECT = {
  id: true,
  profileId: true,
  status: true,
  followUpDate: true,
  notes: true,
  statusUpdatedAt: true,
  createdAt: true,
  scheme: {
    select: {
      slug: true,
      name: true,
      shortName: true,
      department: true,
      applicationUrl: true,
      officialSourceUrl: true,
      deadline: true,
    },
  },
  events: {
    select: { id: true, fromStatus: true, toStatus: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
} as const;

const dateField = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "followUpDate must be a valid date.")
  .transform((value) => new Date(value));

const patchSchema = z
  .strictObject({
    status: z.enum(APPLICATION_STATUSES).optional(),
    followUpDate: dateField.nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes were provided.");

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  await connection();
  try {
    const { id } = await ctx.params;
    if (!id || id.length > 64) return jsonError("Application not found.", 404);

    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = patchSchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { status, followUpDate, notes } = parsed.data;

    const application = await prisma.$transaction(async (tx) => {
      const existing = await tx.trackedApplication.findUnique({ where: { id }, select: { status: true } });
      if (!existing) return null;

      const statusChanged = status !== undefined && status !== existing.status;

      return tx.trackedApplication.update({
        where: { id },
        data: {
          ...(followUpDate !== undefined ? { followUpDate } : {}),
          ...(notes !== undefined ? { notes: notes === "" ? null : notes } : {}),
          ...(statusChanged && status !== undefined
            ? {
                status,
                statusUpdatedAt: new Date(),
                events: { create: { fromStatus: existing.status, toStatus: status } },
              }
            : {}),
        },
        select: TRACKER_SELECT,
      });
    });

    if (!application) return jsonError("Application not found.", 404);
    return NextResponse.json({ application });
  } catch (err) {
    console.error("PATCH /api/tracker/[id] failed", err);
    return jsonError("Could not update the application. Please try again.", 500);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  await connection();
  try {
    const { id } = await ctx.params;
    if (!id || id.length > 64) return jsonError("Application not found.", 404);

    const result = await prisma.trackedApplication.deleteMany({ where: { id } });
    if (result.count === 0) return jsonError("Application not found.", 404);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tracker/[id] failed", err);
    return jsonError("Could not remove the application. Please try again.", 500);
  }
}
