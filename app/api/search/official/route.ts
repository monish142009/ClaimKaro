// GET /api/search/official?q=… — official-source scheme search via Google Custom Search.
// Server-side only. Returns demo mode with no results when Google Search is not configured.

import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { firstIssue, jsonError } from "../../../../lib/api/shared";
import { searchOfficialSchemes } from "../../../../lib/google-search";

const querySchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export async function GET(req: Request) {
  await connection();
  try {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const parsed = querySchema.safeParse({ q });
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);

    const result = await searchOfficialSchemes(parsed.data.q);
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/search/official failed", err);
    return jsonError("Official search failed. Please try again.", 500);
  }
}
