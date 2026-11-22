// GET /api/schemes/[slug] — one scheme with its rules and evidence. Retired schemes are treated as not found.

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { SCHEME_PUBLIC_SELECT, jsonError } from "../../../../lib/api/shared";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    if (!slug || slug.length > 120) return jsonError("Scheme not found.", 404);

    const scheme = await prisma.scheme.findFirst({
      where: { slug, verificationStatus: { not: "RETIRED" } },
      select: SCHEME_PUBLIC_SELECT,
    });
    if (!scheme) return jsonError("Scheme not found.", 404);

    return NextResponse.json({ scheme });
  } catch (err) {
    console.error("GET /api/schemes/[slug] failed", err);
    return jsonError("Could not load the scheme. Please try again.", 500);
  }
}
