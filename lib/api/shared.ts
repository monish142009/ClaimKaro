// Shared helpers for ClaimKaro API route handlers. Server-side only.
// Keeps validation schemas, Prisma selects and error responses identical across routes.

import { NextResponse } from "next/server";
import { z } from "zod";

// Profile fields accepted from users. Unknown keys are rejected (.strict).
// No Aadhaar, PAN, bank, phone or OTP fields exist here, by design.
export const profileFieldsSchema = z.strictObject({
  displayName: z.string().trim().max(60).optional(),
  age: z.int().min(5).max(120).nullable().optional(),
  state: z.string().trim().max(60).nullable().optional(),
  educationLevel: z.string().trim().max(60).nullable().optional(),
  occupation: z.string().trim().max(60).nullable().optional(),
  annualIncome: z.int().min(0).max(100000000).nullable().optional(),
  category: z.string().trim().max(40).nullable().optional(),
});

// The UserProfile model has no category column yet, so category is accepted but not stored.
export const CATEGORY_NOT_STORED_NOTE =
  "category was accepted but is not stored on profiles yet. It is only used when you check eligibility with an inline profile.";

export const PROFILE_SELECT = {
  id: true,
  displayName: true,
  age: true,
  state: true,
  educationLevel: true,
  occupation: true,
  annualIncome: true,
  isGuest: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const SCHEME_PUBLIC_SELECT = {
  slug: true,
  name: true,
  shortName: true,
  department: true,
  level: true,
  state: true,
  beneficiaryGroup: true,
  description: true,
  benefitSummary: true,
  applicationUrl: true,
  officialSourceUrl: true,
  verificationStatus: true,
  lastVerifiedAt: true,
  deadline: true,
  deadlineNote: true,
  rules: {
    select: { id: true, key: true, label: true, ruleType: true, status: true },
  },
  evidence: {
    select: { id: true, sourceUrl: true, sourceTitle: true, quotedText: true, verifiedAt: true },
  },
} as const;

export function jsonError(message: string, status: 400 | 404 | 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request.";
}

export async function readJsonBody(req: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false };
  }
}

// Detects a Prisma known-request error code (for example P2002 unique violation) without
// importing Prisma error classes, so this stays independent of the Prisma runtime shape.
export function isPrismaCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === code;
}
