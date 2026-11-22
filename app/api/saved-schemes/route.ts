// GET    /api/saved-schemes?profileId=… — schemes saved by one profile.
// POST   /api/saved-schemes — save a scheme { profileId, schemeSlug }. Saving twice is harmless.
// DELETE /api/saved-schemes?profileId=…&schemeSlug=… — remove a saved scheme.

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/db";
import { firstIssue, jsonError, readJsonBody } from "../../../lib/api/shared";

const SAVED_SELECT = {
  id: true,
  profileId: true,
  createdAt: true,
  scheme: { select: { slug: true, name: true, shortName: true, department: true } },
} as const;

const profileQuerySchema = z.object({
  profileId: z.string().min(1).max(64),
});

const deleteQuerySchema = z.object({
  profileId: z.string().min(1).max(64),
  schemeSlug: z.string().min(1).max(120),
});

const createSchema = z.strictObject({
  profileId: z.string().min(1).max(64),
  schemeSlug: z.string().min(1).max(120),
});

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const parsed = profileQuerySchema.safeParse({ profileId: url.searchParams.get("profileId") ?? "" });
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { profileId } = parsed.data;

    const profile = await prisma.userProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return jsonError("Profile not found.", 404);

    const saved = await prisma.savedScheme.findMany({
      where: { profileId },
      select: SAVED_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ saved });
  } catch (err) {
    console.error("GET /api/saved-schemes failed", err);
    return jsonError("Could not load saved schemes. Please try again.", 500);
  }
}

export async function POST(req: Request) {
  await connection();
  try {
    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = createSchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { profileId, schemeSlug } = parsed.data;

    const [profile, scheme] = await Promise.all([
      prisma.userProfile.findUnique({ where: { id: profileId }, select: { id: true } }),
      prisma.scheme.findUnique({ where: { slug: schemeSlug }, select: { id: true } }),
    ]);
    if (!profile) return jsonError("Profile not found.", 404);
    if (!scheme) return jsonError("Scheme not found.", 404);

    const saved = await prisma.savedScheme.upsert({
      where: { profileId_schemeId: { profileId, schemeId: scheme.id } },
      create: { profileId, schemeId: scheme.id },
      update: {},
      select: SAVED_SELECT,
    });

    return NextResponse.json({ saved });
  } catch (err) {
    console.error("POST /api/saved-schemes failed", err);
    return jsonError("Could not save the scheme. Please try again.", 500);
  }
}

export async function DELETE(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const parsed = deleteQuerySchema.safeParse({
      profileId: url.searchParams.get("profileId") ?? "",
      schemeSlug: url.searchParams.get("schemeSlug") ?? "",
    });
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { profileId, schemeSlug } = parsed.data;

    const scheme = await prisma.scheme.findUnique({ where: { slug: schemeSlug }, select: { id: true } });
    if (!scheme) return jsonError("Scheme not found.", 404);

    const result = await prisma.savedScheme.deleteMany({ where: { profileId, schemeId: scheme.id } });
    if (result.count === 0) return jsonError("Saved scheme not found.", 404);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/saved-schemes failed", err);
    return jsonError("Could not remove the saved scheme. Please try again.", 500);
  }
}
