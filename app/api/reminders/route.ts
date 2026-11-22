// GET  /api/reminders?profileId=… — reminders for one profile, earliest first.
// POST /api/reminders — add a reminder { profileId, title, remindAt, schemeSlug?, source }.
// source CUSTOM uses the date the user chose. VERIFIED_DEADLINE uses the scheme's recorded deadline only.

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/db";
import { firstIssue, jsonError, readJsonBody } from "../../../lib/api/shared";

const REMINDER_SELECT = {
  id: true,
  profileId: true,
  title: true,
  remindAt: true,
  source: true,
  done: true,
  createdAt: true,
  scheme: { select: { slug: true, name: true, shortName: true } },
} as const;

const getQuerySchema = z.object({
  profileId: z.string().min(1).max(64),
});

const dateField = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "remindAt must be a valid date and time.")
  .transform((value) => new Date(value));

const createSchema = z.strictObject({
  profileId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  remindAt: dateField,
  schemeSlug: z.string().trim().min(1).max(120).nullable().optional(),
  source: z.enum(["CUSTOM", "VERIFIED_DEADLINE"]),
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

    const reminders = await prisma.reminder.findMany({
      where: { profileId },
      select: REMINDER_SELECT,
      orderBy: { remindAt: "asc" },
    });

    return NextResponse.json({ reminders });
  } catch (err) {
    console.error("GET /api/reminders failed", err);
    return jsonError("Could not load your reminders. Please try again.", 500);
  }
}

export async function POST(req: Request) {
  await connection();
  try {
    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = createSchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { profileId, title, remindAt, schemeSlug, source } = parsed.data;

    const profile = await prisma.userProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return jsonError("Profile not found.", 404);

    let schemeId: string | null = null;
    let schemeDeadline: Date | null = null;
    if (schemeSlug) {
      const scheme = await prisma.scheme.findUnique({
        where: { slug: schemeSlug },
        select: { id: true, deadline: true },
      });
      if (!scheme) return jsonError("Scheme not found.", 404);
      schemeId = scheme.id;
      schemeDeadline = scheme.deadline;
    }

    if (source === "VERIFIED_DEADLINE") {
      if (!schemeId) return jsonError("Choose a scheme to use its verified deadline.", 400);
      if (!schemeDeadline) return jsonError("No verified deadline is recorded for this scheme.", 400);
      if (schemeDeadline.getTime() !== remindAt.getTime()) {
        return jsonError("A verified-deadline reminder must use the scheme's recorded deadline.", 400);
      }
    }

    const reminder = await prisma.reminder.create({
      data: { profileId, title, remindAt, source, schemeId, done: false },
      select: REMINDER_SELECT,
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (err) {
    console.error("POST /api/reminders failed", err);
    return jsonError("Could not save the reminder. Please try again.", 500);
  }
}
