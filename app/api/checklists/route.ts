// GET  /api/checklists?profileId=…&schemeSlug=… — checklist items for one profile and scheme.
// POST /api/checklists — add a document { profileId, schemeSlug, documentName } with status PENDING.
// No document list is invented for any scheme; the user adds what they find on the official portal.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/db";
import { firstIssue, isPrismaCode, jsonError, readJsonBody } from "../../../lib/api/shared";

const EMPTY_NOTE =
  "No verified document list is recorded for this scheme yet. Add the documents you find on the official portal.";

const CHECKLIST_SELECT = {
  id: true,
  profileId: true,
  schemeId: true,
  documentName: true,
  status: true,
  updatedAt: true,
} as const;

const getQuerySchema = z.object({
  profileId: z.string().min(1).max(64),
  schemeSlug: z.string().min(1).max(120),
});

const createSchema = z.strictObject({
  profileId: z.string().min(1).max(64),
  schemeSlug: z.string().min(1).max(120),
  documentName: z.string().trim().min(1).max(120),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = getQuerySchema.safeParse({
      profileId: url.searchParams.get("profileId") ?? "",
      schemeSlug: url.searchParams.get("schemeSlug") ?? "",
    });
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { profileId, schemeSlug } = parsed.data;

    const [profile, scheme] = await Promise.all([
      prisma.userProfile.findUnique({ where: { id: profileId }, select: { id: true } }),
      prisma.scheme.findUnique({ where: { slug: schemeSlug }, select: { id: true } }),
    ]);
    if (!profile) return jsonError("Profile not found.", 404);
    if (!scheme) return jsonError("Scheme not found.", 404);

    const items = await prisma.checklistItem.findMany({
      where: { profileId, schemeId: scheme.id },
      select: CHECKLIST_SELECT,
      orderBy: { documentName: "asc" },
    });

    return NextResponse.json({ items, note: items.length === 0 ? EMPTY_NOTE : null });
  } catch (err) {
    console.error("GET /api/checklists failed", err);
    return jsonError("Could not load the checklist. Please try again.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = createSchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const { profileId, schemeSlug, documentName } = parsed.data;

    const [profile, scheme] = await Promise.all([
      prisma.userProfile.findUnique({ where: { id: profileId }, select: { id: true } }),
      prisma.scheme.findUnique({ where: { slug: schemeSlug }, select: { id: true } }),
    ]);
    if (!profile) return jsonError("Profile not found.", 404);
    if (!scheme) return jsonError("Scheme not found.", 404);

    try {
      const item = await prisma.checklistItem.create({
        data: { profileId, schemeId: scheme.id, documentName, status: "PENDING" },
        select: CHECKLIST_SELECT,
      });
      return NextResponse.json({ item }, { status: 201 });
    } catch (err) {
      // Unique key is (profileId, schemeId, documentName).
      if (isPrismaCode(err, "P2002")) {
        return jsonError("This document is already on the checklist for this scheme.", 400);
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /api/checklists failed", err);
    return jsonError("Could not add the document. Please try again.", 500);
  }
}
