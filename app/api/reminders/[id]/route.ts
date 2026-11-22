// PATCH  /api/reminders/[id] — mark done or change the date of a CUSTOM reminder.
// DELETE /api/reminders/[id] — remove a reminder.

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { firstIssue, jsonError, readJsonBody } from "../../../../lib/api/shared";

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

const patchSchema = z
  .strictObject({
    done: z.boolean().optional(),
    remindAt: z
      .string()
      .trim()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), "remindAt must be a valid date and time.")
      .transform((value) => new Date(value))
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes were provided.");

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  await connection();
  try {
    const { id } = await ctx.params;
    if (!id || id.length > 64) return jsonError("Reminder not found.", 404);

    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = patchSchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { done, remindAt } = parsed.data;

    const existing = await prisma.reminder.findUnique({
      where: { id },
      select: { source: true },
    });
    if (!existing) return jsonError("Reminder not found.", 404);
    if (remindAt !== undefined && existing.source === "VERIFIED_DEADLINE") {
      return jsonError("A verified-deadline reminder keeps the scheme's recorded deadline.", 400);
    }

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        ...(done !== undefined ? { done } : {}),
        ...(remindAt !== undefined ? { remindAt } : {}),
      },
      select: REMINDER_SELECT,
    });

    return NextResponse.json({ reminder });
  } catch (err) {
    console.error("PATCH /api/reminders/[id] failed", err);
    return jsonError("Could not update the reminder. Please try again.", 500);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  await connection();
  try {
    const { id } = await ctx.params;
    if (!id || id.length > 64) return jsonError("Reminder not found.", 404);

    const result = await prisma.reminder.deleteMany({ where: { id } });
    if (result.count === 0) return jsonError("Reminder not found.", 404);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/reminders/[id] failed", err);
    return jsonError("Could not delete the reminder. Please try again.", 500);
  }
}
