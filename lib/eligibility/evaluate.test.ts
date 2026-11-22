import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateScheme } from "./evaluate";
import { interpretDescription } from "./interpret";
import type { ProfileInput, RuleInput } from "./types";

const VERIFIED = {
  sourceUrl: "https://scholarships.gov.in",
  sourceTitle: "Test source",
  verifiedAt: new Date("2025-01-01"),
};

function rule(
  overrides: Partial<RuleInput> & Pick<RuleInput, "key" | "ruleType" | "valueJson">,
): RuleInput {
  return {
    label: overrides.key,
    required: true,
    sensitive: false,
    status: "PUBLISHED",
    evidence: VERIFIED,
    ...overrides,
  };
}

const STUDENT: ProfileInput = {
  age: 19,
  state: "Telangana",
  educationLevel: "UG",
  occupation: "Student",
  annualIncome: 150000,
  category: null,
};

const STANDARD_RULES: RuleInput[] = [
  rule({ key: "age_min", ruleType: "NUMERIC_MIN", valueJson: "18" }),
  rule({ key: "state_is", ruleType: "EQUALS", valueJson: JSON.stringify("Telangana") }),
  rule({ key: "education_level_in", ruleType: "ONE_OF", valueJson: JSON.stringify(["Class 11-12", "UG", "PG"]) }),
  rule({ key: "income_max_annual", ruleType: "NUMERIC_MAX", valueJson: "250000" }),
];

test("likely eligible when all verifiable rules match", () => {
  const result = evaluateScheme(STUDENT, STANDARD_RULES, "test-scheme");
  assert.equal(result.verdict, "LIKELY_ELIGIBLE");
  assert.equal(result.headline, "Likely eligible based on the rules we can check");
  assert.equal(result.matched.length, 4);
  assert.equal(result.failed.length, 0);
  assert.equal(result.unverifiedBasis, false);
  assert.equal(result.schemeSlug, "test-scheme");
});

test("NOT_ELIGIBLE when a required numeric max is exceeded", () => {
  const result = evaluateScheme(
    { ...STUDENT, annualIncome: 900000 },
    STANDARD_RULES,
    "test-scheme",
  );
  assert.equal(result.verdict, "NOT_ELIGIBLE");
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].key, "income_max_annual");
});

test("MORE_INFO_NEEDED when age is null and an age rule is required", () => {
  const result = evaluateScheme({ ...STUDENT, age: null }, STANDARD_RULES, "test-scheme");
  assert.equal(result.verdict, "MORE_INFO_NEEDED");
  assert.ok(result.missing.some((o) => o.key === "age_min"));
});

test("INFO-only rules yield POSSIBLY_ELIGIBLE", () => {
  const rules = [
    rule({ key: "education_level_in", ruleType: "ONE_OF", valueJson: JSON.stringify(["UG", "PG"]) }),
    rule({ key: "income_max_annual", ruleType: "INFO_ONLY", valueJson: "null" }),
  ];
  const result = evaluateScheme(STUDENT, rules, "test-scheme");
  assert.equal(result.verdict, "POSSIBLY_ELIGIBLE");
  assert.equal(result.info.length, 1);
  assert.equal(result.info[0].outcome, "INFO");
});

test("unknown rule key yields NOT_EVALUATED", () => {
  const rules = [
    rule({ key: "mystery_rule", ruleType: "EQUALS", valueJson: JSON.stringify("x") }),
    rule({ key: "state_is", ruleType: "EQUALS", valueJson: JSON.stringify("Telangana") }),
  ];
  const result = evaluateScheme(STUDENT, rules, "test-scheme");
  const unknown = result.info.find((o) => o.key === "mystery_rule");
  assert.ok(unknown);
  assert.equal(unknown.outcome, "NOT_EVALUATED");
  assert.equal(unknown.detail, "This rule cannot be checked automatically yet");
  assert.equal(result.verdict, "POSSIBLY_ELIGIBLE");
});

test("invalid valueJson yields NOT_EVALUATED with invalid-definition detail", () => {
  const rules = [rule({ key: "age_min", ruleType: "NUMERIC_MIN", valueJson: "{not json" })];
  const result = evaluateScheme(STUDENT, rules, "test-scheme");
  const outcome = result.info.find((o) => o.key === "age_min");
  assert.ok(outcome);
  assert.equal(outcome.outcome, "NOT_EVALUATED");
  assert.equal(outcome.detail, "Rule definition is invalid");
});

test("headline never contains the word guaranteed", () => {
  const scenarios: Array<[ProfileInput, RuleInput[]]> = [
    [STUDENT, STANDARD_RULES],
    [{ ...STUDENT, annualIncome: 900000 }, STANDARD_RULES],
    [{ ...STUDENT, age: null }, STANDARD_RULES],
    [STUDENT, []],
  ];
  for (const [profile, rules] of scenarios) {
    const result = evaluateScheme(profile, rules, "test-scheme");
    assert.doesNotMatch(result.headline, /guaranteed/i);
    assert.doesNotMatch(result.disclaimer, /guaranteed/i);
  }
});

test("retired rules are ignored entirely", () => {
  const rules = [
    rule({ key: "state_is", ruleType: "EQUALS", valueJson: JSON.stringify("Telangana") }),
    rule({ key: "income_max_annual", ruleType: "NUMERIC_MAX", valueJson: "1000", status: "RETIRED" }),
  ];
  const result = evaluateScheme(STUDENT, rules, "test-scheme");
  assert.equal(result.verdict, "LIKELY_ELIGIBLE");
  const everything = [...result.matched, ...result.failed, ...result.missing, ...result.info];
  assert.ok(!everything.some((o) => o.key === "income_max_annual"));
});

test("draft rules set unverifiedBasis and are labelled DRAFT", () => {
  const rules = [
    rule({ key: "state_is", ruleType: "EQUALS", valueJson: JSON.stringify("Telangana"), status: "DRAFT" }),
  ];
  const result = evaluateScheme(STUDENT, rules, "test-scheme");
  assert.equal(result.unverifiedBasis, true);
  assert.equal(result.matched[0].basis, "DRAFT");
});

test("optional sensitive rule that is missing does not block", () => {
  const rules = [
    rule({ key: "education_level_in", ruleType: "ONE_OF", valueJson: JSON.stringify(["UG", "PG"]) }),
    rule({
      key: "category_in",
      ruleType: "ONE_OF",
      valueJson: JSON.stringify(["SC"]),
      required: false,
      sensitive: true,
    }),
  ];
  const result = evaluateScheme(STUDENT, rules, "test-scheme");
  assert.equal(result.verdict, "LIKELY_ELIGIBLE");
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].key, "category_in");
});

test("interpret extracts age, state, education and income from a plain description", () => {
  const { extracted, questions } = interpretDescription(
    "I'm 19 years old, studying B.Tech in Hyderabad, my family's annual income is ₹1.5 lakh",
  );
  assert.equal(extracted.age, 19);
  assert.equal(extracted.state, "Telangana");
  assert.equal(extracted.educationLevel, "UG");
  assert.equal(extracted.annualIncome, 150000);
  assert.deepEqual(questions, []);
});

test("interpret asks for what it could not extract and ignores sensitive IDs", () => {
  const { extracted, questions } = interpretDescription(
    "I am 20, my Aadhaar is 123456789012 and PAN is ABCDE1234F",
  );
  assert.deepEqual(extracted, { age: 20 });
  assert.ok(questions.includes("Which state do you live in?"));
  assert.ok(questions.includes("What is your family's approximate annual income in rupees?"));
  assert.ok(!questions.includes("What is your age?"));
});
