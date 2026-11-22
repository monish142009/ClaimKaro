// POST /api/eligibility — rule-based likely-eligibility check.
// Body: { profileId?: string, profile?: {…inline profile fields}, schemeSlugs?: string[] (max 20) }
// Uses the stored profile when profileId is given, otherwise the inline profile.
// Results are sorted: LIKELY_ELIGIBLE, POSSIBLY_ELIGIBLE, MORE_INFO_NEEDED, NOT_ELIGIBLE.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/db";
import {
  firstIssue,
  jsonError,
  profileFieldsSchema,
  readJsonBody,
} from "../../../lib/api/shared";
import { evaluateScheme } from "../../../lib/eligibility/evaluate";
import type { EligibilityResult, ProfileInput, RuleInput, Verdict } from "../../../lib/eligibility/types";

const bodySchema = z
  .strictObject({
    profileId: z.string().min(1).max(64).optional(),
    profile: profileFieldsSchema.optional(),
    schemeSlugs: z.array(z.string().min(1).max(120)).max(20).optional(),
  })
  .refine((b) => !(b.profileId !== undefined && b.profile !== undefined), {
    message: "Send either profileId or an inline profile, not both.",
  });

const VERDICT_ORDER: Record<Verdict, number> = {
  LIKELY_ELIGIBLE: 0,
  POSSIBLY_ELIGIBLE: 1,
  MORE_INFO_NEEDED: 2,
  NOT_ELIGIBLE: 3,
};

export async function POST(req: Request) {
  try {
    const raw = await readJsonBody(req);
    if (!raw.ok) return jsonError("Request body must be valid JSON.", 400);

    const parsed = bodySchema.safeParse(raw.body);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    const body = parsed.data;

    let input: ProfileInput;
    if (body.profileId !== undefined) {
      const row = await prisma.userProfile.findUnique({
        where: { id: body.profileId },
        select: { age: true, state: true, educationLevel: true, occupation: true, annualIncome: true },
      });
      if (!row) return jsonError("Profile not found.", 404);
      // UserProfile has no category column, so category is null for stored profiles.
      input = {
        age: row.age,
        state: row.state,
        educationLevel: row.educationLevel,
        occupation: row.occupation,
        annualIncome: row.annualIncome,
        category: null,
      };
    } else {
      input = {
        age: body.profile?.age ?? null,
        state: body.profile?.state ?? null,
        educationLevel: body.profile?.educationLevel ?? null,
        occupation: body.profile?.occupation ?? null,
        annualIncome: body.profile?.annualIncome ?? null,
        category: body.profile?.category ?? null,
      };
    }

    const slugs = body.schemeSlugs;
    const schemes = await prisma.scheme.findMany({
      where: {
        verificationStatus: { not: "RETIRED" },
        ...(slugs && slugs.length > 0 ? { slug: { in: slugs } } : {}),
      },
      select: {
        slug: true,
        rules: {
          select: {
            key: true,
            label: true,
            ruleType: true,
            valueJson: true,
            required: true,
            sensitive: true,
            status: true,
            evidence: { select: { sourceUrl: true, sourceTitle: true, verifiedAt: true } },
          },
        },
      },
    });

    const results: EligibilityResult[] = schemes
      .map((scheme) => {
        const rules: RuleInput[] = scheme.rules.map((rule) => ({
          key: rule.key,
          label: rule.label,
          ruleType: rule.ruleType,
          valueJson: rule.valueJson,
          required: rule.required,
          sensitive: rule.sensitive,
          status: rule.status,
          evidence: rule.evidence
            ? {
                sourceUrl: rule.evidence.sourceUrl,
                sourceTitle: rule.evidence.sourceTitle,
                verifiedAt: rule.evidence.verifiedAt,
              }
            : null,
        }));
        return evaluateScheme(input, rules, scheme.slug);
      })
      .sort(
        (a, b) =>
          VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || a.schemeSlug.localeCompare(b.schemeSlug),
      );

    return NextResponse.json({ results });
  } catch (err) {
    console.error("POST /api/eligibility failed", err);
    return jsonError("Could not check eligibility. Please try again.", 500);
  }
}
