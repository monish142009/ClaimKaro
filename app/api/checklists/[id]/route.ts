// PATCH  /api/checklists/[id] — set status to PENDING or DONE.
// DELETE /api/checklists/[id] — remove the checklist item.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { firstIssue, jsonError, readJsonBody } from "../../../../lib/api/shared";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "Checklist item not found.";

const patchSchema = z.strictObject({
  status: z.enum(["PENDING", "DONE"]),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = patchSchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);

    const existing = await prisma.checklistItem.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError(NOT_FOUND, 404);

    const item = await prisma.checklistItem.update({
      where: { id },
      data: { status: parsed.data.status },
      select: {
        id: true,
        profileId: true,
        schemeId: true,
        documentName: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ item });
  } catch (err) {
    console.error("PATCH /api/checklists/[id] failed", err);
    return jsonError("Could not update the checklist item. Please try again.", 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    const existing = await prisma.checklistItem.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError(NOT_FOUND, 404);

    await prisma.checklistItem.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /api/checklists/[id] failed", err);
    return jsonError("Could not delete the checklist item. Please try again.", 500);
  }
}
