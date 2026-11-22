// Types for the rule-based eligibility engine. Pure TypeScript, no runtime dependencies.

export type ProfileInput = {
  age: number | null;
  state: string | null;
  educationLevel: string | null;
  occupation: string | null;
  annualIncome: number | null;
  category: string | null;
};

export type RuleType =
  | "NUMERIC_MIN"
  | "NUMERIC_MAX"
  | "ONE_OF"
  | "EQUALS"
  | "BOOLEAN"
  | "INFO_ONLY";

export type RuleStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export type RuleEvidence = {
  sourceUrl: string;
  sourceTitle: string;
  verifiedAt: Date | null;
};

export type RuleInput = {
  key: string;
  label: string;
  ruleType: RuleType;
  valueJson: string;
  required: boolean;
  sensitive: boolean;
  status: RuleStatus;
  evidence: RuleEvidence | null;
};

export type Verdict =
  | "LIKELY_ELIGIBLE"
  | "POSSIBLY_ELIGIBLE"
  | "MORE_INFO_NEEDED"
  | "NOT_ELIGIBLE";

export type OutcomeKind = "MATCH" | "NO_MATCH" | "MISSING" | "INFO" | "NOT_EVALUATED";

export type RuleOutcome = {
  key: string;
  label: string;
  ruleType: RuleType;
  outcome: OutcomeKind;
  detail: string;
  evidence: RuleEvidence | null;
  basis: "PUBLISHED" | "DRAFT";
};

export type EligibilityResult = {
  schemeSlug: string;
  verdict: Verdict;
  headline: string;
  matched: RuleOutcome[];
  failed: RuleOutcome[];
  missing: RuleOutcome[];
  info: RuleOutcome[];
  unverifiedBasis: boolean;
  disclaimer: string;
};
