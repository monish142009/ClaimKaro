// GET /api/schemes?q=  — list non-retired schemes with rules and evidence.
// Search is a case-insensitive contains match on name, shortName and description.
// Note: SQLite does not support Prisma's `mode: "insensitive"`; SQLite LIKE is ASCII case-insensitive, which covers the search fields used here.

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/db";
import { SCHEME_PUBLIC_SELECT, firstIssue, jsonError } from "../../../lib/api/shared";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
});

const LIST_NOTE =
  "Scheme details come from our recorded data. Only schemes marked VERIFIED have been checked against an official source; all others must be confirmed on the official portal before you apply.";

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({ q: url.searchParams.get("q") ?? undefined });
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);

    const q = parsed.data.q;
    const schemes = await prisma.scheme.findMany({
      where: {
        verificationStatus: { not: "RETIRED" },
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { shortName: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      select: SCHEME_PUBLIC_SELECT,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ schemes, note: LIST_NOTE });
  } catch (err) {
    console.error("GET /api/schemes failed", err);
    return jsonError("Could not load schemes. Please try again.", 500);
  }
}
