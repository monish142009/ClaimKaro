// Pure, deterministic rule evaluation for scheme eligibility. No network, no AI calls.
// Verdicts are "likely" checks against recorded rules; they are never approval decisions.

import type {
  EligibilityResult,
  OutcomeKind,
  ProfileInput,
  RuleInput,
  RuleOutcome,
  Verdict,
} from "./types";

export const ELIGIBILITY_DISCLAIMER =
  "This is a likely-eligibility check based on rules we have recorded. It is not a guarantee of approval; the government decides.";

export const VERDICT_HEADLINES: Record<Verdict, string> = {
  LIKELY_ELIGIBLE: "Likely eligible based on the rules we can check",
  POSSIBLY_ELIGIBLE: "Possibly eligible — some rules need checking on the official portal",
  MORE_INFO_NEEDED: "More information needed to check eligibility",
  NOT_ELIGIBLE: "Not eligible based on a documented rule",
};

// Explicit rule key -> profile field table, derived from the keys used in prisma/seed.ts
// (state_is, education_level_in, category_in, income_max_annual) plus common age/occupation keys.
// loan_eligibility and other INFO_ONLY rules need no mapping: they are always INFO.
const RULE_FIELD = new Map<string, keyof ProfileInput>([
  ["age_min", "age"],
  ["age_max", "age"],
  ["state_is", "state"],
  ["state_in", "state"],
  ["education_level_in", "educationLevel"],
  ["occupation_in", "occupation"],
  ["occupation_is", "occupation"],
  ["income_min_annual", "annualIncome"],
  ["income_max_annual", "annualIncome"],
  ["category_in", "category"],
  ["caste_in", "category"],
]);

const FIELD_LABEL: Record<keyof ProfileInput, string> = {
  age: "age",
  state: "state of residence",
  educationLevel: "education level",
  occupation: "occupation",
  annualIncome: "annual income",
  category: "category",
};

const INVALID_DEFINITION = "Rule definition is invalid";
const CANNOT_CHECK = "This rule cannot be checked automatically yet";
const INFO_TEXT = "Informational only. This does not decide eligibility; check the official guidelines.";

type Check = { outcome: OutcomeKind; detail: string };

type Entry = { rule: RuleInput; outcome: RuleOutcome };

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return !Number.isFinite(value);
  return false;
}

function missingCheck(rule: RuleInput, field: keyof ProfileInput): Check {
  const label = FIELD_LABEL[field];
  return rule.sensitive
    ? { outcome: "MISSING", detail: `Your ${label} is not in your profile. This is optional and does not block the result.` }
    : { outcome: "MISSING", detail: `Your ${label} is not in your profile yet, so this rule cannot be checked.` };
}

function evaluateParsed(rule: RuleInput, parsed: unknown, value: unknown, field: keyof ProfileInput): Check {
  const label = FIELD_LABEL[field];
  switch (rule.ruleType) {
    case "NUMERIC_MIN":
    case "NUMERIC_MAX": {
      if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
        return { outcome: "NOT_EVALUATED", detail: INVALID_DEFINITION };
      }
      if (isBlank(value)) return missingCheck(rule, field);
      if (typeof value !== "number") return { outcome: "NOT_EVALUATED", detail: INVALID_DEFINITION };
      const isMin = rule.ruleType === "NUMERIC_MIN";
      const ok = isMin ? value >= parsed : value <= parsed;
      const requirement = isMin ? `must be at least ${parsed}` : `must be at most ${parsed}`;
      return ok
        ? { outcome: "MATCH", detail: `Your ${label} (${value}) meets the rule: it ${requirement}.` }
        : { outcome: "NO_MATCH", detail: `Your ${label} (${value}) does not meet the rule: it ${requirement}.` };
    }
    case "ONE_OF": {
      if (!Array.isArray(parsed) || !parsed.every((x): x is string => typeof x === "string")) {
        return { outcome: "NOT_EVALUATED", detail: INVALID_DEFINITION };
      }
      if (isBlank(value)) return missingCheck(rule, field);
      if (typeof value !== "string") return { outcome: "NOT_EVALUATED", detail: INVALID_DEFINITION };
      const wanted = value.trim().toLowerCase();
      const accepted = parsed.join(", ");
      const ok = parsed.some((opt) => opt.trim().toLowerCase() === wanted);
      return ok
        ? { outcome: "MATCH", detail: `Your ${label} (${value}) is one of the accepted options: ${accepted}.` }
        : { outcome: "NO_MATCH", detail: `Your ${label} (${value}) is not one of the accepted options: ${accepted}.` };
    }
    case "EQUALS": {
      if (typeof parsed !== "string") return { outcome: "NOT_EVALUATED", detail: INVALID_DEFINITION };
      if (isBlank(value)) return missingCheck(rule, field);
      if (typeof value !== "string") return { outcome: "NOT_EVALUATED", detail: INVALID_DEFINITION };
      const ok = value.trim().toLowerCase() === parsed.trim().toLowerCase();
      return ok
        ? { outcome: "MATCH", detail: `Your ${label} (${value}) matches the required value: ${parsed}.` }
        : { outcome: "NO_MATCH", detail: `Your ${label} (${value}) does not match the required value: ${parsed}.` };
    }
    case "BOOLEAN": {
      if (typeof parsed !== "boolean") return { outcome: "NOT_EVALUATED", detail: INVALID_DEFINITION };
      return { outcome: "NOT_EVALUATED", detail: CANNOT_CHECK };
    }
    default:
      return { outcome: "NOT_EVALUATED", detail: CANNOT_CHECK };
  }
}

