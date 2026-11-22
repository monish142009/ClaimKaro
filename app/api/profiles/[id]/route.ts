// GET    /api/profiles/[id] — fetch one profile.
// PATCH  /api/profiles/[id] — partial update (same fields as create).
// DELETE /api/profiles/[id] — delete the profile; related checklist items cascade.

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import {
  CATEGORY_NOT_STORED_NOTE,
  PROFILE_SELECT,
  firstIssue,
  jsonError,
  profileFieldsSchema,
  readJsonBody,
} from "../../../../lib/api/shared";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "Profile not found.";

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const profile = await prisma.userProfile.findUnique({ where: { id }, select: PROFILE_SELECT });
    if (!profile) return jsonError(NOT_FOUND, 404);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("GET /api/profiles/[id] failed", err);
    return jsonError("Could not load the profile. Please try again.", 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = profileFieldsSchema.partial().safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    if (Object.keys(parsed.data).length === 0) return jsonError("Send at least one field to update.", 400);

    const existing = await prisma.userProfile.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError(NOT_FOUND, 404);

    const { category, ...data } = parsed.data;
    const profile = await prisma.userProfile.update({
      where: { id },
      data,
      select: PROFILE_SELECT,
    });

    return NextResponse.json({
      profile,
      ...(category !== undefined ? { note: CATEGORY_NOT_STORED_NOTE } : {}),
    });
  } catch (err) {
    console.error("PATCH /api/profiles/[id] failed", err);
    return jsonError("Could not update the profile. Please try again.", 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.userProfile.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError(NOT_FOUND, 404);

    await prisma.userProfile.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /api/profiles/[id] failed", err);
    return jsonError("Could not delete the profile. Please try again.", 500);
  }
}
