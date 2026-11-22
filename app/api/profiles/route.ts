// POST /api/profiles — create a guest profile.
// GET  /api/profiles?id=… — fetch one profile.

import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import {
  CATEGORY_NOT_STORED_NOTE,
  PROFILE_SELECT,
  firstIssue,
  jsonError,
  profileFieldsSchema,
  readJsonBody,
} from "../../../lib/api/shared";

export async function POST(req: Request) {
  try {
    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = profileFieldsSchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);

    const { category, ...data } = parsed.data;
    const profile = await prisma.userProfile.create({
      data: { ...data, isGuest: true },
      select: PROFILE_SELECT,
    });

    return NextResponse.json(
      { profile, ...(category !== undefined ? { note: CATEGORY_NOT_STORED_NOTE } : {}) },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/profiles failed", err);
    return jsonError("Could not create the profile. Please try again.", 500);
  }
}

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("Query parameter id is required.", 400);
    if (id.length > 64) return jsonError("Profile not found.", 404);

    const profile = await prisma.userProfile.findUnique({
      where: { id },
      select: PROFILE_SELECT,
    });
    if (!profile) return jsonError("Profile not found.", 404);

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("GET /api/profiles failed", err);
    return jsonError("Could not load the profile. Please try again.", 500);
  }
}