function evaluateRule(rule: RuleInput, profile: ProfileInput): Check {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rule.valueJson);
  } catch {
    return { outcome: "NOT_EVALUATED", detail: INVALID_DEFINITION };
  }
  if (rule.ruleType === "INFO_ONLY") {
    return { outcome: "INFO", detail: INFO_TEXT };
  }
  const field = RULE_FIELD.get(rule.key);
  if (field === undefined) {
    return { outcome: "NOT_EVALUATED", detail: CANNOT_CHECK };
  }
  return evaluateParsed(rule, parsed, profile[field], field);
}

function compareOutcomes(a: RuleOutcome, b: RuleOutcome): number {
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  if (a.label !== b.label) return a.label < b.label ? -1 : 1;
  return 0;
}

/**
 * Evaluates one scheme's rules against a profile.
 * RETIRED rules are ignored entirely.
 *
 * Verdict order:
 *  1. a required, non-sensitive rule is NO_MATCH          -> NOT_ELIGIBLE
 *  2. a required, non-sensitive rule is MISSING           -> MORE_INFO_NEEDED
 *  3. no rule was actually evaluated (MATCH/NO_MATCH)     -> MORE_INFO_NEEDED
 *  4. any INFO / NOT_EVALUATED / non-blocking NO_MATCH    -> POSSIBLY_ELIGIBLE
 *  5. otherwise                                           -> LIKELY_ELIGIBLE
 */
export function evaluateScheme(
  profile: ProfileInput,
  rules: RuleInput[],
  schemeSlug: string,
): EligibilityResult {
  const active = rules.filter((rule) => rule.status !== "RETIRED");

  const entries: Entry[] = active
    .map((rule): Entry => {
      const check = evaluateRule(rule, profile);
      return {
        rule,
        outcome: {
          key: rule.key,
          label: rule.label,
          ruleType: rule.ruleType,
          outcome: check.outcome,
          detail: check.detail,
          evidence: rule.evidence ?? null,
          basis: rule.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        },
      };
    })
    .sort((a, b) => compareOutcomes(a.outcome, b.outcome));

  const blocking = (e: Entry) => e.rule.required && !e.rule.sensitive;
  const outcomeOf = (e: Entry) => e.outcome.outcome;

  const evaluatedCount = entries.filter((e) => outcomeOf(e) === "MATCH" || outcomeOf(e) === "NO_MATCH").length;

  let verdict: Verdict;
  if (entries.some((e) => blocking(e) && outcomeOf(e) === "NO_MATCH")) {
    verdict = "NOT_ELIGIBLE";
  } else if (entries.some((e) => blocking(e) && outcomeOf(e) === "MISSING")) {
    verdict = "MORE_INFO_NEEDED";
  } else if (evaluatedCount === 0) {
    verdict = "MORE_INFO_NEEDED";
  } else if (entries.some((e) => {
    const o = outcomeOf(e);
    return o === "INFO" || o === "NOT_EVALUATED" || o === "NO_MATCH";
  })) {
    verdict = "POSSIBLY_ELIGIBLE";
  } else {
    verdict = "LIKELY_ELIGIBLE";
  }

  const outcomes = entries.map((e) => e.outcome);
  const unverifiedBasis = active.some(
    (rule) => rule.status === "DRAFT" || !rule.evidence || rule.evidence.verifiedAt === null,
  );

  return {
    schemeSlug,
    verdict,
    headline: VERDICT_HEADLINES[verdict],
    matched: outcomes.filter((o) => o.outcome === "MATCH"),
    failed: outcomes.filter((o) => o.outcome === "NO_MATCH"),
    missing: outcomes.filter((o) => o.outcome === "MISSING"),
    info: outcomes.filter((o) => o.outcome === "INFO" || o.outcome === "NOT_EVALUATED"),
    unverifiedBasis,
    disclaimer: ELIGIBILITY_DISCLAIMER,
  };
}
