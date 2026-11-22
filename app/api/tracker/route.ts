// GET  /api/tracker?profileId=… — tracked applications for one profile, with their status events.
// POST /api/tracker — track a scheme { profileId, schemeSlug, status?, followUpDate?, notes? }.
// Statuses are entered by the user and are NOT verified against government systems.

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/db";
import { firstIssue, isPrismaCode, jsonError, readJsonBody } from "../../../lib/api/shared";

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

const getQuerySchema = z.object({
  profileId: z.string().min(1).max(64),
});

const dateField = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "followUpDate must be a valid date.")
  .transform((value) => new Date(value));

const createSchema = z.strictObject({
  profileId: z.string().min(1).max(64),
  schemeSlug: z.string().min(1).max(120),
  status: z.enum(APPLICATION_STATUSES).optional(),
  followUpDate: dateField.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const parsed = getQuerySchema.safeParse({ profileId: url.searchParams.get("profileId") ?? "" });
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { profileId } = parsed.data;

    const profile = await prisma.userProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return jsonError("Profile not found.", 404);

    // TrackedApplication has no updatedAt column, so the list is ordered by the last status change.
    const applications = await prisma.trackedApplication.findMany({
      where: { profileId },
      select: TRACKER_SELECT,
      orderBy: [{ statusUpdatedAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("GET /api/tracker failed", err);
    return jsonError("Could not load your applications. Please try again.", 500);
  }
}

export async function POST(req: Request) {
  await connection();
  try {
    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = createSchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { profileId, schemeSlug, status, followUpDate, notes } = parsed.data;

    const [profile, scheme] = await Promise.all([
      prisma.userProfile.findUnique({ where: { id: profileId }, select: { id: true } }),
      prisma.scheme.findUnique({ where: { slug: schemeSlug }, select: { id: true } }),
    ]);
    if (!profile) return jsonError("Profile not found.", 404);
    if (!scheme) return jsonError("Scheme not found.", 404);

    const key = { profileId_schemeId: { profileId, schemeId: scheme.id } };

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.trackedApplication.findUnique({ where: key, select: { status: true } });
        const previous = existing?.status ?? null;
        const nextStatus = status ?? previous ?? "INTERESTED";

        const application = await tx.trackedApplication.upsert({
          where: key,
          create: {
            profileId,
            schemeId: scheme.id,
            status: nextStatus,
            followUpDate: followUpDate ?? null,
            notes: notes === undefined || notes === "" ? null : notes,
            events: { create: { fromStatus: null, toStatus: nextStatus } },
          },
          update: {
            ...(followUpDate !== undefined ? { followUpDate } : {}),
            ...(notes !== undefined ? { notes: notes === "" ? null : notes } : {}),
            ...(previous !== null && previous !== nextStatus
              ? {
                  status: nextStatus,
                  statusUpdatedAt: new Date(),
                  events: { create: { fromStatus: previous, toStatus: nextStatus } },
                }
              : {}),
          },
          select: TRACKER_SELECT,
        });
        return { application, created: existing === null };
      });

      return NextResponse.json({ application: result.application }, { status: result.created ? 201 : 200 });
    } catch (err) {
      // A concurrent request may have created the same row first.
      if (isPrismaCode(err, "P2002")) {
        return jsonError("This scheme is already in your tracker. Please try again.", 400);
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /api/tracker failed", err);
    return jsonError("Could not save to your tracker. Please try again.", 500);
  }
}
